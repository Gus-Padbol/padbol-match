/** @typedef {'imagen' | 'video'} SponsorTipoMedia */

/** @param {unknown} raw @returns {SponsorTipoMedia} */
export function normalizeSponsorTipoMedia(raw) {
  const v = String(raw || 'imagen').trim().toLowerCase();
  return v === 'video' ? 'video' : 'imagen';
}

/** @param {Record<string, unknown>|null|undefined} row */
export function sponsorRowHasBannerMedia(row) {
  if (!row) return false;
  const tipo = normalizeSponsorTipoMedia(row.tipo_media);
  if (tipo === 'video') return Boolean(String(row.video_url || '').trim());
  return Boolean(
    String(row.banner_url || row.logo_url || row.imagen_url || '').trim(),
  );
}

/** @param {unknown[]} rows */
export function pickBannerSponsors(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter(sponsorRowHasBannerMedia);
}
