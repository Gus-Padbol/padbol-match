import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import AdminJugadoresSection from './AdminJugadoresSection';
import { fetchAdminJugadoresList } from '../utils/adminJugadoresApi';

const mockCopy = {
  'admin.jugadores.selectSede': 'Selecciona una sede',
  'admin.jugadores.empty': 'No hay jugadores con historial en esta sede.',
  'admin.jugadores.allPlayers': 'Todos los jugadores',
  'admin.jugadores.subtitle': 'Jugadores vinculados a la sede o con historial de reservas. Busca, ordena y abre la ficha.',
  'admin.jugadores.subtitleAll': 'Todos los jugadores registrados, con o sin sede. Elige una sede para filtrar.',
  'admin.jugadores.forbidden': 'No tienes permiso para ver estos jugadores.',
  'admin.jugadores.loadError': 'No se pudieron cargar los jugadores.',
  'admin.jugadores.searchPlaceholder': 'Nombre, @usuario, email o teléfono',
  'admin.jugadores.filterLabel': 'Buscar',
  'admin.jugadores.sedeLabel': 'Sede',
  'admin.jugadores.refresh': 'Actualizar',
  'admin.jugadores.vinculacionFilter': 'Estado de relación',
  'admin.jugadores.filterAll': 'Todos',
  'admin.jugadores.sortLabel': 'Orden',
  'admin.jugadores.vinculacionCol': 'Vinculación',
  'admin.jugadores.activityCol': 'Última actividad',
  'admin.jugadores.registeredCol': 'Fecha de registro',
  'admin.jugadores.sortRegisteredDesc': 'Registro más reciente',
  'admin.jugadores.sortRegisteredAsc': 'Registro más antiguo',
  'admin.jugadores.phoneCol': 'Teléfono',
  'admin.jugadores.viewProfile': 'Ver perfil',
  'admin.jugadores.fichaTitle': 'Ficha del jugador',
  'admin.jugadores.vinculacionHistorial': 'Con historial en sede',
  'admin.jugadores.vinculacionRegistrado': 'Registrado en Padbol Match',
  'admin.jugadores.vinculacionVinculado': 'Vinculado a la sede',
  'admin.jugadores.vinculacionSinHistorial': 'Sin historial',
  'admin.jugadores.vinculacionNote': 'La lista reúne jugadores registrados y su historial en la sede.',
  'admin.jugadores.emptyAll': 'Todavía no hay jugadores registrados.',
  'admin.jugadores.pageOf': 'Página {{page}} de {{total}} ({{count}})',
  'admin.jugadores.minChars': 'Escribe al menos 2 caracteres para buscar.',
  'admin.formularios.noPlayerSearchMatch': 'Ningún jugador coincide con la búsqueda.',
  'admin.formularios.loginAgainAgain': 'Volvé a iniciar sesión.',
  'admin.reservas.player': 'Jugador',
  'admin.formularios.emailLabel': 'Email',
  'admin.metricas.profileCol': 'Perfil',
  'general.retry': 'Reintentar',
  'general.close': 'Cerrar',
  'admin.common.loadingEllipsis': 'Cargando...',
};

jest.mock('../i18n/adminTranslation', () => {
  const t = (key, options) => {
    let value = mockCopy[key];
    if (value == null && typeof options === 'string') value = options;
    if (value == null) return key;
    if (options && typeof options === 'object') {
      return Object.entries(options).reduce(
        (acc, [name, replacement]) => acc.replaceAll(`{{${name}}}`, String(replacement)),
        value,
      );
    }
    return value;
  };
  return { useSafeTranslation: () => ({ t, i18n: { language: 'es' } }), stripAdminEmoji: (v) => v };
});

jest.mock('../utils/adminJugadoresApi', () => ({
  ...jest.requireActual('../utils/adminJugadoresApi'),
  fetchAdminJugadoresList: jest.fn(),
}));

const U1 = 'aaaaaaaa-bbbb-cccc-dddd-111111111111';
const U2 = 'aaaaaaaa-bbbb-cccc-dddd-222222222222';

