/** One event clock for fixture, bracket and match detail, independent of the viewer. */
export function tournamentEventTimeZone(torneo, state) {
  return state?.config?.timezone || torneo?.plan_nations?.timezone || torneo?.plan_nations?.config?.timezone || undefined;
}
export function formatTournamentEventTime(value, timeZone, dateStyle = 'short') {
  if (!value) return '';
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  try {
    const label = instant.toLocaleString('es-AR', {dateStyle, timeStyle:'short', hourCycle:'h23', ...(timeZone ? {timeZone} : {})});
    return timeZone ? `${label} · ${timeZone}` : label;
  } catch { return 'Horario no confirmado'; }
}
