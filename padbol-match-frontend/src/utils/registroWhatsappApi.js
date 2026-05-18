const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

/** GET /api/registro/whatsapp-disponible — true si el WhatsApp (E.164) no está en otro jugadores_perfil. */
export async function fetchWhatsappDisponibleRegistro(whatsappE164, accessToken) {
  const wa = String(whatsappE164 || '').trim();
  if (!wa) return { disponible: true };
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const url = `${API_BASE}/api/registro/whatsapp-disponible?${new URLSearchParams({ whatsapp: wa })}`;
  const res = await fetch(url, { headers });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'No se pudo validar el teléfono');
  return { disponible: Boolean(j.disponible) };
}
