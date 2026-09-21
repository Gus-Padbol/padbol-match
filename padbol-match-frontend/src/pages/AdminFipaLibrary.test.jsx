import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminFipaLibrary, { isActiveGrant, resolveGrantAccount } from './AdminFipaLibrary';

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ session: { access_token: 'test-token' } }),
}));

jest.mock('../i18n/tSafe', () => {
  const es = jest.requireActual('../i18n/locales/es.json');
  const translate = (key, options = {}) => {
    const value = key.split('.').reduce((current, part) => current?.[part], es) || key;
    return String(value).replace(/{{\s*([^}\s]+)\s*}}/g, (_token, name) => options?.[name] ?? '');
  };
  return { useSafeTranslation: () => ({ t: translate, language: 'es' }) };
});

const originalFetch = global.fetch;

function apiResponse(body, ok = true) {
  return { ok, json: async () => body };
}

function mockLibraryApi({ requests = [], grants = [], failure } = {}) {
  global.fetch = jest.fn(async (url, options = {}) => {
    if (failure) return apiResponse({ error: failure }, false);
    if (options.method) return apiResponse({ ok: true });
    if (url.includes('/solicitudes?')) return apiResponse({ requests });
    if (url.endsWith('/habilitaciones')) return apiResponse({ grants });
    throw new Error(`Ruta inesperada en la prueba: ${url}`);
  });
}

function renderLibrary() {
  return render(<MemoryRouter><AdminFipaLibrary /></MemoryRouter>);
}

function mutationCall(method) {
  return global.fetch.mock.calls.find(([, options = {}]) => options.method === method);
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

test('requiere motivo y envía la aprobación autenticada al servidor', async () => {
  mockLibraryApi({
    requests: [{ id: 'request-1', status: 'pending', club_name: 'Club de prueba' }],
  });
  renderLibrary();

  const approve = await screen.findByRole('button', { name: 'Aprobar acceso' });
  fireEvent.click(approve);
  expect(screen.getByRole('alert')).toHaveTextContent('motivo');
  expect(mutationCall('PATCH')).toBeUndefined();

  fireEvent.change(screen.getByLabelText('Motivo de aprobación o rechazo'), {
    target: { value: 'Sede verificada' },
  });
  fireEvent.click(approve);

  await waitFor(() => expect(mutationCall('PATCH')).toBeDefined());
  const [url, options] = mutationCall('PATCH');
  expect(url).toMatch(/\/solicitudes\/request-1$/);
  expect(options.headers.Authorization).toBe('Bearer test-token');
  expect(JSON.parse(options.body)).toEqual({ decision: 'approve', review_note: 'Sede verificada' });
});

test('envía el rechazo con su nota de revisión', async () => {
  mockLibraryApi({
    requests: [{ id: 'request-2', status: 'pending', club_name: 'Cancha declarada' }],
  });
  renderLibrary();

  await screen.findByRole('button', { name: 'Rechazar solicitud' });
  fireEvent.change(screen.getByLabelText('Motivo de aprobación o rechazo'), {
    target: { value: 'No fue posible verificar la vinculación' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Rechazar solicitud' }));

  await waitFor(() => expect(mutationCall('PATCH')).toBeDefined());
  const [url, options] = mutationCall('PATCH');
  expect(url).toMatch(/\/solicitudes\/request-2$/);
  expect(JSON.parse(options.body)).toEqual({
    decision: 'reject',
    review_note: 'No fue posible verificar la vinculación',
  });
});

test('revoca una habilitación activa con un motivo separado', async () => {
  mockLibraryApi({
    grants: [{
      id: 'grant-1',
      user_id: 'user-1',
      email_snapshot: 'miembro@example.com',
      status: 'active',
      granted_at: '2026-09-01T12:00:00Z',
      expires_at: '2099-09-01T12:00:00Z',
    }],
  });
  renderLibrary();

  const revoke = await screen.findByRole('button', { name: 'Revocar acceso' });
  fireEvent.click(revoke);
  expect(screen.getByRole('alert')).toHaveTextContent('revocación');
  expect(mutationCall('POST')).toBeUndefined();

  fireEvent.change(screen.getByLabelText('Motivo de revocación'), {
    target: { value: 'Membresía finalizada' },
  });
  fireEvent.click(revoke);

  await waitFor(() => expect(mutationCall('POST')).toBeDefined());
  const [url, options] = mutationCall('POST');
  expect(url).toMatch(/\/habilitaciones\/grant-1\/revocar$/);
  expect(options.headers.Authorization).toBe('Bearer test-token');
  expect(JSON.parse(options.body)).toEqual({ reason: 'Membresía finalizada' });
});

test('muestra estados vacíos y excluye habilitaciones vencidas o revocadas', async () => {
  mockLibraryApi({
    grants: [
      { id: 'expired', status: 'active', expires_at: '2020-01-01T00:00:00Z' },
      { id: 'revoked', status: 'revoked' },
    ],
  });
  renderLibrary();

  expect(await screen.findByText('No hay solicitudes para revisar')).toBeInTheDocument();
  expect(screen.getByText('No hay habilitaciones activas')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Revocar acceso' })).not.toBeInTheDocument();
});

test('una cuenta rechazada por el servidor no ve solicitudes ni acciones', async () => {
  mockLibraryApi({ failure: 'No autorizado.' });
  renderLibrary();

  expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado.');
  expect(screen.queryByRole('button', { name: 'Aprobar acceso' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Revocar acceso' })).not.toBeInTheDocument();
});

test('los helpers cierran el acceso si el vencimiento es inválido y resuelven la cuenta', () => {
  expect(isActiveGrant({ status: 'active', expires_at: 'fecha-inválida' })).toBe(false);
  expect(isActiveGrant({ status: 'active', expires_at: null })).toBe(true);
  expect(resolveGrantAccount(
    { request_id: 'request-3', user_id: 'user-3' },
    [{ id: 'request-3', email_snapshot: 'cuenta@example.com' }],
  )).toBe('cuenta@example.com');
});
