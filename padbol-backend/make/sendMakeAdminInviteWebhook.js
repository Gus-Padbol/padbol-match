/**
 * Webhook Make para invitaciones admin (magic link / email vía escenario).
 * Se llama desde Node (Render) para evitar CORS del browser.
 */
export const MAKE_ADMIN_INVITE_WEBHOOK_URL_DEFAULT =
  'https://hook.us2.make.com/f0yex4xb57s9ry59pridfsdf6tu6spj3';

/**
 * @param {{ email: string, nombre?: string|null, rol: string, sede_id?: number|null }} payload
 */
export async function notifyMakeAdminInviteWebhook(payload) {
  const url = String(
    process.env.MAKE_ADMIN_INVITE_WEBHOOK_URL || MAKE_ADMIN_INVITE_WEBHOOK_URL_DEFAULT,
  ).trim();
  const email = String(payload?.email || '').trim().toLowerCase();
  if (!email) {
    console.warn('[Make admin invite] omitido: email vacío');
    return;
  }
  if (!url) {
    console.warn('[Make admin invite] omitido: URL webhook vacía');
    return;
  }

  const sedeRaw = payload?.sede_id;
  const sede_id =
    sedeRaw != null && String(sedeRaw).trim() !== '' && Number.isFinite(Number(sedeRaw))
      ? Number(sedeRaw)
      : null;

  const body = {
    email,
    nombre:
      payload?.nombre != null && String(payload.nombre).trim() !== ''
        ? String(payload.nombre).trim()
        : null,
    rol: String(payload?.rol || '').trim().toLowerCase(),
    sede_id,
  };

  console.log('[Make admin invite] antes fetch webhook', {
    ...body,
    webhookHost: (() => {
      try {
        return new URL(url).host;
      } catch {
        return '(url inválida)';
      }
    })(),
  });
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    console.log('[Make admin invite] después fetch webhook', {
      status: res.status,
      preview: text.slice(0, 160),
    });
    if (!res.ok) {
      console.warn('[Make admin invite] webhook respondió error', res.status, text);
    }
  } catch (err) {
    console.warn('[Make admin invite] error en fetch webhook:', err?.message || err);
  }
}
