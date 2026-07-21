/**
 * Identidad visual real de las cinco experiencias de Padbol Match.
 * Valores tomados de la app nativa (`src/lib/experiences.js` y
 * `src/lib/experiencePalettes.js`): solo tokens de marca, sin lógica
 * ni imports del producto. `media` queda preparado para incorporar
 * capturas o video reales sin rehacer la sección.
 */

export const PUBLIC_SITE_EXPERIENCE_IDS = [
  'signature',
  'stadium',
  'express',
  'arena',
  'quantum',
];

export const PUBLIC_SITE_EXPERIENCES = {
  signature: {
    id: 'signature',
    name: 'Signature',
    accent: '#e8150a',
    background: '#0d0d0d',
    card: '#17181c',
    textPrimary: '#ffffff',
    textSecondary: '#a9adb5',
    border: 'rgba(255, 255, 255, 0.12)',
    scheme: 'dark',
    media: null,
  },
  stadium: {
    id: 'stadium',
    name: 'Stadium',
    accent: '#39ff8e',
    background: '#0a0a0a',
    card: '#111111',
    textPrimary: '#ffffff',
    textSecondary: '#888888',
    border: '#222222',
    scheme: 'dark',
    media: null,
  },
  express: {
    id: 'express',
    name: 'Express',
    accent: '#ffd93d',
    background: '#f5f5f5',
    card: '#ffffff',
    textPrimary: '#141414',
    textSecondary: '#6b7076',
    border: 'rgba(20, 20, 20, 0.12)',
    scheme: 'light',
    media: null,
  },
  arena: {
    id: 'arena',
    name: 'Arena',
    accent: '#9a7a5a',
    background: '#f0ede8',
    card: '#ddd7cf',
    textPrimary: '#1a1a1a',
    textSecondary: '#9a9590',
    border: '#c4bdb5',
    scheme: 'light',
    media: null,
  },
  quantum: {
    id: 'quantum',
    name: 'Quantum',
    accent: '#00c8ff',
    background: '#040810',
    card: '#0a1420',
    textPrimary: '#eaf8ff',
    textSecondary: 'rgba(140, 200, 230, 0.6)',
    border: 'rgba(0, 200, 255, 0.2)',
    scheme: 'dark',
    media: null,
  },
};

export const PUBLIC_SITE_EXPERIENCE_LIST = PUBLIC_SITE_EXPERIENCE_IDS.map(
  (id) => PUBLIC_SITE_EXPERIENCES[id],
);
