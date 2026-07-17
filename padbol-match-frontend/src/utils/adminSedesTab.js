/**
 * Identificadores técnicos estables del tab Sedes (no usar i18n como id/tabla).
 */

export const ADMIN_SEDES_TAB_ID = 'sedes';
export const ADMIN_SEDES_TABLE = 'sedes';
export const ADMIN_SEDES_STORAGE_BUCKET = 'sedes';

/**
 * Valores legacy que en algún momento se usaron como tab id vía
 * t('admin.metricas.venuesCount') en distintos idiomas.
 */
export const LEGACY_SEDES_TAB_IDS = Object.freeze([
  'sedes',
  'venues',
  'quartier général',
  'Hauptsitz',
  'المقر الرئيسي',
  'sediu',
  'sede',
]);

const LEGACY_SET = new Set(LEGACY_SEDES_TAB_IDS);

/** Si el raw es un id legacy de Sedes, devuelve 'sedes'; si no, el raw trimmeado. */
export function coerceAdminSedesTabId(raw) {
  const t0 = String(raw || '').trim();
  if (!t0) return t0;
  if (LEGACY_SET.has(t0)) return ADMIN_SEDES_TAB_ID;
  return t0;
}

export function isAdminSedesTab(activeTab) {
  return coerceAdminSedesTabId(activeTab) === ADMIN_SEDES_TAB_ID;
}

/** Garantiza que from(...) nunca reciba un string i18n. */
export function assertSedesTableName(name) {
  const n = String(name || '').trim();
  if (n !== ADMIN_SEDES_TABLE) {
    throw new Error(`Nombre de tabla inválido para sedes: ${n}`);
  }
  return ADMIN_SEDES_TABLE;
}
