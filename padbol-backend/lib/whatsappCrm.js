// CRM de WhatsApp · servicio de lectura y ESCRITURA de la bandeja de contactos.
//
// Alcance inicial: sólo el superadministrador lee y escribe. La delegación por operador y
// sede queda PREPARADA (el alcance se resuelve por rol y sede) pero NO abierta.
//
// Cada escritura corre en una transacción: valida, actualiza la ficha, inserta el evento
// en la línea de tiempo con actor y detalle, y devuelve la ficha actualizada. Si algo
// falla, la transacción se revierte por completo.
//
// CONSENTIMIENTO DE CONTACTO (contrato de la etapa local previa a Meta):
//   * `consentStatus` es filtro de bandeja y campo del DTO; las cinco columnas del contrato
//     viajan también como objeto `consent`.
//   * `POST …/contacts/:id/consentimiento` es acción de PANEL: superadministrador, estado
//     validado, columnas + evento `kind='consentimiento'` con `source_ref`, fecha SIEMPRE
//     del servidor y sin ningún envío.
//   * `POST /api/whatsapp/consentimiento` es el contrato PÚBLICO de los formularios: sin
//     sesión, sólo `granted`/`denied`, crea o reutiliza el contacto por teléfono canónico.
//   * SIN HERENCIA: el consentimiento nunca se copia de FIPA ni de otra ficha. Sólo lo
//     escriben esas dos vías, siempre con origen, versión y fecha del servidor.
//   * `revoked` GANA sobre cualquier estado anterior: se responde 409 en vez de pisarlo.
//
// Este servicio NO envía mensajes, NO llama a Meta, NO dispara webhooks y NO ejecuta
// llamadas. `dispatchAllowed` es siempre `false`.

// H3 · Una sola fuente de verdad para el alcance delegado. `resolveCrmScope` delega en el
// componente en lugar de reimplementar la regla: así el flag NO alcanza sin política válida.
import { buildDelegationScope, DELEGATION_CODES } from './whatsappCrmDelegacion.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['nuevo', 'pendiente_revision', 'asignado', 'llamada_programada', 'no_respondio',
  'seguimiento', 'interesado', 'no_interesado', 'derivado', 'cerrado'];
/** Roles administrativos legítimos: un responsable no puede ser un identificador arbitrario. */
const ADMIN_ROLES = ['super_admin', 'admin_club', 'admin_cadena', 'admin_nacional'];
/**
 * Orígenes admitidos. Debe coincidir EXACTAMENTE con el CHECK
 * `whatsapp_crm_origins_origin_check` de las candidatas SQL y con las validaciones de
 * `whatsapp_crm_note_origin` / `whatsapp_crm_upsert_contact`.
 * `formulario` identifica la procedencia desde un formulario web de Padbol Match.
 */
const ORIGINS = ['whatsapp', 'importacion', 'manual', 'formulario', 'otro'];
/**
 * Estados de consentimiento. Debe coincidir EXACTAMENTE con el CHECK
 * `whatsapp_crm_contacts_consent_status_check` de la candidata de consentimiento.
 * `unknown` es el estado de todo registro histórico: la migración lo pone por defecto y
 * NUNCA se hereda de FIPA ni de ninguna otra ficha.
 */
export const CONSENT_STATUSES = Object.freeze(['granted', 'denied', 'revoked', 'unknown']);
/** Lo que puede ESCRIBIR cada vía: el panel revoca, el formulario público no. */
export const CONSENT_PANEL_STATUSES = Object.freeze(['granted', 'denied', 'revoked']);
export const CONSENT_PUBLIC_STATUSES = Object.freeze(['granted', 'denied']);
/** Origen por defecto cuando el cuerpo no lo trae (el origen siempre queda registrado). */
export const CONSENT_DEFAULT_SOURCE = Object.freeze({ panel: 'panel:manual', public: 'api:publica' });

/** La delegación por sede u operador todavía no está abierta. */
export const CRM_DELEGATION_ENABLED = false;
export const CRM_DISPATCH_ALLOWED = false;
export const CRM_WRITE_ACTIONS = Object.freeze(['asignar', 'quitar_responsable', 'programar_seguimiento',
  'cancelar_seguimiento', 'resultado_llamada', 'nota', 'estado', 'marcar_revision', 'vincular_origen',
  'consentimiento']);

function fail(status, code, message) {
  return Object.assign(new Error(message || code), { status, code });
}

const text = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * Traduce el error de PostgreSQL del alta por teléfono a una respuesta del contrato.
 * `22023` = la función rechaza el teléfono; `23514` = el CHECK de la ficha no lo acepta
 * (demasiado corto). Nunca se filtra el mensaje crudo de la base al formulario público.
 */
