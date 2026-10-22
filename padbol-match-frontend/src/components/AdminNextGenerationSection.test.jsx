import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AdminNextGenerationSection from './AdminNextGenerationSection';

test('muestra estado, sede y jornada sin pedir ciudad o país redundantes', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ summary: { total: 1, confirmadas: 1 }, inscripciones: [{ id: 'registration-1', estado: 'confirmada', contacto_nombre: 'Familia QA', jornada: { nombre_publico: 'Jornada U14' }, sede: { sede_club: 'Sede QA' }, participantes: [{ id: 'p1' }], eventos: [{ id: 1 }] }] }) });
  render(<AdminNextGenerationSection accessToken="token" />);
  await waitFor(() => expect(screen.getByText('Familia QA')).toBeInTheDocument());
  expect(screen.getByText(/Jornada U14 · Sede QA/)).toBeInTheDocument();
  expect(screen.queryByLabelText(/ciudad/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/país/i)).not.toBeInTheDocument();
});

const overview = { summary: {}, inscripciones: [], sedes: [{ id: 1, nombre: 'Club Uno' }, { id: 2, nombre: 'Club Dos' }], jornadas: [] };
const reply = (body, ok = true) => ({ ok, json: async () => body });
beforeEach(() => { global.fetch = jest.fn().mockResolvedValue(reply(overview)); });
const open = async (props = {}) => {
  render(<AdminNextGenerationSection accessToken="token" role="super_admin" {...props} />);
  await screen.findByText('Actualizar'); fireEvent.click(screen.getByText('Crear jornada'));
};
const fill = () => {
  fireEvent.change(screen.getByLabelText('Sede'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Nombre de la jornada'), { target: { value: 'Jornada QA' } });
  fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-11-10T14:00' } });
  fireEvent.change(screen.getByLabelText('Cupo'), { target: { value: '24' } });
};
test.each(['empleado', 'admin_nacional', 'admin_cadena', 'editor_contenido'])('no ofrece creación a %s', async (role) => {
  render(<AdminNextGenerationSection accessToken="token" role={role} />); await screen.findByText('Actualizar');
  expect(screen.queryByText('Crear jornada')).not.toBeInTheDocument(); expect(fetch.mock.calls.every(([, options]) => !options.method)).toBe(true);
});
test('crea payload mínimo con token, exige identidad y refresca overview', async () => {
  await open(); fill(); fetch.mockResolvedValueOnce(reply({ session: { id: 'saved-session', nombre_publico: 'Jornada QA' } }));
  fireEvent.submit(screen.getByRole('form')); await screen.findByRole('status');
  const call = fetch.mock.calls.find(([, options]) => options.method === 'POST');
  expect(call[0]).toMatch(/\/sessions$/); expect(call[1].headers.Authorization).toBe('Bearer token');
  expect(JSON.parse(call[1].body)).toEqual({ sede_id: 1, nombre_publico: 'Jornada QA', categoria: 'U14', comienza_at: new Date('2026-11-10T14:00').toISOString(), termina_at: null, cupo: 24, estado: 'borrador' });
  expect(fetch).toHaveBeenCalledTimes(3);
});
test('club limita selector y payload a su propia sede', async () => {
  await open({ role: 'admin_club', sedeId: 2 }); expect(screen.getByLabelText('Sede')).toBeDisabled(); expect(screen.queryByText('Club Uno')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nombre de la jornada'), { target: { value: 'Jornada club' } });
  fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-11-10T14:00' } }); fireEvent.change(screen.getByLabelText('Cupo'), { target: { value: '12' } });
  fetch.mockResolvedValueOnce(reply({ session: { id: 'session-2' } })); fireEvent.submit(screen.getByRole('form')); await screen.findByRole('status');
  expect(JSON.parse(fetch.mock.calls.find(([, o]) => o.method === 'POST')[1].body).sede_id).toBe(2);
});
test('fecha invertida y cupo cero bloquean submit forzado', async () => {
  await open(); fill(); fireEvent.change(screen.getByLabelText('Final (opcional)'), { target: { value: '2026-11-10T13:00' } }); fireEvent.submit(screen.getByRole('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('posterior');
  fireEvent.change(screen.getByLabelText('Final (opcional)'), { target: { value: '' } }); fireEvent.change(screen.getByLabelText('Cupo'), { target: { value: '0' } }); fireEvent.submit(screen.getByRole('form')); expect(fetch).toHaveBeenCalledTimes(1);
});
test.each([reply({ error: 'internal' }, false), reply({})])('error o respuesta sin ID conserva inputs sin falso éxito', async (failure) => {
  await open(); fill(); fetch.mockResolvedValueOnce(failure); fireEvent.submit(screen.getByRole('form')); await screen.findByRole('alert');
  expect(screen.getByLabelText('Nombre de la jornada')).toHaveValue('Jornada QA'); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
