import { getPublicApiBaseUrl } from './apiPublicBaseUrl';

const API_BASE =
  getPublicApiBaseUrl() ||
  (typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com');

/**
 * Rol del usuario autenticado vía backend (service role; evita RLS en `user_roles` del cliente).
 * @param {string} accessToken JWT de Supabase
 * @returns {Promise<{ email: string, rol: string|null, nombre: string|null, pais: string|null, sedeId: number|null, torneosOficialesHabilitados: boolean }|null>}
 */
export async function fetchMiRol(accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/api/auth/mi-rol`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(data?.error || `No se pudo obtener el rol (${res.status})`);
  }

  const email = String(data.email || '').trim();
  if (!email) return null;

  const sedeIdRaw = data.sedeId;
  const sedeIdNum = sedeIdRaw != null && sedeIdRaw !== '' ? Number(sedeIdRaw) : null;

  return {
    email,
    rol: data.rol ?? null,
    nombre: data.nombre ?? null,
    pais: data.pais ?? null,
    sedeId: Number.isFinite(sedeIdNum) ? sedeIdNum : null,
    torneosOficialesHabilitados: Boolean(data.torneosOficialesHabilitados),
  };
}
