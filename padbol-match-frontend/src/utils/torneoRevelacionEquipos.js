/**
 * Horas antes del inicio en las que la lista de equipos se muestra al público (no admin).
 * Default 48 si no hay valor válido en BD.
 */
export function horasRevelarEquiposTorneo(torneo) {
  const n = Number(torneo?.horas_revelar_equipos);
  if (Number.isFinite(n) && n >= 0) return Math.round(n);
  return 48;
}

/** Horas hasta el inicio del torneo (negativo si ya empezó). null si no hay fecha. */
export function horasHastaInicioTorneo(torneo) {
  const fi = torneo?.fecha_inicio;
  if (fi == null || String(fi).trim() === '') return null;
  const s = String(fi).trim();
  let d;
  if (s.length <= 10 && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    d = new Date(`${s}T12:00:00`);
  } else {
    d = new Date(s);
  }
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - Date.now()) / (1000 * 60 * 60);
}

/**
 * Ocultar lista de equipos en vista pública: aún faltan más de `horas_revelar_equipos` horas para el inicio.
 * Admin (`isAdmin`) siempre ve la lista.
 */
export function torneoListaEquiposOcultaParaPublico(torneo, { isAdmin = false } = {}) {
  if (!torneo || isAdmin) return false;
  const hrs = horasHastaInicioTorneo(torneo);
  if (hrs == null) return false;
  const revelar = horasRevelarEquiposTorneo(torneo);
  if (revelar <= 0) return false;
  return hrs > revelar;
}

/** Texto fijo al completar el equipo (además del WhatsApp al capitán). */
export function mensajeConfirmacionCupoTrasEquipoCompleto(torneo) {
  const fi = torneo?.fecha_inicio;
  let hasta = 'el día previo al inicio del torneo';
  if (fi != null && String(fi).trim() !== '') {
    const s = String(fi).trim();
    const d =
      s.length <= 10 && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const limite = new Date(d.getTime() - 24 * 60 * 60 * 1000);
      hasta = limite.toLocaleString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return `Confirma tu lugar. Tienes tiempo hasta ${hasta}. Los cupos se asignan por orden de confirmación. Si no confirmas, el cupo se libera.`;
}
