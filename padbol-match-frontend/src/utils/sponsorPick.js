/** Normaliza `scope` desde DB o UI (es/en). */
export function normalizeSponsorScope(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'global') return 'global';
  if (s === 'sede' || s === 'club') return 'sede';
  if (s === 'torneo' || s === 'tournament') return 'torneo';
  if (s === 'nacional' || s === 'pais' || s === 'país' || s === 'country') return 'nacional';
  return '';
}

/** YYYY-MM-DD local (Argentina UX alineado al resto de la app). */
export function sponsorDateYmdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `fecha_desde` / `fecha_hasta` como date o string YYYY-MM-DD. */
export function sponsorVigenteEnFecha(row, ymd = sponsorDateYmdLocal()) {
  if (!row || row.activo === false) return false;
  const desde = row.fecha_desde != null && String(row.fecha_desde).trim() !== '' ? String(row.fecha_desde).slice(0, 10) : null;
  const hasta = row.fecha_hasta != null && String(row.fecha_hasta).trim() !== '' ? String(row.fecha_hasta).slice(0, 10) : null;
  if (desde && ymd < desde) return false;
  if (hasta && ymd > hasta) return false;
  return true;
}

function normPais(p) {
  return String(p || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Prioridad numérica: mayor = más específico (torneo > sede > nacional > global). */
export function sponsorScopePriority(scopeNorm) {
  if (scopeNorm === 'torneo') return 4;
  if (scopeNorm === 'sede') return 3;
  if (scopeNorm === 'nacional') return 2;
  if (scopeNorm === 'global') return 1;
  return 0;
}

/**
 * Filtra filas candidatas según contexto (sin ordenar).
 * @param {{ sedeId?: number|null, torneoId?: number|null, pais?: string|null }} ctx
 */
export function sponsorRowsMatchingContext(rows, ctx) {
  const sedeId = ctx.sedeId != null && Number.isFinite(Number(ctx.sedeId)) ? Number(ctx.sedeId) : null;
  const torneoId = ctx.torneoId != null && Number.isFinite(Number(ctx.torneoId)) ? Number(ctx.torneoId) : null;
  const paisCtx = normPais(ctx.pais);

  const list = Array.isArray(rows) ? rows : [];
  return list.filter((row) => {
    if (!sponsorVigenteEnFecha(row)) return false;
    const sc = normalizeSponsorScope(row.scope);
    if (!sc) return false;
    if (sc === 'global') return true;
    if (sc === 'torneo') {
      const tid = row.torneo_id != null ? Number(row.torneo_id) : null;
      return torneoId != null && tid === torneoId;
    }
    if (sc === 'sede') {
      const sid = row.sede_id != null ? Number(row.sede_id) : null;
      return sedeId != null && sid === sedeId;
    }
    if (sc === 'nacional') {
      const p = normPais(row.pais);
      return paisCtx && p && p === paisCtx;
    }
    return false;
  });
}

/**
 * Elige un único sponsor: prioridad torneo > sede > nacional > global;
 * empate en misma prioridad → mayor `id` (más reciente).
 */
export function pickSponsorForContext(rows, ctx) {
  const matches = sponsorRowsMatchingContext(rows, ctx);
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const pa = sponsorScopePriority(normalizeSponsorScope(a.scope));
    const pb = sponsorScopePriority(normalizeSponsorScope(b.scope));
    if (pb !== pa) return pb - pa;
    const ida = Number(a.id) || 0;
    const idb = Number(b.id) || 0;
    return idb - ida;
  });
  return matches[0] || null;
}
