import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TorneoTabbedView from './TorneoTabbedView';

jest.mock('../../i18n/tSafe', () => {
  const t = (key, values) => values?.defaultValue || key;
  return { useSafeTranslation: () => ({ t }) };
});
jest.mock('../../hooks/usePadbolLang', () => ({ usePadbolLangVersion: () => 0 }));
jest.mock('../../supabaseClient', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-session' } } }) } } }));
jest.mock('../SponsorBannerFade', () => () => null);
jest.mock('../SponsorTicker', () => () => null);
// CRA's SVG test transform emits the pre-React-19 element symbol. Decorative
// icons do not participate in the result entry flow exercised here.
jest.mock('../common/SportIcon', () => () => null);
jest.mock('../icons/GeroIcons', () => ({ IconGeroUbicacion: () => null }));
jest.mock('./SorteoGruposModal', () => ({ __esModule: true, default: () => null, equiposConfirmadosParaSorteo: rows => rows }));

const originalFetch = global.fetch;
const partida = { id: 45, torneo_id: 28, equipo_a_id: 71, equipo_b_id: 72, estado: 'pendiente' };
const savedResult = { goles_a: 2, goles_b: 0, historial_sets: [{ set: 1, a: 6, b: 4 }, { set: 2, a: 6, b: 3 }] };

function setup({ isAdmin = true } = {}) {
  const setPartidos = jest.fn();
  const rendered = render(<MemoryRouter><TorneoTabbedView
    torneo={{ id: 28, estado: 'en_curso', nombre: 'Torneo QA', sede_id: 7, deporte: 'padbol' }}
    torneoId="28"
    equipos={[{ id: 71, nombre: 'Alfa', jugadores: [] }, { id: 72, nombre: 'Beta', jugadores: [] }]}
    partidos={[partida]}
    setPartidos={setPartidos}
    apiBaseUrl="https://qa.example.test"
    session={{ user: { id: 'test-user' }, access_token: 'test-session' }}
    isAdmin={isAdmin}
    navigate={jest.fn()}
  /></MemoryRouter>);
  fireEvent.click(rendered.container.querySelector('.partido-item'));
  return { ...rendered, setPartidos };
}

function openAndFill(container) {
  fireEvent.click(screen.getByRole('button', { name: 'torneos.partidoDetalle.cargarResultado' }));
  const inputs = container.querySelectorAll('.form-sets input');
  expect(inputs).toHaveLength(3);
  fireEvent.change(inputs[0], { target: { value: '6-4' } });
  fireEvent.change(inputs[1], { target: { value: '6-3' } });
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
    ok: true, status: 'finalized', torneo_id: 28, partido_id: 45,
    resultado: savedResult, ganador_equipo_id: 71,
  }) });
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

test('el clic desde el detalle conserva el partido, envía el resultado autenticado y refleja la confirmación del servidor', async () => {
  const { container, setPartidos } = setup();
  openAndFill(container);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar', exact: true }));
  await waitFor(() => expect(setPartidos).toHaveBeenCalledTimes(1));
  const [url, request] = global.fetch.mock.calls[0];
  expect(url).toBe('https://qa.example.test/api/torneos/28/partidos/45/resultado');
  expect(request.method).toBe('POST');
  expect(request.headers.Authorization).toBe('Bearer test-session');
  expect(JSON.parse(request.body)).toEqual(savedResult);
  expect(setPartidos.mock.calls[0][0]([partida])[0]).toMatchObject({ estado: 'finalizado', resultado: savedResult, ganador_equipo_id: 71 });
  expect(container.querySelector('.form-sets')).not.toBeInTheDocument();
  expect(window.alert).not.toHaveBeenCalled();
});

test('un rechazo de permisos mantiene el formulario y no inventa un resultado guardado', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'No tienes permiso para esta sede.' }) });
  const { container, setPartidos } = setup();
  openAndFill(container);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar', exact: true }));
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Error al guardar: No tienes permiso para esta sede.'));
  expect(setPartidos).not.toHaveBeenCalled();
  expect(container.querySelector('.form-sets')).toBeInTheDocument();
});

test('la vista de jugador no ofrece el escritor administrativo', () => {
  setup({ isAdmin: false });
  expect(screen.queryByRole('button', { name: 'torneos.partidoDetalle.cargarResultado' })).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});
