import fs from 'fs';
import path from 'path';
import i18n from './index';

const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'TorneoVista.jsx'), 'utf8');

describe('tournament view localization', () => {
  const keys = [
    'loadTournamentError', 'tournamentNotFound', 'confirmOpenRegistration', 'openRegistrationError',
    'networkError', 'teamNumber', 'confirmStartTournament', 'startTournamentError',
    'startTournamentDetails', 'confirmFinishTournament', 'finishTournamentError', 'waitlistJoined',
    'alreadyInTeam', 'waitlistIntro', 'reservePlace', 'openingRegistration', 'openRegistration',
    'teamsAndRegistration', 'missingConfirmedTeams', 'fixtureRequiredBeforeStart', 'startTournament',
    'finishTournament', 'shareText', 'partnerSearchJoinError', 'partnerInviteError',
    'playersSeekingPartner', 'sortedByCompatibility', 'partnerInvitationText', 'acceptAndFormTeam',
    'seekPartner', 'listedAsSeekingPartner', 'loadingPartnerList', 'noPlayersSeekingPartner',
    'rightHanded', 'leftHanded', 'compatibilityTier0', 'compatibilityTier1', 'compatibilityTier2',
    'invitationSent', 'invitedYouPending', 'categoryLabel', 'connectWhatsapp', 'noWhatsapp',
    'inviteToTeam', 'pendingInvitations', 'tournamentFinishedBanner',
  ];

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves tournament operations and partner search', (language) => {
    const t = i18n.getFixedT(language);
    keys.forEach((key) => {
      const value = t(`torneos.vista.${key}`, {
        id: 1, confirmed: 2, minimum: 2, matches: 3, team: 'FIPA', count: 2,
        tournament: 'Open', venue: 'Padbol Club', category: 'Elite', player: 'Ana', players: 'Ana',
      });
      expect(value).not.toContain(`torneos.vista.${key}`);
      expect(value.trim()).not.toBe('');
    });
  });

  test('tournament screen no longer embeds Spanish UI copy', () => {
    [
      '¿Confirmar apertura de inscripción?', 'No se pudo abrir la inscripción',
      '¿Iniciar el torneo?', '¿Finalizar el torneo?', 'Jugadores buscando dupla',
      'Cargando lista…', 'Invitación enviada', 'Conectar por WhatsApp',
      'No pudimos cargar el torneo', '✅ Torneo finalizado',
    ].forEach((literal) => expect(source).not.toContain(literal));
  });

  test('Romanian player journey reads naturally', () => {
    const t = i18n.getFixedT('ro');
    expect(t('torneos.vista.playersSeekingPartner')).toContain('partener');
    expect(t('torneos.vista.alreadyInTeam', { team: 'București' })).toContain('echipa București');
    expect(t('torneos.vista.tournamentFinishedBanner')).toContain('Turneu încheiat');
  });
});
