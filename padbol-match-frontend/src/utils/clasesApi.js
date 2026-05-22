import { stripClasePublic, stripProfesorPublic } from './profesorPublic';

const API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

function authHeaders(accessToken) {
  const h = { 'Content-Type': 'application/json' };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  return h;
}

export async function fetchProfesores({ sedeId, deporte, signal } = {}) {
  const sid = Number(sedeId);
  if (!Number.isFinite(sid)) return [];
  const qs = new URLSearchParams({ sede_id: String(sid) });
  if (deporte) qs.set('deporte', deporte);
  const res = await fetch(`${API_BASE}/api/profesores?${qs}`, { signal });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar los profesores');
  return Array.isArray(data) ? data.map((p) => stripProfesorPublic(p)).filter(Boolean) : [];
}

export async function fetchClases({ sedeId, deporte, signal } = {}) {
  const sid = Number(sedeId);
  if (!Number.isFinite(sid)) return [];
  const qs = new URLSearchParams({ sede_id: String(sid) });
  if (deporte) qs.set('deporte', deporte);
  const res = await fetch(`${API_BASE}/api/clases?${qs}`, { signal });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar las clases');
  return Array.isArray(data) ? data.map((c) => stripClasePublic(c)) : [];
}

export async function fetchClaseDetalle(claseId, { fecha, signal, accessToken } = {}) {
  const id = Number(claseId);
  if (!Number.isFinite(id)) throw new Error('Clase inválida');
  const qs = new URLSearchParams();
  if (fecha) qs.set('fecha', fecha);
  const suffix = qs.toString() ? `?${qs}` : '';
  const res = await fetch(`${API_BASE}/api/clases/${id}${suffix}`, {
    signal,
    headers: authHeaders(accessToken, false),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo cargar la clase');
  return stripClasePublic(data);
}

export async function inscribirClase({ claseId, fecha, horaInicio, accessToken }) {
  const res = await fetch(`${API_BASE}/api/clases/inscribir`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      clase_id: claseId,
      fecha,
      hora_inicio: horaInicio,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo reservar la clase');
  return data;
}

export async function cancelarInscripcionClase({ inscripcionId, accessToken }) {
  const id = Number(inscripcionId);
  if (!Number.isFinite(id)) throw new Error('Inscripción inválida');
  const res = await fetch(`${API_BASE}/api/clases/inscripcion/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || 'No se pudo cancelar la inscripción');
    err.horas_cancelacion = data?.horas_cancelacion;
    throw err;
  }
  return data;
}

export async function fetchMisClases({ accessToken, signal } = {}) {
  const res = await fetch(`${API_BASE}/api/jugador/mis-clases`, {
    headers: authHeaders(accessToken, false),
    signal,
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar tus clases');
  return Array.isArray(data) ? data : [];
}
