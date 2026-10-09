import { formatAdminDate } from './adminDateFormat';
test('one numeric date convention has four-digit years across admin modules', () => {
  expect(formatAdminDate('2026-07-04')).toBe('04/07/2026');
  expect(formatAdminDate('2026-08-04')).toBe('04/08/2026');
  expect(formatAdminDate('2026-07-04', { locale: 'en-US' })).toBe('07/04/2026');
});
test('calendar dates keep their day and do not manufacture a midnight time', () => {
  expect(formatAdminDate('2026-07-04', { withTime: true })).toBe('04/07/2026');
  expect(formatAdminDate('2026-02-30')).toBe('—');
  expect(formatAdminDate('invalid')).toBe('—');
  expect(formatAdminDate(null, { empty: '' })).toBe('');
});
test('timestamps use local timezone and 24-hour time with full year', () => {
  const value = new Date(2026, 6, 13, 19, 0);
  expect(formatAdminDate(value, { withTime: true })).toBe('13/07/2026, 19:00');
});