function mapPhoneError(error) {
  const code = String(error?.code || '');
  if (/consentimiento_revocado_no_se_sobrescribe/.test(String(error?.message || ''))) {
    return fail(409, 'CRM_CONSENT_REVOKED_WINS',
      'El consentimiento está revocado y la revocación gana: no se puede registrar un consentimiento nuevo por esta vía.');
  }
  if (code === '22023' || code === '23514') {
    return fail(400, 'CRM_CONSENT_PHONE_INVALID', 'El teléfono no permite identificar un contacto.');
  }
  return error;
}

const isoDate = value => {
  const raw = text(value, 40);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw fail(400, 'CRM_INVALID_DATE', 'La fecha no es válida.');
  return new Date(parsed).toISOString();
};

/** Filtros aceptados. Cualquier otro se rechaza para no filtrar por columnas arbitrarias. */
export function parseContactFilters(query = {}) {
  const allowed = ['status', 'ownerUserId', 'country', 'sedeId', 'interest', 'origin', 'consentStatus', 'since', 'query'];
  if (Object.keys(query).some(key => !allowed.includes(key))) throw fail(400, 'INVALID_FILTERS', 'Filtro no permitido.');
  const status = query.status ? String(query.status) : null;
  if (status && !STATUSES.includes(status)) throw fail(400, 'INVALID_FILTERS', 'Estado inválido.');
  const sedeId = query.sedeId == null || query.sedeId === '' ? null : Number(query.sedeId);
  if (sedeId != null && (!Number.isInteger(sedeId) || sedeId <= 0)) throw fail(400, 'INVALID_FILTERS', 'Sede inválida.');
  const origin = query.origin ? String(query.origin) : null;
  if (origin && !ORIGINS.includes(origin)) throw fail(400, 'INVALID_FILTERS', 'Origen inválido.');
  const consentStatus = query.consentStatus == null || query.consentStatus === '' ? null : String(query.consentStatus);
  if (consentStatus && !CONSENT_STATUSES.includes(consentStatus)) {
    throw fail(400, 'INVALID_FILTERS', 'Estado de consentimiento inválido.');
  }
  return {
    status, sedeId, origin, consentStatus,
    ownerUserId: query.ownerUserId ? String(query.ownerUserId) : null,
    country: query.country ? text(query.country, 80) : null,
    interest: query.interest ? text(query.interest, 120) : null,
    since: query.since ? text(query.since, 40) : null,
    query: query.query ? text(query.query, 120) : null,
  };
}

/**
 * Decisión de consentimiento validada.
 *
 * El cuerpo sólo aporta el ESTADO, la VERSIÓN del texto y el ORIGEN. Ninguna fecha del
 * cuerpo se acepta: `consent_at` / `consent_revoked_at` los pone SIEMPRE el servidor.
 * `channel` acota los estados que cada vía puede escribir: el formulario público no revoca.
 */
export function parseConsentDecision(body = {}, { channel = 'panel' } = {}) {
  const permitidos = channel === 'public' ? CONSENT_PUBLIC_STATUSES : CONSENT_PANEL_STATUSES;
  const payload = body && typeof body === 'object' ? body : {};
  // Lista CERRADA, como los orígenes del CRM: ni espacios de más ni otra caja.
  const status = typeof payload.status === 'string' ? payload.status : '';
  if (!permitidos.includes(status)) {
    throw fail(400, 'CRM_CONSENT_STATUS_INVALID', channel === 'public'
      ? 'Estado de consentimiento inválido: el formulario sólo informa granted o denied.'
      : 'Estado de consentimiento inválido.');
  }
  const versionRaw = payload.version == null ? '' : String(payload.version).trim();
  if (versionRaw.length > 120) throw fail(400, 'CRM_CONSENT_VERSION_INVALID', 'La versión del texto es demasiado larga.');
  const sourceRaw = payload.source == null ? '' : String(payload.source).trim();
  if (sourceRaw.length > 200) throw fail(400, 'CRM_CONSENT_SOURCE_INVALID', 'El origen del consentimiento es demasiado largo.');
  return {
    status,
    version: versionRaw || null,
    source: sourceRaw || CONSENT_DEFAULT_SOURCE[channel === 'public' ? 'public' : 'panel'],
  };
}

