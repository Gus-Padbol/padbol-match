/**
 * Layout guards for scoreboard admin player rows (BUG-01: foto no debe desalinear la fila).
 */
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../pages/AdminDashboard.css');
const jsxPath = path.join(__dirname, '../pages/AdminDashboard.jsx');
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

describe('Admin scoreboard jugador row — foto sin desalinear (BUG-01)', () => {
  it('reserva avatar fijo con object-fit cover', () => {
    const avatar = extractRuleBody(css, '.admin-scoreboard-jugador-row__foto-avatar');
    const preview = extractRuleBody(css, '.admin-scoreboard-jugador-row__foto-preview');
    const fallback = extractRuleBody(css, '.admin-scoreboard-jugador-row__foto-fallback');
    expect(avatar).toMatch(/width:\s*36px/);
    expect(avatar).toMatch(/height:\s*36px/);
    expect(avatar).toMatch(/flex:\s*0\s+0\s+36px/);
    expect(preview).toMatch(/object-fit:\s*cover/);
    expect(fallback).toMatch(/width:\s*100%/);
    expect(fallback).toMatch(/height:\s*100%/);
  });

  it('bloque foto tiene ancho fijo para no empujar acciones', () => {
    const foto = extractRuleBody(css, '.admin-scoreboard-jugador-row__foto');
    expect(foto).toMatch(/width:\s*36px/);
    expect(foto).toMatch(/min-width:\s*36px/);
    expect(foto).toMatch(/max-width:\s*36px/);
    expect(foto).toMatch(/flex-shrink:\s*0/);
  });

  it('nombre cede espacio con min-width 0 y ellipsis', () => {
    const nombre = extractRuleBody(css, '.admin-scoreboard-jugador-row__nombre');
    expect(nombre).toMatch(/min-width:\s*0/);
    expect(nombre).toMatch(/text-overflow:\s*ellipsis/);
    expect(nombre).toMatch(/overflow:\s*hidden/);
  });

  it('fila en grilla alineada, sin desborde, altura mínima estable', () => {
    const row = extractRuleBody(css, '.admin-scoreboard-jugador-row');
    expect(row).toMatch(/display:\s*grid/);
    expect(row).toMatch(/grid-template-columns:\s*30px\s+46px\s+minmax\(0,\s*1fr\)/);
    expect(row).toMatch(/align-items:\s*center/);
    expect(row).toMatch(/min-width:\s*0/);
    expect(row).toMatch(/min-height:\s*44px/);
  });

  it('la foto se carga desde un único control, sin cruces de iconos', () => {
    const fallback = extractRuleBody(css, '.admin-scoreboard-jugador-row__foto-fallback');
    expect(fallback).toMatch(/position:\s*relative/);
    expect(jsx).toMatch(/htmlFor=\{fotoInputId\}/);
  });

  it('markup siempre renderiza contenedor de avatar (con o sin foto)', () => {
    expect(jsx).toMatch(/admin-scoreboard-jugador-row__foto-avatar/);
    expect(jsx).toMatch(/admin-scoreboard-jugador-row__foto-fallback/);
    expect(jsx).toMatch(/admin-scoreboard-jugador-row__foto-preview/);
  });
});
