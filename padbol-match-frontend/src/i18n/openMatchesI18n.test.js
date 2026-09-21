import fs from 'fs';
import path from 'path';
import i18n from './index';

const pageSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'PartidosAbiertos.jsx'), 'utf8');

describe('open matches localization', () => {
  test.each(['en', 'es', 'ro', 'cs'])('%s resolves every open-match message', (language) => {
    const keys = [
      'loadError', 'networkError', 'sendRequestError', 'updateRequestError',
      'requestAccepted', 'requestRejected', 'manageRequestError', 'joinSuccessTitle',
      'joinSuccessBody', 'myMatches', 'requestsTitle', 'wantsToPlayAt', 'yourMatch',
      'accept', 'reject', 'loadingMatches', 'seeMoreMatches',
    ];
    keys.forEach((key) => {
      const value = i18n.getFixedT(language)(`partidosAbiertos.${key}`, { venue: 'Padbol Club' });
      expect(value).not.toContain(`partidosAbiertos.${key}`);
      expect(value.trim()).not.toBe('');
    });
  });

  test('player-facing Spanish messages are no longer embedded in the page', () => {
    [
      'No se pudieron cargar los partidos', 'Error de red', 'Te has unido con éxito',
      'Solicitudes para tus partidos', 'Quiere jugar en', 'Cargando partidos',
      'Ver más partidos',
    ].forEach((literal) => expect(pageSource).not.toContain(literal));
  });

  test('Romanian uses natural match-request language', () => {
    const t = i18n.getFixedT('ro');
    expect(t('partidosAbiertos.joinSuccessTitle')).toBe('Te-ai înscris cu succes!');
    expect(t('partidosAbiertos.wantsToPlayAt', { venue: 'Padbol Club' })).toBe('Vrea să joace la Padbol Club');
  });
});
