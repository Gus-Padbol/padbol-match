/**
 * Dominio del CRM de WhatsApp (Super Admin).
 *
 * Reconstruido a partir de la evidencia aprobada:
 *  - DOM capturado de la bandeja (clases crm-* y etiquetas visibles)
 *  - contratos funcionales T4 (estados, orígenes, consentimiento, D9)
 *  - módulo backend whatsappCrm.js entregado (mismos valores de dominio)
 *
 * Regla D9: un mensaje lógico ocupa UNA fila del historial. El backend guarda
 * una fila por estado (pending/sending/sent) y esta capa colapsa por
 * `source_ref` conservando la más reciente, que es el estado vigente.
 */

export const CRM_STATUSES = [
  'nuevo',
  'pendiente_revision',
  'asignado',
  'llamada_programada',
  'no_respondio',
  'seguimiento',
  'interesado',
  'no_interesado',
  'derivado',
  'cerrado',
];

export const CRM_CONSENT_STATUSES = ['unknown', 'granted', 'denied', 'revoked'];

export const CRM_ORIGINS = ['whatsapp', 'importacion', 'manual', 'formulario', 'otro'];

/** Orígenes que la bandeja puede filtrar (etiquetas del DOM aprobado). */
export const CRM_ORIGIN_FILTERS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'importacion', label: 'Importación' },
  { value: 'manual', label: 'Alta manual' },
  { value: 'formulario', label: 'Formulario web' },
];

export const STATUS_LABELS = {
  nuevo: 'Nuevo',
  pendiente_revision: 'Pendiente de revisión',
  asignado: 'Asignado',
  llamada_programada: 'Llamada programada',
  no_respondio: 'No respondió',
  seguimiento: 'Seguimiento',
  interesado: 'Interesado',
  no_interesado: 'No interesado',
  derivado: 'Derivado',
  cerrado: 'Cerrado',
};

export const CONSENT_LABELS = {
  unknown: 'Sin registrar',
  granted: 'Otorgado',
  denied: 'Denegado',
  revoked: 'Revocado',
};

export const ORIGIN_LABELS = {
  whatsapp: 'WhatsApp',
  importacion: 'Importación',
  manual: 'Alta manual',
  formulario: 'Formulario web',
  otro: 'Otro origen',
};

/**
 * Color por procedencia. Es el diferenciador visual aprobado: cada origen tiene
 * su propio color, y también su canal (whatsapp / formulario web / otro).
 */
export const ORIGIN_COLORS = {
  whatsapp: '#25D366',
  formulario: '#2563EB',
  importacion: '#B45309',
  manual: '#7C3AED',
  otro: '#64748B',
};

export const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  formulario_web: 'Formulario web',
  formulario: 'Formulario web',
  manual: 'Alta manual',
  importacion: 'Importación',
  otro: 'Otro origen',
};

export const CHANNEL_COLORS = {
  whatsapp: ORIGIN_COLORS.whatsapp,
  formulario_web: ORIGIN_COLORS.formulario,
  formulario: ORIGIN_COLORS.formulario,
  manual: ORIGIN_COLORS.manual,
  importacion: ORIGIN_COLORS.importacion,
  otro: ORIGIN_COLORS.otro,
};

/** Color del punto del historial según el tipo de evento. */
export const TIMELINE_COLORS = {
  mensaje_entrante: '#16A34A',
  mensaje_saliente: '#2563EB',
  nota: '#64748B',
  estado: '#EA580C',
  llamada: '#DC2626',
  seguimiento: '#0891B2',
  asignacion: '#7C3AED',
  revision: '#D97706',
  origen: '#DB2777',
  consentimiento: '#0F766E',
};

export const TIMELINE_LABELS = {
  mensaje_entrante: 'Mensaje entrante',
  mensaje_saliente: 'Mensaje saliente',
  nota: 'Nota',
  estado: 'Cambio de estado',
  llamada: 'Resultado de llamada',
  seguimiento: 'Seguimiento',
  asignacion: 'Asignación',
  revision: 'Revisión',
  origen: 'Origen',
  consentimiento: 'Consentimiento',
};

export const statusLabel = (status) => STATUS_LABELS[status] || status || 'Nuevo';
export const consentLabel = (status) => CONSENT_LABELS[status] || 'Sin registrar';
export const originLabel = (origin) => ORIGIN_LABELS[origin] || origin || 'Otro origen';
export const channelLabel = (channel) => CHANNEL_LABELS[channel] || channel || 'Otro origen';
export const originColor = (origin) => ORIGIN_COLORS[origin] || ORIGIN_COLORS.otro;
export const channelColor = (channel) => CHANNEL_COLORS[channel] || ORIGIN_COLORS.otro;
export const timelineLabel = (kind) => TIMELINE_LABELS[kind] || kind || 'Evento';
export const timelineColor = (kind) => TIMELINE_COLORS[kind] || '#64748B';

