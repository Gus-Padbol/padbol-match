/**
 * Header fijo permanente + compensación de anchors en /plataforma.
 */

const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, 'publicSite.css'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, 'PublicSiteLayout.jsx'), 'utf8');

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

  it('conserva logo, navegación, idioma e ingreso a la cuenta', () => {
    expect(layout).toMatch(/padbol-match-logo-white\.svg/);
    expect(layout).toMatch(/LanguageSwitcher/);
    expect(layout).toMatch(/PUBLIC_SITE_NAV_ITEMS|public-site__desktop-nav/);
    expect(layout).toMatch(/resolvePublicAccountAccessHref/);
    expect(layout.match(/to=\{loginHref\}/g)).toHaveLength(2);
  });

  it('presenta el menú móvil como drawer fijo sin ocupar espacio del hero', () => {
    const drawer = css.match(/\.public-site__mobile-nav\s*\{[^}]*\}/);
    expect(drawer).not.toBeNull();
    expect(drawer[0]).toMatch(/position:\s*fixed/);
    expect(drawer[0]).toMatch(/right:\s*0/);
    expect(drawer[0]).toMatch(/width:\s*min\(82vw,\s*380px\)/);
    expect(drawer[0]).toMatch(/overflow-y:\s*auto/);
    expect(css).toMatch(/\.public-site__mobile-backdrop\s*\{[\s\S]*?position:\s*fixed/);
    expect(css).toMatch(/@media \(min-width:\s*1024px\)[\s\S]*?\.public-site__menu-button\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.public-site__mobile-nav,[\s\S]*?\.public-site__mobile-backdrop\s*\{\s*display:\s*none !important/);
  });

  it('lleva los anchors a plataforma cuando el header se usa en otra ruta pública', () => {
    expect(layout).toMatch(/location\.pathname === PUBLIC_SITE_PATH/);
    expect(layout).toMatch(/`\$\{PUBLIC_SITE_PATH\}\$\{hash\}`/);
    expect(layout).toMatch(/if \(!document\.getElementById\(id\)\) return/);
    expect(layout).toMatch(/scrollToHash\(location\.hash\)/);
  });
});
