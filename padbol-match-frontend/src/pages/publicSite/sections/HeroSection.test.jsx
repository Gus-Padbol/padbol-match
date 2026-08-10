import React from 'react';
import { render, screen } from '@testing-library/react';
import HeroSection from './HeroSection';
import {
  GLOBE_CONTINENT_REGIONS,
  GLOBE_ROTATION_MS,
} from '../globe/globeNetworkData';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock('../../../i18n/tSafe', () => {
  const locale = require('../../../i18n/locales/es.json');
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

jest.mock('../../../components/PadbolBrandLogo', () => function Logo({ alt, className }) {
  return <img alt={alt} className={className} />;
});

describe('Hero con globo premium', () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
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

  it('mantiene logo, claim, una sola acción y globo sin video dominante', () => {
    const { container } = render(<HeroSection />);
    const hero = container.querySelector('.ps-hero');
    expect(hero.querySelector('.ps-hero__logo')).toBeTruthy();
    expect(hero.querySelector('.ps-hero__claim')).toHaveTextContent(
      'La aplicación deportiva que conecta todo.',
    );
    expect(hero.querySelector('.ps-hero__lead')).toHaveTextContent(
      'Juego, operación y comunidad. Nace con Padbol y está lista para otros deportes de cancha.',
    );
    const ctas = Array.from(hero.querySelectorAll('.ps-hero__ctas a')).map((a) => a.textContent);
    expect(ctas).toEqual([
      'Descargar la appiOS + Android ↓',
    ]);
    expect(hero.querySelector('.ps-hero__sports')).toBeNull();
    expect(hero.querySelector('.ps-hero__video')).toBeNull();
    expect(hero.querySelector('.ps-globe')).toBeTruthy();
    expect(hero.querySelector('canvas.ps-globe__canvas')).toBeTruthy();
  });

  it('expone aria-label, red tipo átomo, deportes y Marcador inteligente', () => {
    const { container } = render(<HeroSection />);
    const globe = container.querySelector('.ps-globe');
    expect(globe).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/Red global de Padbol Match/i),
    );
    expect(globe).toHaveAttribute('aria-label', expect.stringMatching(/deportes|Padbol|pádel|tenis/i));
    expect(globe.getAttribute('data-continents')).toBe(GLOBE_CONTINENT_REGIONS.join(','));
    expect(globe.getAttribute('data-rotation-ms')).toBe(String(GLOBE_ROTATION_MS));
    expect(globe.getAttribute('data-label-system')).toBe('atom-packets');
    expect(globe.getAttribute('data-lighting')).toBe('stable');
    expect(globe.getAttribute('data-atm-colors')).toMatch(/ice/);
    expect(Number(globe.getAttribute('data-atmospheric-routes'))).toBeGreaterThanOrEqual(6);
    expect(Number(globe.getAttribute('data-pacific-links'))).toBeGreaterThanOrEqual(12);
    expect(Number(globe.getAttribute('data-australia-nodes'))).toBeGreaterThanOrEqual(3);
    expect(Number(globe.getAttribute('data-nodes'))).toBeGreaterThanOrEqual(46);
    expect(Number(globe.getAttribute('data-links'))).toBeGreaterThanOrEqual(76);
    expect(container.querySelector('.ps-globe-label__dot')).toBeTruthy();
    expect(container.querySelector('[data-core="isologo"]')).toBeNull();
    expect(container.querySelector('[data-isologo="true"]')).toBeNull();
    expect(container.querySelector('[data-isologo-marker="true"]')).toBeNull();
    expect(container.querySelector('.ps-globe__core')).toBeNull();
    expect(container.querySelector('[data-isologo="false"]')).toBeTruthy();
    expect(container.querySelector('[data-sports-equal="true"]')).toBeTruthy();
    expect(Number(container.querySelector('[data-label-max]')?.getAttribute('data-label-max'))).toBe(8);
    expect(Number(container.querySelector('[data-label-min]')?.getAttribute('data-label-min'))).toBe(4);
    expect(container.querySelector('.ps-globe-label.is-emphasize')).toBeNull();
    expect(container.querySelector('.ps-hero__starfield')).toBeTruthy();
    expect(container.querySelector('[data-star-layers="3"]')).toBeTruthy();
    expect(container.querySelector('[data-binary-stream="true"]')).toBeNull();
    expect(container.querySelector('.ps-binary-zone')).toBeNull();
    expect(container.querySelector('.ps-hero__video')).toBeNull();
    expect(container.textContent).not.toMatch(/Multideporte/);
    expect(container.textContent).not.toMatch(/túnel espacial|nave espacial|galaxia/i);
    expect(container.textContent).not.toMatch(/publicSite\.hero\.globe/);
    expect(container.textContent).not.toMatch(/\bSponsor\b/);
    expect(container.textContent).not.toMatch(/\bPublicidad\b/);
    expect(container.textContent).not.toMatch(/\bE-shop\b/);
  });

  it('mantiene el movimiento forzado del globo, deportes iguales y punto rojo', () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    const { container } = render(<HeroSection />);
    expect(container.querySelector('.ps-globe')).toBeTruthy();
    expect(container.querySelector('.ps-hero__globe-wrap')).toHaveAttribute(
      'data-reduced-motion',
      'false',
    );
    expect(screen.getByText('Padbol')).toBeTruthy();
    expect(container.querySelector('.ps-globe-labels')).toHaveAttribute(
      'data-sports-equal',
      'true',
    );
    expect(container.querySelectorAll('.ps-globe-label__dot').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-core="isologo"]')).toBeNull();
    expect(container.querySelector('[data-starfield="true"]')).toHaveAttribute(
      'data-motion',
      'slow',
    );
    expect(container.querySelector('[data-binary-stream="true"]')).toBeNull();
  });

  it('ordena logo antes del claim y el globo después de los CTAs en el layout', () => {
    const heroSrc = require('fs').readFileSync(
      require('path').join(__dirname, 'HeroSection.jsx'),
      'utf8',
    );
    const logoIdx = heroSrc.indexOf('ps-hero__logo');
    const claimIdx = heroSrc.indexOf('ps-hero__claim');
    const ctasIdx = heroSrc.indexOf('ps-hero__ctas');
    const globeIdx = heroSrc.indexOf('ps-hero__globe-wrap');
    expect(logoIdx).toBeLessThan(claimIdx);
    expect(claimIdx).toBeLessThan(ctasIdx);
    expect(ctasIdx).toBeLessThan(globeIdx);
    expect(heroSrc).toMatch(/PremiumGlobalGlobe/);
    expect(heroSrc).not.toMatch(/ellipse|mancha|abstractContinent/i);
  });
});