/** Cuerpo del formulario público: teléfono + decisión. Sin sesión y sin datos de más. */
export function parsePublicConsentBody(body = {}) {
  const payload = body && typeof body === 'object' ? body : {};
  const phone = typeof payload.phone === 'string' || typeof payload.phone === 'number'
    ? String(payload.phone).trim() : '';
  if (!phone || phone.length > 32) throw fail(400, 'CRM_CONSENT_PHONE_INVALID', 'El teléfono no es válido.');
  return { phone, ...parseConsentDecision(payload, { channel: 'public' }) };
}

/** Valida el cuerpo de una acción de escritura y normaliza sus campos. */
export function parseContactAction(kind, body = {}) {
  if (!CRM_WRITE_ACTIONS.includes(kind)) throw fail(400, 'CRM_UNKNOWN_ACTION', 'Acción no permitida.');
  const payload = body && typeof body === 'object' ? body : {};
  if (kind === 'asignar') {
    const ownerUserId = text(payload.ownerUserId, 64);
    if (!UUID.test(ownerUserId)) throw fail(400, 'CRM_OWNER_REQUIRED', 'Responsable inválido.');
    return { ownerUserId };
  }
  if (kind === 'quitar_responsable') return {};
  if (kind === 'programar_seguimiento') {
    const nextActionAt = isoDate(payload.nextActionAt);
    if (!nextActionAt) throw fail(400, 'CRM_NEXT_ACTION_DATE_REQUIRED', 'La fecha de seguimiento es obligatoria.');
    return { nextAction: text(payload.nextAction, 200), nextActionAt };
  }
  if (kind === 'cancelar_seguimiento') return { reason: text(payload.reason, 200) };
  if (kind === 'resultado_llamada') {
    const summary = text(payload.summary, 2000);
    if (!summary) throw fail(400, 'CRM_CALL_SUMMARY_REQUIRED', 'El resumen de la llamada es obligatorio.');
    const status = payload.status ? String(payload.status) : null;
    if (status && !STATUSES.includes(status)) throw fail(400, 'CRM_STATUS_INVALID', 'Estado inválido.');
    return {
      answered: payload.answered === true,
      summary,
      outcome: text(payload.outcome, 200),
      nextAction: text(payload.nextAction, 200),
      nextActionAt: isoDate(payload.nextActionAt),
      status: status || (payload.answered === true ? 'seguimiento' : 'no_respondio'),
    };
  }
  if (kind === 'nota') {
    const note = text(payload.text, 2000);
    if (!note) throw fail(400, 'CRM_NOTE_REQUIRED', 'La nota no puede estar vacía.');
    return { text: note };
  }
  if (kind === 'estado') {
    const status = String(payload.status || '');
    if (!STATUSES.includes(status)) throw fail(400, 'CRM_STATUS_INVALID', 'Estado inválido.');
    return { status };
  }
  if (kind === 'marcar_revision') {
    const candidateContactId = text(payload.candidateContactId, 64);
    if (!UUID.test(candidateContactId)) throw fail(400, 'CRM_CANDIDATE_REQUIRED', 'Contacto candidato inválido.');
    return { candidateContactId, reason: text(payload.reason, 300) };
  }
  // Acción de panel del contrato: { status, version, source }. Ninguna fecha del cuerpo.
  if (kind === 'consentimiento') return parseConsentDecision(payload, { channel: 'panel' });
  const origin = String(payload.origin || '');
  if (!ORIGINS.includes(origin)) throw fail(400, 'CRM_ORIGIN_INVALID', 'Origen inválido.');
  const sourceRef = text(payload.sourceRef, 200);
  if (!sourceRef) throw fail(400, 'CRM_SOURCE_REF_REQUIRED', 'Falta la referencia de origen.');
  return { origin, sourceRef };
}

/**
 * Alcance efectivo del actor.
 * - super_admin → global (todo el CRM), que es el estado inicial definido.
 * - cualquier otro rol → sin acceso mientras la delegación esté cerrada.
 *
 * ── H3 · LA DELEGACIÓN NO PUEDE FALLAR ABIERTA ──────────────────────────────────────────
 * Antes acá había una SEGUNDA implementación del alcance delegado que miraba **sólo el flag**
 * (`delegationEnabled && rol permitido && sede_id != null`), mientras
 * `lib/whatsappCrmDelegacion.js` exigía además una **política completa y válida**. Como el
 * servicio usaba esta versión, con `delegationEnabled: true` un `admin_club` operaba su sede
 * **sin las 4 decisiones P1–P4**: el camino real era más permisivo que el componente que decía
 * gobernarlo (falla abierta).
 *
 * Ahora hay **una sola fuente de verdad**: esta función DELEGA en `buildDelegationScope`, así
 * que con el flag encendido el acceso delegado **exige y valida la política** y se deniega si
 * falta, está incompleta o es inválida (falla cerrado). Se conserva la forma del objeto que ya
 * consumía el servicio, para no romper el contrato existente.
 *
 * `options.delegationEnabled` sigue valiendo por defecto `CRM_DELEGATION_ENABLED`, que es
 * `false`: **la delegación se mantiene APAGADA** y el comportamiento del producto no cambia.
 * No hay ninguna variable de entorno que la active.
 */
