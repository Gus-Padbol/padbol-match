import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ExperiencesSection from './ExperiencesSection';
import SportsStrip from './SportsStrip';
import {
  PUBLIC_SITE_EXPERIENCE_IDS,
  PUBLIC_SITE_EXPERIENCE_LIST,
  PUBLIC_SITE_EXPERIENCES,
} from '../../../constants/publicSiteExperiences';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../../../constants/deportesCanchaSede';

/* El fileTransform de SVG de react-scripts no es compatible con React 19 en Jest. */
jest.mock('../../../components/common/SportIcon', () => function SportIconMock({ deporte }) {
  return <span data-testid={`sport-icon-${deporte}`} />;
});

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
  const fallbacks = flatten(locale);
  return {
    ES_FALLBACKS: fallbacks,
    useSafeTranslation: () => ({
      t: (key, fallback) => fallback || fallbacks[key] || key,
    }),
  };
});

describe('cinco experiencias (sección inmersiva)', () => {
  let reducedMotion = false;

  beforeEach(() => {
    reducedMotion = false;
    window.matchMedia = jest.fn().mockImplementation(() => ({ matches: reducedMotion }));
  });

  it('define las cinco experiencias con identidad real de la nativa', () => {
    expect(PUBLIC_SITE_EXPERIENCE_IDS).toEqual([
      'signature',
      'stadium',
      'express',
      'arena',
      'quantum',
    ]);
    expect(PUBLIC_SITE_EXPERIENCES.stadium.accent).toBe('#39ff8e');
    expect(PUBLIC_SITE_EXPERIENCES.quantum.accent).toBe('#00c8ff');
    expect(PUBLIC_SITE_EXPERIENCES.arena.accent).toBe('#9a7a5a');
    expect(PUBLIC_SITE_EXPERIENCES.express.accent).toBe('#ffd93d');
    expect(PUBLIC_SITE_EXPERIENCES.signature.accent).toBe('#e8150a');
    /* Arquitectura preparada para captura/video real sin rehacer la sección */
    PUBLIC_SITE_EXPERIENCE_LIST.forEach((exp) => expect(exp).toHaveProperty('media', null));
  });

  it('renderiza selector con roles de tab y Signature activa por defecto', () => {
    render(<ExperiencesSection />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('cambia de experiencia al tocar una pestaña', () => {
    render(<ExperiencesSection />);
    fireEvent.click(screen.getByRole('tab', { name: /Quantum/i }));
    expect(screen.getByRole('tab', { name: /Quantum/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'ps-exp-tab-quantum');
  });

  it('navega con anterior/siguiente en forma circular', () => {
    render(<ExperiencesSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Experiencia anterior' }));
    expect(screen.getByRole('tab', { name: /Quantum/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Experiencia siguiente' }));
    expect(screen.getByRole('tab', { name: /Signature/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('navega con flechas del teclado dentro del tablist', () => {
    render(<ExperiencesSection />);
    const first = screen.getByRole('tab', { name: /Signature/i });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Stadium/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('autoplay avanza lento y se detiene con interacción', () => {
    jest.useFakeTimers();
    try {
      render(<ExperiencesSection />);
      act(() => {
        jest.advanceTimersByTime(7100);
      });
      expect(screen.getByRole('tab', { name: /Stadium/i })).toHaveAttribute('aria-selected', 'true');
      fireEvent.pointerDown(screen.getByRole('tabpanel'));
      act(() => {
        jest.advanceTimersByTime(15000);
      });
      expect(screen.getByRole('tab', { name: /Stadium/i })).toHaveAttribute('aria-selected', 'true');
    } finally {
      jest.useRealTimers();
    }
  });

  it('desactiva el autoplay con prefers-reduced-motion', () => {
    reducedMotion = true;
    jest.useFakeTimers();
    try {
      render(<ExperiencesSection />);
      act(() => {
        jest.advanceTimersByTime(30000);
      });
      expect(screen.getByRole('tab', { name: /Signature/i })).toHaveAttribute('aria-selected', 'true');
    } finally {
      jest.useRealTimers();
    }
  });

  it('la preview es demostración sin conexiones (fetch no se invoca)', () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() => {
      throw new Error('la preview no debe llamar APIs');
    });
    try {
      render(<ExperiencesSection />);
      expect(screen.getAllByText('Demostración').length).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('franja multideporte', () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  });

  it('muestra únicamente los deportes habilitados en el producto', () => {
    render(<SportsStrip />);
    expect(DEPORTES_CANCHA_SEDE_OPTIONS.map(({ key }) => key)).toEqual([
      'padbol',
      'padel',
      'pickleball',
      'tenis',
    ]);
    DEPORTES_CANCHA_SEDE_OPTIONS.forEach(({ label }) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(DEPORTES_CANCHA_SEDE_OPTIONS.length);
  });
});
