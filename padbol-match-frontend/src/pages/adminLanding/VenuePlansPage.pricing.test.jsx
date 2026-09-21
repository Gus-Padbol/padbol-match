import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VenuePlansPage from './VenuePlansPage';
import { venuePlansCopy } from './venuePlansCopy';

jest.mock('../publicSite/PublicSiteLayout', () => function PublicSiteLayoutMock({ children }) {
  return <>{children}</>;
});

jest.mock('../../i18n/tSafe', () => ({
  useSafeTranslation: () => ({ i18n: { language: 'es', resolvedLanguage: 'es' } }),
}));

beforeEach(() => {
  window.scrollTo = jest.fn();
});

test('muestra los planes antes de la invitación sin cifras y enlaza a la explicación con formulario', () => {
  render(
    <MemoryRouter>
      <VenuePlansPage />
    </MemoryRouter>,
  );

  const proCard = screen.getAllByRole('article').find((article) => (
    within(article).queryByRole('heading', { name: 'Pro' })
  ));
  expect(within(proCard).getByText('USD 68')).toBeInTheDocument();
  expect(within(proCard).getByText(/USD 680/)).toBeInTheDocument();

  const businessCard = screen.getAllByRole('article').find((article) => (
    within(article).queryByRole('heading', { name: 'Business' })
  ));
  expect(within(businessCard).getByRole('link', { name: 'HABLEMOS' })).toHaveAttribute(
    'href', '/contacto?tema=business',
  );
  expect(businessCard.querySelector('.venue-plans__price')).toHaveTextContent('HABLEMOS');
  expect(within(businessCard).getByText('A definir')).toBeInTheDocument();
  expect(businessCard.textContent).not.toMatch(/USD|%|Desde|\/ mes|\/ año/);

  const benefit = screen.getByRole('region', { name: '¿Eres propietario de una o más Padbol Courts?' });
  const catalog = proCard.closest('section');
  ['Starter', 'Pro', 'Business'].forEach((name) => {
    expect(within(catalog).getByRole('heading', { name })).toBeInTheDocument();
  });
  expect(catalog.compareDocumentPosition(benefit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(benefit.textContent).not.toMatch(/USD|[%％]|[0-9۰-۹٠-٩]/u);
  expect(within(benefit).getByRole('link', { name: 'PIDE TUS BENEFICIOS' })).toHaveAttribute(
    'href', '/unirse?plan=pro&promo=padbol-pro-renovable',
  );
  expect(within(benefit).getByText(/Descubre los beneficios exclusivos/i)).toBeInTheDocument();
  expect(screen.queryByText(/6 meses|renuévalo mes a mes/i)).not.toBeInTheDocument();
});

test.each(['es', 'en', 'ro', 'cs', 'pt-BR', 'pt-PT', 'it', 'fr', 'de', 'ar', 'fa-IR', 'nl-NL', 'nl-BE', 'sv', 'el', 'hu', 'he', 'pl', 'uk', 'af'])(
  'mantiene la invitación sin precios, porcentajes ni duración en %s',
  (locale) => {
    const copy = venuePlansCopy(locale);
    const publicOffer = [copy.padbolOwnerText, copy.padbolOwnerHint, copy.padbolOwnerCta].join(' ');

    expect(copy.padbolOwnerText).toBeTruthy();
    expect(copy.padbolOwnerCta).toBeTruthy();
    expect(publicOffer).not.toMatch(/USD|[%％]|[0-9۰-۹٠-٩]/u);
  },
);

test('los CTA comerciales siguen abriendo formularios y no un checkout', () => {
  render(
    <MemoryRouter>
      <VenuePlansPage />
    </MemoryRouter>,
  );

  const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href')).filter(Boolean);
  expect(hrefs).toContain('/unirse?plan=pro');
  expect(hrefs).toContain('/unirse?plan=pro&promo=padbol-pro-renovable');
  expect(hrefs.join(' ')).not.toMatch(/checkout|pago|payment/i);
});
