/**
 * Cliente HTTP del CRM de WhatsApp para el dashboard de Super Admin.
 *
 * Endpoints del contrato entregado (backend CRM dedicado):
 *   GET  /api/admin/whatsapp/crm/contacts?<filtros>
 *   GET  /api/admin/whatsapp/crm/contacts/:id
 *   POST /api/admin/whatsapp/crm/contacts/:id/<accion>
 *
 * Normaliza lo que el contrato exige:
 *   · D9 — el historial se colapsa a un renglón por mensaje.
 *   · D6 — `needsReview`, `reviewReason` y `phonePais` vienen de la API y
 *     mandan sobre cualquier espejo local.
 *   · Los errores conservan `status` y `code` para que la UI distinga
 *     401 (sin sesión), 403 (sin permiso) y 409 (consentimiento revocado).
 */

import { collapseCrmMessageRows } from './whatsappCrmLeads';
import { getPublicApiBaseUrl } from './apiPublicBaseUrl';

export class CrmApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'CrmApiError';
    this.status = status;
    this.code = code;
  }
}

/** La API manda `contact`/`contacts`; el timeline va siempre colapsado (D9). */
export function normalizeCrmContact(raw = {}) {
  return {
    ...raw,
    id: raw.id || raw.contactId || null,
    name: raw.name || raw.displayName || '',
    identityKey: raw.identityKey || raw.identity_key || '',
    phoneOriginal: raw.phoneOriginal || raw.phone_original || '',
    phoneNormalized: raw.phoneNormalized || raw.phone_normalized || '',
    origins: Array.isArray(raw.origins) ? raw.origins : [],
    country: raw.country || '',
    consentStatus: raw.consentStatus || raw.consent_status || 'unknown',
    status: raw.status || 'nuevo',
    ownerUserId: raw.ownerUserId || raw.owner_user_id || '',
    nextAction: raw.nextAction || raw.next_action || '',
    nextActionAt: raw.nextActionAt || raw.next_action_at || null,
    lastContactAt: raw.lastContactAt || raw.last_contact_at || null,
    needsReview: typeof raw.needsReview === 'boolean'
      ? raw.needsReview
      : String(raw.identityKey || raw.identity_key || '').startsWith('review:'),
    reviewReason: raw.reviewReason || raw.review_reason || '',
    phonePais: raw.phonePais || raw.phone_pais || '',
  };
}

export function normalizeCrmDetail(payload = {}) {
  const contacto = normalizeCrmContact(payload.contact || payload);
  return {
    ...payload,
    contact: contacto,
    timeline: collapseCrmMessageRows(payload.timeline || []),
    consents: Array.isArray(payload.consents) ? payload.consents : [],
    forms: Array.isArray(payload.forms) ? payload.forms : [],
  };
}

function buildQuery(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function createWhatsappCrmApiClient({ token, baseUrl = getPublicApiBaseUrl(), fetchImpl = fetch } = {}) {
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      });
    } catch (error) {
      throw new CrmApiError('No se pudo conectar con el backend del CRM.', { code: 'network' });
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new CrmApiError(body.error || body.message || 'El CRM respondió con un error.', {
        status: response.status,
        code: body.code || '',
      });
    }
    return body;
  }

  return {
    /** Bandeja. Devuelve `{ contacts, total }` normalizado. */
    list: async (filters = {}) => {
      const body = await request(`/api/admin/whatsapp/crm/contacts${buildQuery(filters)}`);
      const contacts = (body.contacts || body.items || []).map(normalizeCrmContact);
      return { ...body, contacts, total: body.total ?? contacts.length };
    },
    /** Ficha completa: contacto + historial (D9) + consentimiento + formularios. */
    detail: async (id) => normalizeCrmDetail(await request(`/api/admin/whatsapp/crm/contacts/${encodeURIComponent(id)}`)),
    /** Acciones: nota, estado, llamada, seguimiento, responsable, consentimiento, origen, revisión. */
    action: async (id, kind, payload = {}) =>
      normalizeCrmDetail(
        await request(`/api/admin/whatsapp/crm/contacts/${encodeURIComponent(id)}/${String(kind).replace(/_/g, '-')}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      ),
  };
}
