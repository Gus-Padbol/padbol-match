/** Convierte "HH:MM" a minutos desde medianoche; null si inválido. */
export function horaAMinutos(hhmm) {
  const s = String(hhmm || '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * Precio del turno según `franjas_horarias` (JSONB).
 * Cada franja: { hora_inicio, hora_fin, precio } en "HH:MM".
 * Rango normal [inicio, fin); si fin <= inicio se trata como cruce de medianoche.
 */
export function precioDesdeFranjas(sede, horaTurno) {
  const franjas = sede?.franjas_horarias;
  if (!Array.isArray(franjas) || franjas.length === 0) return null;
  const mins = horaAMinutos(horaTurno);
  if (mins == null) return null;
  for (const f of franjas) {
    const i = horaAMinutos(f?.hora_inicio);
    const fi = horaAMinutos(f?.hora_fin);
    if (i == null || fi == null) continue;
    let dentro = false;
    if (fi > i) dentro = mins >= i && mins < fi;
    else if (fi < i) dentro = mins >= i || mins < fi;
    else dentro = mins === i;
    if (!dentro) continue;
    const p = Number(f?.precio);
    if (Number.isFinite(p) && p >= 0) return p;
  }
  return null;
}

/** Precio mínimo entre franjas (para cards). */
export function precioMinimoFranjas(sede) {
  const franjas = sede?.franjas_horarias;
  if (!Array.isArray(franjas) || franjas.length === 0) return null;
  let min = null;
  for (const f of franjas) {
    const p = Number(f?.precio);
    if (!Number.isFinite(p) || p < 0) continue;
    if (min == null || p < min) min = p;
  }
  return min;
}

/** Nombre de la franja que contiene `horaTurno`, o null. */
export function nombreFranjaActiva(sede, horaTurno) {
  const franjas = sede?.franjas_horarias;
  if (!Array.isArray(franjas) || franjas.length === 0) return null;
  const mins = horaAMinutos(horaTurno);
  if (mins == null) return null;
  for (const f of franjas) {
    const i = horaAMinutos(f?.hora_inicio);
    const fi = horaAMinutos(f?.hora_fin);
    if (i == null || fi == null) continue;
    let dentro = false;
    if (fi > i) dentro = mins >= i && mins < fi;
    else if (fi < i) dentro = mins >= i || mins < fi;
    else dentro = mins === i;
    if (!dentro) continue;
    const n = String(f?.nombre || '').trim();
    return n || 'Franja horaria';
  }
  return null;
}

/** Texto corto para subtítulo de tarifas en reserva (franjas o legacy). */
export function textoLineaTarifasReserva(sede) {
  const moneda = sede?.moneda || 'ARS';
  const franjas = sede?.franjas_horarias;
  if (Array.isArray(franjas) && franjas.length > 0) {
    const parts = franjas
      .map((f) => {
        const p = Number(f?.precio);
        if (!Number.isFinite(p)) return null;
        const nm = String(f?.nombre || '').trim() || 'Franja';
        return `${nm} $${p.toLocaleString('es-AR')}`;
      })
      .filter(Boolean);
    if (parts.length) return ` • ${parts.join(' · ')} ${moneda}`;
  }
  if (sede?.precio_manana && sede?.precio_tarde) {
    return ` • 🌅 $${Number(sede.precio_manana).toLocaleString('es-AR')} / 🌆 $${Number(sede.precio_tarde).toLocaleString('es-AR')} ${moneda}`;
  }
  const base = Number(sede?.precio_por_reserva || sede?.precio_turno || 0);
  return ` • $${base.toLocaleString('es-AR')} ${moneda}`;
}
