const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || '';

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
    if (filters.channel) q.set('channel', filters.channel);
    if (filters.estado) q.set('estado', filters.estado);
    const qs = q.toString();
    return request(`/api/admin/crm/inbox${qs ? `?${qs}` : ''}`, token);
  },
  get: (token, id) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}`, token),
  reply: (token, id, body) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/reply`, token, { method: 'POST', body: JSON.stringify({ body }) }),
  handoff: (token, id) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/handoff`, token, { method: 'POST' }),
  activities: (token, id) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/activities`, token),
  addActivity: (token, id, activity) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/activities`, token, { method: 'POST', body: JSON.stringify(activity) }),
  audit: (token) => request('/api/admin/crm/audit', token),
  createManual: (token, payload) => request('/api/admin/crm/manual', token, { method: 'POST', body: JSON.stringify(payload) }),
  assignSede: (token, id, sedeId) => request(`/api/admin/crm/inbox/${encodeURIComponent(id)}/sede`, token, { method: 'PATCH', body: JSON.stringify({ sede_id: sedeId }) }),
  sedes: (token) => request('/api/sedes', token),
};
