/**
 * Fila de hub por deporte + card (API GET /api/hub-deporte-config).
 * @param {unknown[]} rows
 * @param {string} deporteKey
 * @param {string} cardKey
 * @returns {Record<string, unknown>|null}
 */
export function pickHubDeporteRow(rows, deporteKey, cardKey) {
  if (!deporteKey || !Array.isArray(rows)) return null;
  const d = String(deporteKey).trim().toLowerCase();
  const c = String(cardKey || '').trim();
  const hits = rows.filter((r) => {
    if (r == null || typeof r !== 'object') return false;
    return String(r.deporte || '').trim().toLowerCase() === d && String(r.card_key || '').trim() === c;
  });
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];
  return hits.reduce((best, cur) => {
    const tb = best?.updated_at ? Date.parse(best.updated_at) : 0;
    const tc = cur?.updated_at ? Date.parse(cur.updated_at) : 0;
    return tc >= tb ? cur : best;
  });
}
