import fs from 'fs';
import path from 'path';
import i18n from './index';
import en from './locales/en.json';

const KEYS = Object.keys(en.teamDetail).map((key) => `teamDetail.${key}`);

describe('team detail internationalization', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves the whole team journey', async (lang) => {
    await i18n.changeLanguage(lang);
    KEYS.forEach((key) => {
      const value = i18n.t(key, { tournament: 'Open', venue: 'Club', team: 'Wolves', link: 'https://example.test', player: 'Alex' });
      expect(typeof value).toBe('string');
      expect(value.trim()).not.toBe('');
      expect(value).not.toBe(key);
      expect(value).not.toMatch(/{{\s*\w+\s*}}/);
    });
  });

  test.each(['ro', 'cs'])('%s has direct editorial copy instead of English fallback', async (lang) => {
    await i18n.changeLanguage('en');
    const english = Object.fromEntries(KEYS.map((key) => [key, i18n.t(key)]));
    await i18n.changeLanguage(lang);
    KEYS.forEach((key) => expect(i18n.t(key)).not.toBe(english[key]));
  });

  it('does not leave visible Spanish literals in the team detail page', () => {
    const source = fs.readFileSync(path.join(__dirname, '../pages/EquipoVista.jsx'), 'utf8');
    [
      'Equipo completo', 'Invitar jugadores', 'Solicitudes pendientes', 'Pendiente de pago',
      'Disolver equipo', 'Salir del equipo', 'No se encontró el equipo.', 'Subir foto de equipo',
      'Toca el nombre para ver la ficha', 'Completa tu perfil para participar en torneos',
    ].forEach((literal) => expect(source).not.toContain(`'${literal}'`));
  });
});
