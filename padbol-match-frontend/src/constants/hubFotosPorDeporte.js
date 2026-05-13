/**
 * Fotos de fondo del hub principal por deporte y por card.
 * Valores son URLs ya usadas en el repo (UserHome, hubCardDefaults, PartidoAbiertoCard).
 * Podés sustituir por rutas locales, p. ej. `${process.env.PUBLIC_URL}/assets/fotos/padel-reservar.jpg`,
 * colocando los archivos en `public/assets/fotos/`.
 *
 * Si falta una entrada, {@link hubCardPhotoFallback} usa {@link HUB_CARD_UNSPLASH_GENERIC}.
 * Claves de card: reservar | buscar_partido | torneos | armar_partido.
 */
import { HUB_CARD_DEFAULT_IMAGES } from './hubCardDefaults';

/** Fallback genérico (comportamiento histórico del hub cuando no hay CMS ni deporte). */
export const HUB_CARD_UNSPLASH_GENERIC = {
  reservar: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80',
  buscar_partido: 'https://images.unsplash.com/photo-1614632537197-38a17061c2bd?w=800&q=80',
  torneos: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80',
  armar_partido: 'https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=800&q=80',
};

/** Heroes por deporte (mismas URLs que PartidoAbiertoCard `DEPORTE_HERO`). */
const HERO = {
  padbol: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80',
  padel: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e2c1?w=800&q=80',
  tenis: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e2c1?w=800&q=80',
  pickleball: 'https://images.unsplash.com/photo-1622163642998-1ea36b1adcd3?w=800&q=80',
  futbol_5: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
  futbol_7: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
};

const D = HUB_CARD_DEFAULT_IMAGES;

export const FOTOS_POR_DEPORTE = {
  padbol: {
    reservar: HUB_CARD_UNSPLASH_GENERIC.reservar,
    buscar_partido: HUB_CARD_UNSPLASH_GENERIC.buscar_partido,
    torneos: HUB_CARD_UNSPLASH_GENERIC.torneos,
    armar_partido: HUB_CARD_UNSPLASH_GENERIC.armar_partido,
  },
  padel: {
    reservar: D.reservar,
    buscar_partido: D.partidos,
    torneos: D.torneos,
    armar_partido: D.jugar,
  },
  pickleball: {
    reservar: HERO.pickleball,
    buscar_partido: D.partidos,
    torneos: D.torneos_lista,
    armar_partido: D.jugar,
  },
  squash: {
    reservar: D.sedes,
    buscar_partido: D.partidos,
    torneos: D.torneos,
    armar_partido: D.jugar,
  },
  tenis: {
    reservar: HERO.tenis,
    buscar_partido: D.partidos,
    torneos: D.rankings,
    armar_partido: D.jugar,
  },
  futbol_5: {
    reservar: HERO.futbol_5,
    buscar_partido: HERO.futbol_5,
    torneos: D.torneos,
    armar_partido: D.jugar,
  },
  futbol_7: {
    reservar: HERO.futbol_7,
    buscar_partido: HERO.futbol_7,
    torneos: D.torneos_lista,
    armar_partido: D.jugar,
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
