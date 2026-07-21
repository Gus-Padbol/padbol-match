import {
  PUBLIC_SITE_ANCHORS,
  PUBLIC_SITE_CTA,
  PUBLIC_SITE_STORE_LINKS,
} from '../constants/publicSiteLinks';

const item = (key) => ({ key });

export const PUBLIC_SITE_NAV_ITEMS = [
  { key: 'platform', href: PUBLIC_SITE_ANCHORS.platform },
  { key: 'players', href: PUBLIC_SITE_ANCHORS.players },
  { key: 'venues', href: PUBLIC_SITE_ANCHORS.venues },
  { key: 'download', href: PUBLIC_SITE_ANCHORS.download },
];

export const PUBLIC_SITE_SECTIONS = {
  problem: {
    id: 'problema',
    items: ['messages', 'payments', 'sheets', 'results'].map(item),
    journey: ['book', 'play', 'compete', 'return'],
  },
  ecosystem: {
    id: 'ecosistema',
    items: ['player', 'venue', 'system'].map(item),
  },
  experiences: {
    id: 'experiencias',
    items: ['signature', 'stadium', 'express', 'arena', 'quantum'].map(item),
  },
  playerCycle: {
    id: 'jugadores',
    items: ['find', 'book', 'play', 'compete', 'evolve', 'return'].map(item),
  },
  venueOps: {
    id: 'sedes',
    items: ['operation', 'competition', 'loyalty', 'decisions'].map(item),
  },
  community: {
    id: 'comunidad',
    items: ['create', 'complete', 'communicate'].map(item),
  },
  scoreboard: {
    id: 'marcador',
    items: ['start', 'follow', 'correct', 'close'].map(item),
    flow: ['result', 'history', 'ranking', 'statistics', 'venue'].map(item),
  },
  tournaments: {
    id: 'torneos',
    items: ['teams', 'registrations', 'matches', 'results'].map(item),
  },
  ranking: {
    id: 'evolucion',
    items: ['history', 'statistics', 'achievements', 'ranking'].map(item),
  },
  padCoins: {
    id: 'fidelizacion',
    items: ['padcoins', 'memberships', 'campaigns'].map(item),
  },
  venueBenefits: {
    id: 'beneficios',
    items: ['friction', 'occupancy', 'recurrence', 'control', 'revenue', 'community'].map(item),
  },
  rollout: {
    id: 'implementacion',
    items: ['base', 'connected', 'loyalty', 'expansion'].map(item),
  },
  download: {
    id: 'descargar',
    stores: [
      { key: 'appStore', url: PUBLIC_SITE_STORE_LINKS.appStore },
      { key: 'googlePlay', url: PUBLIC_SITE_STORE_LINKS.googlePlay },
    ],
    login: PUBLIC_SITE_CTA.login,
  },
  contact: {
    id: 'contacto',
    ctas: [
      { key: 'play', to: PUBLIC_SITE_CTA.play },
      { key: 'venue', to: PUBLIC_SITE_CTA.venue },
      { key: 'login', to: PUBLIC_SITE_CTA.login },
    ],
  },
};

export const PUBLIC_SITE_SECTION_ORDER = Object.values(PUBLIC_SITE_SECTIONS).map(({ id }) => id);

export const PUBLIC_SITE_INTERNAL_ROUTES = [
  PUBLIC_SITE_CTA.play,
  PUBLIC_SITE_CTA.venue,
  PUBLIC_SITE_CTA.login,
  '/sobre',
  '/privacidad',
  '/terminos',
];
