const API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

function authHeaders(accessToken, json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

export async function fetchAdminProfesores({ sedeId, accessToken, signal } = {}) {
  const sid = Number(sedeId);
  if (!Number.isFinite(sid)) return [];
  const res = await fetch(`${API_BASE}/api/admin/profesores?sede_id=${sid}`, {
    headers: authHeaders(accessToken),
    signal,
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar los profesores');
  return Array.isArray(data) ? data : [];
}

export async function fetchAdminProfesoresPendientes({ accessToken, signal } = {}) {
  const res = await fetch(`${API_BASE}/api/admin/profesores-pendientes`, {
    headers: authHeaders(accessToken),
    signal,
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar profesores pendientes');
  return Array.isArray(data) ? data : [];
}

export async function crearProfesorAdmin({ sedeId, body, accessToken }) {
  const res = await fetch(`${API_BASE}/api/admin/profesores`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ ...body, sede_id: sedeId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo crear el profesor');
  return data;
}

export async function aprobarProfesorAdmin({ profesorId, accessToken }) {
  const res = await fetch(`${API_BASE}/api/admin/profesores/${Number(profesorId)}/aprobar`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo aprobar');
  return data;
}

export async function fetchAdminClases({ sedeId, accessToken, signal } = {}) {
  const sid = Number(sedeId);
  if (!Number.isFinite(sid)) return [];
  const res = await fetch(`${API_BASE}/api/admin/clases?sede_id=${sid}`, {
    headers: authHeaders(accessToken),
    signal,
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar las clases');
  return Array.isArray(data) ? data : [];
}

export async function crearClaseAdmin({ body, accessToken }) {
  const res = await fetch(`${API_BASE}/api/admin/clases`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo crear la clase');
  return data;
}

export async function patchClaseActivoAdmin({ claseId, activo, accessToken }) {
  const res = await fetch(`${API_BASE}/api/admin/clases/${Number(claseId)}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ activo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo actualizar');
  return data;
}
