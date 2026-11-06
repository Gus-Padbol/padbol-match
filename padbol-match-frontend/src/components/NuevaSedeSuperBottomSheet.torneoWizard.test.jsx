/**
 * REVISIÓN INDEPENDIENTE — wizard de alta de sede tipo torneo.
 * Pruebas marcadas HALLAZGO se espera que FALLEN: documentan que el wizard
 * todavía exige campos de alquiler para una sede de torneo.
 */
import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import NuevaSedeSuperBottomSheet from './NuevaSedeSuperBottomSheet';

jest.mock('../hooks/useGooglePlaces', () => ({useGooglePlaces: () => ({isLoaded: false, placesEnabled: false})}));
jest.mock('../i18n/tSafe', () => ({useSafeTranslation: () => ({t: (key) => key})}));

const originalFetch = global.fetch;
const originalAlert = window.alert;
beforeEach(() => {
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () => (String(url).endsWith('/api/plan-pricing') ? [] : {id: 123}),
  }));
  window.alert = jest.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
  window.alert = originalAlert;
});

async function renderSheetAndTorneo() {
  render(<NuevaSedeSuperBottomSheet open apiBaseUrl="https://api.qa.example" accessToken="fixture" />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('radio', {name: 'Sede para torneo'}));
  fireEvent.change(screen.getByLabelText(/Nombre de la sede/), {target: {value: 'Sede torneo ficticia'}});
  fireEvent.change(screen.getByLabelText(/^País/), {target: {value: '🇦🇷 Argentina'}});
  fireEvent.change(screen.getByLabelText(/^Ciudad/), {target: {value: 'La Plata'}});
  fireEvent.change(screen.getByLabelText(/^Dirección/), {target: {value: 'Calle ficticia 123'}});
  fireEvent.click(screen.getByRole('button', {name: 'Siguiente'}));
  await screen.findByText(/Paso 2 de 3/);
}

test('HALLAZGO ALTO: una sede de torneo no debería exigir canchas para avanzar', async () => {
  await renderSheetAndTorneo();

  fireEvent.click(screen.getByRole('button', {name: 'Siguiente'}));

  // Correcto: avanzar a paso 3 sin declarar canchas. Actual: queda en paso 2 con error.
  expect(screen.queryByText(/Selecciona al menos un deporte/)).not.toBeInTheDocument();
  expect(screen.getByText(/Paso 3 de 3/)).toBeInTheDocument();
});

test('HALLAZGO ALTO: una sede de torneo no debería exigir precio/horarios para crear', async () => {
  await renderSheetAndTorneo();
  // Se declara una cancha solo para poder llegar al paso 3; el objetivo es probar el submit.
  fireEvent.click(screen.getByRole('checkbox', {name: 'Padbol'}));
  fireEvent.click(screen.getByRole('button', {name: 'Siguiente'}));
  await screen.findByText(/Paso 3 de 3/);

  fireEvent.click(screen.getByRole('button', {name: 'Crear sede'}));

  // Correcto: con tipo torneo debe enviar sin precio/horarios. Actual: error de validación.
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/api/sedes'))).toBe(true));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
