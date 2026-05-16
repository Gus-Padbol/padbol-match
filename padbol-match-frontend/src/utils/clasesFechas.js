/** Utilidades de calendario para clases (mismo criterio que ArmarPartido). */

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysISO(baseYmd, days) {
  const [y, m, da] = baseYmd.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, da);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function nextNDaysFrom(todayStr, count) {
  const n = Number(count);
  const len = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  return Array.from({ length: len }, (_, i) => addDaysISO(todayStr, i));
}

export function labelDiaCorta(iso, index) {
  if (index === 0) return 'Hoy';
  if (index === 1) return 'Mañana';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const w = d.toLocaleDateString('es', { weekday: 'short' });
  const day = d.getDate();
  const mo = d.toLocaleDateString('es', { month: 'short' });
  return `${w} ${day} ${mo}`;
}

export function diaSemanaFromFechaYmd(ymd) {
  const [y, mo, d] = String(ymd || '').split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getDay();
}

export function normalizeHoraClase(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Math.min(23, parseInt(m[1], 10));
  const mm = Math.min(59, parseInt(m[2], 10));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
