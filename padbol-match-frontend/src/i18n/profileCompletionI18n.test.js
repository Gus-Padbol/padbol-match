import fs from 'fs';
import path from 'path';
import i18n from './index';

const LANGS = ['en', 'es', 'ro', 'cs'];
const KEYS = [
  'profileCompletion.title', 'profileCompletion.intro', 'profileCompletion.sportsTitle',
  'profileCompletion.sportsIntro', 'profileCompletion.sportsHelp', 'profileCompletion.country',
  'profileCompletion.countryCodeTitle', 'profileCompletion.countryCodeAria', 'profileCompletion.number',
  'profileCompletion.numberPlaceholder', 'profileCompletion.numberAria', 'profileCompletion.confirmNumber',
  'profileCompletion.confirmNumberPlaceholder', 'profileCompletion.confirmNumberAria', 'profileCompletion.back',
  'profileCompletion.saving', 'profileCompletion.continue', 'profileCompletion.saveContinue',
  'profileCompletion.skip', 'profileCompletion.sessionExpired', 'profileCompletion.emailCheckFailed',
  'profileCompletion.emailCheckRetry', 'profileCompletion.emailInUse', 'profileCompletion.duplicateData',
  'profileCompletion.saveFailed', 'auth.completeProfile', 'auth.selectGender', 'auth.phoneMismatch',
  'auth.invalidWhatsapp', 'auth.phoneAlreadyRegistered', 'auth.phoneValidationFailed', 'auth.gender',
  'auth.choose', 'auth.male', 'auth.female', 'auth.goToLogin',
];

describe('profile completion internationalization', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  test.each(LANGS)('%s resolves every profile field without raw keys', async (lang) => {
    await i18n.changeLanguage(lang);
    KEYS.forEach((key) => {
      const value = i18n.t(key);
      expect(typeof value).toBe('string');
      expect(value.trim()).not.toBe('');
      expect(value).not.toBe(key);
    });
  });

  test.each(['ro', 'cs'])('%s has direct editorial copy for the new journey', async (lang) => {
    await i18n.changeLanguage('en');
    const english = Object.fromEntries(KEYS.filter((key) => key.startsWith('profileCompletion.')).map((key) => [key, i18n.t(key)]));
    await i18n.changeLanguage(lang);
    Object.entries(english).forEach(([key, value]) => expect(i18n.t(key)).not.toBe(value));
  });

  it('does not leave visible Spanish literals in the profile page', () => {
    const source = fs.readFileSync(path.join(__dirname, '../pages/CompletarPerfilOAuth.jsx'), 'utf8');
    [
      'Completar perfil', 'Completa tu perfil', '¿Qué deportes practicas?', 'Selecciona género',
      'Los números no coinciden', 'Número de WhatsApp inválido', 'Ir a iniciar sesión',
      'Guardar y continuar', 'Omitir',
    ].forEach((literal) => expect(source).not.toContain(`'${literal}'`));
  });
});
