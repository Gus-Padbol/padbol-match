/** One event clock for fixture, bracket and match detail, independent of the viewer. */
export function tournamentEventTimeZone(torneo, state) {
  return state?.config?.timezone || torneo?.plan_nations?.timezone || torneo?.plan_nations?.config?.timezone || undefined;
}
export function tournamentEventInstant(value) {
  if (!value) return null;
  const raw = String(value).trim();
  // Legacy DB timestamps are timestamp-without-timezone values stored as UTC.
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(raw) ? `${raw}Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function formatTournamentEventTime(value, timeZone, dateStyle = 'short') {
  if (!value) return '';
  const instant = tournamentEventInstant(value);
  if (!instant) return '';
  if (Number.isNaN(instant.getTime())) return '';
  try {
    const label = instant.toLocaleString('es-AR', {dateStyle, timeStyle:'short', hourCycle:'h23', ...(timeZone ? {timeZone} : {})});
    return timeZone ? `${label} · ${timeZone}` : label;
  } catch { return 'Horario no confirmado'; }
}