/**
 * Identidad lógica de un mensaje. Los de trigger llevan `source_ref`
 * (`inbound:<id>` / `outbox:<id>`); si falta, se cae a una clave derivada.
 */
export function crmMessageKey(row = {}) {
  const ref = String(row.source_ref || row.sourceRef || '');
  if (/^(inbound|outbox):/.test(ref)) return ref;
  const kind = String(row.kind || '');
  return kind === 'mensaje_entrante' || kind === 'mensaje_saliente'
    ? `${kind}:${row.at || ''}:${row.detail || ''}`
    : '';
}

/** D9 · colapsa las filas de un mensaje conservando la más reciente (vigente). */
export function collapseCrmMessageRows(rows = []) {
  const result = [];
  const positions = new Map();
  for (const row of rows) {
    const key = crmMessageKey(row);
    if (!key) {
      result.push(row);
      continue;
    }
    if (!positions.has(key)) {
      positions.set(key, result.length);
      result.push(row);
    } else {
      result[positions.get(key)] = row;
    }
  }
  return result;
}

/** Conteo de mensajes reales (no de transiciones de estado). */
export function countCrmMessages(contact = {}) {
  const rows = collapseCrmMessageRows(contact.timeline || []);
  return {
    inbound: rows.filter((row) => row.kind === 'mensaje_entrante').length,
    outbound: rows.filter((row) => row.kind === 'mensaje_saliente').length,
  };
}

/** `source_status` de un mensaje saliente: en la base heredada nunca es `sent`. */
export function readSourceStatus(row = {}) {
  return String(row.source_status || row.sourceStatus || '').trim();
}

export function isCrmMessageSent(row = {}) {
  return readSourceStatus(row) === 'sent';
}

/** La API manda `needsReview`; el espejo local sólo se usa como respaldo. */
export function contactNeedsReview(contact = {}) {
  if (typeof contact.needsReview === 'boolean') return contact.needsReview;
  return String(contact.identityKey || contact.identity_key || '').startsWith('review:');
}

export function contactReviewReason(contact = {}) {
  return contact.reviewReason || contact.review_reason || '';
}

/** País del teléfono: vacío se muestra como «—», nunca `undefined`. */
export function phoneCountry(contact = {}) {
  const value = String(contact.phonePais || contact.phone_pais || '').trim();
  return value || '—';
}

/** Resumen de la bandeja: los cinco contadores del encabezado aprobado. */
export function buildInboxSummary(contacts = []) {
  const lista = Array.isArray(contacts) ? contacts : [];
  const byOrigin = (origin) =>
    lista.filter((contact) => (contact.origins || []).includes(origin)).length;
  const overdue = lista.filter((contact) => {
    const next = contact.nextActionAt || contact.next_action_at;
    return next ? new Date(next).getTime() < Date.now() : false;
  }).length;
  return [
    { key: 'total', value: lista.length, label: 'Contactos' },
    { key: 'whatsapp', value: byOrigin('whatsapp'), label: 'Por WhatsApp' },
    { key: 'formulario', value: byOrigin('formulario'), label: 'Por formulario web' },
    { key: 'review', value: lista.filter(contactNeedsReview).length, label: 'Para revisar' },
    { key: 'overdue', value: overdue, label: 'Seguimientos vencidos', alert: true },
  ];
}

/** Filtro local, espejo de los parámetros que acepta la API. */
export function filterContacts(contacts = [], filtros = {}) {
  const texto = String(filtros.q || filtros.texto || '').trim().toLowerCase();
  return (Array.isArray(contacts) ? contacts : []).filter((contact) => {
    if (filtros.status && contact.status !== filtros.status) return false;
    if (filtros.origin && !(contact.origins || []).includes(filtros.origin)) return false;
    if (filtros.region && contact.country !== filtros.region) return false;
    if (filtros.ownerUserId && contact.ownerUserId !== filtros.ownerUserId) return false;
    if (filtros.consentStatus && contact.consentStatus !== filtros.consentStatus) return false;
    if (!texto) return true;
    return [contact.name, contact.phoneOriginal, contact.phoneNormalized, contact.email, contact.identityKey]
      .some((valor) => typeof valor === 'string' && valor.toLowerCase().includes(texto));
  });
}

/** Formatos del DOM aprobado: fecha corta y fecha y hora local. */
export function formatCrmDate(value) {
  if (!value) return '—';
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
