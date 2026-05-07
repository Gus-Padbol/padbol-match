/**
 * Dígitos para https://wa.me/{digits} (sin + ni espacios).
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function whatsappDigitsForWaMe(raw) {
  if (raw == null) return '';
  return String(raw).replace(/\D/g, '');
}

/**
 * @param {string|null|undefined} digits
 * @param {string} [message]
 * @returns {string|null}
 */
export function buildWhatsAppMeUrl(digits, message) {
  const d = whatsappDigitsForWaMe(digits);
  if (d.length < 8) return null;
  const base = `https://wa.me/${d}`;
  if (message == null || String(message).trim() === '') return base;
  return `${base}?text=${encodeURIComponent(String(message))}`;
}

/** Primer nombre o token para saludo por WhatsApp. */
export function primerNombreSaludo(fullName) {
  const t = String(fullName || '').trim();
  if (!t) return '';
  return t.split(/\s+/).filter(Boolean)[0] || '';
}
