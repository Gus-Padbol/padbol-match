/**
 * Guards de maquetación del marcador móvil (ScoreboardControl):
 * cabecera de altura fija + bloque de resultado alineado entre tarjetas.
 */
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../styles/ScoreboardControl.css');
const jsxPath = path.join(__dirname, '../pages/ScoreboardControl.jsx');
const css = fs.readFileSync(cssPath, 'utf8');
const jsx = fs.readFileSync(jsxPath, 'utf8');

describe('ScoreboardControl mobile team card layout', () => {
  it('reserva altura fija para nombre de equipo (hasta 2 líneas)', () => {
    expect(css).toMatch(/--sc-team-name-h:/);
    expect(css).toMatch(/\.sc-team-name-row\s*\{[^}]*height:\s*var\(--sc-team-name-h\)/s);
    expect(css).toMatch(/-webkit-line-clamp:\s*2/);
    expect(css).toMatch(/line-clamp:\s*2/);
  });

  it('reserva zona fija para dos jugadores con número siempre visible', () => {
    expect(css).toMatch(/--sc-players-h:/);
    expect(css).toMatch(/\.sc-players\s*\{[^}]*height:\s*var\(--sc-players-h\)/s);
    expect(css).toMatch(/\.sc-player__num\s*\{[^}]*flex:\s*0 0 auto/s);
    expect(css).toMatch(/\.sc-player__name\s*\{[^}]*text-overflow:\s*ellipsis/s);
    expect(jsx).toMatch(/function TeamPlayersBlock/);
    expect(jsx).toMatch(/sc-player__num/);
    expect(jsx).toMatch(/sc-player__name/);
  });

  it('agrupa resultado / Games / Sets / + POINT en bloque posterior a la cabecera', () => {
    expect(jsx).toMatch(/sc-team-card__header/);
    expect(jsx).toMatch(/sc-team-card__score-block/);
    expect(css).toMatch(/\.sc-team-card__score-block/);
    expect(css).toMatch(/\.sc-game-score\s*\{[^}]*height:\s*var\(--sc-score-h\)/s);
    expect(css).toMatch(/\.sc-stats\s*\{[^}]*height:\s*var\(--sc-stats-h\)/s);
    expect(css).toMatch(/\.sc-point-btn\s*\{[^}]*height:\s*var\(--sc-point-h\)/s);
  });

  it('incluye ajustes para anchos tipo iPhone', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*430px\)/);
    expect(css).toMatch(/@media\s*\(max-width:\s*360px\)/);
  });

  it('no reduce tipografía de jugadores por debajo de 12px en mobile', () => {
    const mobileBlock = css.slice(css.indexOf('@media (max-width: 430px)'));
    expect(mobileBlock).toMatch(/\.sc-player__name\s*\{[^}]*font-size:\s*12px/s);
    expect(mobileBlock).not.toMatch(/\.sc-player__name\s*\{[^}]*font-size:\s*1[01]px/s);
  });
});
