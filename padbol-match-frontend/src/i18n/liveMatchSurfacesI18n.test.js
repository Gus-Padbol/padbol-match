import fs from 'fs';
import path from 'path';
import i18n from './index';

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'pages', name), 'utf8');

describe('payment QR and live scoreboard localization', () => {
  test.each(['en', 'es', 'ro', 'cs'])('%s resolves live-match messages', (language) => {
    const t = i18n.getFixedT(language);
    ['loading', 'waiting', 'matchLoadError', 'courtMatchLoadError'].forEach((key) => {
      expect(t(`scoreboardDisplay.${key}`)).not.toContain(`scoreboardDisplay.${key}`);
    });
    ['qrGenerationFailed', 'networkError'].forEach((key) => {
      expect(t(`pago.${key}`)).not.toContain(`pago.${key}`);
    });
  });

  test('standalone live surfaces contain no fixed English or Spanish errors', () => {
    const source = [
      read('PagoExitoso.jsx'), read('ScoreboardDisplay.jsx'),
      read('ScoreboardCanchaDisplay.jsx'), read('ScoreboardScoreBugPage.jsx'),
    ].join('\n');
    [
      'No se pudo generar el QR', 'Error loading match', 'Error loading court match',
      'Loading scoreboard...', 'Waiting for match...',
    ].forEach((literal) => expect(source).not.toContain(literal));
  });
});
