import { getPublicApiBaseUrl } from './apiPublicBaseUrl';
import { normalizeUserRole } from './adminPanelRoles';

const API_BASE =
  getPublicApiBaseUrl() ||
  (typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com');

const MI_ROL_PATHS = ['/api/auth/mi-rol', '/api/usuarios/mi-rol'];

function parseMiRolResponse(data) {
  const email = String(data?.email || '').trim();
  if (!email) return null;

  const sedeIdRaw = data.sedeId ?? data.sede_id;
  const sedeIdNum = sedeIdRaw != null && sedeIdRaw !== '' ? Number(sedeIdRaw) : null;
  const rolRaw = data.rol ?? data.role;
  const organizacionId = data.organizacionId ?? data.organizacion_id ?? null;

  return {
    email,
    rol: normalizeUserRole(rolRaw),
    nombre: data.nombre ?? null,
    pais: data.pais ?? null,
    sedeId: Number.isFinite(sedeIdNum) ? sedeIdNum : null,
    organizacionId: organizacionId ? String(organizacionId) : null,
    torneosOficialesHabilitados: Boolean(data.torneosOficialesHabilitados),
  };
}

/**
 * Rol del usuario autenticado vía backend (service role; evita RLS en `user_roles` del cliente).
 * @param {string} accessToken JWT de Supabase
 */
export async function fetchMiRol(accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) return null;

  let lastError = null;

  for (const path of MI_ROL_PATHS) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    let data = {};
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = {};
      }
    }

    if (res.status === 401) return null;
    if (res.status === 404) {
      lastError = new Error(`Ruta no encontrada: ${path}`);
      continue;
    }
    if (!res.ok) {
      lastError = new Error(data?.error || `No se pudo obtener el rol (${res.status})`);
      continue;
    }
    if (!contentType.includes('application/json')) {
      lastError = new Error(`Respuesta no JSON (${res.status})`);
      continue;
    }

    return parseMiRolResponse(data);
  }

  if (lastError) throw lastError;
  return null;
}
