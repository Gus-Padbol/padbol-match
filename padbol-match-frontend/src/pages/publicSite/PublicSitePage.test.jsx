import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PublicSitePage from './PublicSitePage';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/plataforma' }),
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

jest.mock('../../components/PadbolBrandLogo', () => function Logo({ alt, className }) {
  return <img alt={alt} className={className} />;
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
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      clip: jest.fn(),
      fillRect: jest.fn(),
      createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
    }));
    global.IntersectionObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
    global.ResizeObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderPage() {
    return render(<PublicSitePage />);
  }

  it('no muestra binarios decorativos en el recorrido público', () => {
    const { container } = renderPage();
    expect(container.querySelector('[data-binary-zone="true"]')).toBeNull();
    expect(container.querySelectorAll('[data-binary-stream="true"]')).toHaveLength(0);
  });

  it('renderiza la estructura nueva, un h1 y ninguna BottomNav', () => {
    const { container } = renderPage();
    [
      'que-es', 'experiencias', 'jugadores', 'tu-recorrido',
      'marcador-inteligente', 'continuidad', 'sedes', 'administra-tu-sede',
      'arbitro-virtual', 'nosotros', 'descargar', 'contacto',
    ].forEach((id) => expect(container.querySelector(`#${id}`)).toBeTruthy());
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('.bottom-nav')).toBeNull();
    expect(container.querySelector('.ps-hero__video')).toBeNull();
    expect(container.querySelector('.ps-globe')).toBeTruthy();
    expect(container.querySelector('canvas.ps-globe__canvas')).toBeTruthy();
  });

  it('evita repetir Padbol Match junto al isólogo de la sección Qué es', () => {
    const { container } = renderPage();
    const brand = container.querySelector('.ps-what__brand');
    expect(brand?.querySelector('img')).toBeTruthy();
    expect(brand).not.toHaveTextContent('Padbol Match');
  });

  it('Hero prioriza la marca: logo → claim → subtítulo → CTAs → globo', () => {
    const { container } = renderPage();
    const hero = container.querySelector('.ps-hero');
    expect(hero).toBeTruthy();
    const logo = hero.querySelector('.ps-hero__logo');
    const claim = hero.querySelector('.ps-hero__claim');
    const lead = hero.querySelector('.ps-hero__lead');
    const ctas = hero.querySelector('.ps-hero__ctas');
    const globe = hero.querySelector('.ps-globe');
    expect(logo).toBeTruthy();
    expect(claim).toHaveTextContent('La aplicación deportiva que conecta todo.');
    expect(lead).toHaveTextContent(
      'Juego, operación y comunidad. Nace con Padbol y está lista para otros deportes de cancha.',
    );
    expect(hero.textContent).not.toMatch(/Cada partido construye una relación/i);
    expect(hero.textContent).not.toMatch(/Jugadores y sedes en una misma plataforma/i);
    /* No repetir el nombre de marca como texto suelto en el Hero (solo alt del logo). */
    const textNodes = Array.from(hero.querySelectorAll('h1, p, a, button')).map((el) => el.textContent.trim());
    expect(textNodes.some((t) => t === 'Padbol Match')).toBe(false);
    const positions = [logo, claim, lead, ctas, globe].map((el) => {
      let pos = 0;
      const walker = document.createTreeWalker(hero, NodeFilter.SHOW_ELEMENT);
      while (walker.nextNode()) {
        if (walker.currentNode === el) return pos;
        pos += 1;
      }
      return -1;
    });
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
    expect(positions[2]).toBeLessThan(positions[3]);
    expect(positions[3]).toBeLessThan(positions[4]);
    const ctaLinks = Array.from(ctas.querySelectorAll('a')).map((a) => a.textContent.trim());
    expect(ctaLinks).toEqual([
      'Descargar la appiOS + Android ↓',
    ]);
  });

  it('evita que el Hero desborde horizontalmente en pantallas móviles', () => {
    const css = require('fs').readFileSync(
      require('path').join(__dirname, 'publicSite.css'),
      'utf8',
    );
    expect(css).toMatch(/\.ps-hero__content\s*\{[\s\S]*?min-width:\s*0/);
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('mantiene el header intacto con logo pequeño e Ingresar', () => {
    const { container } = renderPage();
    expect(container.querySelector('.public-site__nav')).toBeTruthy();
    expect(container.querySelector('.public-site__brand-logo')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Ingresar' })[0]).toHaveAttribute('href', '/acceso');
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeTruthy();
  });

  it('expone navegación, CTAs prioritarios y stores no activos', () => {
    renderPage();
    expect(screen.getAllByRole('link', { name: 'Plataforma' })[0]).toHaveAttribute('href', '#que-es');
    expect(screen.getAllByRole('link', { name: 'Para jugadores' })[0]).toHaveAttribute('href', '#jugadores');
    expect(screen.getAllByRole('link', { name: 'Comunidad' })[0]).toHaveAttribute('href', '#comunidad-partidos');
    expect(screen.getAllByRole('link', { name: 'Marcador' })[0]).toHaveAttribute('href', '#marcador-inteligente');
    expect(screen.getAllByRole('link', { name: 'Para sedes' })[0]).toHaveAttribute('href', '#sedes');
    expect(screen.getAllByRole('link', { name: 'Descargar la app' })[0]).toHaveAttribute('href', '#descargar');
    expect(screen.queryByRole('link', { name: 'Conocer la plataforma' })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Quiero jugar/i })[0]).toHaveAttribute('href', '#descargar');
    expect(screen.getAllByRole('link', { name: 'Quiero incorporar Padbol Match' })[0])
      .toHaveAttribute('href', '/administradores');
    expect(screen.getAllByRole('link', { name: 'Ingresar' })[0]).toHaveAttribute('href', '/acceso');
    expect(document.querySelector('#nosotros')).toBeTruthy();
    expect(document.querySelector('#descargar')).toBeTruthy();
    expect(screen.getByText('App Store').closest('a')).toBeNull();
    expect(screen.getByText('Google Play').closest('a')).toBeNull();
    expect(screen.getAllByText('Aún no disponible en tiendas').length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).toMatch(/próximamente/i);
  });

  it('explica el recorrido reconocido y el marcador inteligente', () => {
    const { container } = renderPage();
    expect(container.querySelector('#tu-recorrido')).toBeTruthy();
    expect(container.querySelector('#marcador-inteligente')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Traé tu recorrido/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Marcador inteligente/i })).toBeTruthy();
    expect(container.textContent).toMatch(/mientras se juega/i);
    expect(container.textContent).toMatch(/sets y parciales/i);
    expect(container.textContent).toMatch(/Corregir una acción/i);
    expect(container.textContent).toMatch(/Cerrar el resultado/i);
    expect(container.textContent).toMatch(/historial, estadísticas, ranking y torneos/i);
    expect(container.querySelector('.ps-scoreboard__video')).toBeTruthy();
    expect(container.textContent).toMatch(/No tenés que dejar atrás tu camino/i);
  });

  it('muestra las cinco experiencias y diferencia expansión futura', () => {
    renderPage();
    ['Signature', 'Stadium', 'Express', 'Arena', 'Quantum'].forEach((name) => {
      expect(screen.getByRole('tab', { name: new RegExp(name, 'i') })).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: /Más oportunidades para tu sede/i })).toBeTruthy();
    expect(screen.getByText('Sponsors')).toBeTruthy();
    expect(screen.getByText('Publicidad')).toBeTruthy();
    expect(screen.getByText('E-shop')).toBeTruthy();
  });

  it('ordena el relato sin duplicar el bloque de expansión multideporte', () => {
    const { container } = renderPage();
    const sectionIds = [
      'que-es',
      'experiencias',
      'jugadores',
      'tu-recorrido',
      'marcador-inteligente',
      'continuidad',
      'sedes',
      'administra-tu-sede',
      'arbitro-virtual',
      'nosotros',
      'descargar',
      'contacto',
    ];
    const positions = sectionIds.map((id) => {
      const section = container.querySelector(`#${id}`);
      return Array.from(container.querySelectorAll('section')).indexOf(section);
    });

    positions.forEach((position) => expect(position).toBeGreaterThanOrEqual(0));
    positions.slice(1).forEach((position, index) => {
      expect(position).toBeGreaterThan(positions[index]);
    });
  });

  it('no deja claves i18n visibles ni secciones eliminadas', () => {
    const { container } = renderPage();
    expect(container.textContent).not.toMatch(/publicSite\./);
    ['#problema', '#ecosistema', '#comunidad', '#marcador', '#torneos', '#fidelizacion'].forEach((sel) => {
      expect(container.querySelector(sel)).toBeNull();
    });
    expect(container.querySelector('#tu-recorrido')).toBeTruthy();
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
      expect.stringMatching(/jugadores, sedes y organizaciones/i),
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

  it('mantiene el movimiento forzado del globo como decisión visual aprobada', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    const { container } = renderPage();
    expect(container.querySelector('.ps-globe')).toBeTruthy();
    expect(container.querySelector('.ps-hero__globe-wrap')).toHaveAttribute(
      'data-reduced-motion',
      'false',
    );
  });
});
