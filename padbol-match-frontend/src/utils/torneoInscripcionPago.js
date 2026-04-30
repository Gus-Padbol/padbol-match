const API_MP_BASE = 'https://padbol-backend.onrender.com';

/** Estado de pago de inscripción del equipo en torneo. */
export function getEquipoInscripcionEstado(equipo) {
  const s = String(equipo?.inscripcion_estado ?? '').toLowerCase();
  if (s === 'confirmado') return 'confirmado';
  return 'pendiente';
}

/** Precio unitario inscripción equipo (ARS u otra moneda del torneo). Fallback si no hay columna en DB. */
export function precioInscripcionTorneo(torneo) {
  const n = Number(torneo?.precio_inscripcion_equipo ?? torneo?.precio_inscripcion ?? 0);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return 5000;
}

export function etiquetaInscripcionEstado(estado) {
  return estado === 'confirmado' ? 'Inscripción confirmada' : 'Inscripción pendiente de pago';
}

/** Nuevas inscripciones / equipos: solo antes de que el torneo esté en curso o terminado. */
export function torneoPermiteNuevasInscripciones(torneo) {
  const e = String(torneo?.estado || '').toLowerCase();
  return e !== 'finalizado' && e !== 'cancelado' && e !== 'en_curso';
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
}) {
  const precio = precioInscripcionTorneo(torneo);
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
    const res = await fetch(`${API_MP_BASE}/api/crear-preferencia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo,
        precio,
        moneda,
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
