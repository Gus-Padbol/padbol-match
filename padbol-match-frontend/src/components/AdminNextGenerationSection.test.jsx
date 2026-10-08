import { render, screen, waitFor } from '@testing-library/react';
import AdminNextGenerationSection from './AdminNextGenerationSection';

test('muestra estado, sede y jornada sin pedir ciudad o país redundantes', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ summary: { total: 1, confirmadas: 1 }, inscripciones: [{ id: 'registration-1', estado: 'confirmada', contacto_nombre: 'Familia QA', jornada: { nombre_publico: 'Jornada U14' }, sede: { sede_club: 'Sede QA' }, participantes: [{ id: 'p1' }], eventos: [{ id: 1 }] }] }) });
  render(<AdminNextGenerationSection accessToken="token" />);
  await waitFor(() => expect(screen.getByText('Familia QA')).toBeInTheDocument());
  expect(screen.getByText(/Jornada U14 · Sede QA/)).toBeInTheDocument();
  expect(screen.queryByLabelText(/ciudad/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/país/i)).not.toBeInTheDocument();
});
