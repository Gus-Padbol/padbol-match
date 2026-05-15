/** Valores por defecto alineados con `sponsor_config` y AdminSponsorsSection. */
export const DEFAULT_SPONSOR_CUPOS = {
  max_global: 5,
  max_por_sede_starter: 2,
  max_por_sede_pro: 5,
  max_por_sede_elite: 20,
  max_por_nacion: 3,
};

/** Misma lógica que NuevaSedeSuperBottomSheet / AdminSponsors: plan por cantidad de canchas. */
export function matchPlanForTotal(planes, total) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  const list = [...(planes || [])].sort((a, b) => Number(a.canchas_min) - Number(b.canchas_min));
  for (const p of list) {
    const min = Number(p.canchas_min);
    const maxRaw = p.canchas_max;
    const max = maxRaw == null || maxRaw === '' ? null : Number(maxRaw);
    if (!Number.isFinite(min) || min < 0) continue;
    if (n < min) continue;
    if (max != null && Number.isFinite(max) && n > max) continue;
    return p;
  }
  return null;
}

/** Límite de sponsors con scope `sede` según nombre comercial del plan (Starter / Pro / Elite / Enterprise). */
export function maxPorSedeSegunNombrePlan(nombrePlan, cupos) {
  const n = String(nombrePlan || '').trim().toLowerCase();
  if (n === 'enterprise') return cupos.max_por_sede_elite;
  if (n === 'elite') return cupos.max_por_sede_elite;
  if (n === 'pro') return cupos.max_por_sede_pro;
  if (n === 'starter') return cupos.max_por_sede_starter;
  return cupos.max_por_sede_starter;
}

/**
 * Nombre del plan comercial: columna `plan` (o similar) en `sedes`, si no hay coincide con `plan_pricing` por canchas.
 * Sin datos: "Starter" (límite más restrictivo por defecto).
 */
export function resolveSedeCommercialPlanNombre(miSede, planPricingRows) {
  if (!miSede) return 'Starter';
  const keys = ['plan', 'plan_nombre', 'tipo_plan', 'plan_suscripcion', 'plan_comercial'];
  for (const k of keys) {
    const raw = miSede[k];
    if (raw == null || String(raw).trim() === '') continue;
    const s = String(raw).trim().toLowerCase();
    if (s.includes('enterprise')) return 'Enterprise';
    if (s.includes('elite')) return 'Elite';
    if (s === 'pro' || (/\bpro\b/.test(s) && !s.includes('enterprise'))) return 'Pro';
    if (s.includes('starter')) return 'Starter';
    const t = String(raw).trim();
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
  const total = Math.max(0, Math.floor(Number(miSede.cantidad_canchas) || 0));
  const plan = matchPlanForTotal(planPricingRows, total > 0 ? total : 1);
  return plan?.nombre ? String(plan.nombre).trim() : 'Starter';
}