const player = (overrides = {}) => ({
  user_id: U1,
  display_name: 'Ana Lopez',
  nombre: 'Ana',
  apellido: 'Lopez',
  username: 'analopez',
  email: 'ana@test.com',
  telefono: '111',
  vinculacion: 'registrado',
  last_activity_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const SEDES = { 7: { id: 7, nombre: 'Club Siete' }, 9: { id: 9, nombre: 'Club Nueve' } };

beforeEach(() => jest.clearAllMocks());

test('super admin arranca en Todos, sin sede_id, y muestra jugadores con y sin sede', async () => {
  fetchAdminJugadoresList.mockResolvedValue({
    items: [
      player({ user_id: U1, display_name: 'Ana Sin Sede' }),
      player({ user_id: U2, display_name: 'Beto Con Sede', nombre: 'Beto' }),
    ],
    total: 2,
    total_pages: 1,
    scope: 'global',
  });

  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);

  expect(await screen.findByText('Ana Sin Sede')).toBeInTheDocument();
  expect(screen.getByText('Beto Con Sede')).toBeInTheDocument();
  expect(fetchAdminJugadoresList).toHaveBeenCalledTimes(1);
  expect(fetchAdminJugadoresList.mock.calls[0][0]).toEqual(expect.objectContaining({
    sedeId: undefined,
    q: '',
    page: 1,
    vinculacion: '',
    orden: 'name_asc',
  }));
  expect(screen.getByRole('option', { name: 'Todos los jugadores' })).toBeInTheDocument();
  expect(screen.getByText(mockCopy['admin.jugadores.subtitleAll'])).toBeInTheDocument();
  expect(screen.queryByText(mockCopy['admin.jugadores.vinculacionNote'])).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Fecha de registro' })).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Teléfono' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Registro más reciente' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Registro más antiguo' })).toBeInTheDocument();
});

test('la sede es filtro opcional y reutiliza el roster de esa sede', async () => {
  fetchAdminJugadoresList.mockResolvedValue({ items: [player()], total: 1, total_pages: 1, scope: 'global' });
  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);
  await screen.findByText('Ana Lopez');

  fireEvent.change(screen.getByRole('combobox', { name: 'Sede' }), { target: { value: '7' } });

  await waitFor(() => expect(fetchAdminJugadoresList).toHaveBeenCalledTimes(2));
  expect(fetchAdminJugadoresList.mock.calls[1][0]).toEqual(expect.objectContaining({ sedeId: '7', page: 1 }));
  expect(screen.getByText(mockCopy['admin.jugadores.vinculacionNote'])).toBeInTheDocument();
  expect(await screen.findByRole('columnheader', { name: 'Última actividad' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Teléfono' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Actividad reciente' })).toBeInTheDocument();
});

test('búsqueda global: debounce envía q y vuelve a página 1', async () => {
  fetchAdminJugadoresList.mockResolvedValue({ items: [player()], total: 1, total_pages: 1 });
  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);
  await screen.findByText('Ana Lopez');

  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'beto' } });

  await waitFor(
    () => expect(fetchAdminJugadoresList).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'beto', page: 1, sedeId: undefined }),
    ),
    { timeout: 2500 },
  );
});

test('búsqueda de 1 carácter no consulta al backend y muestra ayuda', async () => {
  fetchAdminJugadoresList.mockResolvedValue({ items: [player()], total: 1, total_pages: 1 });
  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);
  await screen.findByText('Ana Lopez');

  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'a' } });

  expect(await screen.findByText(mockCopy['admin.jugadores.minChars'])).toBeInTheDocument();
  await waitFor(() => expect(fetchAdminJugadoresList).toHaveBeenCalledTimes(1));
});

test('búsqueda sin coincidencias muestra vacío de búsqueda, no el vacío de sede', async () => {
  fetchAdminJugadoresList
    .mockResolvedValueOnce({ items: [player()], total: 1, total_pages: 1 })
    .mockResolvedValueOnce({ items: [], total: 0, total_pages: 1 });
  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);
  await screen.findByText('Ana Lopez');

  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'zzz' } });

  expect(await screen.findByText(mockCopy['admin.formularios.noPlayerSearchMatch'])).toBeInTheDocument();
  expect(screen.queryByText(mockCopy['admin.jugadores.emptyAll'])).not.toBeInTheDocument();
});

test('sin resultados globales muestra el vacío de todos los jugadores', async () => {
  fetchAdminJugadoresList.mockResolvedValue({ items: [], total: 0, total_pages: 1 });
  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);
  expect(await screen.findByText(mockCopy['admin.jugadores.emptyAll'])).toBeInTheDocument();
});

