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
  const catalog = flatten(locale);
  return {
    ES_FALLBACKS: catalog,
    useSafeTranslation: () => ({
      t: (key, fallback) => catalog[key] || fallback || key,
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
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    jest.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderPage() {
    return render(<PublicSitePage />);
  }

  it('renderiza la estructura nueva, un h1 y ninguna BottomNav', () => {
    const { container } = renderPage();
    PUBLIC_SITE_SECTION_ORDER.forEach((id) => expect(container.querySelector(`#${id}`)).toBeTruthy());
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('.bottom-nav')).toBeNull();
    expect(container.querySelector('.ps-hero__video')).toBeTruthy();
    expect(container.querySelector('.public-site-hero__globe')).toBeNull();
  });

  it('expone navegación, CTAs prioritarios y stores no activos', () => {
    renderPage();
    expect(screen.getAllByRole('link', { name: 'Plataforma' })[0]).toHaveAttribute('href', '#que-es');
    expect(screen.getAllByRole('link', { name: 'Para jugadores' })[0]).toHaveAttribute('href', '#jugadores');
    expect(screen.getAllByRole('link', { name: 'Comunidad' })[0]).toHaveAttribute('href', '#comunidad-partidos');
    expect(screen.getAllByRole('link', { name: 'Marcador' })[0]).toHaveAttribute('href', '#marcador-inteligente');
    expect(screen.getAllByRole('link', { name: 'Para sedes' })[0]).toHaveAttribute('href', '#sedes');
    expect(screen.getAllByRole('link', { name: 'Descargar la app' })[0]).toHaveAttribute('href', '#descargar');
    expect(screen.getByRole('link', { name: 'Conocer la plataforma' })).toHaveAttribute('href', '#que-es');
    expect(screen.getAllByRole('link', { name: 'Quiero jugar' })[0]).toHaveAttribute('href', '/hub');
    expect(screen.getAllByRole('link', { name: 'Quiero incorporar Padbol Match' })[0])
      .toHaveAttribute('href', '/contacto');
    expect(screen.getAllByRole('link', { name: 'Ingresar' })[0]).toHaveAttribute('href', '/acceso');
    expect(screen.getByRole('heading', { name: 'Quiénes somos' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Descargar la app' })).toBeTruthy();
    expect(screen.getByText('App Store').closest('a')).toBeNull();
    expect(screen.getByText('Google Play').closest('a')).toBeNull();
    expect(screen.getAllByText('Aún no disponible en tiendas').length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).not.toMatch(/próximamente/i);
  });

  it('explica comunidad, partidos abiertos y marcador inteligente', () => {
    const { container } = renderPage();
    expect(container.querySelector('#comunidad-partidos')).toBeTruthy();
    expect(container.querySelector('#marcador-inteligente')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Jugar empieza antes/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Marcador inteligente/i })).toBeTruthy();
    expect(container.textContent).toMatch(/crear partidos/i);
    expect(container.textContent).toMatch(/encuentros abiertos/i);
    expect(container.textContent).toMatch(/Completar equipos/i);
    expect(container.textContent).toMatch(/mientras se juega/i);
    expect(container.textContent).toMatch(/sets y parciales/i);
    expect(container.textContent).toMatch(/Corregir una acción/i);
    expect(container.textContent).toMatch(/Cerrar el resultado/i);
    expect(container.textContent).toMatch(/historial, estadísticas, ranking y torneos/i);
    expect(container.querySelector('.ps-sb')).toBeTruthy();
    expect(container.querySelector('.ps-match')).toBeTruthy();
    expect(container.textContent).toMatch(/Crear un partido/i);
    expect(container.textContent).toMatch(/Partidos abiertos/i);
    expect(container.textContent).toMatch(/ocupación real/i);
  });

  it('muestra las cinco experiencias y diferencia expansión futura', () => {
    renderPage();
    ['Signature', 'Stadium', 'Express', 'Arena', 'Quantum'].forEach((name) => {
      expect(screen.getByRole('tab', { name: new RegExp(name, 'i') })).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: /ecosistema sigue creciendo/i })).toBeTruthy();
    expect(screen.getByText('Sponsor')).toBeTruthy();
    expect(screen.getByText('Publicidad')).toBeTruthy();
    expect(screen.getByText('E-shop')).toBeTruthy();
  });

  it('no deja claves i18n visibles ni secciones eliminadas', () => {
    const { container } = renderPage();
    expect(container.textContent).not.toMatch(/publicSite\./);
    ['#problema', '#ecosistema', '#comunidad', '#marcador', '#torneos', '#fidelizacion'].forEach((sel) => {
      expect(container.querySelector(sel)).toBeNull();
    });
    expect(container.querySelector('#comunidad-partidos')).toBeTruthy();
    expect(container.querySelector('#marcador-inteligente')).toBeTruthy();
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
    expect(document.title).toBe('Padbol Match — Plataforma');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      expect.stringMatching(/jugadores y sedes/i),
    );
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#0a0c12');
    expect(document.documentElement.classList.contains('public-site-active')).toBe(true);
    unmount();
    expect(document.title).toBe('Título anterior');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'Descripción anterior',
    );
    expect(document.documentElement.classList.contains('public-site-active')).toBe(false);
  });

  it('respeta reduced motion en el hero video', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    const playSpy = window.HTMLMediaElement.prototype.play;
    const pauseSpy = window.HTMLMediaElement.prototype.pause;
    playSpy.mockClear();
    pauseSpy.mockClear();
    renderPage();
    expect(playSpy).not.toHaveBeenCalled();
    expect(pauseSpy).toHaveBeenCalled();
  });
});
