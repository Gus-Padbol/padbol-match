import fs from 'fs';
import path from 'path';
import i18n from './index';

const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'TorneoCrear.jsx'), 'utf8');

describe('tournament creation localization', () => {
  const keys = [
    'header', 'title', 'backToTournaments', 'loadVenuesError', 'requiredFieldsError',
    'selectCategoryError', 'selectSportError', 'selectVenueError', 'teamsPerGroupError',
    'qualifiersPerGroupError', 'autoOpenDateError', 'createdSuccess', 'createError',
    'nameLabel', 'namePlaceholder', 'sportLabel', 'teamFormatLabel', 'teamFormat.singles',
    'teamFormat.dobles', 'teamFormatHint', 'levelLabel', 'restrictedLevelsHint',
    'multiVenueLabel', 'venueLabel', 'loadingVenue', 'fixedVenueHint', 'competitionTypeLabel',
    'competitionTypeAria', 'competitionTypeHint', 'ageCategoryLabel', 'ageCategoryAria',
    'categoryLabel', 'fixtureFormatLabel', 'initialStatusLabel', 'initialStatusHint',
    'teamsPerGroupLabel', 'qualifiersPerGroupLabel', 'bestThirdsLabel', 'nonePlaceholder',
    'bestThirdsHint', 'autoOpenLabel', 'autoOpenHint', 'startDateLabel', 'endDateLabel',
    'teamCountLabel', 'registrationFeeLabel', 'freePlaceholder', 'registrationCurrencyAria',
    'registrationFeeHint', 'prizesLabel', 'prizesPlaceholder', 'pointsLabel',
    'viewDistribution', 'maxTeamsLabel', 'maxTeamsPlaceholder', 'maxTeamsHint',
    'revealHoursLabel', 'revealHoursHint', 'creating', 'submit',
  ];

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves every tournament creation field', (language) => {
    const t = i18n.getFixedT(language);
    keys.forEach((key) => {
      const value = t(`torneos.create.${key}`, { error: 'x' });
      expect(value).not.toContain(`torneos.create.${key}`);
      expect(value.trim()).not.toBe('');
    });
  });

  test('creation form contains no embedded Spanish interface copy', () => {
    [
      'Error al cargar sedes', 'Completa los campos obligatorios', 'Crear Nuevo Torneo',
      'Nombre del Torneo', 'Multisede (varios países)', 'Categoría de edad',
      'Apertura automática de inscripción', 'Inscripción por equipo', '✅ Crear Torneo',
    ].forEach((literal) => expect(source).not.toContain(literal));
  });

  test('Romanian organizer copy is coherent', () => {
    const t = i18n.getFixedT('ro');
    expect(t('torneos.create.title')).toBe('Creează un turneu nou');
    expect(t('torneos.create.venueLabel')).toBe('Club');
    expect(t('torneos.create.revealHoursHint')).toContain('Administratorii turneului');
  });
});
