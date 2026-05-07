const TZ_TORNEO_CALENDARIO = 'America/Argentina/Buenos_Aires';

export function ymdTodayTorneoTz() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_TORNEO_CALENDARIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const mo = parts.find((p) => p.type === 'month')?.value;
  const da = parts.find((p) => p.type === 'day')?.value;
  if (!y || !mo || !da) return null;
  return `${y}-${mo}-${da}`;
}

export function torneoFechaInicioYmd(fechaInicioStr) {
  const d = String(fechaInicioStr || '').trim();
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Solo calendario: fecha de juego estrictamente anterior a hoy (ART), sin mirar estado en BD. */
export function torneoFechaInicioEsPasadaCalendario(fechaInicioStr) {
  const inicio = torneoFechaInicioYmd(fechaInicioStr);
  const hoy = ymdTodayTorneoTz();
  if (!inicio || !hoy) return false;
  return inicio < hoy;
}
