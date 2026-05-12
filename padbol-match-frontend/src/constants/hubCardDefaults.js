/** Imágenes por defecto del hub (CMS `foto_url` vacío o sin filas). */
export const HUB_CARD_DEFAULT_IMAGES = {
  partidos: 'https://images.unsplash.com/photo-1526676531761-c6e1654d599b?w=800&q=80',
  torneos: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  perfil: 'https://images.unsplash.com/photo-1534438327276-14e53078660e?w=800&q=80',
  sedes: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
  reservar: 'https://images.unsplash.com/photo-1529900740304-2e06a23f9fee?w=800&q=80',
  rankings: 'https://images.unsplash.com/photo-1517649763962-0c62306601b7?w=800&q=80',
  jugar: 'https://images.unsplash.com/photo-1575367420392-2c71baa18656?w=800&q=80',
  torneos_lista: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
};

/** Texto por defecto si el CMS deja título/subtítulo vacíos. */
export const HUB_CARD_FALLBACK_COPY = {
  partidos: { titulo: 'Partidos cerca de ti', subtitulo: 'Si no hay, ¡Crea uno!' },
  torneos: { titulo: 'Torneos', subtitulo: 'Torneos y rankings.' },
  perfil: { titulo: 'Mi perfil', subtitulo: 'Perfil, estadísticas e historial.' },
  sedes: { titulo: 'Explorar sedes', subtitulo: '' },
  reservar: { titulo: 'Reservar', subtitulo: 'Reservá cancha en tu club.' },
  rankings: { titulo: 'Rankings', subtitulo: 'Posiciones y puntos.' },
  jugar: { titulo: 'Jugar', subtitulo: 'Reservar, buscar o armar partido.' },
  torneos_lista: { titulo: 'Torneos abiertos', subtitulo: 'Inscripciones y sedes.' },
};

export function defaultHubCardImageForId(id) {
  const k = String(id || '').trim();
  return HUB_CARD_DEFAULT_IMAGES[k] || HUB_CARD_DEFAULT_IMAGES.partidos;
}

export function fallbackCopyForHubCardId(id) {
  const k = String(id || '').trim();
  return HUB_CARD_FALLBACK_COPY[k] || { titulo: k || 'Card', subtitulo: '' };
}
