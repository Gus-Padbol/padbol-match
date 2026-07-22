/**
 * Regresión del globo tecnológico del Hero (/plataforma).
 * Verifica logo grande, continentes, red, labels activos/futuros,
 * 4 deportes, accesibilidad y ausencia de llamadas externas.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import HeroSection from './sections/HeroSection';
import { DEPORTES_CANCHA_SEDE_KEYS } from '../../constants/deportesCanchaSede';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
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

jest.mock('../../components/PadbolBrandLogo', () => function Logo({ alt, className }) {
  return <img alt={alt} className={className} data-testid="hero-brand-logo" />;
});

jest.mock('../../components/common/SportIcon', () => function SportIconMock({ deporte }) {
  return <span data-testid={`sport-icon-${deporte}`} />;
});

const CONTINENTS = [
  'north-america',
  'south-america',
  'europe',
  'africa',
  'asia',
  'oceania',
];

const FUNCTIONAL = [
  'Jugador',
  'Sede',
  'Marcador',
  'Ranking',
  'PadCoins',
  'Comunidad',
  'Torneos',
  'Reservas',
  'Membresías',
];
const FUTURE = ['Sponsor', 'Publicidad', 'E-shop'];
const SPORTS = ['Padbol', 'Pádel', 'Pickleball', 'Tenis'];
const UNSUPPORTED = ['Fútbol', 'Golf', 'Hockey', 'Rugby', 'Squash'];

describe('Hero globe tecnológico', () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    global.fetch = jest.fn();
  });

  function renderHero() {
    return render(<HeroSection />);
  }

  it('muestra logo grande en Hero y no duplica marca textual Padbol Match', () => {
    const { container } = renderHero();
    expect(screen.getByTestId('hero-brand-logo')).toBeInTheDocument();
    expect(container.querySelector('.public-site-hero__logo')).toBeTruthy();
    expect(container.querySelector('.public-site-hero__brand')).toBeNull();
    /* El claim no debe ir precedido por un nodo de marca textual. */
    const copy = container.querySelector('.public-site-hero__copy');
    const children = Array.from(copy.children).map((el) => el.className);
    expect(children[0]).toMatch(/public-site-hero__logo/);
    expect(children[1]).toMatch(/public-site-hero__title/);
  });

  it('expone los seis continentes como siluetas SVG', () => {
    const { container } = renderHero();
    CONTINENTS.forEach((id) => {
      expect(container.querySelectorAll(`[data-continent="${id}"]`).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('muestra labels funcionales y capacidades futuras con indicación', () => {
    const { container } = renderHero();
    FUNCTIONAL.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    FUTURE.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    const futureNodes = container.querySelectorAll('.public-site-hero__eco-node.is-future');
    expect(futureNodes.length).toBe(3);
    expect(container.querySelectorAll('.public-site-hero__eco-soon').length).toBe(3);
    expect(screen.getAllByText('Próximamente').length).toBeGreaterThanOrEqual(3);
  });

  it('incluye exactamente los cuatro deportes soportados', () => {
    const { container } = renderHero();
    const sportNodes = container.querySelectorAll('.public-site-hero__eco-node.is-sport');
    expect(sportNodes).toHaveLength(4);
    SPORTS.forEach((label) => {
      expect(
        Array.from(sportNodes).some((node) => node.textContent.includes(label)),
      ).toBe(true);
    });
    expect(DEPORTES_CANCHA_SEDE_KEYS).toEqual(['padbol', 'padel', 'pickleball', 'tenis']);
    DEPORTES_CANCHA_SEDE_KEYS.forEach((key) => {
      expect(screen.getByTestId(`sport-icon-${key}`)).toBeInTheDocument();
    });
    UNSUPPORTED.forEach((label) => {
      expect(screen.queryByText(label)).toBeNull();
    });
  });

  it('conserva núcleo Partido y aria-label con capacidades futuras', () => {
    const { container } = renderHero();
    expect(screen.getByText('Partido')).toBeInTheDocument();
    expect(screen.getByText('el centro de todo')).toBeInTheDocument();
    const globe = container.querySelector('.public-site-hero__ecosystem');
    expect(globe).toHaveAttribute('role', 'img');
    const aria = globe.getAttribute('aria-label');
    expect(aria).toMatch(/Sponsor/i);
    expect(aria).toMatch(/Publicidad/i);
    expect(aria).toMatch(/E-shop/i);
    expect(aria).toMatch(/futuras/i);
    expect(aria).toMatch(/Padbol, Pádel, Pickleball y Tenis/i);
    expect(container.querySelector('svg.public-site-hero__globe')).toHaveAttribute('aria-hidden', 'true');
  });

  it('tiene red densa (35–50) con líneas base permanentes y pulsos (sin fetch)', () => {
    const { container } = renderHero();
    const bases = container.querySelectorAll('.public-site-hero__globe-arcs .is-base');
    const pulses = container.querySelectorAll('.public-site-hero__globe-arcs .is-pulse');
    /* Dos paneles → N arcos × 2; N entre 35 y 50 */
    expect(bases.length).toBeGreaterThanOrEqual(70);
    expect(bases.length).toBeLessThanOrEqual(100);
    expect(pulses.length).toBe(bases.length);
    expect(container.querySelector('.public-site-hero__globe-spin')).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('respeta prefers-reduced-motion vía CSS (líneas base visibles, sin movimiento)', () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, 'publicSite.css'), 'utf8');
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/animation:\s*none\s*!important/);
    expect(css).toMatch(/ps-globe-rotate/);
    expect(css).toMatch(/\.public-site-hero__globe-arcs \.is-base[\s\S]*?opacity:\s*1/);
    expect(css).toMatch(/\.is-pulse[\s\S]*?opacity:\s*0/);
  });
});
