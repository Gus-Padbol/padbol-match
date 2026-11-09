const REGIONAL_INDICATOR_A = 0x1f1e6;
const ISO_COUNTRY = /^[A-Z]{2}$/;

function normalizeIso(iso) {
  const code = String(iso ?? '').trim().toUpperCase();
  return ISO_COUNTRY.test(code) ? code : '';
}

/** Bandera desde el código ISO de dos letras, sin depender de un catálogo manual. */
export function countryFlagFromIso(iso) {
  const code = normalizeIso(iso);
  if (!code) return '';
  return String.fromCodePoint(
    ...[...code].map((letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - 65),
  );
}

/** Nombre localizado del país usando el ISO ya validado por el backend. */
export function countryNameFromIso(iso, locale = 'en') {
  const code = normalizeIso(iso);
  if (!code) return '';
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      const display = new Intl.DisplayNames([locale], { type: 'region' });
      return display.of(code) || code;
    }
  } catch {
    // Intl.DisplayNames is not available in every old webview: the ISO code
    // is still an honest, non-invented label.
  }
  return code;
}

export function countryLabelFromIso(iso, locale = 'en') {
  const name = countryNameFromIso(iso, locale);
  const flag = countryFlagFromIso(iso);
  if (flag && name) return `${flag} ${name}`;
  return name || flag || '';
}
