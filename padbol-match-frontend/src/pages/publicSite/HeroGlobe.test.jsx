/**
 * Regresión del globo tecnológico del Hero (/plataforma).
 * Verifica continentes, red, labels funcionales, 4 deportes soportados,
 * accesibilidad y ausencia de dependencias/llamadas externas.
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

jest.mock('../../components/PadbolBrandLogo', () => function Logo({ alt }) {
  return <img alt={alt} />;
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

const FUNCTIONAL = ['Jugador', 'Sede', 'Marcador', 'Ranking', 'PadCoins'];
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

  it('expone los seis continentes como siluetas SVG', () => {
    const { container } = renderHero();
    CONTINENTS.forEach((id) => {
      expect(container.querySelectorAll(`[data-continent="${id}"]`).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('muestra los cinco labels funcionales fuera del globo', () => {
    renderHero();
    FUNCTIONAL.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('incluye exactamente los cuatro deportes soportados', () => {
    renderHero();
    SPORTS.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(DEPORTES_CANCHA_SEDE_KEYS).toEqual(['padbol', 'padel', 'pickleball', 'tenis']);
    DEPORTES_CANCHA_SEDE_KEYS.forEach((key) => {
      expect(screen.getByTestId(`sport-icon-${key}`)).toBeInTheDocument();
    });
    UNSUPPORTED.forEach((label) => {
      expect(screen.queryByText(label)).toBeNull();
    });
  });

  it('conserva núcleo Partido y estructura accesible', () => {
    const { container } = renderHero();
    expect(screen.getByText('Partido')).toBeInTheDocument();
    expect(screen.getByText('el centro de todo')).toBeInTheDocument();
    const globe = container.querySelector('.public-site-hero__ecosystem');
    expect(globe).toHaveAttribute('role', 'img');
    expect(globe.getAttribute('aria-label')).toMatch(/Padbol, Pádel, Pickleball y Tenis/i);
    expect(container.querySelector('svg.public-site-hero__globe')).toHaveAttribute('aria-hidden', 'true');
  });

  it('tiene red de conexiones con pulsos y rotación CSS (sin fetch)', () => {
    const { container } = renderHero();
    const bases = container.querySelectorAll('.public-site-hero__globe-arcs .is-base');
    const pulses = container.querySelectorAll('.public-site-hero__globe-arcs .is-pulse');
    /* Dos paneles del mapa → 24 arcos × 2 */
    expect(bases.length).toBe(48);
    expect(pulses.length).toBe(48);
    expect(container.querySelector('.public-site-hero__globe-spin')).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('respeta prefers-reduced-motion vía CSS global de la web pública', () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, 'publicSite.css'), 'utf8');
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/animation:\s*none\s*!important/);
    expect(css).toMatch(/ps-globe-rotate/);
  });
});
