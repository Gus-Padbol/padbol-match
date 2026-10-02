/**
 * ════════════════════════════════════════════════════════════════════════════════════════
 * DELEGACIÓN DEL CRM DE WHATSAPP · componente preparado, CONTRATO DE INTERFAZ
 * ════════════════════════════════════════════════════════════════════════════════════════
 *
 * ESTADO: preparado y probado como componente INDEPENDIENTE. **No está cableado al servicio**:
 * encender la delegación es una DECISIÓN DE PRODUCTO que todavía no está tomada, y este
 * módulo no la inventa. Lo que hace es fijar la interfaz para que, cuando se decida, sólo
 * haya que pasar la política.
 *
 * Hallazgos del frente de permisos que este componente resuelve en su parte de contrato
 * (`whatsapp-crm-permisos-qa/INFORME_PERMISOS_CRM.md` §3.3):
 *   - el flag era un `const` de módulo → ya es INYECTABLE (`resolveCrmScope(role, {delegationEnabled})`);
 *   - no existía noción de región ni de responsable en el alcance → acá está el contrato;
 *   - la rama `global:false` no tenía cobertura → ahora sí (ver el `.test.js`).
 *
 * ── DECISIONES PENDIENTES (no las resuelve este archivo) ────────────────────────────────
 *   P1. ¿Un operador de sede ve TODA su sede o sólo los contactos que tiene asignados?
 *       → `policy.ownerOnly`
 *   P2. ¿Se limita además por país/provincia/ciudad (el `country` del contacto), o la sede
 *       alcanza? → `policy.regionScoped`
 *   P3. ¿Qué roles delegan? Hoy el código contempla `admin_club` y `operador_whatsapp`; si
 *       entra `admin_nacional` o `empleado`, hay que decirlo → `policy.roles`
 *   P4. ¿Puede un operador ESCRIBIR (las 10 acciones) o sólo leer? → `policy.writeAllowed`
 * Mientras no se respondan, `normalizeDelegationPolicy` las exige EXPLÍCITAS: sin política
 * completa devuelve `ok:false` y el llamador debe seguir tratando al rol como sin acceso.
 * Falla CERRADO: ante la duda, no se delega.
 * ════════════════════════════════════════════════════════════════════════════════════════
 */
/** Códigos de error del contrato. Cerrados: nunca se inventa uno nuevo en el llamador. */
export const DELEGATION_CODES = Object.freeze({
  POLICY_REQUIRED: 'CRM_DELEGATION_POLICY_REQUIRED',
  POLICY_INVALID: 'CRM_DELEGATION_POLICY_INVALID',
  ROLE_NOT_DELEGABLE: 'CRM_DELEGATION_ROLE_NOT_DELEGABLE',
  SEDE_REQUIRED: 'CRM_DELEGATION_SEDE_REQUIRED',
  DELEGATION_CLOSED: 'delegation_closed',
});
/** Roles que el código del producto ya contemplaba como delegables. */
export const DEFAULT_DELEGABLE_ROLES = Object.freeze(['admin_club', 'operador_whatsapp']);
/** Preguntas que siguen abiertas. Se exponen para que el informe/contrato no las pierda. */
export const DELEGATION_PENDING_DECISIONS = Object.freeze([
  'P1 · ¿el operador ve toda su sede o sólo lo asignado? (ownerOnly)',
  'P2 · ¿se limita por país/provincia/ciudad además de la sede? (regionScoped)',
  'P3 · ¿qué roles delegan exactamente? (roles)',
  'P4 · ¿el operador puede escribir o sólo leer? (writeAllowed)',
]);
const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asBool = value => value === true;
/**
 * Valida y normaliza la política que DECIDE el dueño del producto.
 *
 * Entrada:  `{ ownerOnly, regionScoped, roles, writeAllowed }` — los cuatro OBLIGATORIOS.
 * Salida:   `{ ok: true, policy }` normalizada, o `{ ok: false, code, message }`.
 * Errores:  `CRM_DELEGATION_POLICY_REQUIRED` · `CRM_DELEGATION_POLICY_INVALID`.
 * Idempotente: normalizar dos veces la misma entrada devuelve un objeto equivalente.
 */
