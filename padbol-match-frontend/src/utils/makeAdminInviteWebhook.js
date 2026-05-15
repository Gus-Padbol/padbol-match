/** Webhook Make: envía datos del invitado para generar/enviar magic link por email. */
const MAKE_ADMIN_INVITE_WEBHOOK_URL = (() => {
  const fromEnv =
    typeof process !== 'undefined' ? process.env.REACT_APP_MAKE_ADMIN_INVITE_WEBHOOK_URL : '';
  const s = String(fromEnv || '').trim();
  return s || 'https://hook.us2.make.com/f0yex4xb57s9ry59pridfsdf6tu6spj3';
})();

/**
 * POST a Make tras invitación admin exitosa. No lanza: solo loguea si falla.
 * @param {{ email: string, nombre?: string|null, rol: string, sede_id?: number|null }} params
 */
export async function notifyMakeAdminInvite({ email, nombre, rol, sede_id }) {
  const url = String(MAKE_ADMIN_INVITE_WEBHOOK_URL || '').trim();
  if (!url) return;

  const em = String(email || '').trim().toLowerCase();
  if (!em) return;

  const sedeRaw = sede_id;
  const sedeIdOut =
    sedeRaw != null && String(sedeRaw).trim() !== '' && Number.isFinite(Number(sedeRaw))
      ? Number(sedeRaw)
      : null;

  const payload = {
    email: em,
    nombre: nombre != null && String(nombre).trim() !== '' ? String(nombre).trim() : null,
    rol: String(rol || '').trim().toLowerCase(),
    sede_id: sedeIdOut,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn('[Make] webhook invitación admin:', res.status, t);
    }
  } catch (err) {
    console.warn('[Make] webhook invitación admin:', err?.message || err);
  }
}
