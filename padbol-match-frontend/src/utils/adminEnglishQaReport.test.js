import fs from 'fs';
import path from 'path';
import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';

const dashboardSource = fs.readFileSync(
  path.join(__dirname, '../pages/AdminDashboard.jsx'),
  'utf8',
);
const promoSource = fs.readFileSync(
  path.join(__dirname, '../components/AdminHubPromoSedeSection.jsx'),
  'utf8',
);

function flattenKeys(value, prefix = '', output = []) {
  Object.entries(value || {}).forEach(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flattenKeys(child, fullKey, output);
    } else {
      output.push(fullKey);
    }
  });
  return output;
}

describe('QA English report — Admin panel', () => {
  it('keeps English complete for every Spanish source key', () => {
    const englishKeys = new Set(flattenKeys(en));
    const missing = flattenKeys(es).filter((key) => !englishKeys.has(key));
    expect(missing).toEqual([]);
  });

  it('contains complete English groups for Overview, Scoreboard and PadCoins', () => {
    expect(en.admin.overview.today).toBe('Today');
    expect(en.admin.overview.todayRevenue).toBe('TODAY’S REVENUE');
    expect(en.admin.scoreboard.title).toBe('Live scoreboard');
    expect(en.admin.scoreboard.selectFile).toBe('Select file');
    expect(Object.keys(en.admin.padcoins)).toHaveLength(180);
    expect(en.admin.padcoins.title).toBe('PadCoins Benefits');
  });

  it('contains English My Venue, sponsor, facility and social labels', () => {
    expect(en.admin.sedes.editVenue).toBe('Edit venue');
    expect(en.admin.sedes.provinceState).toBe('Province / State');
    expect(en.admin.sedes.amenities.vestuarios).toBe('Locker rooms');
    expect(en.admin.sedes.saveSocialNetworks).toBe('Save social media');
    expect(en.admin.sedes.useAsHero).toBe('Use as hero');
    expect(en.admin.sedes.heroCurrent).toBe('Current hero');
    expect(en.admin.sedes.heroUpdated).toBe('Hero updated');
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
});
