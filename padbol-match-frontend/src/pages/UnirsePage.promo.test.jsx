import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UnirsePage from './UnirsePage';
import i18n from '../i18n';

jest.mock('../components/AppHeader', () => function AppHeaderMock({ title }) {
  return <header>{title}</header>;
});

jest.mock('../context/HubNavLayoutContext', () => ({
  useHubNavLayout: () => ({ navDock: 'top' }),
}));

describe('solicitud promocional para sedes Padbol', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, id: 1 }),
    });
  });

  it('renders the complete promotional journey in Romanian without Spanish UI copy', async () => {
    await i18n.changeLanguage('ro');
    const { container } = render(
      <MemoryRouter initialEntries={['/unirse?plan=pro&promo=padbol-pro-renovable']}>
        <UnirsePage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Folosește gratuit Padbol Match Pro și dezvoltă-ți clubul')).toBeInTheDocument();
    expect(screen.getByText('6 luni gratuite')).toBeInTheDocument();
    expect(screen.getByText('Și promovarea sportului contează')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicită cele 6 luni Pro gratuite' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Seleccion|Nombre de|¿|Empez|meses sin cargo/);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('muestra solo el formulario breve y envía los datos compatibles con el backend', async () => {
    render(
      <MemoryRouter initialEntries={['/unirse?plan=pro&promo=padbol-pro-renovable']}>
        <UnirsePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Usa Padbol Match Pro sin cargo y haz crecer tu sede')).toBeInTheDocument();
    expect(screen.getByText(/Empiezas con 6 meses completos/i)).toBeInTheDocument();
    expect(screen.getByText('6 meses sin cargo')).toBeInTheDocument();
    expect(screen.getByText('Renovación mensual')).toBeInTheDocument();
    expect(screen.getByText('Sin sorpresas')).toBeInTheDocument();
    expect(screen.getByText(/continúas en Starter/i)).toBeInTheDocument();
    expect(screen.getByText('Objetivos que hacen crecer tu sede')).toBeInTheDocument();
    expect(screen.getByText(/Organizar y finalizar al menos 1 torneo/i)).toBeInTheDocument();
    expect(screen.getByText('La difusión del deporte también cuenta')).toBeInTheDocument();
    expect(screen.getByText(/tiempo, el esfuerzo y la inversión/i)).toBeInTheDocument();
    expect(screen.getByText('Te ayudamos a poner en marcha tu club')).toBeInTheDocument();
    expect(screen.getByText(/onboarding de Padbol Match/i)).toBeInTheDocument();
    expect(screen.getByText(/servicios adicionales/i)).toBeInTheDocument();
    expect(screen.queryByText('Planes para crecer con Padbol Match')).not.toBeInTheDocument();
    expect(screen.queryByText('Sede Base')).not.toBeInTheDocument();
    expect(screen.queryByText(/licencia/i)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Padbol Match' })).toHaveAttribute(
      'src',
      '/media/public-site/jero/padbol-match-logo-white.svg',
    );

    fireEvent.change(screen.getByLabelText('Nombre de la sede *'), { target: { value: 'La Meca' } });
    fireEvent.change(screen.getByLabelText('Nombre y apellido del propietario *'), { target: { value: 'Gustavo Miguens' } });
    fireEvent.change(screen.getByLabelText('País *'), { target: { value: 'Argentina' } });
    fireEvent.change(screen.getByLabelText('Ubicación de la sede *'), { target: { value: 'La Plata, Buenos Aires' } });
    fireEvent.change(screen.getByLabelText('¿Cuántos Padbol Courts tiene? *'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('¿La sede ofrece otros deportes? *'), { target: { value: 'si' } });
    fireEvent.change(screen.getByLabelText('Email de contacto *'), { target: { value: 'club@example.com' } });
    fireEvent.change(screen.getByLabelText('WhatsApp con código de país *'), { target: { value: '+54 9 221 555 1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pedir mis 6 meses Pro sin cargo' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [, request] = global.fetch.mock.calls[0];
    const payload = JSON.parse(request.body);
    expect(payload).toMatchObject({
      club_nombre: 'La Meca',
      pais: 'Argentina',
      ciudad: 'La Plata, Buenos Aires',
      responsable_nombre: 'Gustavo Miguens',
      responsable_cargo: 'propietario',
      cantidad_canchas: 2,
      deportes_canchas: { deportes: ['padbol'], canchas: { padbol: 2 } },
    });
    expect(payload.mensaje).toContain('Otros deportes en la sede: Sí');
    expect(payload.mensaje).toContain('renovación mensual por continuidad');
  });
});
