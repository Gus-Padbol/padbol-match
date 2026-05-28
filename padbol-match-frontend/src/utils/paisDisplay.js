const PAIS_ISO_DISPLAY = {
  AR: '🇦🇷 Argentina',
  ES: '🇪🇸 España',
  US: '🇺🇸 Estados Unidos',
  IT: '🇮🇹 Italia',
  BR: '🇧🇷 Brasil',
  UY: '🇺🇾 Uruguay',
  CL: '🇨🇱 Chile',
  MX: '🇲🇽 México',
  FR: '🇫🇷 Francia',
  DE: '🇩🇪 Alemania',
  PT: '🇵🇹 Portugal',
  RO: '🇷🇴 Rumania',
  CO: '🇨🇴 Colombia',
  PE: '🇵🇪 Perú',
  PY: '🇵🇾 Paraguay',
  BO: '🇧🇴 Bolivia',
  VE: '🇻🇪 Venezuela',
};

const ISO2_RE = /^[A-Za-z]{2}$/;
const FLAG_PAIR_RE = /^[\u{1F1E6}-\u{1F1FF}]{2}/u;

/**
 * @param {string} codigo ISO-2, "🇦🇷 Argentina" u otro valor guardado en perfil.pais
 * @returns {string}
 */
export function getPaisDisplay(codigo) {
  const raw = String(codigo || '').trim();
  if (!raw) return '';

  if (FLAG_PAIR_RE.test(raw)) {
    return raw;
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  const first = parts[0] || '';

  if (ISO2_RE.test(first)) {
    const mapped = PAIS_ISO_DISPLAY[first.toUpperCase()];
    if (mapped) return mapped;
    return first.toUpperCase();
  }

  if (ISO2_RE.test(raw)) {
    const mapped = PAIS_ISO_DISPLAY[raw.toUpperCase()];
    return mapped || raw.toUpperCase();
  }

  return raw;
}
