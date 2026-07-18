const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const publicBrand = path.join(root, 'public/brand');

describe('Padbol brand logos oficiales (horizontales)', () => {
  it('incluye variantes on-light y on-dark en public/brand', () => {
    expect(fs.existsSync(path.join(publicBrand, 'padbol-match-logo-on-light.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicBrand, 'padbol-match-logo-on-dark.png'))).toBe(true);
  });

  it('constantes y componente apuntan a /brand/', () => {
    const brandJs = fs.readFileSync(path.join(__dirname, 'padbolBrandLogo.js'), 'utf8');
    const comp = fs.readFileSync(path.join(__dirname, '../components/PadbolBrandLogo.jsx'), 'utf8');
    expect(brandJs).toMatch(/\/brand\/padbol-match-logo-on-light\.png/);
    expect(brandJs).toMatch(/\/brand\/padbol-match-logo-on-dark\.png/);
    expect(comp).toMatch(/PadbolBrandLogo/);
    expect(comp).toMatch(/padbolBrandLogoSrc|PADBOL_LOGO_ON_/);
  });

  it('no quedan referencias activas a logo.svg de React ni paths viejos en pantallas clave', () => {
    const files = [
      '../pages/AccesoCuenta.jsx',
      '../pages/LandingPage.jsx',
      '../pages/HomePublic.jsx',
      '../pages/AdminDashboard.jsx',
      '../pages/ScoreboardCanchaDisplay.jsx',
      '../components/scoreboard/ScoreboardBoard.jsx',
      '../components/LanguageSelectScreen.jsx',
    ].map((rel) => fs.readFileSync(path.join(__dirname, rel), 'utf8'));
    const joined = files.join('\n');
    expect(joined).not.toMatch(/from ['"]\.\.\/logo\.svg['"]/);
    expect(joined).not.toMatch(/src=["']\/logo-padbol-match\.png["']/);
    expect(joined).not.toMatch(/src=["']\/padbol-match-logo\.png["']/);
  });
});
