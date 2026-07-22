/**
 * Regresión del logo oficial en la web pública (/plataforma).
 *
 * El logo imagen vive en Header (y footer/download).
 * El Hero usa marca textual "Padbol Match" (sin imagen duplicada).
 */

const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, 'publicSite.css'), 'utf8');
const brandConst = fs.readFileSync(
  path.join(__dirname, '../../constants/padbolBrandLogo.js'),
  'utf8',
);
const hero = fs.readFileSync(path.join(__dirname, 'sections/HeroSection.jsx'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, 'PublicSiteLayout.jsx'), 'utf8');

describe('logo oficial de la web pública', () => {
  it('expone el asset on-dark recortado (sin lienzo negro)', () => {
    expect(brandConst).toMatch(
      /PADBOL_LOGO_ON_DARK_TIGHT\s*=\s*['"]\/brand\/padbol-match-logo-on-dark-tight\.png['"]/,
    );
    const assetPath = path.join(
      __dirname,
      '../../../public/brand/padbol-match-logo-on-dark-tight.png',
    );
    expect(fs.existsSync(assetPath)).toBe(true);
  });

  it('Header usa la variante tight; Hero no duplica el logo imagen', () => {
    expect(layout).toMatch(/variant=["']on-dark-tight["']/);
    expect(hero).not.toMatch(/PadbolBrandLogo/);
    expect(hero).not.toMatch(/public-site-hero__logo/);
    expect(hero).toMatch(/public-site-hero__brand/);
  });

  it('Header se dimensiona por ancho sin empujar la navegación', () => {
    const rule = css.match(/\.public-site__brand-logo\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule[0]).toMatch(/width:\s*min\(140px,\s*42vw\)\s*!important/);
    expect(rule[0]).toMatch(/height:\s*auto\s*!important/);
    expect(rule[0]).toMatch(/object-fit:\s*contain/);
  });

  it('marca textual Padbol Match está estilizada en CSS (sin tipografía externa)', () => {
    expect(css).toMatch(/\.public-site-hero__brand\s*\{/);
    expect(css).toMatch(/\.public-site-hero__brand-match\s*\{/);
    expect(css).not.toMatch(/@import\s+url\(/);
    expect(css).not.toMatch(/fonts\.google/);
  });
});