export function normalizeDelegationPolicy(input) {
  if (!isPlainObject(input)) {
    return { ok: false, code: DELEGATION_CODES.POLICY_REQUIRED,
      message: 'La delegación exige una política explícita; no hay valores por defecto.' };
  }
  const faltantes = ['ownerOnly', 'regionScoped', 'roles', 'writeAllowed']
    .filter(key => input[key] === undefined || input[key] === null);
  if (faltantes.length) {
    return { ok: false, code: DELEGATION_CODES.POLICY_REQUIRED,
      message: `Faltan decisiones de la política de delegación: ${faltantes.join(', ')}.` };
  }
  if (typeof input.ownerOnly !== 'boolean' || typeof input.regionScoped !== 'boolean'
      || typeof input.writeAllowed !== 'boolean') {
    return { ok: false, code: DELEGATION_CODES.POLICY_INVALID,
      message: 'ownerOnly, regionScoped y writeAllowed deben ser booleanos.' };
  }
  if (!Array.isArray(input.roles) || !input.roles.length
      || input.roles.some(role => typeof role !== 'string' || !role.trim())) {
    return { ok: false, code: DELEGATION_CODES.POLICY_INVALID,
      message: 'roles debe ser una lista no vacía de nombres de rol.' };
  }
  const roles = [...new Set(input.roles.map(role => role.trim().toLowerCase()))].sort();
  return { ok: true, policy: Object.freeze({
    ownerOnly: input.ownerOnly,
    regionScoped: input.regionScoped,
    writeAllowed: input.writeAllowed,
    roles: Object.freeze(roles),
  }) };
}
/**
 * Alcance efectivo de un actor, con la política ya decidida.
 *
 * Entrada:  `roleRow` = fila de `public.user_roles` (`role`, `alcance`, `sede_id`, y —si se
 *           decide limitar por territorio— `pais`, `provincia`, `ciudad`).
 *           `options.delegationEnabled` (por defecto `false`) y `options.policy`.
 * Salida:   `{ allowed, global, role, sedeId, ownerUserId, region, writeAllowed, reason }`.
 *           `allowed:false` siempre lleva `reason` de `DELEGATION_CODES`.
 * Errores:  no lanza: devuelve `allowed:false`. Falla CERRADO.
 */
export function buildDelegationScope(roleRow, { delegationEnabled = false, policy = null } = {}) {
  const deny = reason => ({ allowed: false, global: false, role: null, sedeId: null,
    ownerUserId: null, region: null, writeAllowed: false, reason });
  if (!roleRow) return deny('no_role');
  const role = String(roleRow.role || roleRow.rol || '').trim().toLowerCase();
  // El superadministrador global NO depende de la delegación: es el estado inicial del
  // contrato y sigue funcionando con el flag apagado.
  // El rol super_admin es global por definición. `alcance` nació para roles
  // delegados y algunas filas históricas heredaron el default `sede`; no debe
  // degradar ni bloquear al superadministrador.
  if (role === 'super_admin') {
    return { allowed: true, global: true, role, sedeId: null, ownerUserId: null, region: null,
      writeAllowed: true, reason: null };
  }
  if (!delegationEnabled) return deny(DELEGATION_CODES.DELEGATION_CLOSED);
  const normalized = normalizeDelegationPolicy(policy);
  if (!normalized.ok) return deny(normalized.code);
  const effective = normalized.policy;
  if (!effective.roles.includes(role)) return deny(DELEGATION_CODES.ROLE_NOT_DELEGABLE);
  // Un operador delegado SIEMPRE necesita sede: sin sede no hay alcance que acotar.
  // `null` no es `0`: se exige un entero positivo.
  const sedeId = roleRow.sede_id == null || roleRow.sede_id === '' ? null : Number(roleRow.sede_id);
  if (!Number.isInteger(sedeId) || sedeId <= 0) return deny(DELEGATION_CODES.SEDE_REQUIRED);
  const ownerUserId = effective.ownerOnly
    ? (roleRow.user_id ? String(roleRow.user_id) : null)
    : null;
  // Si la política pide "sólo lo asignado" pero no hay usuario, no se puede acotar → se niega.
  if (effective.ownerOnly && !ownerUserId) return deny(DELEGATION_CODES.ROLE_NOT_DELEGABLE);
  const region = effective.regionScoped
    ? { pais: String(roleRow.pais || '').trim(), provincia: String(roleRow.provincia || '').trim(),
        ciudad: String(roleRow.ciudad || '').trim() }
    : null;
  return { allowed: true, global: false, role, sedeId, ownerUserId, region,
    writeAllowed: asBool(effective.writeAllowed), reason: null };
}
/**
 * Filtros EFECTIVOS que el servicio debe aplicar. Es la única función que traduce el alcance
 * a predicados, así que el llamador no puede "olvidarse" de uno.
 *
 * Regla: los filtros que pide el usuario nunca AMPLÍAN el alcance; sólo lo reducen.
 * Entrada: `scope` (de `buildDelegationScope`) y `filters` (los del query string).
 * Salida:  `{ sedeId, ownerUserId, country, denied }`. `denied:true` ⇒ no se debe consultar.
 */
export function delegationFilters(scope, filters = {}) {
  if (!scope?.allowed) return { sedeId: null, ownerUserId: null, country: null, denied: true };
  if (scope.global) {
    return { sedeId: filters.sedeId ?? null, ownerUserId: filters.ownerUserId ?? null,
      country: filters.country ?? null, denied: false };
  }
  return {
    // La sede del alcance MANDA: un operador no puede pedir otra sede por query string.
    sedeId: scope.sedeId,
    // Sólo lo asignado si la política lo decidió; si no, el filtro del usuario (si lo pide).
    ownerUserId: scope.ownerUserId ?? filters.ownerUserId ?? null,
    // La región del alcance manda sobre el país pedido.
    country: scope.region?.pais ? scope.region.pais : (filters.country ?? null),
    denied: false,
  };
}
/** ¿Puede este alcance ejecutar acciones de escritura? (P4 de la política) */
export function canWriteWithScope(scope) {
  if (!scope?.allowed) return false;
  return scope.global === true || scope.writeAllowed === true;
}
