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

const DIAS_SEMANA_FRANJA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

function diaFranjaDesdeFecha(fechaISO) {
  const s = String(fechaISO || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return DIAS_SEMANA_FRANJA[d.getDay()] || null;
}

export function franjaAplicaAFecha(f, fechaISO) {
  const tipo = String(f?.tipo || '').trim();
  if (tipo === 'fecha_especial') {
    return Boolean(fechaISO) && String(f?.fecha || '').slice(0, 10) === String(fechaISO || '').slice(0, 10);
  }
  const dias = Array.isArray(f?.dias) ? f.dias.map((d) => String(d).trim()) : [];
  if (!fechaISO || dias.length === 0) return true;
  const dia = diaFranjaDesdeFecha(fechaISO);
  return dia ? dias.includes(dia) : true;
}

/**
 * Precio del turno según `franjas_horarias` (JSONB).
 * Cada franja: { hora_inicio, hora_fin, precio } en "HH:MM".
 * Rango normal [inicio, fin); si fin <= inicio se trata como cruce de medianoche.
 */
export function precioDesdeFranjas(sede, horaTurno, fechaTurno = null) {
  const franjas = sede?.franjas_horarias;
  if (!Array.isArray(franjas) || franjas.length === 0) return null;
  const mins = horaAMinutos(horaTurno);
  if (mins == null) return null;
  const ordenadas = [
    ...franjas.filter((f) => String(f?.tipo || '') === 'fecha_especial'),
    ...franjas.filter((f) => String(f?.tipo || '') !== 'fecha_especial'),
  ];
  for (const f of ordenadas) {
    if (!franjaAplicaAFecha(f, fechaTurno)) continue;
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
export function nombreFranjaActiva(sede, horaTurno, fechaTurno = null) {
  const franjas = sede?.franjas_horarias;
  if (!Array.isArray(franjas) || franjas.length === 0) return null;
  const mins = horaAMinutos(horaTurno);
  if (mins == null) return null;
  const ordenadas = [
    ...franjas.filter((f) => String(f?.tipo || '') === 'fecha_especial'),
    ...franjas.filter((f) => String(f?.tipo || '') !== 'fecha_especial'),
  ];
  for (const f of ordenadas) {
    if (!franjaAplicaAFecha(f, fechaTurno)) continue;
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
        const nm = String(f?.nombre || '').trim() || (String(f?.tipo || '') === 'fecha_especial' ? 'Fecha especial' : 'Franja');
        const dias = String(f?.tipo || '') === 'fecha_especial'
          ? String(f?.fecha || '').slice(0, 10)
          : Array.isArray(f?.dias) && f.dias.length
            ? f.dias.join('/')
            : '';
        return `${nm}${dias ? ` (${dias})` : ''} $${p.toLocaleString('es-AR')}`;
      })
      .filter(Boolean);
    if (parts.length) return ` • ${parts.join(' · ')} ${moneda}`;
  }
  if (sede?.precio_manana && sede?.precio_tarde) {
    return ` • 🌅 $${Number(sede.precio_manana).toLocaleString('es-AR')} / 🌆 $${Number(sede.precio_tarde).toLocaleString('es-AR')} ${moneda}`;
  }
  const pt = Number(sede?.precio_turno);
  const base =
    Number.isFinite(pt) && pt >= 0 ? pt : Number(sede?.precio_por_reserva || 0) || 0;
  return ` • $${base.toLocaleString('es-AR')} ${moneda}`;
}
