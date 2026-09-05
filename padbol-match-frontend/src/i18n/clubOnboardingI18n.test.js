import fs from 'fs';
import path from 'path';
import i18n from './index';
import en from './locales/en.json';

function flatten(value, prefix = '', output = {}) {
  Object.entries(value || {}).forEach(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, next, output);
    else output[next] = String(child);
  });
  return output;
}

const KEYS = Object.keys(flatten(en.clubOnboarding)).map((key) => `clubOnboarding.${key}`);
const PARAMS = { plan: 'Venue Pro', price: '$59 USD/month' };

describe('club onboarding internationalization', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves the complete onboarding journey', async (lang) => {
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
    const english = Object.fromEntries(KEYS.map((key) => [key, i18n.t(key, PARAMS)]));
    await i18n.changeLanguage(lang);
    KEYS.forEach((key) => expect(i18n.t(key, PARAMS)).not.toBe(english[key]));
  });

  it('removes visible Spanish literals from the club onboarding page', () => {
    const source = fs.readFileSync(path.join(__dirname, '../pages/UnirsePage.jsx'), 'utf8');
    [
      'Suma tu club a Padbol Match', 'Alta simple, sin planillas', 'Todo lo que necesitás',
      'Nombre de la sede o club', 'Plan elegido', 'Enviar mi consulta',
    ].forEach((literal) => expect(source).not.toContain(literal));
  });
});
