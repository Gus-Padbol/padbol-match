import {
  normalizeSponsorScope,
  sponsorDateYmdLocal,
  sponsorVigenteEnFecha,
  normPais,
} from './sponsorPick';
import { sponsorRowMatchesCardFormato, sponsorRowMatchesTickerFormato } from './sponsorDisplayFormato';

export function sponsorRowApproved(row) {
  if (!row) return false;
  return row.aprobado === true || row.aprobado === 'true' || row.aprobado === 1;
}

/**
 * Sponsors para banda del hub: global + sede del usuario + nacional (sin torneo).
 * @param {unknown[]} rows
 * @param {{ sedeId?: number|null, pais?: string|null }} ctx
 */
export function hubSponsorsEligibles(rows, ctx, ymd = sponsorDateYmdLocal()) {
  const sid = ctx.sedeId != null && Number.isFinite(Number(ctx.sedeId)) ? Number(ctx.sedeId) : null;
  const pCtx = normPais(ctx.pais);
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((r) => {
    if (r.activo === false) return false;
    if (!sponsorVigenteEnFecha(r, ymd)) return false;
    if (!sponsorRowApproved(r)) return false;
    const sc = normalizeSponsorScope(r.scope);
    if (sc === 'torneo') return false;
    if (sc === 'global') return true;
    if (sc === 'sede') {
      const s = r.sede_id != null ? Number(r.sede_id) : null;
      return sid != null && s === sid;
    }
    if (sc === 'nacional') {
      const p = normPais(r.pais);
      return Boolean(pCtx) && Boolean(p) && p === pCtx;
    }
    return false;
  });
}

export function pickTercerTiempoSedeSponsor(rows, sedeId, ymd = sponsorDateYmdLocal()) {
  const sid = sedeId != null && Number.isFinite(Number(sedeId)) ? Number(sedeId) : null;
  if (sid == null) return null;
  const list = Array.isArray(rows) ? rows : [];
  const matches = list.filter((r) => {
    if (r.activo === false) return false;
    if (!sponsorVigenteEnFecha(r, ymd)) return false;
    if (!sponsorRowApproved(r)) return false;
    if (normalizeSponsorScope(r.scope) !== 'sede') return false;
    const s = r.sede_id != null ? Number(r.sede_id) : null;
    return s === sid;
  });
  matches.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  return matches[0] || null;
}

export function hubTickerSponsors(rows, ctx, excludeId = null) {
  const elig = hubSponsorsEligibles(rows, ctx).filter(sponsorRowMatchesTickerFormato);
  if (excludeId == null || excludeId === '') return elig;
  return elig.filter((r) => String(r.id) !== String(excludeId));
}

/** Primer sponsor elegible para card destacada full-bleed (formato card o ambos). */
export function pickHubCardSponsor(rows, ctx, ymd = sponsorDateYmdLocal()) {
  const elig = hubSponsorsEligibles(rows, ctx, ymd).filter(sponsorRowMatchesCardFormato);
  elig.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  return elig[0] || null;
}
