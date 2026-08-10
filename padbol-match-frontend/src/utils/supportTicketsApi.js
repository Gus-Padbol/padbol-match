const API_BASE_URL = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

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
  if (!response.ok) throw new Error(data?.error || 'No se pudo completar la acción');
  return data;
}

export const supportTicketsApi = {
  listMine: (token) => request('/api/support/tickets', token),
  getMine: (token, id) => request(`/api/support/tickets/${id}`, token),
  create: (token, payload) => request('/api/support/tickets', token, { method: 'POST', body: JSON.stringify(payload) }),
  replyMine: (token, id, mensaje) => request(`/api/support/tickets/${id}/messages`, token, { method: 'POST', body: JSON.stringify({ mensaje }) }),
  listAdmin: (token, estado = '') => request(`/api/admin/support/tickets${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`, token),
  getAdmin: (token, id) => request(`/api/admin/support/tickets/${id}`, token),
  replyAdmin: (token, id, payload) => request(`/api/admin/support/tickets/${id}/messages`, token, { method: 'POST', body: JSON.stringify(payload) }),
  updateAdmin: (token, id, payload) => request(`/api/admin/support/tickets/${id}`, token, { method: 'PATCH', body: JSON.stringify(payload) }),
};
