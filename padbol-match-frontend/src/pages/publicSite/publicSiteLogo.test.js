/**
 * Regresión del logo oficial en la web pública (/plataforma).
 *
 * Header: logo pequeño. Hero: logo grande → claim → subtítulo → CTAs.
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

  it('Hero y Header usan la variante tight', () => {
    expect(hero).toMatch(/variant=["']on-dark-tight["']/);
    expect(layout).toMatch(/variant=["']on-dark-tight["']/);
    expect(hero).toMatch(/ps-hero__logo/);
    expect(hero).not.toMatch(/public-site-hero__brand/);
  });

  it('Hero se dimensiona por ancho (protagonista) y no por altura del lienzo', () => {
    const rule = css.match(/\.ps-hero__logo\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule[0]).toMatch(/width:\s*clamp\(250px,\s*82vw,\s*330px\)\s*!important/);
    expect(rule[0]).toMatch(/height:\s*auto\s*!important/);
    expect(rule[0]).toMatch(/object-fit:\s*contain/);
    expect(rule[0]).not.toMatch(/margin:\s*-\d/);
    expect(css).toMatch(/clamp\(320px,\s*48vw,\s*430px\)/);
    expect(css).toMatch(/clamp\(420px,\s*36vw,\s*560px\)/);
  });

  it('Header se dimensiona por ancho sin empujar la navegación', () => {
    const rule = css.match(/\.public-site__brand-logo\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule[0]).toMatch(/width:\s*min\(140px,\s*42vw\)\s*!important/);
    expect(rule[0]).toMatch(/height:\s*auto\s*!important/);
    expect(rule[0]).toMatch(/object-fit:\s*contain/);
  });

  it('logo aparece antes del claim en el Hero', () => {
    const logoIdx = hero.indexOf('ps-hero__logo');
    const titleIdx = hero.indexOf('ps-hero__claim');
    const leadIdx = hero.indexOf('ps-hero__lead');
    const ctasIdx = hero.indexOf('ps-hero__ctas');
    const mediaIdx = hero.indexOf('ps-hero__media');
    expect(logoIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(-1);
    expect(logoIdx).toBeLessThan(titleIdx);
    expect(titleIdx).toBeLessThan(leadIdx);
    expect(leadIdx).toBeLessThan(ctasIdx);
    expect(ctasIdx).toBeLessThan(mediaIdx);
    expect(hero).not.toMatch(/public-site-hero__pillars/);
    expect(hero).not.toMatch(/publicSite\.hero\.pillars/);
  });
});
