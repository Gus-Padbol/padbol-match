/**
 * Una fila por par (deporte, card_key). Si hay duplicados (p. ej. migración incompleta),
 * conserva la de `updated_at` más reciente.
 * @param {unknown[]} rows
 * @returns {Record<string, unknown>[]}
 */
export function dedupeHubDeporteConfigRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  /** @type {Map<string, Record<string, unknown>>} */
  const map = new Map();
  for (const r of rows) {
    if (r == null || typeof r !== 'object') continue;
    const d = String(r.deporte || '').trim().toLowerCase();
    const c = String(r.card_key || '').trim();
    if (!d || !c) continue;
    const k = `${d}|${c}`;
    const cur = map.get(k);
    if (!cur) {
      map.set(k, /** @type {Record<string, unknown>} */ (r));
      continue;
    }
    const tb = cur?.updated_at != null ? Date.parse(String(cur.updated_at)) : 0;
    const tc = r?.updated_at != null ? Date.parse(String(r.updated_at)) : 0;
    const tCur = Number.isFinite(tc) ? tc : 0;
    const tBest = Number.isFinite(tb) ? tb : 0;
    if (tCur >= tBest) map.set(k, /** @type {Record<string, unknown>} */ (r));
  }
  return [...map.values()];
}

/**
 * Fila de hub por deporte + card (API GET /api/hub-deporte-config).
 * @param {unknown[]} rows
 * @param {string} deporteKey
 * @param {string} cardKey
 * @returns {Record<string, unknown>|null}
 */
/**
 * Reemplaza o agrega una fila en el array local (solo par deporte+card_key).
 * @param {unknown[]} prev
 * @param {Record<string, unknown>} row
 */
export function mergeHubDeporteRowIntoList(prev, row) {
  if (!row || typeof row !== 'object') return dedupeHubDeporteConfigRows(prev);
  const dep = String(row.deporte || '').trim().toLowerCase();
  const ck = String(row.card_key || '').trim();
  if (!dep || !ck) return dedupeHubDeporteConfigRows(prev);
  const list = Array.isArray(prev) ? prev : [];
  const others = list.filter(
    (r) => String(r?.deporte || '').trim().toLowerCase() !== dep || String(r?.card_key || '').trim() !== ck,
  );
  return dedupeHubDeporteConfigRows([...others, row]);
}

export function pickHubDeporteRow(rows, deporteKey, cardKey) {
  if (!deporteKey || !Array.isArray(rows)) return null;
  const d = String(deporteKey).trim().toLowerCase();
  const c = String(cardKey || '').trim();
  const deduped = dedupeHubDeporteConfigRows(rows);
  const hit = deduped.find((r) => {
    if (r == null || typeof r !== 'object') return false;
    return String(r.deporte || '').trim().toLowerCase() === d && String(r.card_key || '').trim() === c;
  });
  return hit ?? null;
}
