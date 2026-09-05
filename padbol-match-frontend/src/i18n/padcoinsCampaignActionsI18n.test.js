import fs from 'fs';
import path from 'path';
import i18n from './index';

const ACTION_KEYS = [
  'campaignBenefitsLoadFailed', 'campaignLoadFailed', 'campaignPermissionDenied', 'campaignSaveFailed',
  'campaignUpdated', 'campaignCreated', 'campaignActivateHighImpactConfirm', 'campaignActivateConfirm',
  'campaignActivateFailed', 'campaignActivated', 'campaignPauseConfirm', 'campaignPauseFailed',
  'campaignPaused', 'campaignSummaryLoadFailed',
].map((key) => `admin.padcoins.${key}`);

describe('PadCoins campaign action internationalization', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves every campaign action and error', async (lang) => {
    await i18n.changeLanguage(lang);
    ACTION_KEYS.forEach((key) => {
      const value = i18n.t(key, { name: 'Summer Bonus' });
      expect(value).not.toBe(key);
      expect(value.trim()).not.toBe('');
      expect(value).not.toMatch(/{{\s*name\s*}}/);
    });
  });

  test.each(['ro', 'cs'])('%s keeps direct editorial action copy', async (lang) => {
    await i18n.changeLanguage('en');
    const english = Object.fromEntries(ACTION_KEYS.map((key) => [key, i18n.t(key, { name: 'Summer Bonus' })]));
    await i18n.changeLanguage(lang);
    ACTION_KEYS.forEach((key) => expect(i18n.t(key, { name: 'Summer Bonus' })).not.toBe(english[key]));
  });

  it('does not leave Spanish campaign actions in the dashboard source', () => {
    const source = fs.readFileSync(path.join(__dirname, '../pages/AdminDashboard.jsx'), 'utf8');
    [
      '¿Activar la campaña', '¿Pausar la campaña', 'Error al activar campaña',
      'Error al pausar campaña', '✅ Campaña activada', '✅ Campaña pausada',
    ].forEach((literal) => expect(source).not.toContain(literal));
  });
});
