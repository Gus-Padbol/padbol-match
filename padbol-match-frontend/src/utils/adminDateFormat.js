/** Calendar dates keep their stored day; timestamps keep the user's local timezone. */
export function formatAdminDate(raw, { locale = 'es-AR', withTime = false, empty = '—' } = {}) {
  if (raw == null || raw === '') return empty;
  const value = String(raw).trim();
  const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  let date;
  if (calendar) {
    const [, year, month, day] = calendar.map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return empty;
  } else date = raw instanceof Date ? raw : new Date(value);
  if (Number.isNaN(date.getTime())) return empty;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      ...(calendar ? { timeZone: 'UTC' } : {}),
      ...(withTime && !calendar ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
    }).format(date);
  } catch { return empty; }
}
