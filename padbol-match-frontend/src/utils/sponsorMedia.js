/** @typedef {'imagen' | 'video'} SponsorTipoMedia */

/** @param {unknown} raw @returns {SponsorTipoMedia} */
export function normalizeSponsorTipoMedia(raw) {
  const v = String(raw ?? 'imagen').trim().toLowerCase();
  return v === 'video' ? 'video' : 'imagen';
}

function safeStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

/** @param {Record<string, unknown>|null|undefined} row */
export function sponsorRowHasBannerMedia(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const tipo = normalizeSponsorTipoMedia(row.tipo_media);
  if (tipo === 'video') return Boolean(safeStr(row.video_url));
  return Boolean(safeStr(row.banner_url) || safeStr(row.logo_url) || safeStr(row.imagen_url));
}

/** @param {Record<string, unknown>|null|undefined} row */
export function sponsorHasDisplayableMedia(row) {
  return sponsorRowHasBannerMedia(row);
}

/** @param {unknown[]} rows */
export function pickBannerSponsors(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((row) => sponsorRowHasBannerMedia(row));
}
