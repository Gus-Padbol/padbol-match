import fs from 'fs';
import path from 'path';
import i18n from './index';

const ACTION_KEYS = [
  'campaignBenefitsLoadFailed', 'campaignLoadFailed', 'campaignPermissionDenied', 'campaignSaveFailed',
  'campaignUpdated', 'campaignCreated', 'campaignActivateHighImpactConfirm', 'campaignActivateConfirm',
  'campaignActivateFailed', 'campaignActivated', 'campaignPauseConfirm', 'campaignPauseFailed',
  'campaignPaused', 'campaignSummaryLoadFailed',
  'benefitsLoadFailed', 'redemptionsLoadFailed', 'globalConfigLoadFailed', 'participationLoadFailed',
  'participationSelectVenue', 'dateOrderInvalid', 'participationPermissionDenied', 'participationSaveFailed',
  'participationUpdated', 'smartViewPermissionDenied', 'smartLoadFailed', 'smartSelectVenueSave',
  'smartEditPermissionDenied', 'smartInvalid', 'smartSaveFailed', 'smartUpdated', 'smartSelectVenueRestore',
  'smartRestoreFailed', 'smartRestored', 'globalConfigSaveFailed', 'globalConfigSaved', 'benefitSelectVenue',
  'benefitSaveFailed', 'benefitUpdated', 'benefitCreated', 'benefitDeactivateConfirm',
  'benefitDeactivateFailed', 'benefitDeactivated', 'redemptionDeliverConfirm', 'redemptionDeliverFailed',
  'redemptionDelivered', 'redemptionCancelConfirm', 'redemptionCancelFailed', 'redemptionCancelled',
  'movementsPermissionDenied', 'movementsLoadFailed', 'alertsPermissionDenied', 'alertsLoadFailed',
  'campaignsPermissionDenied', 'campaignsLoadFailed',
  'all', 'smartRuleHelp.bookingCredit', 'smartRuleHelp.internalConversion', 'smartRuleHelp.calculationMode',
].map((key) => `admin.padcoins.${key}`);

describe('PadCoins campaign action internationalization', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves every campaign action and error', async (lang) => {
    await i18n.changeLanguage(lang);
    ACTION_KEYS.forEach((key) => {
      const value = i18n.t(key, { name: 'Summer Bonus', code: 'ABC-123' });
      expect(value).not.toBe(key);
      expect(value.trim()).not.toBe('');
      expect(value).not.toMatch(/{{\s*\w+\s*}}/);
    });
  });

  test.each(['ro', 'cs'])('%s keeps direct editorial action copy', async (lang) => {
    await i18n.changeLanguage('en');
    const english = Object.fromEntries(ACTION_KEYS.map((key) => [key, i18n.t(key, { name: 'Summer Bonus', code: 'ABC-123' })]));
    await i18n.changeLanguage(lang);
    ACTION_KEYS.forEach((key) => expect(i18n.t(key, { name: 'Summer Bonus', code: 'ABC-123' })).not.toBe(english[key]));
  });

  it('does not leave Spanish campaign actions in the dashboard source', () => {
    const source = fs.readFileSync(path.join(__dirname, '../pages/AdminDashboard.jsx'), 'utf8');
    [
      '¿Activar la campaña', '¿Pausar la campaña', 'Error al activar campaña',
      'Error al pausar campaña', '✅ Campaña activada', '✅ Campaña pausada',
      'Error al cargar canjes', 'Error al guardar beneficio', '¿Desactivar el beneficio',
      '¿Marcar como entregado el canje', '¿Cancelar el canje',
      'Error al cargar movimientos PadCoins', 'Error al cargar alertas PadCoins',
    ].forEach((literal) => expect(source).not.toContain(literal));
  });
});