export function resolveCrmScope(roleRow, options = {}) {
  const delegationEnabled = options.delegationEnabled ?? CRM_DELEGATION_ENABLED;
  const policy = options.policy ?? options.delegationPolicy ?? null;
  if (!roleRow) return { allowed: false, reason: 'no_role' };

  const scope = buildDelegationScope(roleRow, { delegationEnabled, policy });
  if (scope.allowed && scope.global) {
    return { allowed: true, global: true, role: scope.role, sedeId: null };
  }
  if (scope.allowed) {
    return { allowed: true, global: false, role: scope.role, sedeId: scope.sedeId,
      ownerUserId: scope.ownerUserId, writeAllowed: scope.writeAllowed };
  }
  // Se conserva `delegation_closed` para el caso histórico (flag apagado) y se informa el
  // motivo real del componente cuando la denegación viene de la política.
  const reason = scope.reason === DELEGATION_CODES.DELEGATION_CLOSED ? 'delegation_closed' : scope.reason;
  return { allowed: false, reason };
}

async function loadRoleRow(db, userId) {
  const { rows } = await db.query(`select role, alcance, sede_id from public.user_roles
    where user_id = $1::uuid limit 2`, [userId]);
  if (rows.length !== 1) throw fail(403, 'CRM_FORBIDDEN', 'Sin permiso para el CRM de WhatsApp.');
  return rows[0];
}

/**
 * Consentimiento de la ficha, en la forma del contrato.
 * Un registro histórico (fila creada antes de la migración) no trae las columnas nuevas:
 * se informa `unknown` y NUNCA se deduce de otra ficha ni de otro campo.
 */
export function consentDto(row = {}) {
  const status = CONSENT_STATUSES.includes(String(row.consent_status)) ? String(row.consent_status) : 'unknown';
  return {
    status,
    version: row.consent_version || null,
    source: row.consent_source || null,
    at: row.consent_at || null,
    revokedAt: row.consent_revoked_at || null,
  };
}

/** DTO de salida: expone la ficha y conserva el número original. Nunca agrega secretos. */
export function contactDto(row) {
  const consent = consentDto(row);
  return {
    id: row.id,
    identityKey: row.identity_key,
    phoneNormalized: row.phone_normalized,
    phoneOriginal: row.phone_original,
    name: row.display_name || '',
    country: row.country || '',
    sedeId: row.sede_id,
    market: row.market || '',
    interest: row.interest || '',
    firstContactAt: row.first_contact_at,
    lastContactAt: row.last_contact_at,
    ownerUserId: row.owner_user_id,
    status: row.status,
    nextAction: row.next_action || '',
    nextActionAt: row.next_action_at,
    notes: row.notes || '',
    // D6: columnas de revisión. `needsReview` es la marca que pone el upsert/backfill cuando la
    // identidad telefónica NO es concluyente; es distinta de `status='pendiente_revision'`,
    // que es una decisión humana (`marcar_revision`). Se exponen las dos por separado.
    needsReview: row.needs_review === true,
    reviewReason: row.review_reason || '',
    phonePais: row.phone_pais || '',
    consentStatus: consent.status,
    consentVersion: consent.version,
    consentSource: consent.source,
    consentAt: consent.at,
    consentRevokedAt: consent.revokedAt,
    consent,
  };
}

const CONTACT_COLUMNS = `id, identity_key, phone_normalized, phone_original, display_name,
  country, sede_id, market, interest, first_contact_at, last_contact_at, owner_user_id, status,
  next_action, next_action_at, notes, consent_status, consent_version, consent_source,
  consent_at, consent_revoked_at,
  -- D6: el endurecimiento ya escribía estas tres columnas, pero el servicio no las leía, así
  -- que la interfaz no podía distinguir una ficha marcada para revisión.
  needs_review, review_reason, phone_pais`;

