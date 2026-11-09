import fs from 'fs';
import path from 'path';
import i18n from './index';

const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'Rankings.jsx'), 'utf8');
const countrySource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'ranking', 'CountryRankingTable.jsx'),
  'utf8',
);

describe('individual rankings localization', () => {
  const keys = [
    'sport', 'otherSportsLocalOnly', 'tabLocal', 'tabNational', 'tabInternational',
    'filter', 'openFiltersAria', 'localWithLocation', 'localDefault', 'nationalCountry',
    'nationalDefault', 'internationalDefault', 'categorySuffix', 'loading', 'noData',
    'noRankingYet', 'noPointsForFilters', 'noFinishedTournaments', 'player', 'country',
    'team', 'tournaments', 'points', 'playersShown', 'filters', 'all', 'province',
    'state', 'region', 'stateRegion', 'city', 'category', 'tournamentType',
    'localCountryAria', 'localSubdivisionAria', 'localCityAria', 'nationalCountryAria',
    'categoryFilterAria', 'tournamentTypeFilterAria', 'apply', 'clearAll', 'loadVenuesError',
    'viewPlayers', 'viewCountries', 'viewModeAria', 'countriesDefault', 'countriesLoading',
    'countriesError', 'countriesRetry', 'countriesEmpty', 'countriesEmptyHint',
    'countriesPending', 'countriesPendingNote', 'countriesShown', 'countriesTableAria',
    'countriesTieNote',
  ];

  test.each(['en', 'es', 'ro', 'cs'])('%s resolves the complete individual-ranking view', (language) => {
    const t = i18n.getFixedT(language);
    keys.forEach((key) => {
      const value = t(`ranking.${key}`, {
        sport: 'Padbol', location: 'București', country: 'România', category: ' · Elite',
        subdivision: 'Regiune', count: 2,
      });
      expect(value).not.toContain(`ranking.${key}`);
      expect(value.trim()).not.toBe('');
    });
  });

  test('ranking page contains no embedded Spanish user interface', () => {
    [
      'Abrir filtros del ranking', 'Cargando rankings', 'Sin datos disponibles',
      'No hay jugadores con puntos', '>Jugador<', '>País<', '>Equipo<', '>Torneos<',
      '>Puntos<', '>Aplicar<', 'Limpiar todo', 'localeCompare(b, \'es\')',
    ].forEach((literal) => expect(source).not.toContain(literal));
  });

  test('Romanian makes the individual nature of the ranking clear', () => {
    const t = i18n.getFixedT('ro');
    expect(t('ranking.player')).toBe('Jucător');
    expect(t('ranking.playersShown', { count: 2 })).toContain('jucători');
    expect(t('ranking.internationalDefault', { sport: 'Padbol', category: '' })).toContain('Clasament FIPA');
  });

  test('the country view shares the Rankings page with the individual view', () => {
    expect(source).toContain('fetchNationsCountryRanking');
    expect(source).toContain('<CountryRankingTable');
    expect(source).toContain("rankingView === 'paises'");
    expect(source).toContain("viewCountries");
  });

  test('the country table contains no embedded Spanish user interface', () => {
    [
      'Cargando ranking de países', 'No se pudo cargar', 'Pendiente',
      'Reintentar', 'Ranking acumulado de países', 'comparten la misma posición',
    ].forEach((literal) => expect(countrySource).not.toContain(literal));
  });

  test('Romanian localizes the accumulated country view', () => {
    const t = i18n.getFixedT('ro');
    expect(t('ranking.viewCountries')).toBe('Țări');
    expect(t('ranking.countriesTieNote')).toContain('poziție');
    expect(t('ranking.countriesPending')).toBe('În așteptare');
  });

  test('pending country copy counts contributions, never tournaments', () => {
    const tournamentWord = /torneo|tournament|turneu|turnaj|torneio|tournoi|turnier/i;
    ['en', 'es', 'ro', 'it', 'de', 'fr', 'pt', 'ar', 'cs'].forEach((language) => {
      const value = i18n.getFixedT(language)('ranking.countriesPendingNote', { count: 15 });
      expect(value).not.toMatch(tournamentWord);
      expect(value).toContain('15');
    });
  });

  test('country empty copy is limited to the ranking and never claims there were no tournaments', () => {
    const es = i18n.getFixedT('es');
    expect(es('ranking.countriesEmpty')).toContain('resultados verificados');
    expect(es('ranking.countriesEmpty')).not.toMatch(/torneos finalizados y publicados/i);
    expect(es('ranking.countriesEmptyHint')).toMatch(/resultados finales/i);
    expect(es('ranking.countriesEmptyHint')).not.toMatch(/import|históric/i);

    const en = i18n.getFixedT('en');
    expect(en('ranking.countriesEmpty')).toContain('verified results');
    expect(en('ranking.countriesEmptyHint')).not.toMatch(/import|historical/i);
  });
});
