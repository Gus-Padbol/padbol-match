/**
 * Fotos de fondo del hub principal por deporte y por card (Unsplash).
 * Podés sustituir por rutas locales en `public/assets/fotos/` si preferís.
 *
 * Si falta una entrada, {@link hubCardPhotoFallback} usa {@link HUB_CARD_UNSPLASH_GENERIC}.
 * Claves de card: reservar | buscar_partido | tomar_clase | torneos | armar_partido.
 */

/** Fallback genérico (comportamiento histórico del hub cuando no hay CMS ni deporte). */
export const HUB_CARD_UNSPLASH_GENERIC = {
  reservar: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80',
  buscar_partido: 'https://images.unsplash.com/photo-1614632537197-38a17061c2bd?w=800&q=80',
  tomar_clase: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
  torneos: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80',
  armar_partido: 'https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=800&q=80',
};

export const FOTOS_POR_DEPORTE = {
  padbol: {
    reservar: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80',
    buscar_partido: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=800&q=80',
    torneos: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
    armar_partido: 'https://images.unsplash.com/photo-1543357480-c60d40fafa5f?w=800&q=80',
  },
  padel: {
    reservar: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80',
    buscar_partido: 'https://images.unsplash.com/photo-1625134673337-519d4d10b313?w=800&q=80',
    torneos: 'https://images.unsplash.com/photo-1599474924187-334a4ae5051f?w=800&q=80',
    armar_partido: 'https://images.unsplash.com/photo-1602211844066-d3bb556e983b?w=800&q=80',
  },
  pickleball: {
    reservar: 'https://images.unsplash.com/photo-1686311613688-eb1882ed0e25?w=800&q=80',
    buscar_partido: 'https://images.unsplash.com/photo-1686311613696-7f02f1b7dc6f?w=800&q=80',
    torneos: 'https://images.unsplash.com/photo-1686311613705-b4ed85c94a7b?w=800&q=80',
    armar_partido: 'https://images.unsplash.com/photo-1686311613713-24c63e5c83f4?w=800&q=80',
  },
  squash: {
    reservar: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80',
    buscar_partido: 'https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?w=800&q=80',
    torneos: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
    armar_partido: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=800&q=80',
  },
  tenis: {
    reservar: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80',
    buscar_partido: 'https://images.unsplash.com/photo-1542144582-1ba00456b5e3?w=800&q=80',
    torneos: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&q=80',
    armar_partido: 'https://images.unsplash.com/photo-1544298621-35a989e4e54a?w=800&q=80',
  },
  futbol_5: {
    reservar: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    buscar_partido: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80',
    torneos: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=800&q=80',
    /* Mensaje original cortado en "photo-1…"; misma imagen que padbol.armar_partido del set pedido. */
    armar_partido: 'https://images.unsplash.com/photo-1543357480-c60d40fafa5f?w=800&q=80',
  },
  /* Bloque no incluido en el mensaje; variación del set fútbol 5 para cancha 7. */
  futbol_7: {
    reservar: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
    buscar_partido: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    torneos: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=800&q=80',
    armar_partido: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80',
  },
};

/**
 * URL de foto por deporte y card. Vacío si deporte no reconocido o sin entrada.
 */
export function hubCardPhotoPorDeporte(deporteKey, cardKey) {
  const d = String(deporteKey || '').trim().toLowerCase();
  const c = String(cardKey || '').trim();
  if (!d || !FOTOS_POR_DEPORTE[d]) return '';
  const u = FOTOS_POR_DEPORTE[d][c];
  return typeof u === 'string' && u.trim() ? u.trim() : '';
}

export function hubCardPhotoFallback(cardKey) {
  const c = String(cardKey || '').trim();
  return HUB_CARD_UNSPLASH_GENERIC[c] || '';
}