export function createWhatsappCrmService({ pgPool, delegationEnabled = undefined, delegationPolicy = null }) {
  async function withScope(userId, operation) {
    if (!UUID.test(String(userId || ''))) throw fail(401, 'AUTH_REQUIRED', 'Inicia sesión para continuar.');
    if (!pgPool) throw fail(503, 'CRM_UNAVAILABLE', 'El CRM de WhatsApp no está disponible.');
    const db = await pgPool.connect();
    try {
      await db.query('begin isolation level repeatable read');
      await db.query("set local statement_timeout = '5000ms'");
      // H3: el flag y la POLÍTICA viajan juntos. Con el flag encendido, sin política válida
      // el alcance queda denegado (falla cerrado) y no se llega a consultar la bandeja.
      const scope = resolveCrmScope(await loadRoleRow(db, userId),
        { delegationEnabled, policy: delegationPolicy });
      if (!scope.allowed) throw fail(403, 'CRM_FORBIDDEN', 'Sin permiso para el CRM de WhatsApp.');
      const result = await operation(db, scope);
      await db.query('commit');
      return result;
    } catch (error) {
      await db.query('rollback').catch(() => {});
      throw error;
    } finally { db.release(); }
  }

  async function readRow(db, scope, contactId) {
    if (!UUID.test(String(contactId || ''))) throw fail(404, 'CRM_NOT_FOUND', 'Contacto no disponible.');
    const { rows } = await db.query(`select ${CONTACT_COLUMNS} from public.whatsapp_crm_contacts
      where id = $1::uuid and ($2::bigint is null or sede_id = $2) limit 1`,
    [contactId, scope.global ? null : scope.sedeId]);
    if (!rows.length) throw fail(404, 'CRM_NOT_FOUND', 'Contacto no disponible.');
    return rows[0];
  }

  async function fullCard(db, contactId, row) {
    const origins = await db.query(`select origin, source_ref, first_seen_at, last_seen_at
      from public.whatsapp_crm_contact_origins where contact_id = $1::uuid order by origin, source_ref`, [contactId]);
    const timeline = await db.query(`select kind, at, actor_user_id, detail, payload, source_ref, source_status
      from public.whatsapp_crm_timeline where contact_id = $1::uuid order by at, id limit 500`, [contactId]);
    return { contact: contactDto(row), origins: origins.rows, timeline: timeline.rows,
      dispatchAllowed: CRM_DISPATCH_ALLOWED };
  }

  async function patch(db, contactId, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const sets = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    await db.query(`update public.whatsapp_crm_contacts set ${sets} where id = $1::uuid`,
      [contactId, ...keys.map(key => fields[key])]);
  }

  /**
   * Evento de historial.
   *
   * D5 · `source_ref` deja de ser opcional para los eventos del servicio. Antes las acciones
   * del CRM insertaban con `source_ref` NULL, así que quedaban FUERA del índice único parcial
   * `whatsapp_crm_timeline_source_unique` (que sólo cubre las filas con `source_ref` no nulo):
   * la idempotencia de la timeline protegía a los eventos de los triggers pero no a los del
   * servicio, y no había forma de saber de dónde venía cada evento.
   *
   * Convención (espeja la que ya usaba el consentimiento): `crm:<kind>:<actor>@<marca del
   * servidor>`. Lleva la marca de tiempo porque el índice es por
   * (contact_id, source_ref, source_status): sin ella, DOS acciones legítimamente repetidas
   * (dos notas del mismo actor) colisionarían y la segunda se perdería.
   * `source_status` queda vacío: una acción de panel no tiene estado de proveedor.
   */
  async function event(db, contactId, actorId, kind, detail, payload = {}, sourceRef = null, sourceStatus = '') {
    const resolvedSourceRef = sourceRef
      ?? `crm:${kind}:${actorId || 'anon'}@${new Date().toISOString()}`;
    await db.query(`insert into public.whatsapp_crm_timeline
      (contact_id, kind, actor_user_id, detail, payload, source_ref, source_status)
      values ($1::uuid, $2, $3::uuid, $4, $5::jsonb, $6, $7)`,
    [contactId, kind, actorId, text(detail, 2000), JSON.stringify(payload), resolvedSourceRef, sourceStatus]);
  }

  /**
   * `source_ref` del evento de consentimiento. Lleva el ORIGEN (lo que pide el contrato) y,
   * además, la decisión y la marca del servidor: el índice único
   * `whatsapp_crm_timeline_source_unique` es por (contact_id, source_ref, source_status), así
   * que sin esa marca el SEGUNDO cambio con el mismo origen se perdería.
   */
  const consentSourceRef = (decision, at) =>
    `consentimiento:${decision.source}:${decision.status}@${at}`;

  /** Lectura del estado de consentimiento guardado, tolerante al registro histórico. */
  const storedConsent = row => String(row?.consent_status ?? 'unknown');

  /** `revoked` GANA: no se degrada una revocación a granted/denied en silencio. */
  function assertConsentTransition(row, status) {
    if (storedConsent(row) === 'revoked' && status !== 'revoked') {
      throw fail(409, 'CRM_CONSENT_REVOKED_WINS',
        'El consentimiento está revocado y la revocación gana: no se puede registrar un consentimiento nuevo por esta vía.');
    }
  }

  /**
   * Escritura del consentimiento. Las fechas son SIEMPRE del servidor: cualquier fecha que
   * venga en el cuerpo se ignora y no se lee. Devuelve las columnas a persistir.
   */
  function consentColumns(row, decision, at) {
    const revocado = decision.status === 'revoked';
    return {
      consent_status: decision.status,
      // La versión vacía no pisa la que ya estaba registrada.
      consent_version: decision.version ?? (row?.consent_version ?? null),
      consent_source: decision.source,
      // La revocación no borra cuándo se había decidido: conserva la traza.
      consent_at: revocado ? (row?.consent_at ?? null) : at,
      // Revocar dos veces no mueve el momento de la primera revocación.
      consent_revoked_at: revocado ? (storedConsent(row) === 'revoked' && row?.consent_revoked_at
        ? row.consent_revoked_at : at) : null,
    };
  }

  /** El responsable sólo puede ser un usuario administrativo legítimo. */
  async function assertAdminUser(db, ownerUserId) {
    const { rows } = await db.query('select role from public.user_roles where user_id = $1::uuid limit 2', [ownerUserId]);
    if (rows.length !== 1) throw fail(400, 'CRM_OWNER_NOT_ADMIN', 'El responsable no es un usuario administrativo.');
    const role = String(rows[0].role || '').trim().toLowerCase();
    if (!ADMIN_ROLES.includes(role)) throw fail(400, 'CRM_OWNER_NOT_ADMIN', 'El responsable no es un usuario administrativo.');
  }
  async function assertSameSedeOrGlobal(db, scope, ownerUserId) {
    if (scope.global) return;
    const { rows } = await db.query('select sede_id from public.user_roles where user_id = $1::uuid limit 1', [ownerUserId]);
    if (!rows.length || Number(rows[0].sede_id) !== Number(scope.sedeId)) {
      throw fail(403, 'CRM_FORBIDDEN', 'Sin permiso para asignar ese responsable.');
    }
  }

  return {
    /** Bandeja: una ficha por persona, con sus orígenes. */
    listContacts: (userId, query = {}) => withScope(userId, async (db, scope) => {
      const filters = parseContactFilters(query);
      const sedeFilter = scope.global ? filters.sedeId : scope.sedeId;
      const { rows } = await db.query(`select c.id, c.identity_key, c.phone_normalized, c.phone_original, c.display_name,
        c.country, c.sede_id, c.market, c.interest, c.first_contact_at, c.last_contact_at, c.owner_user_id, c.status,
        c.next_action, c.next_action_at, c.notes,
        c.consent_status, c.consent_version, c.consent_source, c.consent_at, c.consent_revoked_at,
        c.needs_review, c.review_reason, c.phone_pais,
        coalesce((select array_agg(distinct o.origin order by o.origin)
          from public.whatsapp_crm_contact_origins o where o.contact_id = c.id), '{}') as origins
        from public.whatsapp_crm_contacts c
        where ($1::text is null or c.status = $1)
          and ($2::bigint is null or c.sede_id = $2)
          and ($3::uuid is null or c.owner_user_id = $3::uuid)
          and ($4::text is null or c.country = $4)
          and ($5::text is null or c.interest ilike '%' || $5 || '%')
          and ($6::text is null or c.phone_normalized like '%' || $6 || '%' or c.display_name ilike '%' || $6 || '%')
          and ($7::text is null or exists (select 1 from public.whatsapp_crm_contact_origins o
            where o.contact_id = c.id and o.origin = $7))
          and ($8::text is null or c.consent_status = $8)
        order by c.last_contact_at desc nulls last, c.id
        limit 200`,
      [filters.status, sedeFilter, filters.ownerUserId, filters.country, filters.interest, filters.query,
        filters.origin, filters.consentStatus]);
      return { contacts: rows.map(row => ({ ...contactDto(row), origins: row.origins || [] })),
        dispatchAllowed: CRM_DISPATCH_ALLOWED };
    }),

    /** Ficha completa con línea de tiempo y procedencia. */
    readContact: (userId, contactId) => withScope(userId, async (db, scope) =>
      fullCard(db, contactId, await readRow(db, scope, contactId))),

    /**
     * CONTRATO PÚBLICO DE LOS FORMULARIOS · `POST /api/whatsapp/consentimiento`.
     *
     * Sin sesión: lo llama el formulario de la Web Oficial. No hereda nada de FIPA ni de otra
     * ficha, no envía mensajes y no toca ningún formulario. Crea o reutiliza la ficha por
     * teléfono CANÓNICO (la misma función que usan el trigger entrante y el backfill, así que
     * un `wa_id` internacional sin '+' cae en la misma ficha) y guarda el consentimiento con
     * fecha del servidor y su evento de historial con `source_ref`.
     */
    consentFromForm: async (body = {}) => {
      const parsed = parsePublicConsentBody(body);
      if (!pgPool) throw fail(503, 'CRM_UNAVAILABLE', 'El CRM de WhatsApp no está disponible.');
      const db = await pgPool.connect();
      try {
        await db.query('begin');
        await db.query("set local statement_timeout = '5000ms'");
        const at = new Date().toISOString();   // hora del SERVIDOR: no se lee ninguna fecha del cuerpo
        let fila;
        try {
          fila = await db.query(`select contact_id, created, needs_review
            from public.whatsapp_crm_upsert_contact($1,$2,$3,$4,$5,$6,null,$7,$7)`,
          [parsed.phone, '', '', null, 'formulario', parsed.source, at]);
        } catch (error) {
          throw mapPhoneError(error);
        }
        const contactId = fila.rows[0]?.contact_id;
        if (!contactId) throw fail(503, 'CRM_UNAVAILABLE', 'El CRM de WhatsApp no está disponible.');
        const { rows } = await db.query(`select ${CONTACT_COLUMNS}
          from public.whatsapp_crm_contacts where id = $1::uuid limit 1`, [contactId]);
        const row = rows[0];
        assertConsentTransition(row, parsed.status);
        const anterior = storedConsent(row);
        await patch(db, contactId, consentColumns(row, parsed, at));
        await event(db, contactId, null, 'consentimiento',
          `Consentimiento desde el formulario: ${anterior} → ${parsed.status} (origen ${parsed.source}).`,
          { from: anterior, to: parsed.status, version: parsed.version, source: parsed.source, at,
            channel: 'formulario_publico' },
          consentSourceRef(parsed, at), parsed.status);
        await db.query('commit');
        // Respuesta EXACTA del contrato, más la constancia de que el despacho sigue apagado.
        return { ok: true, contactId, consentStatus: parsed.status, dispatchAllowed: CRM_DISPATCH_ALLOWED };
      } catch (error) {
        await db.query('rollback').catch(() => {});
        throw error;
      } finally { db.release(); }
    },

    /**
     * Aplica una acción de escritura: valida, actualiza la ficha, inserta el evento en la
     * línea de tiempo y devuelve la ficha actualizada. Todo en la misma transacción.
     */
    applyAction: (userId, contactId, kind, body = {}) => withScope(userId, async (db, scope) => {
      const payload = parseContactAction(kind, body);
      const row = await readRow(db, scope, contactId);

      if (kind === 'asignar') {
        await assertAdminUser(db, payload.ownerUserId);
        await assertSameSedeOrGlobal(db, scope, payload.ownerUserId);
        await patch(db, contactId, {
          owner_user_id: payload.ownerUserId,
          status: ['nuevo', 'pendiente_revision'].includes(row.status) ? 'asignado' : row.status,
        });
        await event(db, contactId, userId, 'asignacion', 'Responsable asignado.', { ownerUserId: payload.ownerUserId });
      } else if (kind === 'quitar_responsable') {
        await patch(db, contactId, { owner_user_id: null });
        await event(db, contactId, userId, 'asignacion', 'Responsable quitado.');
      } else if (kind === 'programar_seguimiento') {
        await patch(db, contactId, { next_action: payload.nextAction, next_action_at: payload.nextActionAt, status: 'llamada_programada' });
        await event(db, contactId, userId, 'seguimiento', `Seguimiento agendado para ${payload.nextActionAt}.`, payload);
      } else if (kind === 'cancelar_seguimiento') {
        await patch(db, contactId, { next_action: '', next_action_at: null });
        await event(db, contactId, userId, 'seguimiento', `Seguimiento cancelado. ${payload.reason}`.trim(), payload);
      } else if (kind === 'resultado_llamada') {
        await patch(db, contactId, { status: payload.status, next_action: payload.nextAction, next_action_at: payload.nextActionAt });
        await event(db, contactId, userId, 'llamada', payload.summary,
          { answered: payload.answered, outcome: payload.outcome, from: 'telefono_propio', channel: 'tel' });
      } else if (kind === 'nota') {
        await patch(db, contactId, { notes: [row.notes, payload.text].filter(Boolean).join('\n') });
        await event(db, contactId, userId, 'nota', payload.text);
      } else if (kind === 'estado') {
        await patch(db, contactId, { status: payload.status });
        await event(db, contactId, userId, 'estado', `Estado: ${row.status} → ${payload.status}`,
          { from: row.status, to: payload.status });
      } else if (kind === 'marcar_revision') {
        if (payload.candidateContactId === contactId) throw fail(400, 'CRM_CANDIDATE_REQUIRED', 'El candidato debe ser otro contacto.');
        await patch(db, contactId, { status: 'pendiente_revision' });
        await event(db, contactId, userId, 'revision', `Coincidencia marcada para revisión. ${payload.reason}`.trim(),
          { candidateContactId: payload.candidateContactId, reason: payload.reason });
      } else if (kind === 'vincular_origen') {
        // Vincular orígenes confirmados a mano: nunca fusiona fichas automáticamente.
        await db.query(`insert into public.whatsapp_crm_contact_origins (contact_id, origin, source_ref)
          values ($1::uuid, $2, $3) on conflict (contact_id, origin, source_ref) do update set last_seen_at = now()`,
        [contactId, payload.origin, payload.sourceRef]);
        await event(db, contactId, userId, 'origen', `Origen confirmado: ${payload.origin} · ${payload.sourceRef}`, payload);
      } else if (kind === 'consentimiento') {
        // Acción explícita del panel. `revoked` gana; la fecha la pone el servidor.
        assertConsentTransition(row, payload.status);
        const at = new Date().toISOString();
        const anterior = storedConsent(row);
        await patch(db, contactId, consentColumns(row, payload, at));
        await event(db, contactId, userId, 'consentimiento',
          `Consentimiento: ${anterior} → ${payload.status} (origen ${payload.source}).`,
          { from: anterior, to: payload.status, version: payload.version, source: payload.source, at },
          consentSourceRef(payload, at), payload.status);
      }

      const updated = await readRow(db, scope, contactId);
      return fullCard(db, contactId, updated);
    }),
  };
}

