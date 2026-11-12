/**
 * Display-only name formatter for the public TV board.
 *
 * Equivalent contract to the native b31 helper (commit 371cf5d8); the native
 * helper is not imported or modified. It never mutates or reorders the source,
 * IDs, lookup keys or raw values. Only tokens made entirely of uppercase
 * letters are title-cased; mixed tokens such as McDonald or de la Cruz are
 * returned unchanged.
 */
const PARTICLES = new Set(['de', 'la', 'del', 'los', 'las', 'y', 'e', 'van', 'von']);
const ROMAN_FINAL = /^[IVXLCDM]+$/;

function isAllUppercaseToken(token) {
  const upper = token.toLocaleUpperCase('es');
  const lower = token.toLocaleLowerCase('es');
  return token === upper && token !== lower;
}

function titleToken(token, first, last) {
  const lower = token.toLocaleLowerCase('es');
  if (last && ROMAN_FINAL.test(lower.toLocaleUpperCase('es'))) return token;
  if (!first && PARTICLES.has(lower)) return lower;
  return lower.replace(/(^|['’\-/])(\p{L})/gu, (_, separator, letter) => separator + letter.toLocaleUpperCase('es'));
}

function formatTokens(value) {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) return raw;
  const parts = raw.split(/(\s+)/);
  const wordIndexes = parts.map((part, index) => (/\S/.test(part) ? index : -1)).filter((index) => index >= 0);
  return parts.map((part, index) => {
    if (!/\S/.test(part)) return part;
    if (!isAllUppercaseToken(part)) return part;
    return titleToken(part, index === wordIndexes[0], index === wordIndexes[wordIndexes.length - 1]);
  }).join('');
}

export function formatDisplayName(value) {
  return formatTokens(value);
}

/** Team labels such as “A / B” use the same display contract. */
export function formatTeamDisplayName(value) {
  const raw = typeof value === 'string' ? value : '';
  return raw.split(/(\/)/).map((part) => (part === '/' ? part : formatTokens(part))).join('');
}
