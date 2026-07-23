/**
 * Catálogo centralizado de etiquetas del globo Hero.
 * Única fuente de verdad — no dispersar textos por varios archivos de lógica.
 */

export const GLOBE_LABEL_CATEGORIES = {
  sports: ['padbol', 'padel', 'pickleball', 'tennis'],
  community: ['community', 'players', 'teams', 'invitations', 'profiles', 'history'],
  competition: [
    'matches',
    'tournaments',
    'competitions',
    'standings',
    'liveResults',
    'stats',
    'ranking',
    'scoreboard',
    'referees',
  ],
  management: [
    'venues',
    'courts',
    'clubs',
    'bookings',
    'calendar',
    'registrations',
    'organizations',
    'associations',
    'federations',
    'academies',
    'coaches',
  ],
  experience: [
    'padcoins',
    'memberships',
    'loyalty',
    'benefits',
    'awards',
    'events',
    'notifications',
    'experiences',
  ],
};

/** Los cuatro deportes — misma jerarquía, sin emphasize. */
export const GLOBE_SPORT_LABELS = [...GLOBE_LABEL_CATEGORIES.sports];

/** Preferidas para rutas que cruzan el centro. */
export const GLOBE_CENTER_ROUTE_LABELS = [
  'community',
  'players',
  'matches',
  'tournaments',
  'associations',
  'federations',
  'ranking',
  'scoreboard',
];

/** Prioridad móvil (ciclos posteriores rotan el resto). */
export const GLOBE_MOBILE_PRIORITY_LABELS = [
  'padbol',
  'padel',
  'pickleball',
  'tennis',
  'community',
  'players',
  'matches',
  'tournaments',
  'venues',
  'ranking',
];

/** Textos largos: tipografía levemente menor, sin mayor jerarquía. */
export const GLOBE_LONG_LABEL_KEYS = ['scoreboard', 'liveResults'];

/**
 * Meta por clave. Sin emphasize — igualdad visual entre deportes.
 * category: sports | community | competition | management | experience
 */
export const GLOBE_LABEL_CATALOG = {
  padbol: { category: 'sports', sport: true, mode: 'surface' },
  padel: { category: 'sports', sport: true, mode: 'surface' },
  pickleball: { category: 'sports', sport: true, mode: 'surface' },
  tennis: { category: 'sports', sport: true, mode: 'surface' },

  community: { category: 'community', sport: false, mode: 'surface' },
  players: { category: 'community', sport: false, mode: 'surface' },
  teams: { category: 'community', sport: false, mode: 'surface' },
  invitations: { category: 'community', sport: false, mode: 'surface' },
  profiles: { category: 'community', sport: false, mode: 'surface' },
  history: { category: 'community', sport: false, mode: 'surface' },

  matches: { category: 'competition', sport: false, mode: 'surface' },
  tournaments: { category: 'competition', sport: false, mode: 'atmospheric' },
  competitions: { category: 'competition', sport: false, mode: 'atmospheric' },
  standings: { category: 'competition', sport: false, mode: 'atmospheric' },
  liveResults: { category: 'competition', sport: false, mode: 'atmospheric' },
  stats: { category: 'competition', sport: false, mode: 'atmospheric' },
  ranking: { category: 'competition', sport: false, mode: 'atmospheric' },
  scoreboard: { category: 'competition', sport: false, mode: 'surface' },
  referees: { category: 'competition', sport: false, mode: 'atmospheric' },

  venues: { category: 'management', sport: false, mode: 'surface' },
  courts: { category: 'management', sport: false, mode: 'atmospheric' },
  clubs: { category: 'management', sport: false, mode: 'surface' },
  bookings: { category: 'management', sport: false, mode: 'surface' },
  calendar: { category: 'management', sport: false, mode: 'surface' },
  registrations: { category: 'management', sport: false, mode: 'surface' },
  organizations: { category: 'management', sport: false, mode: 'atmospheric' },
  associations: { category: 'management', sport: false, mode: 'atmospheric' },
  federations: { category: 'management', sport: false, mode: 'atmospheric' },
  academies: { category: 'management', sport: false, mode: 'surface' },
  coaches: { category: 'management', sport: false, mode: 'surface' },

  padcoins: { category: 'experience', sport: false, mode: 'atmospheric' },
  memberships: { category: 'experience', sport: false, mode: 'surface' },
  loyalty: { category: 'experience', sport: false, mode: 'atmospheric' },
  benefits: { category: 'experience', sport: false, mode: 'atmospheric' },
  awards: { category: 'experience', sport: false, mode: 'atmospheric' },
  events: { category: 'experience', sport: false, mode: 'atmospheric' },
  notifications: { category: 'experience', sport: false, mode: 'atmospheric' },
  experiences: { category: 'experience', sport: false, mode: 'atmospheric' },
};

export const GLOBE_ALL_LABEL_KEYS = Object.keys(GLOBE_LABEL_CATALOG);

export function labelCategory(key) {
  return GLOBE_LABEL_CATALOG[key]?.category || null;
}

export function isSportLabel(key) {
  return Boolean(GLOBE_LABEL_CATALOG[key]?.sport);
}

/** Visibilidad continua por viewport. */
export const GLOBE_PACKET_MIN = {
  desktop: 4,
  tablet: 3,
  mobile: 2,
};

export const GLOBE_PACKET_MAX = {
  desktop: 8,
  tablet: 6,
  mobile: 4,
};

export const GLOBE_PACKET_TARGET = {
  desktop: [6, 8],
  tablet: [4, 6],
  mobile: [3, 4],
};

/** Reduced motion: estáticas, con los 4 deportes en desktop. */
export const GLOBE_STATIC_LABELS = {
  desktop: [
    'padbol',
    'padel',
    'pickleball',
    'tennis',
    'community',
    'players',
  ],
  tablet: ['padbol', 'padel', 'pickleball', 'tennis'],
  mobile: ['padbol', 'padel', 'tennis'],
};

/**
 * Simula apariciones de etiquetas en un intervalo (métrica determinista).
 * @returns {Record<string, number>}
 */
export function countLabelAppearances({
  scheduleFn,
  durationMs = 120000,
  stepMs = 500,
  yawDeg = -18,
  cx = 280,
  cy = 280,
  radius = 210,
  compact = false,
  tablet = false,
} = {}) {
  const counts = {};
  for (let t = 0; t < durationMs; t += stepMs) {
    const items = scheduleFn({
      elapsedMs: t,
      yawDeg,
      cx,
      cy,
      radius,
      compact,
      tablet,
      reducedMotion: false,
      layoutW: compact ? 360 : tablet ? 720 : 1100,
    });
    items.forEach((item) => {
      counts[item.key] = (counts[item.key] || 0) + 1;
    });
  }
  return counts;
}

/**
 * Ratio max/min entre deportes (1 = perfecto).
 */
export function sportAppearanceBalance(counts) {
  const vals = GLOBE_SPORT_LABELS.map((k) => counts[k] || 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (max === 0) return { ratio: Infinity, vals, min, max };
  return { ratio: max / Math.max(1, min), vals, min, max };
}
