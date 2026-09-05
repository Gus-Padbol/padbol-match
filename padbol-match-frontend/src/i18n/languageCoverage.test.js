import en from './locales/en.json';
import i18n from './index';
import { getLocaleFallbacks } from './tSafe';
import { PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';

function flattenLocale(obj, prefix = '', out = {}) {
  Object.entries(obj || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenLocale(value, path, out);
    } else {
      out[path] = String(value);
    }
  });
  return out;
}

describe('language coverage', () => {
  const englishKeys = Object.keys(flattenLocale(en));

  it('resuelve todas las claves conocidas para cada idioma publicado', () => {
    PADBOL_LANGUAGE_CODES.forEach((language) => {
      const fallbacks = getLocaleFallbacks(language);
      englishKeys.forEach((key) => {
        expect(fallbacks[key]).toBeTruthy();
      });
    });
  });

  it('no devuelve claves técnicas al cambiar entre los 20 idiomas', async () => {
    for (const language of PADBOL_LANGUAGE_CODES) {
      await i18n.changeLanguage(language);
      for (const key of englishKeys) {
        expect(i18n.t(key, { lng: language })).not.toBe(key);
      }
    }
  });

  it.each([
    ['es', 'Para jugadores'],
    ['it', 'Per i giocatori'],
    ['ro', 'Pentru jucători'],
    ['fr', 'Pour les joueurs'],
    ['cs', 'Pro hráče'],
  ])('cambia realmente el contenido público a %s', async (language, expected) => {
    await i18n.changeLanguage(language);
    expect(i18n.language).toBe(language);
    expect(i18n.t('publicSite.nav.players')).toBe(expected);
  });

  it('mantiene en rumano los recorridos prioritarios para jugadores', async () => {
    await i18n.changeLanguage('ro');

    expect(i18n.t('auth.login')).toBe('Autentificare');
    expect(i18n.t('auth.firstName')).toBe('Prenume');
    expect(i18n.t('auth.handednessLeft')).toBe('Stângaci');
    expect(i18n.t('nav.jugar')).toBe('Joacă');
    expect(i18n.t('reservas.heroTitle')).toBe('Rezervă-ți terenul');
    expect(i18n.t('reservas.court')).toBe('Teren');
    expect(i18n.t('torneos.listado.tabActivos')).toBe('În curând / În desfășurare');
    expect(i18n.t('perfilPublico.shareProfile')).toBe('Distribuie profilul');
    expect(i18n.t('publicSite.nav.platform')).toBe('Platformă');
    expect(i18n.t('publicSite.hero.globe.labels.courts')).toBe('Terenuri');
    expect(i18n.t('publicSite.venuePath.items.reports.title')).toBe('Administrare');
  });

  it('nu folosește în română termeni juridici sau alte sporturi pentru teren', async () => {
    await i18n.changeLanguage('ro');
    const priorityKeys = [
      'reservas.titulo', 'reservas.heroTitle', 'reservas.chooseCourt',
      'reservas.court', 'reservas.labelCourt', 'reservas.searchCourtsError',
      'publicSite.hero.globe.labels.courts', 'publicSite.playerPath.items.book.text',
      'publicSite.about.text',
    ];
    const copy = priorityKeys.map((key) => i18n.t(key)).join(' ').toLowerCase();

    expect(copy).not.toMatch(/tribunal|instanță|baschet/);
  });
});
