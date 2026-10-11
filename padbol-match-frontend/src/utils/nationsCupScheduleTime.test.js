import { nationsCupScheduleInstant, nationsCupScheduleLocal } from './nationsCupScheduleTime';

test('Naples event time is stored as an instant and reloaded in the explicit event zone', () => {
  const stored = nationsCupScheduleInstant('2026-11-22T10:30', 'Europe/Rome');
  expect(stored).toBe('2026-11-22T09:30:00Z');
  expect(nationsCupScheduleLocal(stored, 'Europe/Rome')).toBe('2026-11-22T10:30');
  expect(nationsCupScheduleLocal(stored, 'America/Santo_Domingo')).toBe('2026-11-22T05:30');
});
test.each([['2026-11-22T10:30', 'Invalid/Zone'], ['2026-02-30T10:30','Europe/Rome'], ['2026-03-29T02:30','Europe/Rome'], ['2026-10-25T02:30','Europe/Rome'], ['', 'Europe/Rome']])('invalid or ambiguous schedules fail before saving: %s', (local, zone) => {
  expect(() => nationsCupScheduleInstant(local, zone)).toThrow();
});
test('summer time is resolved by the same explicit zone and malformed receipts stay empty', () => {
  expect(nationsCupScheduleInstant('2026-07-22T10:30', 'Europe/Rome')).toBe('2026-07-22T08:30:00Z');
  expect(nationsCupScheduleLocal('bad', 'Europe/Rome')).toBe('');
});
