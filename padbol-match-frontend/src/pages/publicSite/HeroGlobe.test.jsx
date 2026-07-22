/**
 * Regresión del globo tecnológico del Hero (/plataforma).
 * Verifica continentes, red densa permanente, labels, 4 deportes,
 * marca textual, accesibilidad y ausencia de dependencias/llamadas externas.
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

  it('muestra marca textual Padbol Match sin logo imagen duplicado', () => {
    const { container } = renderHero();
    expect(container.querySelector('.public-site-hero__brand')).toBeTruthy();
    expect(container.querySelector('.public-site-hero__brand-padbol')).toHaveTextContent('Padbol');
    expect(container.querySelector('.public-site-hero__brand-match')).toHaveTextContent('Match');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.public-site-hero__logo')).toBeNull();
  });

  it('expone los seis continentes como siluetas SVG', () => {
    const { container } = renderHero();
    CONTINENTS.forEach((id) => {
      expect(container.querySelectorAll(`[data-continent="${id}"]`).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('muestra labels funcionales fuera del globo incluyendo Comunidad', () => {
    renderHero();
    FUNCTIONAL.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
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

  it('conserva núcleo Partido y estructura accesible', () => {
    const { container } = renderHero();
    expect(screen.getByText('Partido')).toBeInTheDocument();
    expect(screen.getByText('el centro de todo')).toBeInTheDocument();
    const globe = container.querySelector('.public-site-hero__ecosystem');
    expect(globe).toHaveAttribute('role', 'img');
    expect(globe.getAttribute('aria-label')).toMatch(/Comunidad/i);
    expect(globe.getAttribute('aria-label')).toMatch(/Padbol, Pádel, Pickleball y Tenis/i);
    expect(container.querySelector('svg.public-site-hero__globe')).toHaveAttribute('aria-hidden', 'true');
  });

  it('tiene red densa (≥30) con líneas base permanentes y pulsos (sin fetch)', () => {
    const { container } = renderHero();
    const bases = container.querySelectorAll('.public-site-hero__globe-arcs .is-base');
    const pulses = container.querySelectorAll('.public-site-hero__globe-arcs .is-pulse');
    /* Dos paneles del mapa → N arcos × 2; N entre 30 y 45 */
    expect(bases.length).toBeGreaterThanOrEqual(60);
    expect(bases.length).toBeLessThanOrEqual(90);
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
