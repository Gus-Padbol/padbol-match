import { preferNewestScoreboard } from './scoreboardVersion';
test('ignores a delayed update even within the same millisecond', () => {
  const current = { id: 'match', updated_at: '2026-10-21T12:00:00.123456+00:00', score_a: 30 };
  const older = { id: 'match', updated_at: '2026-10-21T12:00:00.123123+00:00', score_a: 15 };
  expect(preferNewestScoreboard(current, older)).toBe(current);
  expect(preferNewestScoreboard(current, { ...older, updated_at: '2026-10-21T12:00:00.123457Z' }).score_a).toBe(15);
});
test('does not replace a verified version with an unversioned event', () => {
  const current = { id: 'match', updated_at: '2026-10-21T12:00:00Z' };
  expect(preferNewestScoreboard(current, { id: 'match' })).toBe(current);
  expect(preferNewestScoreboard(null, { id: 'match' })).toEqual({ id: 'match' });
});