test('error muestra alerta y Reintentar vuelve a pedir', async () => {
  fetchAdminJugadoresList
    .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }))
    .mockResolvedValueOnce({ items: [player()], total: 1, total_pages: 1 });
  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('boom');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Ana Lopez')).toBeInTheDocument();
  expect(fetchAdminJugadoresList).toHaveBeenCalledTimes(2);
});

test('sin token no llama al backend y pide volver a iniciar sesión', async () => {
  render(<AdminJugadoresSection accessToken="" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);
  expect(await screen.findByRole('alert')).toHaveTextContent(mockCopy['admin.formularios.loginAgainAgain']);
  expect(fetchAdminJugadoresList).not.toHaveBeenCalled();
});

test('respuesta tardía de otro alcance no pisa el resultado vigente', async () => {
  let resolveSlow;
  const slow = new Promise((resolve) => { resolveSlow = resolve; });
  fetchAdminJugadoresList
    .mockImplementationOnce(() => slow)
    .mockResolvedValueOnce({ items: [player({ display_name: 'Beto Nuevo' })], total: 1, total_pages: 1 });

  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Sede' }), { target: { value: '7' } });

  expect(await screen.findByText('Beto Nuevo')).toBeInTheDocument();
  await act(async () => {
    resolveSlow({ items: [player({ display_name: 'Ana Lenta' })], total: 1, total_pages: 1 });
  });
  expect(screen.queryByText('Ana Lenta')).not.toBeInTheDocument();
  expect(screen.getByText('Beto Nuevo')).toBeInTheDocument();
});

