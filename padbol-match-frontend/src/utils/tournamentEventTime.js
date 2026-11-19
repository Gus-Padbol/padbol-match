/** One event clock for fixture, bracket and match detail, independent of the viewer. */
export function tournamentEventTimeZone(torneo, state, partido = null) {
  const plan = torneo?.plan_nations || torneo?.planNations || torneo?.config?.nations || null;
  const explicit = partido?.timezone
    || partido?.slot_timezone
    || partido?.schedule?.timezone
    || state?.config?.timezone
    || plan?.timezone
    || plan?.config?.timezone
    || torneo?.timezone
    || torneo?.config?.timezone
    || torneo?.sede_timezone;
  if (explicit) return explicit;
  // Only the explicit Nations 57 master has a regional fallback. Others keep their own/undefined zone.
  return String(torneo?.id ?? torneo?.torneo_id ?? '') === '57' ? 'Europe/Rome' : undefined;
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
