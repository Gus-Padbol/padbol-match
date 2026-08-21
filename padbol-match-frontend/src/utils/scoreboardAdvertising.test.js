import {
  SCOREBOARD_AD_DEFAULT_PLACEMENTS,
  normalizeScoreboardPlacements,
  sponsorsForScoreboardPlacement,
} from './scoreboardAdvertising';

describe('scoreboard advertising placements', () => {
  it('keeps legacy sponsors visible in every approved placement', () => {
    expect(normalizeScoreboardPlacements(null)).toEqual(SCOREBOARD_AD_DEFAULT_PLACEMENTS);
  });

  it('filters and orders each placement independently', () => {
    const rows = [
      { id: 1, nombre: 'Ticker', scoreboard_placements: ['ticker'], scoreboard_order: 2 },
      { id: 2, nombre: 'Set first', scoreboard_placements: ['set_break'], scoreboard_order: 1 },
      { id: 3, nombre: 'Set second', scoreboard_placements: ['set_break'], scoreboard_order: 3 },
    ];
    expect(sponsorsForScoreboardPlacement(rows, 'ticker').map((row) => row.nombre)).toEqual(['Ticker']);
    expect(sponsorsForScoreboardPlacement(rows, 'set_break').map((row) => row.nombre)).toEqual(['Set first', 'Set second']);
  });
});
