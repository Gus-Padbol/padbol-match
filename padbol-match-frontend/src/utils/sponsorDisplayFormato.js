/** @typedef {'ticker' | 'card' | 'ambos'} SponsorDisplayFormato */

export const SPONSOR_FORMATO_OPTIONS = [
  { value: 'ticker', label: 'Ticker horizontal' },
  { value: 'card', label: 'Card destacada' },
  { value: 'ambos', label: 'Ticker + Card' },
];

/**
 * @param {unknown} raw
 * @returns {SponsorDisplayFormato}
 */
export function normalizeSponsorFormato(raw) {
  const v = String(raw ?? 'ticker').trim().toLowerCase();
  if (v === 'card' || v === 'ambos') return v;
  return 'ticker';
}

/** @param {unknown} row */
export function sponsorRowMatchesTickerFormato(row) {
  const f = normalizeSponsorFormato(row?.formato);
  return f === 'ticker' || f === 'ambos';
}

/** @param {unknown} row */
export function sponsorRowMatchesCardFormato(row) {
  const f = normalizeSponsorFormato(row?.formato);
  return f === 'card' || f === 'ambos';
}

/** @param {unknown} row */
export function etiquetaFormatoSponsorRow(row) {
  const f = normalizeSponsorFormato(row?.formato);
  const hit = SPONSOR_FORMATO_OPTIONS.find((o) => o.value === f);
  return hit?.label ?? 'Ticker horizontal';
}

/** @param {unknown} item fila o ítem ya normalizado para ticker */
export function sponsorItemMatchesTickerFormato(item) {
  if (item == null || item.formato === undefined || item.formato === null || item.formato === '') {
    return true;
  }
  return sponsorRowMatchesTickerFormato(item);
}

/** @param {unknown} item */
export function sponsorItemMatchesCardFormato(item) {
  if (item == null || item.formato === undefined || item.formato === null || item.formato === '') {
    return false;
  }
  return sponsorRowMatchesCardFormato(item);
}

/** @param {unknown} row */
export function sponsorRowToCardSlot(row) {
  if (!row || !sponsorRowMatchesCardFormato(row)) return null;
  const nombre = String(row.nombre ?? '').trim();
  if (!nombre) return null;
  return {
    imagen_url: String(row.logo_url ?? row.imagen_url ?? '').trim(),
    url_destino: String(row.url_destino ?? '').trim(),
    texto_corto: nombre,
  };
}
