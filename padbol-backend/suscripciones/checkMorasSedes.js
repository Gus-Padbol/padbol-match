/**
 * Cron diario (safety net): escala suscripcion_estado por mora según suscripcion_proximo_cobro.
 * No modifica metodo_pago = manual. No procesa sedes ya cancelado (mora). Solo avanza (nunca retrocede).
 */

function normalizeMetodoPago(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'stripe') return 'stripe';
  if (v === 'manual') return 'manual';
  return 'mercadopago';
}

/** Días completos de mora desde proximo_cobro (UTC, floor). */
export function diasMoraDesdeProximoCobro(proximoIso, now = new Date()) {
  const due = new Date(proximoIso);
  if (Number.isNaN(due.getTime())) return null;
  const ms = now.getTime() - due.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / 86_400_000);
}

/** Estado objetivo según días de mora (0–6 → aviso, 7–14 → segundo_aviso, …). */
export function estadoMoraDesdeDias(dias) {
  if (dias == null || dias < 0) return null;
  if (dias < 7) return 'aviso';
  if (dias < 15) return 'segundo_aviso';
  if (dias < 30) return 'suspendido';
  return 'cancelado';
}

const RANK_MORA = {
  aviso: 10,
  segundo_aviso: 20,
  suspendido: 30,
  cancelado: 40,
};

/** Rango lineal para comparar “solo hacia adelante” (Stripe / legado = 0). */
export function rankSuscripcionParaMora(estadoRaw) {
  const e = String(estadoRaw || '').trim().toLowerCase();
  if (RANK_MORA[e] != null) return RANK_MORA[e];
  return 0;
}

function mensajeWhatsApp(nuevoEstado, nombreSede) {
  const nombre = String(nombreSede || 'tu club').trim();
  switch (nuevoEstado) {
    case 'aviso':
      return `⚠️ Hola ${nombre}, tu suscripción a Padbol Match venció. Regularizá tu pago para continuar operando sin interrupciones.`;
    case 'segundo_aviso':
      return `🔴 ${nombre}, segundo aviso: 7 días sin renovar. En 8 días tu cuenta será suspendida.`;
    case 'suspendido':
      return `🚫 ${nombre}, cuenta suspendida por falta de pago. Tus jugadores no pueden reservar. Contactá soporte: soporte@padbolmatch.com`;
    case 'cancelado':
      return `❌ ${nombre}, cuenta cancelada. Contactá soporte para reactivarla: soporte@padbolmatch.com`;
    default:
      return '';
  }
}

/**
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.supabase
 * @param {(to: string, body: string) => Promise<void>} opts.sendWhatsApp
 * @param {Date} [opts.now]
 */
export async function checkMorasSedes({ supabase, sendWhatsApp, now = new Date() }) {
  const nowIso = now.toISOString();
  const { data: rows, error } = await supabase
    .from('sedes')
    .select('id, nombre, telefono, suscripcion_estado, suscripcion_proximo_cobro, metodo_pago')
    .not('suscripcion_proximo_cobro', 'is', null)
    .lt('suscripcion_proximo_cobro', nowIso);

  if (error) {
    console.error('❌ checkMorasSedes consulta:', error.message);
    return { ok: false, error: error.message };
  }

  let actualizados = 0;
  for (const row of rows || []) {
    if (normalizeMetodoPago(row.metodo_pago) === 'manual') continue;

    const estAct = String(row.suscripcion_estado || '').trim().toLowerCase();
    if (estAct === 'cancelado') continue;

    const prox = row.suscripcion_proximo_cobro;
    const proxTime = new Date(prox).getTime();
    if (!Number.isFinite(proxTime) || proxTime >= now.getTime()) continue;

    const dias = diasMoraDesdeProximoCobro(prox, now);
    const nuevo = estadoMoraDesdeDias(dias);
    if (!nuevo) continue;
    if (nuevo === estAct) continue;

    const rActual = rankSuscripcionParaMora(estAct);
    const rNuevo = rankSuscripcionParaMora(nuevo);
    if (rNuevo <= rActual) continue;

    const { error: upErr } = await supabase.from('sedes').update({ suscripcion_estado: nuevo }).eq('id', row.id);
    if (upErr) {
      console.warn(`⚠️ checkMorasSedes update sede ${row.id}:`, upErr.message);
      continue;
    }
    actualizados += 1;
    console.log(`✓ Mora sede ${row.id} (${row.nombre}): ${estAct} → ${nuevo} (${dias} días)`);

    const wa = mensajeWhatsApp(nuevo, row.nombre);
    if (wa && typeof sendWhatsApp === 'function') {
      try {
        await sendWhatsApp(row.telefono, wa);
      } catch (e) {
        console.warn(`⚠️ checkMorasSedes WA sede ${row.id}:`, e?.message || e);
      }
    }
  }

  if (actualizados) console.log(`📋 checkMorasSedes: ${actualizados} sede(s) actualizadas`);
  return { ok: true, actualizados };
}

/** @deprecated usar checkMorasSedes */
export const runCheckMorasSedes = checkMorasSedes;
