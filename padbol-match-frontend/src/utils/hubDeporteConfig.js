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
  const hit = rows.find((r) => {
    if (r == null || typeof r !== 'object') return false;
    return String(r.deporte || '').trim().toLowerCase() === d && String(r.card_key || '').trim() === c;
  });
  return hit || null;
}
