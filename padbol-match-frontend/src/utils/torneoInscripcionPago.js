function defaultApiBackendBase() {
  if (typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL) {
    return String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '');
  }
  return 'https://padbol-backend.onrender.com';
}

/** Estado de pago de inscripción del equipo en torneo. */
export function getEquipoInscripcionEstado(equipo) {
  const s = String(equipo?.inscripcion_estado ?? '').toLowerCase();
  if (s === 'confirmado') return 'confirmado';
  return 'pendiente';
}

/**
 * Monto inscripción por equipo (ARS / moneda del torneo).
 * Prioriza `costo_inscripcion` en BD; 0 = gratis. Legacy: `precio_inscripcion_equipo` / `precio_inscripcion`.
 */
export function precioInscripcionTorneo(torneo) {
  if (!torneo || typeof torneo !== 'object') return 0;
  if (Object.prototype.hasOwnProperty.call(torneo, 'costo_inscripcion')) {
    const c = Number(torneo.costo_inscripcion);
    if (Number.isFinite(c) && c >= 0) return Math.round(c);
    return 0;
  }
  const legacy = Number(torneo?.precio_inscripcion_equipo ?? torneo?.precio_inscripcion ?? 0);
  if (Number.isFinite(legacy) && legacy > 0) return Math.round(legacy);
  return 0;
}

export function etiquetaInscripcionEstado(estado) {
  return estado === 'confirmado' ? 'Inscripción confirmada' : 'Inscripción pendiente de pago';
}

/** Nuevas inscripciones / equipos: solo antes de que el torneo esté en curso o terminado. */
export function torneoPermiteNuevasInscripciones(torneo) {
  const e = String(torneo?.estado || '').toLowerCase();
  return e !== 'finalizado' && e !== 'cancelado' && e !== 'en_curso' && e !== 'activo';
}

/**
 * Texto legible del tope para confirmar inscripción: `fecha_inicio` a las 00:00 (ART) menos 24 horas.
 * @returns {string|null}
 */
export function textoFechaLimiteConfirmacionInscripcion(torneo) {
  const fi = torneo?.fecha_inicio;
  if (!fi) return null;
  const m = String(fi).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const inicio = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00-03:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  const limite = new Date(inicio.getTime() - 24 * 60 * 60 * 1000);
  return limite.toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Crea preferencia MP y redirige al checkout.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export async function iniciarPagoInscripcionTorneo({
  equipoId,
  torneoId,
  email,
  torneoNombre,
  equipoNombre,
  torneo,
  apiBaseUrl,
}) {
  const base = String(apiBaseUrl || '').replace(/\/$/, '') || defaultApiBackendBase();
  const precio = precioInscripcionTorneo(torneo);
  if (!Number.isFinite(precio) || precio <= 0) {
    try {
      const res = await fetch(`${base}/api/torneos/confirmar-inscripcion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipo_id: Number(equipoId),
          torneo_id: Number(torneoId),
          email: String(email || '').trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.ok || data.already)) {
        return { ok: true, gratis: true };
      }
      return { ok: false, error: data.error || 'No se pudo confirmar la inscripción sin costo' };
    } catch (e) {
      return { ok: false, error: e?.message || 'Error de conexión' };
    }
  }

  const moneda = String(torneo?.moneda || 'ARS').trim() || 'ARS';
  const sedeId = torneo?.sede_id != null ? Number(torneo.sede_id) : null;
  const titulo = `Inscripción torneo — ${String(equipoNombre || 'Equipo').slice(0, 60)}`;
  const reservaData = {
    tipo: 'torneo_inscripcion',
    equipo_id: Number(equipoId),
    torneo_id: Number(torneoId),
    email: String(email || '').trim(),
  };

  try {
    const res = await fetch(`${base}/api/crear-preferencia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo,
        precio,
        monto: precio,
        moneda,
        tipo: 'torneo_inscripcion',
        equipo_id: Number(equipoId),
        torneo_id: Number(torneoId),
        email: String(email || '').trim(),
        sedeNombre: String(torneoNombre || 'Padbol Match').slice(0, 40),
        sedeId: Number.isFinite(sedeId) ? sedeId : null,
        reservaData,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.init_point) {
      window.location.href = data.init_point;
      return { ok: true };
    }
    return { ok: false, error: data.error || 'No se pudo iniciar el pago' };
  } catch (e) {
    return { ok: false, error: e?.message || 'Error de conexión' };
  }
}
