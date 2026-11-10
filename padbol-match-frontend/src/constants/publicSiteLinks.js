/**
 * Enlaces y anchors de la web pública (`/plataforma`).
 * App Store / Google Play: URLs oficiales verificadas desde padbol.com.
 */

export const PUBLIC_SITE_PATH = '/plataforma';
export const PUBLIC_SITE_ADMIN_PATH = '/administradores';

/** CTAs del Hero — flujos productivos existentes. */
export const PUBLIC_SITE_CTA = {
  /** Scroll interno a la sección “Qué es”. */
  exploreHash: '#que-es',
  /** Descarga de la app. Mientras no haya stores, baja al bloque "Próximamente". */
  play: '#descargar',
  /** Incorporar sede: primero presenta la landing comercial específica para sedes. */
  venue: PUBLIC_SITE_ADMIN_PATH,
  /** Solicitud de alta: solo después de conocer la propuesta comercial. */
  venueApplication: '/unirse',
  /** Acceso a cuenta. */
  login: '/acceso',
};

/** Anchors principales de navegación pública. */
export const PUBLIC_SITE_ANCHORS = {
  platform: '#que-es',
  players: '#jugadores',
  community: '#comunidad-partidos',
  scoreboard: '#marcador-inteligente',
  venues: '#sedes',
  about: '#nosotros',
  download: '#descargar',
};

/** Stores: null = no presentar como enlace activo. */
export const PUBLIC_SITE_STORE_LINKS = {
  appStore: 'https://apps.apple.com/app/id6814243035',
  googlePlay: 'https://play.google.com/store/apps/details?id=com.padbolmatch.app',
};
