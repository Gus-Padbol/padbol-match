// PostgreSQL timestamps can carry six fractional digits; preserve the last
// three rather than ordering updates only to JavaScript's millisecond precision.
function timestampMicros(value) {
  if (typeof value !== 'string') return null;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  const fraction = value.match(/\.(\d+)/)?.[1] || '';
  const remainder = Number((fraction + '000000').slice(3, 6));
  return [millis, remainder];
}

export function preferNewestScoreboard(current, incoming) {
  if (!current || !incoming || String(current.id) !== String(incoming.id)) return incoming;
  const previous = timestampMicros(current.updated_at);
  const next = timestampMicros(incoming.updated_at);
  if (previous !== null && (next === null || next[0] < previous[0]
    || (next[0] === previous[0] && next[1] < previous[1]))) return current;
  return incoming;
}
