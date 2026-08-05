import {
  PUBLIC_SITE_ANCHORS,
  PUBLIC_SITE_ADMIN_PATH,
  PUBLIC_SITE_CTA,
  PUBLIC_SITE_STORE_LINKS,
} from '../constants/publicSiteLinks';

const item = (key) => ({ key });

export const PUBLIC_SITE_NAV_ITEMS = [
  { key: 'about', href: PUBLIC_SITE_ANCHORS.about },
  { key: 'platform', href: PUBLIC_SITE_ANCHORS.platform },
  { key: 'players', href: PUBLIC_SITE_ANCHORS.players },
  { key: 'community', href: PUBLIC_SITE_ANCHORS.community },
  { key: 'scoreboard', href: PUBLIC_SITE_ANCHORS.scoreboard },
  { key: 'venues', href: PUBLIC_SITE_ANCHORS.venues },
  { key: 'download', href: PUBLIC_SITE_ANCHORS.download },
];

/**
 * Estructura editorial (~10 bloques) con protagonismo de comunidad y marcador.
 */
export const PUBLIC_SITE_SECTIONS = {
  whatIs: {
    id: 'que-es',
  },
  status: {
    id: 'estado-plataforma',
    items: ['active', 'rollingOut'].map(item),
  },
  playerPath: {
    id: 'jugadores',
    items: ['find', 'create', 'join', 'book', 'compete', 'evolve', 'community'].map(item),
  },
  communityMatches: {
    id: 'comunidad-partidos',
    steps: ['create', 'publish', 'join', 'confirm'].map(item),
  },
  venuePath: {
    id: 'sedes',
    items: ['occupy', 'activate', 'scoreboard', 'continuity'].map(item),
  },
  continuity: {
    id: 'continuidad',
    items: ['openMatches', 'tournaments', 'results', 'ranking', 'padcoins', 'memberships', 'community'].map(
      item,
    ),
  },
  voice: {
    id: 'chivi-voz',
    items: ['ask', 'guide', 'result'].map(item),
  },
  smartScoreboard: {
    id: 'marcador-inteligente',
    steps: ['start', 'live', 'correct', 'close', 'connect'].map(item),
  },
  experiences: {
    id: 'experiencias',
    items: ['signature', 'stadium', 'express', 'arena', 'quantum'].map(item),
  },
  matchIntelligence: {
    id: 'arbitro-virtual',
    features: ['scoreboard', 'referee', 'traceability'].map(item),
  },
  expansion: {
    id: 'expansion',
    items: ['sponsor', 'ads', 'eshop'].map(item),
  },
  about: {
    id: 'nosotros',
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
      { key: 'venue', to: PUBLIC_SITE_CTA.venue },
      { key: 'play', to: PUBLIC_SITE_CTA.play },
      { key: 'login', to: PUBLIC_SITE_CTA.login },
    ],
  },
};

/**
 * Recorrido público, en el mismo orden en que se renderiza la landing:
 * identidad y propuesta → experiencias → jugadores y
 * operación → oportunidades comerciales → lo próximo.
 *
 * El bloque de innovación futura queda deliberadamente al final del relato
 * para no competir con las funciones que ya pueden usar jugadores y sedes.
 */
export const PUBLIC_SITE_SECTION_ORDER = [
  PUBLIC_SITE_SECTIONS.about.id,
  PUBLIC_SITE_SECTIONS.whatIs.id,
  PUBLIC_SITE_SECTIONS.experiences.id,
  PUBLIC_SITE_SECTIONS.playerPath.id,
  PUBLIC_SITE_SECTIONS.communityMatches.id,
  PUBLIC_SITE_SECTIONS.smartScoreboard.id,
  PUBLIC_SITE_SECTIONS.venuePath.id,
  PUBLIC_SITE_SECTIONS.continuity.id,
  PUBLIC_SITE_SECTIONS.expansion.id,
  PUBLIC_SITE_SECTIONS.matchIntelligence.id,
  PUBLIC_SITE_SECTIONS.download.id,
  PUBLIC_SITE_SECTIONS.contact.id,
];

export const PUBLIC_SITE_INTERNAL_ROUTES = [
  PUBLIC_SITE_CTA.play,
  PUBLIC_SITE_CTA.venue,
  PUBLIC_SITE_CTA.login,
  PUBLIC_SITE_ADMIN_PATH,
  '/sobre',
  '/privacidad',
  '/eliminar-cuenta',
  '/terminos',
];
