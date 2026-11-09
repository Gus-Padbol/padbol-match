import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CountryRankingTable from './CountryRankingTable';

jest.mock('../../i18n/tSafe', () => {
  const dictionary = {
    'ranking.countriesLoading': 'Cargando ranking de países…',
    'ranking.countriesError': 'No se pudo cargar el ranking de países.',
    'ranking.countriesRetry': 'Reintentar',
    'ranking.countriesEmpty': 'Aún no hay torneos de selecciones finalizados y publicados.',
    'ranking.countriesEmptyHint': 'El ranking de países aparece cuando se publican resultados finales de Nations.',
    'ranking.countriesTableAria': 'Ranking acumulado de países',
    'ranking.country': 'País',
    'ranking.tournaments': 'Torneos',
    'ranking.points': 'Puntos',
    'ranking.countriesPending': 'Pendiente',
    'ranking.countriesPendingNote': 'Contribuciones de puntos pendientes: {{count}}',
    'ranking.countriesShown': '{{count}} países mostrados',
    'ranking.countriesTieNote': 'Los países con los mismos puntos comparten la misma posición.',
  };
  return {
    useSafeTranslation: () => ({
      t: (key, options = {}) => String(dictionary[key] ?? key).replace('{{count}}', String(options.count ?? '')),
      i18n: { language: 'es' },
    }),
  };
});

const rows = [
  { pais: 'AR', puntos_total: 300, torneos_count: 1, torneos_pendientes: 0, posicion: 1, pendiente: false, torneos: [] },
  { pais: 'IT', puntos_total: 300, torneos_count: 2, torneos_pendientes: 0, posicion: 1, pendiente: false, torneos: [] },
  { pais: 'ES', puntos_total: 0, torneos_count: 1, torneos_pendientes: 0, posicion: 3, pendiente: false, torneos: [] },
  { pais: 'FR', puntos_total: 0, torneos_count: 0, torneos_pendientes: 1, posicion: null, pendiente: true, torneos: [] },
];

test('loading and empty states stay explicit', () => {
  const { rerender } = render(<CountryRankingTable loading items={[]} />);
  expect(screen.getByRole('status')).toHaveTextContent('Cargando ranking de países…');

  rerender(<CountryRankingTable items={[]} />);
  expect(screen.getByRole('status')).toHaveTextContent('Aún no hay torneos de selecciones finalizados y publicados.');
  expect(screen.queryByRole('table')).toBeNull();
});

test('error state is announced and offers a retry', async () => {
  const onRetry = jest.fn();
  render(<CountryRankingTable items={[]} error onRetry={onRetry} />);

  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el ranking de países.');
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test('renders tied positions, a real zero and pending points without inventing an order', () => {
  render(<CountryRankingTable items={rows} />);

  expect(screen.getByRole('table', { name: 'Ranking acumulado de países' })).toBeInTheDocument();
  const bodyRows = screen.getAllByRole('row').slice(1);
  expect(bodyRows).toHaveLength(4);

  // The two countries with 300 points share the first position.
  expect(screen.getAllByText('🥇')).toHaveLength(2);
  expect(within(bodyRows[0]).getByText(/🇦🇷/)).toBeInTheDocument();
  expect(within(bodyRows[1]).getByText(/🇮🇹/)).toBeInTheDocument();

  // A stored zero is displayed as a real zero.
  expect(within(bodyRows[2]).getByText('0')).toBeInTheDocument();
  // A missing award is pending, never zero.
  expect(within(bodyRows[3]).getByText('Pendiente')).toBeInTheDocument();
  expect(within(bodyRows[3]).getByText('—')).toBeInTheDocument();
  expect(screen.getByText('Contribuciones de puntos pendientes: 1')).toBeInTheDocument();
});

test('pending footer counts contributions, not tournaments, when many countries share one event', () => {
  const isos = ['AR', 'IT', 'ES', 'FR', 'GB', 'US', 'BR', 'DE', 'PT', 'BE', 'NL', 'CH', 'AT', 'AU', 'UY'];
  const pendingFromSameTournament = isos.map((pais) => ({
    pais,
    puntos_total: 0,
    torneos_count: 0,
    // The backend reports one missing country-tournament award per country.
    torneos_pendientes: 1,
    posicion: null,
    pendiente: true,
    torneos: [],
  }));

  render(<CountryRankingTable items={pendingFromSameTournament} />);

  // 15 countries pending in one event are 15 pending contributions, not 15 tournaments.
  expect(screen.getByText('Contribuciones de puntos pendientes: 15')).toBeInTheDocument();
  expect(screen.queryByText(/15 torneos/i)).toBeNull();
  expect(screen.queryByText(/torneos con puntos pendientes/i)).toBeNull();
});

test('narrow screens drop the tournaments column but keep country and points', () => {
  render(<CountryRankingTable items={rows} narrow />);

  expect(screen.queryByText('Torneos')).toBeNull();
  expect(screen.getByText('País')).toBeInTheDocument();
  expect(screen.getByText('Puntos')).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(5);
});
