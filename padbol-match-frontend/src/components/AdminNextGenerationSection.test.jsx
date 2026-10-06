import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminNextGenerationSection from './AdminNextGenerationSection';

const overview = {
  participants: [
    { id: 'registration-1', estado: 'confirmada', contacto_nombre: 'Familia Real', pais: 'España', sesion_id: 'session-1', jornada: { id: 'session-1', nombre_publico: 'Madrid U14', categoria: 'U14', cupo: 16 }, sede: { sede_club: 'Madrid Centro', pais: 'España' }, participantes: [{ id: 'p1' }] },
    { id: 'registration-test', estado: 'en_espera', contacto_nombre: '[LIMPIAR] Prueba 23', is_test: true },
  ],
  venueApplications: [{ id: 'venue-1', sede_club: 'Club Barcelona', ciudad: 'Barcelona', pais: 'España', estado: 'pendiente' }],
  sessions: [{ id: 'session-1', sede_id: 7, nombre_publico: 'Madrid U14', ciudad: 'Madrid', pais: 'España', categoria: 'U14', cupo: 16, estado: 'programada', comienza_at: '2026-11-01T10:00:00.000Z' }],
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => overview });
});

test('separa participantes, oculta pruebas y muestra datos operativos', async () => {
  render(<AdminNextGenerationSection accessToken="token" />);
  await screen.findByText('Familia Real');
  expect(screen.getByText(/España · Madrid Centro · Madrid U14 · U14/)).toBeInTheDocument();
  expect(screen.queryByText('[LIMPIAR] Prueba 23')).not.toBeInTheDocument();
  expect(screen.getByText(/Mostrar 1 registro/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/Mostrar 1 registro/));
  expect(screen.getByText('[LIMPIAR] Prueba 23')).toBeInTheDocument();
});

test('muestra las postulaciones en una pestaña separada', async () => {
  render(<AdminNextGenerationSection accessToken="token" isSuperAdmin />);
  await screen.findByText('Familia Real');
  fireEvent.click(screen.getByRole('tab', { name: 'Sedes y postulaciones' }));
  expect(screen.getAllByText('Club Barcelona').length).toBeGreaterThan(0);
  expect(screen.queryByText('Familia Real')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Evaluar' })).toBeInTheDocument();
});

test('confirma una inscripción por el endpoint operativo', async () => {
  render(<AdminNextGenerationSection accessToken="token" />);
  await screen.findByText('Familia Real');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/admin/next-generation/registrations/registration-1/confirm',
    expect.objectContaining({ method: 'POST' }),
  ));
});

test('permite a una sede crear una jornada con cupo', async () => {
  render(<AdminNextGenerationSection accessToken="token" />);
  await screen.findByText('Familia Real');
  fireEvent.click(screen.getByRole('tab', { name: 'Jornadas y cupos' }));
  fireEvent.change(screen.getByLabelText('Nombre de la jornada'), { target: { value: 'Nueva U16' } });
  fireEvent.change(screen.getByLabelText('Categoría de la jornada'), { target: { value: 'U16' } });
  fireEvent.change(screen.getByLabelText('Inicio de la jornada'), { target: { value: '2026-12-01T10:00' } });
  fireEvent.change(screen.getByLabelText('Cupo de la jornada'), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear jornada' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/admin/next-generation/sessions',
    expect.objectContaining({ method: 'POST', body: expect.stringContaining('"cupo":20') }),
  ));
});

test('carga una jornada existente para editar el cupo', async () => {
  render(<AdminNextGenerationSection accessToken="token" />);
  await screen.findByText('Familia Real');
  fireEvent.click(screen.getByRole('tab', { name: 'Jornadas y cupos' }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar jornada y cupo' }));
  fireEvent.change(screen.getByLabelText('Cupo de la jornada'), { target: { value: '24' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    '/api/admin/next-generation/sessions/session-1',
    expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"cupo":24') }),
  ));
});
