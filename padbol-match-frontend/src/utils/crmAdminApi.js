// CRM usa el proxy del mismo dominio. Ese proxy apunta al backend canónico de
// CRM y evita heredar el backend general antiguo configurado para otras áreas.
import { getApiBaseUrl } from './apiPublicBaseUrl';
const API_BASE_URL = getApiBaseUrl();

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || 'No se pudo completar la acción');
    error.status = response.status;
    throw error;
  }
  return data;
}

export const crmAdminApi = {
  permissions: (token) => request('/api/admin/crm/permissions', token),
  inbox: (token, filters = {}) => {
    const q = new URLSearchParams();
    if (filters.hiddenOnly) q.set('hidden','true');
    if (filters.channel) q.set('channel', filters.channel);
    if (filters.estado) q.set('estado', filters.estado);
    if (filters.ticketReference) q.set('ticket_reference', filters.ticketReference);
    const qs = q.toString();
    return request(`/api/admin/crm/inbox${qs ? `?${qs}` : ''}`, token);
  },
  setTestVisibility: (token, id, hide, expectedVersion) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/test-visibility`, token, { method:'POST', body:JSON.stringify({hide,expectedVersion}) }),
  whatsappMediaList: (token, id) => request(`/api/admin/crm/conversations/${encodeURIComponent(id)}/whatsapp-media`, token),
  whatsappMedia: async (token, id, eventId) => {
    const response = await fetch(`${API_BASE_URL}/api/admin/crm/conversations/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}/whatsapp-media`, {
      cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw Object.assign(new Error('No se pudo descargar el archivo.'), { status: response.status });
    const disposition = response.headers.get('Content-Disposition') || '';
    const filename = disposition.match(/filename="(adjunto-whatsapp(?:\.[a-z0-9]{1,8})?)"/i)?.[1] || 'adjunto-whatsapp';
    return { blob: await response.blob(), filename };
  },
  get: (token, id) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}`, token),
  whatsappHistory: (token, id) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/whatsapp-history`, token),
  reply: (token, id, body, requestId) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/reply`, token, { method: 'POST', body: JSON.stringify({ body, ...(requestId ? { requestId } : {}) }) }),
  handoff: (token, id) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/handoff`, token, { method: 'POST' }),
  activities: (token, id) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/activities`, token),
  addActivity: (token, id, activity) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/activities`, token, { method: 'POST', body: JSON.stringify(activity) }),
  audit: (token) => request('/api/admin/crm/audit', token),
  createManual: (token, payload) => request('/api/admin/crm/manual', token, { method: 'POST', body: JSON.stringify(payload) }),
  assignSede: (token, id, sedeId) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/sede`, token, { method: 'PATCH', body: JSON.stringify({ sede_id: sedeId }) }),
  sedes: (token) => request('/api/sedes', token),
  nextGenerationOverview: (token) => request('/api/admin/next-generation/overview', token),
  createNextGenerationRegistration: (token, payload) => request('/api/admin/next-generation/registrations/from-crm', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  createNextGenerationVenueApplication: (token, payload) => request('/api/admin/next-generation/venue-applications/from-crm', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};
