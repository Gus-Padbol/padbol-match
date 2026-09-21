import fs from 'fs';
import path from 'path';
import i18n from './index';
import en from './locales/en.json';

const KEYS = Object.keys(en.teamRegistration).map((key) => `teamRegistration.${key}`);
const PARAMS = { count: 4, tournament: 'Open', url: 'https://example.test', filled: 2, total: 4, status: 'open', team: 'Wolves', deadline: 'Friday' };

describe('tournament team registration internationalization', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves the complete registration journey', async (lang) => {
    await i18n.changeLanguage(lang);
    KEYS.forEach((key) => {
      const value = i18n.t(key, PARAMS);
      expect(typeof value).toBe('string');
      expect(value.trim()).not.toBe('');
      expect(value).not.toBe(key);
      expect(value).not.toMatch(/{{\s*\w+\s*}}/);
    });
  });

  test.each(['ro', 'cs'])('%s uses direct editorial copy', async (lang) => {
    await i18n.changeLanguage('en');
    const english = Object.fromEntries(KEYS.map((key) => [key, i18n.t(key)]));
    await i18n.changeLanguage(lang);
    KEYS.forEach((key) => expect(i18n.t(key)).not.toBe(english[key]));
  });

  it('removes visible Spanish literals from the registration page', () => {
    const source = fs.readFileSync(path.join(__dirname, '../pages/FormEquipos.jsx'), 'utf8');
    [
      'Nombre del equipo', 'Busco compañero', 'Agregar compañero', 'Confirmar mi lugar',
      'Gestión de equipos y torneo', 'Inscripción al torneo', '¿Disolver el equipo?',
      'No se pudo cargar el equipo.', 'Completa tu perfil para participar en torneos',
    ].forEach((literal) => expect(source).not.toContain(`'${literal}'`));
  });
});
