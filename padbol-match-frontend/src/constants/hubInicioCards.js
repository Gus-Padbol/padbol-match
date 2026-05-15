import { DEPORTES_CANCHA_SEDE_KEYS, DEPORTES_CANCHA_SEDE_OPTIONS } from './deportesCanchaSede';

/** IDs en `hub_config` para la grilla de bienvenida del hub (4 slots). Ver `padbol-backend/sql/hub_inicio_cards.sql`. */
export const HUB_INICIO_CARD_IDS = [
  'hub_inicio_card_1',
  'hub_inicio_card_2',
  'hub_inicio_card_3',
  'hub_inicio_card_4',
];

/** Deporte por defecto si el CMS aún no tiene `titulo` guardado (índice 0–3). */
export function defaultDeporteHubInicioPorIndice(index) {
  const i = Number(index);
  const opts = DEPORTES_CANCHA_SEDE_OPTIONS;
  if (!opts.length) return 'padbol';
  const slot = Number.isFinite(i) && i >= 0 && i < opts.length ? i : 0;
  return opts[slot].key;
}

/** Normaliza la clave de deporte leyendo `titulo` en hub_config para slots de inicio. */
export function deporteHubInicioDesdeRow(row, slotIndex) {
  const k = String(row?.titulo || '')
    .trim()
    .toLowerCase();
  if (k && DEPORTES_CANCHA_SEDE_KEYS.includes(k)) return k;
  return defaultDeporteHubInicioPorIndice(slotIndex);
}
