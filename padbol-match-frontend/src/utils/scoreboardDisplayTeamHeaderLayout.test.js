/**
 * Layout guards — cabecera de equipos TV (LED de saque no debe desalinear columnas).
 */
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../styles/ScoreboardDisplay.css');
const jsxPath = path.join(__dirname, '../components/scoreboard/ScoreboardBoard.jsx');
const css = fs.readFileSync(cssPath, 'utf8');
const jsx = fs.readFileSync(jsxPath, 'utf8');

function extractRuleBody(source, selector) {
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    's',
  );
  const m = source.match(re);
  expect(m).toBeTruthy();
  return m[1];
}

describe('ScoreboardDisplay TV team header alignment', () => {
  it('reserva altura fija de nombre (hasta 2 líneas) en ambos paneles', () => {
    const block = extractRuleBody(css, '.sb-team-name-block');
    const name = extractRuleBody(css, '.sb-panel .sb-team-name');
    expect(block).toMatch(/--sb-team-name-h:\s*calc\(2\s*\*/);
    expect(block).toMatch(/height:\s*var\(--sb-team-header-h\)/);
    expect(block).toMatch(/min-height:\s*var\(--sb-team-header-h\)/);
    expect(block).toMatch(/max-height:\s*var\(--sb-team-header-h\)/);
    expect(name).toMatch(/-webkit-line-clamp:\s*2|line-clamp:\s*2/);
    expect(name).toMatch(/height:\s*var\(--sb-team-name-h\)/);
  });

  it('LED de saque está fuera del flujo (position absolute)', () => {
    const dot = extractRuleBody(css, '.sb-team-serve-dot');
    expect(dot).toMatch(/position:\s*absolute/);
    expect(dot).toMatch(/width:\s*16px/);
    expect(dot).toMatch(/height:\s*16px/);
    expect(dot).toMatch(/background:\s*#00ff88/);
    expect(dot).toMatch(/animation:\s*sb-serve-dot-pulse/);
  });

  it('gutter simétrico para el LED sin empujar el nombre al flujo del punto', () => {
    const block = extractRuleBody(css, '.sb-team-name-block');
    expect(block).toMatch(/position:\s*relative/);
    expect(block).toMatch(/padding-left:\s*var\(--sb-team-serve-gutter\)/);
  });

  it('meta (jersey) tiene altura fija; LED no vive dentro de meta', () => {
    const meta = extractRuleBody(css, '.sb-team-name-meta');
    expect(meta).toMatch(/height:\s*var\(--sb-team-meta-h\)/);
    const teamNameRow = jsx.slice(
      jsx.indexOf('function TeamNameRow'),
      jsx.indexOf('function SetHistory'),
    );
    expect(teamNameRow).toMatch(/sb-team-serve-dot/);
    expect(teamNameRow).toMatch(/sb-team-name-block/);
    // LED sibling del nombre, no hijo de meta
    const metaStart = teamNameRow.indexOf('sb-team-name-meta');
    const metaChunk = teamNameRow.slice(metaStart, metaStart + 280);
    expect(metaChunk).not.toMatch(/sb-team-serve-dot/);
  });

  it('no altera ScoreboardControl (marcador móvil / árbitro)', () => {
    const controlCss = fs.readFileSync(
      path.join(__dirname, '../styles/ScoreboardControl.css'),
      'utf8',
    );
    // Este cambio no debe tocar el control móvil en este bloque
    expect(jsx).not.toMatch(/sc-team-serve-dot/);
    expect(controlCss).toMatch(/\.sc-team-serve-dot/);
  });
});
