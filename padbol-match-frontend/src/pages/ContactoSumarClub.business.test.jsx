import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContactoSumarClub from './ContactoSumarClub';

jest.mock('../components/AppHeader', () => function AppHeaderMock({ title }) {
  return <header>{title}</header>;
});

describe('consulta del plan Business', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id: 22 }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reemplaza el alta vieja por un formulario multisede y envía una solicitud compatible', async () => {
    render(
      <MemoryRouter initialEntries={['/contacto?tema=business']}>
        <ContactoSumarClub />
      </MemoryRouter>,
    );

    expect(screen.getByText('Consulta Plan Business')).toBeInTheDocument();
    expect(screen.queryByText('Completar formulario de alta')).not.toBeInTheDocument();
    expect(screen.getByText(/no activa ningún plan, suscripción ni cobro/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre de la organización o cadena *'), { target: { value: 'Cadena Padel España' } });
    fireEvent.change(screen.getByLabelText('Nombre y apellido del responsable *'), { target: { value: 'Ana García' } });
    fireEvent.change(screen.getByLabelText('País principal *'), { target: { value: 'España' } });
    fireEvent.change(screen.getByLabelText('Ciudad o ubicación central *'), { target: { value: 'Madrid' } });
    fireEvent.change(screen.getByLabelText('¿Cuántas sedes tiene la organización? *'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Cantidad total aproximada de canchas *'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Deporte principal *'), { target: { value: 'padel' } });
    fireEvent.change(screen.getByLabelText('¿Ofrece otros deportes? *'), { target: { value: 'si' } });
    fireEvent.change(screen.getByLabelText('Email de contacto *'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('WhatsApp con código de país *'), { target: { value: '+34 600 123 456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta Business' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [, request] = global.fetch.mock.calls[0];
    const payload = JSON.parse(request.body);
    expect(payload).toMatchObject({
      club_nombre: 'Cadena Padel España',
      pais: 'España',
      ciudad: 'Madrid',
      responsable_nombre: 'Ana García',
      responsable_cargo: 'manager',
      cantidad_canchas: 120,
      deportes_canchas: { deportes: ['padel'], canchas: { padel: 120 } },
    });
    expect(payload.mensaje).toContain('Plan consultado: Business');
    expect(payload.mensaje).toContain('Cantidad de sedes: 15');
  });
});
