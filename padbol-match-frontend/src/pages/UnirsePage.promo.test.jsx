import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UnirsePage from './UnirsePage';
import i18n from '../i18n';
import { commercialFlowCopy } from './commercialFlowCopy';

jest.mock('../components/AppHeader', () => function AppHeaderMock({ title }) {
  return <header>{title}</header>;
});

jest.mock('../context/HubNavLayoutContext', () => ({
  useHubNavLayout: () => ({ navDock: 'top' }),
}));

describe('solicitud promocional para sedes Padbol', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
    window.scrollTo = jest.fn();
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
    expect(screen.getByText('Accesează beneficiul Padbol Courts și dezvoltă-ți clubul')).toBeInTheDocument();
    expect(screen.getByText('3 luni gratuite.')).toBeInTheDocument();
    expect(screen.getByText('Preț Pro')).toBeInTheDocument();
    expect(screen.getByText('Serviciu pentru club pe terenurile Padbol: 0%')).toBeInTheDocument();
    expect(screen.getByText('Beneficiu Padbol: reducere de 50%')).toBeInTheDocument();
    expect(screen.getByText('Încă 50% reducere pentru îndeplinirea obiectivelor')).toBeInTheDocument();
    const priceCards = within(screen.getByRole('region', { name: 'Cum funcționează beneficiul Pro' })).getAllByRole('article');
    expect(priceCards.map((card) => within(card).getByText(/^USD \d+$/).textContent)).toEqual(['USD 68', 'USD 34', 'USD 17']);
    expect(screen.getByRole('complementary', { name: commercialFlowCopy('ro').promo.outreachTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicită beneficiul Padbol Courts' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Seleccion|Nombre de|¿|Empez|meses sin cargo/);
    expect(container.textContent).not.toMatch(/6 luni|reînnoire lunară/i);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('explica precios y objetivos antes del formulario breve y conserva el contrato de solicitud', async () => {
    render(
      <MemoryRouter initialEntries={['/unirse?plan=pro&promo=padbol-pro-renovable']}>
        <UnirsePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Accede al beneficio Padbol Courts y haz crecer tu sede')).toBeInTheDocument();
    expect(screen.getByText(/Los primeros 3 meses son sin cargo/i)).toBeInTheDocument();
    expect(screen.getByText('3 meses sin cargo.')).toBeInTheDocument();
    expect(screen.getByText('Valor Pro')).toBeInTheDocument();
    expect(screen.getByText('Servicio a la sede en canchas Padbol: 0%')).toBeInTheDocument();
    expect(screen.getByText('Beneficio Padbol: 50% de descuento')).toBeInTheDocument();
    expect(screen.getByText('Otro 50% por cumplir los objetivos')).toBeInTheDocument();
    const priceExplanation = screen.getByRole('region', { name: 'Cómo funciona el beneficio Pro' });
    const priceCards = within(priceExplanation).getAllByRole('article');
    expect(priceCards.map((card) => within(card).getByText(/^USD \d+$/).textContent)).toEqual(['USD 68', 'USD 34', 'USD 17']);
    expect(screen.getByText(/Enviar el formulario no activa cobros\./)).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(screen.getByText('Objetivos que hacen crecer tu sede')).toBeInTheDocument();
    const tournamentGoal = screen.getByText(/Organizar y finalizar al menos un torneo al mes, gestionado íntegramente en Padbol Match, con un mínimo de 8 parejas y jugadores inscritos desde la app\./i);
    expect(tournamentGoal).toBeInTheDocument();
    const goals = tournamentGoal.closest('ul');
    expect(within(goals).getAllByRole('listitem', { hidden: true })).toHaveLength(4);
    expect(goals.textContent).not.toContain('PadCoins');
    expect(goals.textContent).toMatch(/Cada persona cuenta una sola vez/i);
    expect(goals.textContent).toMatch(/quienes juegan efectivamente en los torneos/i);
    expect(goals.textContent).toMatch(/Pueden ser los mismos jugadores de meses anteriores/i);
    expect(within(goals).getByText(/Registrar todos los resultados en Padbol Match\. El último punto de la final en el marcador digital debe definir al campeón y finalizar el torneo/i)).toBeInTheDocument();
    expect(goals.textContent).toMatch(/los demás partidos pueden cargarse en vivo o manualmente al terminar/i);
    expect(goals.textContent).not.toMatch(/50%|100%|redondeo/);
    expect(within(goals).getByText(/12 reservas reales al mes.*desde la app por usuarios verificados.*reservas canceladas no cuentan/i)).toBeInTheDocument();
    expect(within(goals).getByText(/al menos 10 jugadores distintos vinculados a la sede.*actividad real durante el mes/i)).toBeInTheDocument();
    const firstInput = screen.getByLabelText('Nombre de la sede *');
    expect(priceExplanation.compareDocumentPosition(firstInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(goals.compareDocumentPosition(firstInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const monthlyGoals = screen.getByRole('region', { name: 'Objetivos que hacen crecer tu sede' });
    expect(within(monthlyGoals).getByText('El 50% adicional se aplica al cumplir todos los objetivos del mes.')).toBeInTheDocument();
    expect(monthlyGoals.textContent).not.toMatch(/con límite|parciales|tarifa mínima|16 jugadores|se revisan|no suma descuentos/i);
    const growthAdvice = screen.getByRole('complementary', { name: 'Haz crecer tu sede' });
    expect(monthlyGoals).not.toContainElement(growthAdvice);
    expect(screen.getByRole('region', { name: 'Te ayudamos a poner en marcha tu club' })).toContainElement(growthAdvice);
    expect(within(growthAdvice).getByText(/redes sociales.*promociones.*campañas publicitarias/i)).toBeInTheDocument();
    expect(growthAdvice.textContent).not.toMatch(/USD|descuento|comprob|revisi|\d/);
    expect(screen.queryByText('La difusión del deporte también cuenta')).not.toBeInTheDocument();
    expect(screen.getByText('Te ayudamos a poner en marcha tu club')).toBeInTheDocument();
    expect(screen.getByText(/onboarding personalizado de Padbol Match/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar el beneficio Padbol Courts' }));

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
    expect(payload.mensaje).toContain('3 meses iniciales');
    expect(payload.mensaje).toContain('USD 34 de referencia');
    expect(payload.mensaje).toContain('base de USD 68');
    expect(payload.mensaje).toContain('otro 50% sobre USD 34');
    expect(payload.mensaje).toContain('cuatro metas mensuales');
    expect(payload.mensaje).toContain('sin descuentos parciales');
    expect(payload.mensaje).toContain('al menos 8 parejas');
    expect(payload.mensaje).toContain('gestionado íntegramente en Padbol Match');
    expect(payload.mensaje).toContain('jugadores inscritos desde la app');
    expect(payload.mensaje).toContain('sorteo automático o manual por el club y zonas en el sistema');
    expect(payload.mensaje).toContain('el último punto de la final en el marcador digital define al campeón y finaliza el torneo');
    expect(payload.mensaje).toContain('los demás partidos pueden registrarse en vivo desde PC o tablet o cargarse manualmente al terminar');
    expect(payload.mensaje).toContain('sin pantalla física obligatoria');
    expect(payload.mensaje).not.toMatch(/al menos el 50% de los partidos|100% de los partidos|redondeo/);
    expect(payload.mensaje).toContain('12 reservas reales completadas al mes, realizadas desde la app por usuarios verificados');
    expect(payload.mensaje).toContain('10 jugadores distintos vinculados a la sede');
    expect(payload.mensaje).toContain('cada persona cuenta una sola vez');
    expect(payload.mensaje).toContain('también quienes juegan efectivamente en los torneos');
    expect(payload.mensaje).toContain('pueden repetirse de meses anteriores');
    expect(payload.mensaje).not.toContain('10 reservas');
    expect(payload.mensaje).toContain('tarifa mínima USD 17, metas no acumulables');
    expect(payload.mensaje).not.toMatch(/PadCoins|seis metas|sólo como proyección/i);
    expect(payload.mensaje).toContain('facturación cerrada');
    expect(payload.mensaje).not.toMatch(/6 meses|renovación mensual por continuidad/i);
  });

  it.each(['en', 'es', 'ro', 'cs', 'de', 'fr', 'it', 'ar', 'fa-IR', 'nl-NL', 'nl-BE', 'sv', 'pt-BR', 'pt-PT', 'el', 'hu', 'he', 'pl', 'uk', 'af'])(
    'mantiene el tramo comercial 3/68/34/17 en el copy público %s',
    (locale) => {
      const promo = commercialFlowCopy(locale).promo;
      const publicOffer = [promo.title, promo.lead, promo.benefits.flat().join(' '), promo.formSubtitle, promo.submit].join(' ');

      expect(publicOffer).toContain('3');
      expect(publicOffer).toContain('68');
      expect(publicOffer).toContain('34');
      expect(publicOffer).toContain('17');
      expect(publicOffer).not.toMatch(/\b6\b/);
    },
  );
});
