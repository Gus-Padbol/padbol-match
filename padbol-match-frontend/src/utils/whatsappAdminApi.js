import { getApiBaseUrl } from './apiPublicBaseUrl';

const API_BASE_URL = getApiBaseUrl();

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
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

export const whatsappAdminApi = {
  permissions: (token) => request('/api/admin/whatsapp/permissions', token),
  inbox: (token, limit = 50) => request(`/api/admin/whatsapp/inbox?limit=${encodeURIComponent(limit)}`, token),
  reply: (token, id, body) => request(
    `/api/admin/whatsapp/inbox/${encodeURIComponent(id)}/reply`,
    token,
    { method: 'POST', body: JSON.stringify({ body }) },
  ),
  handoff: (token, id) => request(
    `/api/admin/whatsapp/inbox/${encodeURIComponent(id)}/handoff`,
    token,
    { method: 'POST' },
  ),
  audit: (token) => request('/api/admin/whatsapp/audit', token),
};