test('admin_club queda fijado a su sede, sin opción Todos', async () => {
  fetchAdminJugadoresList.mockResolvedValue({ items: [player()], total: 1, total_pages: 1 });
  render(
    <AdminJugadoresSection
      accessToken="token"
      apiBaseUrl="https://api.test"
      sedeId={7}
      sedesMap={SEDES}
      esAdminClub
    />,
  );

  expect(await screen.findByText('Ana Lopez')).toBeInTheDocument();
  expect(fetchAdminJugadoresList.mock.calls[0][0]).toEqual(expect.objectContaining({ sedeId: '7' }));
  expect(screen.queryByRole('combobox', { name: 'Sede' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Todos los jugadores' })).not.toBeInTheDocument();
  expect(screen.getByText('Club Siete')).toBeInTheDocument();
});

test('admin_club con 403 muestra prohibido y permite reintentar', async () => {
  fetchAdminJugadoresList.mockRejectedValue(Object.assign(new Error('No podés'), { status: 403 }));
  render(
    <AdminJugadoresSection
      accessToken="token"
      apiBaseUrl="https://api.test"
      sedeId={7}
      sedesMap={SEDES}
      esAdminClub
    />,
  );

  expect(await screen.findByRole('alert')).toHaveTextContent(mockCopy['admin.jugadores.forbidden']);
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
});

test('paginación pide la página siguiente y respeta el total del servidor', async () => {
  fetchAdminJugadoresList
    .mockResolvedValueOnce({ items: [player({ display_name: 'Ana Uno' })], total: 3, total_pages: 2 })
    .mockResolvedValueOnce({ items: [player({ user_id: U2, display_name: 'Beto Dos' })], total: 3, total_pages: 2 });
  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);
  await screen.findByText('Ana Uno');

  fireEvent.click(screen.getByRole('button', { name: '→' }));

  expect(await screen.findByText('Beto Dos')).toBeInTheDocument();
  expect(fetchAdminJugadoresList.mock.calls[1][0]).toEqual(expect.objectContaining({ page: 2 }));
  expect(screen.getByText('Página 2 de 2 (3)')).toBeInTheDocument();
});

test('orden y relación se envían al servidor (no se reordenan por página)', async () => {
  fetchAdminJugadoresList.mockResolvedValue({ items: [player()], total: 1, total_pages: 1 });
  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);
  await screen.findByText('Ana Lopez');
  fireEvent.change(screen.getByRole('combobox', { name: 'Sede' }), { target: { value: '7' } });
  await waitFor(() => expect(fetchAdminJugadoresList).toHaveBeenCalledTimes(2));

  fireEvent.change(screen.getByRole('combobox', { name: 'Orden' }), { target: { value: 'name_desc' } });
  await waitFor(() => expect(fetchAdminJugadoresList).toHaveBeenLastCalledWith(
    expect.objectContaining({ orden: 'name_desc', page: 1 }),
  ));

  fireEvent.change(screen.getByRole('combobox', { name: 'Estado de relación' }), { target: { value: 'vinculado' } });
  await waitFor(() => expect(fetchAdminJugadoresList).toHaveBeenLastCalledWith(
    expect.objectContaining({ vinculacion: 'vinculado', page: 1 }),
  ));
});

test('la ficha se cierra al cambiar de alcance', async () => {
  fetchAdminJugadoresList.mockResolvedValue({ items: [player()], total: 1, total_pages: 1 });
  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />);
  await screen.findByText('Ana Lopez');

  fireEvent.click(screen.getByRole('button', { name: 'Ana Lopez' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  fireEvent.change(screen.getByRole('combobox', { name: 'Sede' }), { target: { value: '7' } });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('un jugador sólo vinculado se muestra como vinculado, no como sin historial', async () => {
  fetchAdminJugadoresList.mockResolvedValue({
    items: [player({ display_name: 'Caro Link', vinculacion: 'vinculado' })],
    total: 1,
    total_pages: 1,
  });
  render(<AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" sedeId={7} sedesMap={SEDES} esAdminClub />);

  expect(await screen.findByText('Caro Link')).toBeInTheDocument();
  expect(
    within(screen.getByRole('table')).getByText(mockCopy['admin.jugadores.vinculacionVinculado']),
  ).toBeInTheDocument();
});

test('la ficha global no muestra email/teléfono; la ficha por sede sí los conserva', async () => {
  fetchAdminJugadoresList.mockResolvedValue({
    items: [player({ display_name: 'Ana Lopez', email: 'ana@test.com', telefono: '111' })],
    total: 1,
    total_pages: 1,
  });
  const { rerender } = render(
    <AdminJugadoresSection accessToken="token" apiBaseUrl="https://api.test" isSuperAdmin sedesMap={SEDES} />,
  );
  await screen.findByText('Ana Lopez');
  fireEvent.click(screen.getByRole('button', { name: 'Ana Lopez' }));
  let dialog = screen.getByRole('dialog');
  expect(within(dialog).queryByText('Email')).not.toBeInTheDocument();
  expect(within(dialog).queryByText('Teléfono')).not.toBeInTheDocument();
  expect(within(dialog).queryByText('ana@test.com')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));

  rerender(
    <AdminJugadoresSection
      accessToken="token"
      apiBaseUrl="https://api.test"
      sedeId={7}
      sedesMap={SEDES}
      esAdminClub
    />,
  );
  await screen.findByRole('columnheader', { name: 'Email' });
  fireEvent.click(screen.getByRole('button', { name: 'Ana Lopez' }));
  dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Email')).toBeInTheDocument();
  expect(within(dialog).getByText('ana@test.com')).toBeInTheDocument();
  expect(within(dialog).getByText('111')).toBeInTheDocument();
});

test('cambio de sesión/base cierra la ficha e invalida la respuesta tardía', async () => {
  let resolveSlow;
  const slow = new Promise((resolve) => { resolveSlow = resolve; });
  fetchAdminJugadoresList
    .mockResolvedValueOnce({
      items: [player({ display_name: 'Ana Vieja', email: 'vieja@test.com' })],
      total: 1,
      total_pages: 1,
    })
    .mockImplementationOnce(() => slow);

  const { rerender } = render(
    <AdminJugadoresSection
      accessToken="token-viejo"
      apiBaseUrl="https://api.one"
      sedeId={7}
      sedesMap={SEDES}
      esAdminClub
    />,
  );
  await screen.findByText('Ana Vieja');
  fireEvent.click(screen.getByRole('button', { name: 'Ana Vieja' }));
  expect(within(screen.getByRole('dialog')).getByText('vieja@test.com')).toBeInTheDocument();

  rerender(
    <AdminJugadoresSection
      accessToken="token-nuevo"
      apiBaseUrl="https://api.two"
      sedeId={7}
      sedesMap={SEDES}
      esAdminClub
    />,
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByText('vieja@test.com')).not.toBeInTheDocument();

  await act(async () => {
    resolveSlow({
      items: [player({ display_name: 'Ana Nueva', email: 'nueva@test.com' })],
      total: 1,
      total_pages: 1,
    });
  });
  expect(await screen.findByText('Ana Nueva')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('vieja@test.com')).not.toBeInTheDocument();
});
