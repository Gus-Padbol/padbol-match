import fs from 'fs';
import path from 'path';
import i18n from './index';

const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SedePublica.jsx'), 'utf8');

describe('public venue profile localization', () => {
  const keys = [
    'totalBookings', 'totalTournaments', 'totalRegisteredPlayers', 'averageReviews', 'inNumbers',
    'ratingOutOfFive', 'starsOutOfFive', 'unnamedVenue', 'waitlistLeaveError', 'waitlistJoinError',
    'mapTitle', 'openGoogleMaps', 'photoGallery', 'venueFallback', 'shareText', 'missingVenueId',
    'invalidVenueId', 'venueIdNotFound', 'venueLoadErrorDetail', 'unexpectedError', 'loadingVenue',
    'venueNotFound', 'venueIdLabel', 'openMatches', 'seeMoreMatches',
  ];

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves every public venue message', (language) => {
    const t = i18n.getFixedT(language);
    keys.forEach((key) => {
      const value = t(`sedes.publica.${key}`, { rating: 5, venue: 'Padbol Club', id: 1, error: 'x' });
      expect(value).not.toContain(`sedes.publica.${key}`);
      expect(value.trim()).not.toBe('');
    });
  });

  test('public venue page contains no embedded Spanish interface strings', () => {
    [
      'Total jugadores registrados en la sede', 'Promedio de reseñas', '(sin nombre)',
      'No se pudo salir de la lista', 'Ubicación en Google Maps', 'Galería de fotos',
      'No se recibió un ID de sede', 'Sede no encontrada.', 'Cargando sede…',
    ].forEach((literal) => expect(source).not.toContain(literal));
  });

  test('Romanian public venue vocabulary is ready for native review', () => {
    const t = i18n.getFixedT('ro');
    expect(t('sedes.publica.shareText', { venue: 'Club București' })).toContain('Padbol Court');
    expect(t('sedes.publica.inNumbers')).toBe('În cifre');
    expect(t('sedes.publica.openMatches')).toBe('Meciuri deschise');
  });
});
