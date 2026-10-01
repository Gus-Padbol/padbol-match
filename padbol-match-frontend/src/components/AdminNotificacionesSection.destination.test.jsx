import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminNotificacionesSection from './AdminNotificacionesSection';

const response = (body) => ({ ok: true, status: 200, json: async () => body });

afterEach(() => jest.restoreAllMocks());

test('superadmin configura torneo real, no ve cupo y el historial muestra destino legible', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (url, options = {}) => {
    const path = String(url);
    if (path.includes('/admin-quota')) return response({ unlimited: true, remaining: null });
    if (path.includes('/admin-history')) return response([{
      id: 1,
      titulo: 'Inscripción abierta',
      segmento: { type: 'todos_usuarios', destination: { type: 'torneo', entityId: '42', label: 'Torneo Apertura' } },
      cantidad_enviadas: 1,
      estado: 'sent',
    }]);
    if (path.includes('/admin-segment-preview')) return response({ recipients: 1, withPushToken: 1, category: 'marketing' });
    if (path.includes('/send-admin')) return response({ cantidad_enviadas: 1, quota: { unlimited: true } });
    throw new Error(`Unexpected ${path}`);
  });

  render(
    <AdminNotificacionesSection
      apiBaseUrl="https://api.example.test"
      accessToken="token"
      isSuperAdmin
      torneosOptions={[{ id: 42, nombre: 'Torneo Apertura' }]}
    />,
  );

  expect(await screen.findAllByText('Torneo Apertura')).not.toHaveLength(0);
  expect(screen.queryByText(/restantes/i)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/title|título/i), { target: { value: 'Inscripción abierta' } });
  fireEvent.change(screen.getByLabelText(/message|mensaje/i), { target: { value: 'Sumate hoy' } });
  fireEvent.change(screen.getByLabelText('Destino al tocar'), { target: { value: 'torneo' } });
  fireEvent.change(screen.getByLabelText('Torneo'), { target: { value: '42' } });
  expect(screen.getByText(/al tocar abrirá Torneo Apertura/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /send|enviar/i }));

  await waitFor(() => {
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/send-admin'));
    expect(JSON.parse(call[1].body).destination).toEqual({ type: 'torneo', entityId: '42' });
  });
  expect(screen.getByLabelText('Destino al tocar')).toHaveValue('torneo');
});

test('acepta el event_id namespaced de un formulario CRM como destino obligatorio', async () => {
  jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const path = String(url);
    if (path.includes('/admin-quota')) return response({ unlimited: true, remaining: null });
    if (path.includes('/admin-history')) return response([]);
    if (path.includes('/admin-segment-preview')) return response({ recipients: 6, withPushToken: 4 });
    throw new Error(`Unexpected ${path}`);
  });

  render(
    <AdminNotificacionesSection
      apiBaseUrl="https://api.example.test"
      accessToken="token"
      isSuperAdmin
    />,
  );

  await screen.findByText(/destino para continuar/i);
  fireEvent.change(screen.getByLabelText('Destino al tocar'), { target: { value: 'formulario' } });
  const destinationInput = screen.getByLabelText('ID de Formulario / evento CRM');
  expect(destinationInput).toHaveAttribute('pattern', '[A-Za-z0-9_:-]+');
  expect(destinationInput).toBeRequired();
  fireEvent.change(destinationInput, { target: { value: 'nextgen:registration:created:1234' } });
  expect(screen.getByText(/Formulario \/ evento CRM #nextgen:registration:created:1234/i)).toBeInTheDocument();
});
