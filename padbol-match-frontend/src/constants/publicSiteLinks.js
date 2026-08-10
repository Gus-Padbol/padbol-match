/**
 * Enlaces y anchors de la web pública (`/plataforma`).
 * App Store / Google Play: sin URLs aprobadas → UI no activa.
 */

export const PUBLIC_SITE_PATH = '/plataforma';

/** CTAs del Hero — flujos productivos existentes. */
export const PUBLIC_SITE_CTA = {
  /** Scroll interno a la sección “Qué es”. */
  exploreHash: '#que-es',
  /** Descarga de la app. Mientras no haya stores, baja al bloque "Próximamente". */
  play: '#descargar',
  /** Incorporar sede: primero presenta la landing comercial específica para sedes. */
  venue: '/administradores',
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
  appStore: null,
  googlePlay: null,
};
