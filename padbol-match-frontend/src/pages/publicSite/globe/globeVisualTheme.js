/**
 * Paleta visual del globo Hero (solo estética).
 * Planeta digital cyan / petróleo — no define topología.
 */

/** Continentes oscuros azul petróleo. */
export const GLOBE_LAND_THEME = {
  base: '#183A50',
  lit: '#245A73',
  side: '#102A3B',
  limb: '#081A27',
  alpha: 0.8,
  alphaLit: 0.84,
  alphaSide: 0.6,
  alphaLimb: 0.38,
  fill: 'rgba(24, 58, 80, 0.8)',
  tone: 'dark-petroleum-cyan',
  politicalBorders: false,
};

/** Costas cyan brillantes (elemento visual prioritario). */
export const GLOBE_COAST_THEME = {
  stroke: '#24D8FF',
  strokeRgba: 'rgba(36, 216, 255, 1)',
  secondary: 'rgba(18, 120, 160, 0.55)',
  halo: 'rgba(36, 200, 255, 0.32)',
  double: 'rgba(80, 210, 245, 0.28)',
  width: { desktop: 1.45, tablet: 1.15, mobile: 0.95 },
  secondaryWidth: { desktop: 1.0, tablet: 0.8, mobile: 0.65 },
  haloWidth: { desktop: 4.0, tablet: 3.0, mobile: 2.0 },
  doubleWidth: { desktop: 0.85, tablet: 0.65, mobile: 0 },
  doubleContourRatio: 0.36,
  doubleMinZ: 0.4,
};

export const GLOBE_OCEAN_THEME = {
  stops: [
    { t: 0, color: '#0E2A40' },
    { t: 0.32, color: '#081A2C' },
    { t: 0.68, color: '#050F1A' },
    { t: 1, color: '#03080F' },
  ],
  frontGlow: 'rgba(40, 130, 170, 0.16)',
};

export const GLOBE_NODE_THEME = {
  core: '#F2F7FF',
  coreHot: '#FFFFFF',
  halo: 'rgba(140, 220, 255, 0.32)',
  rim: 'rgba(36, 200, 240, 0.55)',
  permanentColors: ['#F2F7FF'],
  forbiddenPermanent: ['#168a45', '#1f6b3a', '#e11b22', 'green', 'red'],
};

export const GLOBE_LINK_THEME = {
  ice: 'rgba(220, 245, 255, 1)',
  silver: 'rgba(160, 210, 235, 1)',
  cyan: 'rgba(70, 210, 255, 0.95)',
  red: 'rgba(225, 27, 34, 0.88)',
  understroke: 'rgba(4, 10, 18, 1)',
};

/**
 * Grosores delicados (px) — costas cyan deben dominar sobre la red.
 * Antes: local~1.3 / regional~1.4 / intl~1.15 / atmF~1.55 / atmB~1.25
 */
export const GLOBE_LINK_WIDTHS = {
  desktop: {
    local: 0.6,
    regional: 0.8,
    international: 0.98,
    understrokeExtra: 0.55,
    atmFrontPrimary: 1.15,
    atmFront: 0.95,
    atmBackPrimary: 0.7,
    atmBack: 0.55,
  },
  tablet: {
    local: 0.52,
    regional: 0.7,
    international: 0.86,
    understrokeExtra: 0.48,
    atmFrontPrimary: 1.0,
    atmFront: 0.85,
    atmBackPrimary: 0.62,
    atmBack: 0.48,
  },
  mobile: {
    local: 0.48,
    regional: 0.62,
    international: 0.78,
    understrokeExtra: 0.42,
    atmFrontPrimary: 0.92,
    atmFront: 0.78,
    atmBackPrimary: 0.55,
    atmBack: 0.45,
  },
};

/** Grilla tecnológica reforzada (cyan / azul frío). */
export const GLOBE_GRID_THEME = {
  base: 'rgba(70, 160, 195, 0.26)',
  baseWidth: 0.9,
  parallel: 'rgba(90, 190, 220, 0.38)',
  parallelWidth: 1.1,
  equator: 'rgba(120, 220, 245, 0.55)',
  equatorWidth: 1.45,
  meridian: 'rgba(100, 200, 235, 0.48)',
  meridianWidth: 1.25,
  highlightParallels: [-30, 30],
  /** Saltos para evitar cuadrícula completa */
  gapChance: 0.18,
  secondaryRings: [-45, 45, -60, 60],
};

export const GLOBE_LIMB_THEME = {
  rim: 'rgba(36, 216, 255, 0.28)',
  rimWidth: 1.5,
  glowInner: 'rgba(255,255,255,0)',
  glowOuter: 'rgba(36, 180, 230, 0.2)',
  glowWidth: 5.5,
};

export const GLOBE_PULSE_THEME = {
  red: 'rgba(225, 27, 34, 1)',
  glow: 'rgba(225, 27, 34, 0.3)',
};

/** Microtramas: grupos visibles por viewport (no fronteras). */
export const GLOBE_INLAND_THEME = {
  line: 'rgba(80, 200, 230, 0.28)',
  dot: 'rgba(120, 215, 245, 0.34)',
  ice: 'rgba(180, 230, 250, 0.22)',
  square: 'rgba(90, 195, 225, 0.26)',
  counts: {
    desktop: { groups: 32, details: 32, dots: 72 },
    tablet: { groups: 18, details: 18, dots: 40 },
    mobile: { groups: 9, details: 9, dots: 18 },
  },
  dotRadius: { desktop: 0.85, tablet: 0.7, mobile: 0.6 },
  nodeMinCore: 3.4,
  shimmerPeriodSec: 7.5,
};

/** Nube atmosférica + líneas de datos (no nodos funcionales). */
export const GLOBE_ATMOSPHERE_FX = {
  points: { desktop: 280, tablet: 240, mobile: 110 },
  dataLines: { desktop: 6, tablet: 6, mobile: 3 },
  orbitArcs: { desktop: 5, tablet: 4, mobile: 2 },
  sparkles: { desktop: 12, tablet: 10, mobile: 5 },
  shellMin: 1.04,
  shellMax: 1.28,
};

export const STARFIELD_THEME = {
  desktop: { far: 120, mid: 46, near: 16 },
  tablet: { far: 110, mid: 40, near: 14 },
  mobile: { far: 64, mid: 22, near: 8 },
  sizes: {
    far: [0.7, 1.15],
    mid: [1.15, 1.95],
    near: [1.9, 3.0],
  },
  tones: [
    { rgb: '210, 240, 255', weight: 0.35 },
    { rgb: '120, 210, 255', weight: 0.28 },
    { rgb: '180, 200, 230', weight: 0.22 },
    { rgb: '70, 180, 230', weight: 0.1 },
    { rgb: '255, 220, 230', weight: 0.05 },
  ],
  techLines: { desktop: 5, tablet: 3, mobile: 1 },
};
