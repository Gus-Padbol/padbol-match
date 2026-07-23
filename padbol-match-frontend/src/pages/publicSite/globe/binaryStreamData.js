/**
 * Secuencias binarias deterministas (0/1) — corriente vertical cyan del Hero.
 * No implica datos operativos.
 */

export function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildBinarySequence(seed, length = 64) {
  const rand = mulberry32(seed);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += rand() > 0.5 ? '1' : '0';
  }
  return out;
}

export function isBinaryOnly(text) {
  return typeof text === 'string' && text.length > 0 && /^[01]+$/.test(text);
}

/** Tipografía / contrato del grupo vertical cyan (sin rojo). */
export const BINARY_STREAM_TYPOGRAPHY = {
  letterSpacing: {
    desktop: '0.08em',
    tablet: '0.07em',
    mobile: '0.06em',
  },
  fontPx: {
    desktop: [16, 17, 15, 18],
    tablet: [14, 15, 13, 14],
    mobile: [11, 12, 11],
  },
  lineGapPx: {
    desktop: 6,
    tablet: 5,
    mobile: 4,
  },
  orientation: 'vertical',
  rotateDeg: 0,
  position: 'left',
  motionAxis: 'y',
  palette: {
    primary: '#58D9F8',
    secondary: '#8BE7FF',
    soft: 'rgba(120, 210, 235, 0.28)',
    highlight: '#D7F7FF',
  },
  forbiddenColors: ['red', '#e11b22', '#E11B22', 'padbol-red'],
};

/**
 * Exactamente 4 líneas desktop — grupo compacto a la izquierda, caída vertical.
 * rotateDeg: 0°; duraciones lentas; opacidades de fondo (≤0.22).
 */
export const BINARY_STREAM_BANDS_DESKTOP = [
  {
    id: 'bin-v1',
    seed: 11027,
    length: 160,
    durationSec: 33,
    delaySec: 0,
    rotateDeg: 0,
    depth: 'line-1',
    fontPx: 16,
    opacity: 0.12,
    colorTone: 'soft',
  },
  {
    id: 'bin-v2',
    seed: 22053,
    length: 172,
    durationSec: 42,
    delaySec: -3.5,
    rotateDeg: 0,
    depth: 'line-2',
    fontPx: 17,
    opacity: 0.17,
    colorTone: 'primary',
  },
  {
    id: 'bin-v3',
    seed: 33079,
    length: 148,
    durationSec: 48,
    delaySec: -7,
    rotateDeg: 0,
    depth: 'line-3',
    fontPx: 15,
    opacity: 0.1,
    colorTone: 'soft',
  },
  {
    id: 'bin-v4',
    seed: 44101,
    length: 164,
    durationSec: 38,
    delaySec: -1.5,
    rotateDeg: 0,
    depth: 'line-4',
    fontPx: 18,
    opacity: 0.14,
    colorTone: 'secondary',
  },
];

/** Sin fragmentos front sueltos — un solo grupo. */
export const BINARY_STREAM_FRONT_FRAGMENTS = [];

/** Acentos hielo/cyan claros (~6–8%), nunca rojo. */
export function decorateBinaryAccents(text, seed) {
  const rand = mulberry32(seed + 97);
  const n = text.length;
  const out = [];
  let i = 0;
  let iceChars = 0;
  while (i < n) {
    const gap = 24 + Math.floor(rand() * 13);
    const endBase = Math.min(n, i + gap);
    if (endBase > i) {
      out.push({ type: 'base', text: text.slice(i, endBase) });
      i = endBase;
    }
    if (i >= n) break;
    const run = Math.min(n - i, 2 + (rand() > 0.65 ? 1 : 0));
    out.push({ type: 'ice', text: text.slice(i, i + run) });
    iceChars += run;
    i += run;
  }
  if (iceChars === 0 && n >= 12) {
    const start = Math.min(n - 2, 6 + Math.floor(rand() * 6));
    return [
      { type: 'base', text: text.slice(0, start) },
      { type: 'ice', text: text.slice(start, start + 2) },
      { type: 'base', text: text.slice(start + 2) },
    ].filter((s) => s.text.length > 0);
  }
  return out;
}

export function selectBinaryBands({ compact = false, tablet = false, reducedMotion = false } = {}) {
  const scaleFonts = (list, fonts) =>
    list.map((b, idx) => ({
      ...b,
      fontPx: fonts[idx] ?? fonts[fonts.length - 1] ?? b.fontPx,
    }));

  if (compact) {
    const fonts = BINARY_STREAM_TYPOGRAPHY.fontPx.mobile;
    return scaleFonts(
      BINARY_STREAM_BANDS_DESKTOP.slice(0, 3).map((b, idx) => ({
        ...b,
        opacity: Math.min(0.12, b.opacity * 0.85),
        durationSec: b.durationSec + 10,
        length: Math.max(100, b.length - 24),
        rotateDeg: 0,
        delaySec: b.delaySec,
        id: `${b.id}-m`,
        depth: `line-${idx + 1}`,
      })),
      fonts,
    );
  }
  if (tablet) {
    const fonts = BINARY_STREAM_TYPOGRAPHY.fontPx.tablet;
    return scaleFonts(
      BINARY_STREAM_BANDS_DESKTOP.slice(0, 4).map((b, idx) => ({
        ...b,
        opacity: Math.min(0.18, b.opacity * 0.9),
        length: Math.max(120, b.length - 12),
        durationSec: b.durationSec + 6,
        depth: `line-${idx + 1}`,
      })),
      fonts,
    );
  }
  /* reduced motion: mismas 4 líneas, estáticas vía CSS/animación pausada */
  void reducedMotion;
  return BINARY_STREAM_BANDS_DESKTOP;
}

export function selectFrontFragments() {
  return [];
}
