import fs from 'fs';
import path from 'path';
import i18n from './index';

const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'ArmarPartido.jsx'), 'utf8');

describe('create match localization', () => {
  const keys = [
    'loadVenuesError', 'selectVenueError', 'selectDateError', 'selectTimeError',
    'selectDurationError', 'selectCourtError', 'loginToPayError', 'incompleteBookingError',
    'paymentTitle', 'cardSetupPending', 'paymentStartError', 'publishError', 'courtNumber',
    'minutesLong', 'perUnit', 'whatsappShareText', 'shareWhatsapp', 'goFindMatch',
  ];

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves the complete create-match flow', (language) => {
    const t = i18n.getFixedT(language);
    keys.forEach((key) => {
      const value = t(`armarPartido.${key}`, { venue: 'Padbol Club', num: 2, url: 'https://example.test' });
      expect(value).not.toContain(`armarPartido.${key}`);
      expect(value.trim()).not.toBe('');
    });
  });

  test('visible Spanish messages and fixed Spanish formatting are gone from the page', () => {
    [
      "label: 'Pádel'", "setMsg('Seleccioná una sede.')", "setMsg('Elegí una fecha.')",
      "setMsg('Elegí una duración.')", "setMsg('Elegí una cancha libre.')",
      'Compartir por WhatsApp', 'Ir a buscar partido', "toLocaleString('es-AR')",
    ].forEach((literal) => expect(source).not.toContain(literal));
  });

  test('Romanian booking terminology is natural and consistent', () => {
    const t = i18n.getFixedT('ro');
    expect(t('armarPartido.titleSportAndVenue')).toBe('Sport și club');
    expect(t('armarPartido.selectCourtError')).toBe('Alege un teren disponibil.');
    expect(t('armarPartido.shareWhatsapp')).toBe('Distribuie pe WhatsApp');
  });
});
