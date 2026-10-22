// Database details belong in server logs, never in operator-facing messages.
export function adminErrorMessage(error, fallback) {
  const text = String(error?.message || error || '').trim();
  const technical = /schema cache|column .+does not exist|relation .+does not exist|permission denied for (table|function)|PGRST\d+|42P01|42703|public\.[a-z_]+/i;
  return !text || technical.test(text) ? fallback : text;
}
