function venueName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, '')
    .trim().replace(/\s+/g, ' ').toLowerCase();
}

function currency(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : '';
}

/** Legacy reservations can contain both a stale currency and an incorrect venue ID. */
export function resolveReservaMoneda(reserva, sedesMap = {}) {
  const venues = Array.isArray(sedesMap) ? sedesMap : Object.values(sedesMap || {});
  const name = venueName(reserva?.sede_nombre || reserva?.nombre_sede
    || reserva?.sede?.nombre || (typeof reserva?.sede === 'string' ? reserva.sede : ''));
  const id = String(reserva?.sede_id ?? '').trim();
  const byId = venues.find((venue) => id && String(venue?.id ?? '').trim() === id);
  if (name) {
    const matches = venues.filter((venue) => venueName(venue?.nombre) === name);
    const currencies = [...new Set(matches.map((venue) => currency(venue?.moneda)).filter(Boolean))];
    if (currencies.length === 1) return currencies[0];
    if (matches.includes(byId) && currency(byId?.moneda)) return currency(byId.moneda);
  }
  if (byId && (!name || venueName(byId.nombre) === name) && currency(byId.moneda)) return currency(byId.moneda);
  return currency(reserva?.moneda) || 'ARS';
}
