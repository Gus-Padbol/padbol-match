export const SCOREBOARD_AD_PLACEMENTS = [
  { value: 'ticker', label: 'Banda inferior durante el partido' },
  { value: 'game_break', label: 'Pieza breve entre games / cambio de lado' },
  { value: 'rest', label: 'Carrusel durante descansos' },
  { value: 'set_break', label: 'Carrusel al terminar un set' },
  { value: 'waiting', label: 'Pantalla entre partidos' },
];

export const SCOREBOARD_AD_DEFAULT_PLACEMENTS = SCOREBOARD_AD_PLACEMENTS.map(({ value }) => value);

export function normalizeScoreboardPlacements(raw) {
  const list = Array.isArray(raw) ? raw : SCOREBOARD_AD_DEFAULT_PLACEMENTS;
  const allowed = new Set(SCOREBOARD_AD_DEFAULT_PLACEMENTS);
  const normalized = [...new Set(list.map((item) => String(item || '').trim()).filter((item) => allowed.has(item)))];
  return normalized.length ? normalized : SCOREBOARD_AD_DEFAULT_PLACEMENTS;
}

export function sponsorsForScoreboardPlacement(sponsors, placement) {
  return (Array.isArray(sponsors) ? sponsors : [])
    .filter((sponsor) => sponsor && String(sponsor.nombre || '').trim())
    .filter((sponsor) => normalizeScoreboardPlacements(sponsor.scoreboard_placements).includes(placement))
    .sort((a, b) => Number(a.scoreboard_order || 0) - Number(b.scoreboard_order || 0));
}
