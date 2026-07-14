import {
  formatJugadorActivity,
  formatJugadorUsername,
} from './adminJugadoresApi';

describe('adminJugadoresApi helpers', () => {
  it('formatJugadorUsername adds @', () => {
    expect(formatJugadorUsername('ana')).toBe('@ana');
    expect(formatJugadorUsername('@ana')).toBe('@ana');
    expect(formatJugadorUsername('')).toBe('');
  });

  it('formatJugadorActivity handles ISO dates', () => {
    expect(formatJugadorActivity('2026-07-01T12:00:00.000Z')).toMatch(/2026/);
    expect(formatJugadorActivity('')).toBe('');
  });
});
