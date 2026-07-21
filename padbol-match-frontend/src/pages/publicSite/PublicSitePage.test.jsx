import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PublicSitePage from './PublicSitePage';
import { PUBLIC_SITE_SECTION_ORDER } from '../../content/publicSiteContent';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock('../../i18n/tSafe', () => {
  const locale = require('../../i18n/locales/es.json');
  const flatten = (value, prefix = '', result = {}) => {
    Object.entries(value).forEach(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, result);
      else result[path] = String(child);
    });
    return result;
  };
  const fallbacks = flatten(locale);
  return {
    ES_FALLBACKS: fallbacks,
    useSafeTranslation: () => ({
      t: (key, fallback) => fallback || fallbacks[key] || key,
    }),
  };
});

jest.mock('../../components/PadbolBrandLogo', () => function Logo({ alt }) {
  return <img alt={alt} />;
});
jest.mock('../../components/common/SportIcon', () => function SportIconMock({ deporte }) {
  return <span data-testid={`sport-icon-${deporte}`} />;
});
jest.mock('../../components/LanguageSwitcher', () => function Language() {
  return <button type="button">Idioma</button>;
});
jest.mock('../../components/CookieConsentBanner', () => function Cookies() {
  return null;
});

describe('/plataforma public site', () => {
  beforeEach(() => {
    document.head.innerHTML = [
      '<meta name="description" content="Descripción anterior">',
      '<meta name="theme-color" content="#ffffff">',
    ].join('');
    document.title = 'Título anterior';
    window.scrollTo = jest.fn();
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  });

  function renderPage() {
    return render(<PublicSitePage />);
  }

  it('renderiza todos los anchors, un h1 y ninguna BottomNav', () => {
    const { container } = renderPage();
    PUBLIC_SITE_SECTION_ORDER.forEach((id) => expect(container.querySelector(`#${id}`)).toBeTruthy());
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('.bottom-nav')).toBeNull();
  });

  it('expone navegación, CTAs y stores próximamente sin enlaces falsos', () => {
    renderPage();
    expect(screen.getAllByRole('link', { name: 'Plataforma' })[0]).toHaveAttribute('href', '#ecosistema');
    expect(screen.getAllByRole('link', { name: 'Para jugadores' })[0]).toHaveAttribute('href', '#jugadores');
    expect(screen.getAllByRole('link', { name: 'Para sedes' })[0]).toHaveAttribute('href', '#sedes');
    expect(screen.getAllByRole('link', { name: 'Descargar' })[0]).toHaveAttribute('href', '#descargar');
    expect(screen.getAllByRole('link', { name: 'Quiero jugar' })[0]).toHaveAttribute('href', '/hub');
    expect(screen.getAllByRole('link', { name: 'Quiero incorporar Padbol Match' })[0])
      .toHaveAttribute('href', '/contacto');
    expect(screen.getAllByRole('link', { name: 'Ingresar' })[0]).toHaveAttribute('href', '/acceso');
    expect(screen.getAllByText('Próximamente')).toHaveLength(2);
    expect(screen.getByText('App Store').closest('a')).toBeNull();
    expect(screen.getByText('Google Play').closest('a')).toBeNull();
  });

  it('abre el menú móvil, mueve el foco y cierra con Escape', () => {
    renderPage();
    const toggle = screen.getByRole('button', { name: 'Abrir menú' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toHaveTextContent('Plataforma');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(toggle);
  });

  it('aplica SEO público y restaura el head al desmontar', () => {
    const { unmount } = renderPage();
    expect(document.title).toBe('Padbol Match | Juego, comunidad y gestión');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'La plataforma que conecta jugadores, sedes, competencia, fidelización y gestión en una sola experiencia.',
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://localhost/plataforma',
    );
    expect(document.querySelector('meta[property="og:title"]')).toBeTruthy();
    expect(document.querySelector('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
    expect(document.querySelector('meta[property="og:image"]')).toBeNull();
    unmount();
    expect(document.title).toBe('Título anterior');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'Descripción anterior',
    );
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[property="og:title"]')).toBeNull();
  });
});
