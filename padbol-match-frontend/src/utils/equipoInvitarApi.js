const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

/**
 * Acepta invitación: WhatsApp personalizado (backend) + actualización de `equipos`.
 * Requiere que exista solicitud con ese email y ficha en `jugadores_perfil`.
 */
export async function invitarJugadorEquipo(equipoId, email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) throw new Error('email requerido');
  const res = await fetch(`${API_BASE}/api/equipos/${encodeURIComponent(String(equipoId))}/invitar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: em }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