/**
 * Rutas del CRM. Lectura y escritura para el superadministrador.
 * No hay ruta de envío, ni de llamada, ni de contacto con Meta.
 *
 * Sí hay UNA ruta pública: `POST /api/whatsapp/consentimiento`, el contrato que van a usar
 * los formularios. No exige sesión porque la llama un visitante, pero sólo puede registrar
 * consentimiento (granted/denied) sobre un teléfono: no lee fichas, no lista y no envía.
 */
export function registerWhatsappCrmRoutes(app, { pgPool, authUserFromBearer }) {
  const service = createWhatsappCrmService({ pgPool });
  const sendError = (res, error, mensajeGenerico) => {
    const status = Number(error?.status) || 500;
    const code = status >= 500 ? 'CRM_UNAVAILABLE' : (error?.code || 'CRM_REQUEST_FAILED');
    return res.status(status).json({ ok: false, dispatchAllowed: false, code,
      error: status >= 500 ? mensajeGenerico : error.message });
  };
  const route = handler => async (req, res) => {
    try {
      const user = await authUserFromBearer(req);
      return await handler(user, req, res);
    } catch (error) {
      return sendError(res, error, 'El CRM de WhatsApp no está disponible.');
    }
  };
  app.get('/api/admin/whatsapp/crm/contacts', route(async (user, req, res) =>
    res.json({ ok: true, ...(await service.listContacts(user?.id, req.query || {})) })));
  app.get('/api/admin/whatsapp/crm/contacts/:contactId', route(async (user, req, res) =>
    res.json({ ok: true, ...(await service.readContact(user?.id, req.params.contactId)) })));
  // Escrituras: una ruta por acción, todas transaccionales y auditadas.
  for (const kind of CRM_WRITE_ACTIONS) {
    app.post(`/api/admin/whatsapp/crm/contacts/:contactId/${kind.replace(/_/g, '-')}`, route(async (user, req, res) =>
      res.json({ ok: true, ...(await service.applyAction(user?.id, req.params.contactId, kind, req.body)) })));
  }
  // Contrato PÚBLICO de los formularios: sin sesión, sin envío y sin tocar ningún formulario.
  app.post('/api/whatsapp/consentimiento', async (req, res) => {
    try {
      return res.json(await service.consentFromForm(req.body));
    } catch (error) {
      return sendError(res, error, 'No se pudo registrar el consentimiento.');
    }
  });
}
