import fs from 'fs';
import path from 'path';
import en from '../i18n/locales/en.json';

const dashboardSource = fs.readFileSync(
  path.join(__dirname, '../pages/AdminDashboard.jsx'),
  'utf8',
);
const promoSource = fs.readFileSync(
  path.join(__dirname, '../components/AdminHubPromoSedeSection.jsx'),
  'utf8',
);

function readPath(source, dottedPath) {
  return dottedPath.split('.').reduce((value, segment) => value && value[segment], source);
}

describe('QA English report — Admin panel', () => {
  it('contains complete English groups for Overview, Scoreboard and PadCoins', () => {
    expect(en.admin.overview.today).toBe('Today');
    expect(en.admin.overview.todayRevenue).toBe('TODAY’S REVENUE');
    expect(en.admin.scoreboard.title).toBe('Live scoreboard');
    expect(en.admin.scoreboard.selectFile).toBe('Select file');
    // El módulo sigue creciendo; verificamos el grupo y sus claves críticas
    // sin volver frágil el test por cada nueva etiqueta traducida.
    expect(Object.keys(en.admin.padcoins).length).toBeGreaterThanOrEqual(260);
    expect(en.admin.padcoins.title).toBe('PadCoins Benefits');
  });

  it('contains English My Venue, sponsor, facility and social labels', () => {
    expect(en.admin.sedes.editVenue).toBe('Edit venue');
    expect(en.admin.sedes.provinceState).toBe('Province / State');
    expect(en.admin.sedes.amenities.vestuarios).toBe('Locker rooms');
    expect(en.admin.sedes.saveSocialNetworks).toBe('Save social media');
    expect(en.admin.hub.promoActive).toBe('Active promotion');
  });

  it('does not leave the QA-reported Spanish labels hardcoded in visible JSX', () => {
    expect(dashboardSource).not.toMatch(/>\s*Licencia PADBOL Activa\s*</);
    expect(dashboardSource).not.toMatch(/>\s*Mis sponsors disponibles\s*</);
    expect(dashboardSource).not.toMatch(/>\s*Nueva reserva manual\s*</);
    expect(dashboardSource).not.toMatch(/>\s*\+ Nuevo Torneo\s*</);
    expect(dashboardSource).not.toMatch(/>\s*Guardar instalaciones\s*</);
    expect(promoSource).not.toMatch(/>\s*Promo activa\s*</);
    expect(promoSource).not.toMatch(/>\s*URL de imagen \(fondo de la card\)\s*</);
  });

  it('translates every PadCoins key currently rendered by the admin modules', () => {
    const padcoinsSources = [
      dashboardSource,
      fs.readFileSync(path.join(__dirname, '../components/AdminPadcoinsReportesSection.jsx'), 'utf8'),
    ].join('\n');
    const keys = [...padcoinsSources.matchAll(/["'](admin\.padcoins\.[^"'\s,)]+)["']/g)].map((match) => match[1]);
    const missing = [...new Set(keys)].filter((key) => typeof readPath(en, key) !== 'string');
    expect(missing).toEqual([]);
  });
});
