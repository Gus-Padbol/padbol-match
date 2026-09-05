import fs from 'fs';
import path from 'path';
import i18n from './index';

const KEYS = [
  'pago.qrGenerationFailed', 'pago.networkError', 'admin.hub.unsavedPromoConfirm',
  'admin.sedes.durationsLoadFailed', 'admin.sedes.lastDurationDeactivateConfirm',
  'admin.sedes.standardDurationsOnly', 'admin.sedes.durationAlreadyConfigured',
  'admin.sedes.durationAlreadyExistsSport', 'admin.sedes.lastDurationRemoveConfirm',
  'admin.sedes.removeDurationConfirm', 'admin.franjas.slotSaved', 'admin.franjas.surgeSaved',
  'admin.franjas.surgeSaveFailed',
];

describe('venue operation internationalization', () => {
  afterAll(async () => i18n.changeLanguage('en'));

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves venue operation messages', async (lang) => {
    await i18n.changeLanguage(lang);
    KEYS.forEach((key) => {
      const value = i18n.t(key, { minutes: 90, sport: 'Padbol' });
      expect(value).not.toBe(key);
      expect(value.trim()).not.toBe('');
      expect(value).not.toMatch(/{{\s*\w+\s*}}/);
    });
  });

  it('removes the affected Spanish operation literals from the dashboard', () => {
    const source = fs.readFileSync(path.join(__dirname, '../pages/AdminDashboard.jsx'), 'utf8');
    [
      'No se pudo generar el QR', 'Tenés cambios sin guardar en la promoción',
      'Solo se permiten duraciones de 60, 90 o 120 minutos', 'Esta es la última duración activa',
      'No se pudo guardar Surge', '✅ Franja guardada',
    ].forEach((literal) => expect(source).not.toContain(literal));
  });
});
