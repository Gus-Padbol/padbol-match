/**
 * Header fijo permanente + compensación de anchors en /plataforma.
 */

const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, 'publicSite.css'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, 'PublicSiteLayout.jsx'), 'utf8');
const languageSwitcherCss = fs.readFileSync(
  path.join(__dirname, '../../components/LanguageSwitcher.css'),
  'utf8',
);

describe('header fijo y anchors de la web pública', () => {
  it('mantiene el header fijo en top con z-index suficiente', () => {
    const rule = css.match(/\.public-site__nav\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule[0]).toMatch(/position:\s*fixed/);
    expect(rule[0]).toMatch(/top:\s*0/);
    expect(rule[0]).toMatch(/z-index:\s*60/);
  });

  it('compensa el header fixed en el contenedor y en anchors', () => {
    expect(css).toMatch(/\.public-site\s*\{[\s\S]*?padding-top:\s*calc\(68px/);
    expect(css).toMatch(/scroll-margin-top:\s*calc\(var\(--ps-header-offset/);
    expect(css).toMatch(/--ps-header-offset:\s*calc\(68px/);
  });

  it('aplica glass al inicio y más sólido al scroll', () => {
    expect(css).toMatch(/\.public-site__nav\s*\{[\s\S]*?backdrop-filter:\s*blur/);
    expect(css).toMatch(/\.public-site__nav\.is-scrolled\s*\{/);
    expect(layout).toMatch(/is-scrolled/);
    expect(layout).toMatch(/useHeaderScrolled|window\.scrollY/);
  });

  it('conserva logo, navegación, idioma e Ingresar en el layout', () => {
    expect(layout).toMatch(/PadbolBrandLogo/);
    expect(layout).toMatch(/LanguageSwitcher/);
    expect(layout).toMatch(/PUBLIC_SITE_NAV_ITEMS|public-site__desktop-nav/);
    expect(layout).toMatch(/Ingresar|ctaLogin|PUBLIC_SITE_CTA/);
  });

  it('mantiene contraste claro en las opciones del selector público', () => {
    const landingMenu = languageSwitcherCss.match(
      /\.lang-switcher--landing \.lang-switcher__menu\s*\{[^}]*\}/,
    );
    const landingOption = languageSwitcherCss.match(
      /\.lang-switcher--landing \.lang-switcher__option\s*\{[^}]*\}/,
    );

    expect(landingMenu).not.toBeNull();
    expect(landingMenu[0]).toMatch(/background:\s*#1e293b/);
    expect(landingMenu[0]).toMatch(/color:\s*#f8fafc/);
    expect(landingOption).not.toBeNull();
    expect(landingOption[0]).toMatch(/color:\s*#f8fafc/);
  });
});
