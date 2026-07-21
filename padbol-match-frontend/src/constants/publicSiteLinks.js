/**
 * Enlaces y anchors de la web pública (`/plataforma`).
 * App Store / Google Play: sin URLs aprobadas → UI “Próximamente”.
 */

export const PUBLIC_SITE_PATH = '/plataforma';

/** CTAs del Hero — flujos productivos existentes. */
export const PUBLIC_SITE_CTA = {
  /** Scroll interno a la sección de ecosistema. */
  exploreHash: '#ecosistema',
  /** Entrada a jugar / explorar (guest-friendly, sin gate de login). */
  play: '/hub',
  /** Incorporar sede: página comercial existente (luego → /unirse). */
  venue: '/contacto',
  /** Acceso a cuenta. */
  login: '/acceso',
};

/** Anchors principales de navegación pública. */
export const PUBLIC_SITE_ANCHORS = {
  platform: '#ecosistema',
  players: '#jugadores',
  venues: '#sedes',
  download: '#descargar',
};

/** Stores: null = mostrar “Próximamente”. */
export const PUBLIC_SITE_STORE_LINKS = {
  appStore: null,
  googlePlay: null,
};
