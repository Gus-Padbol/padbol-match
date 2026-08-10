import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ExperiencesSection from './ExperiencesSection';
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
    /* Cada experiencia apunta a su video real servido como asset estático */
    PUBLIC_SITE_EXPERIENCE_LIST.forEach((exp) => {
      expect(exp.media).toEqual(expect.objectContaining({
        video: `/media/experiences/${exp.id}.mp4`,
        poster: `/media/experiences/posters/${exp.id}.jpg`,
      }));
    });
  });

  it('los cinco archivos de video existen en public/media/experiences', () => {
    const fs = require('fs');
    const path = require('path');
    PUBLIC_SITE_EXPERIENCE_LIST.forEach((exp) => {
      const abs = path.join(__dirname, '../../../../public', exp.media.video);
      expect({ id: exp.id, exists: fs.existsSync(abs) }).toEqual({ id: exp.id, exists: true });
    });
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

  it('mantiene la selección manual, sin avance automático', () => {
    render(<ExperiencesSection />);
    expect(screen.getByRole('tab', { name: /Signature/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /Quantum/i }));
    expect(screen.getByRole('tab', { name: /Quantum/i })).toHaveAttribute('aria-selected', 'true');
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

describe('video real por experiencia', () => {
  let playSpy;

  beforeEach(() => {
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    playSpy = jest
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    playSpy.mockRestore();
  });

  const getVideo = (container) => container.querySelector('video.ps-exp-phone__video');

  it('la experiencia activa usa su video con atributos seguros (sin controles)', () => {
    const { container } = render(<ExperiencesSection />);
    const video = getVideo(container);
    expect(video).toBeTruthy();
    expect(video.querySelector('source')).toHaveAttribute('src', '/media/experiences/signature.mp4');
    expect(video).toHaveAttribute('playsinline');
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('loop');
    expect(video.getAttribute('preload')).toBe('auto');
    expect(video).toHaveAttribute('poster', '/media/experiences/posters/signature.jpg');
    expect(video).not.toHaveAttribute('controls');
  });

  it('cambiar de experiencia reemplaza la vista previa y su fuente', () => {
    const { container } = render(<ExperiencesSection />);
    fireEvent.click(screen.getByRole('tab', { name: /Quantum/i }));
    const video = getVideo(container);
    expect(video.querySelector('source')).toHaveAttribute('src', '/media/experiences/quantum.mp4');
    expect(video).toHaveAttribute('poster', '/media/experiences/posters/quantum.jpg');
  });

  it('mantiene la maqueta detrás del video sin conexiones al backend', () => {
    const { container } = render(<ExperiencesSection />);
    expect(getVideo(container)).toBeTruthy();
    expect(screen.getByText('Reserva')).toBeInTheDocument();
    expect(screen.getAllByText('Demostración').length).toBeGreaterThan(0);
  });

  it('el video no dispara llamadas al Backend (fetch intacto)', () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() => {
      throw new Error('la sección no debe llamar APIs');
    });
    try {
      const { container } = render(<ExperiencesSection />);
      fireEvent.click(screen.getByRole('tab', { name: /Arena/i }));
      expect(getVideo(container).querySelector('source')).toHaveAttribute('src', '/media/experiences/arena.mp4');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('deportes habilitados en el producto', () => {
  it('mantiene únicamente los deportes habilitados en el producto', () => {
    expect(DEPORTES_CANCHA_SEDE_OPTIONS.map(({ key }) => key)).toEqual([
      'padbol',
      'padel',
      'pickleball',
      'tenis',
    ]);
  });
});
