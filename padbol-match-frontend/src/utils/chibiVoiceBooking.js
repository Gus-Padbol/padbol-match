/**
 * Interpreta una respuesta breve del usuario cuando Chibi ya tiene un turno
 * seleccionado. Mantenerlo local evita volver a consultar al modelo para una
 * confirmación que debe terminar en el checkout real.
 */
export function resolveVoiceBookingConfirmation(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[!?.,;:]/g, ' ')
    .replace(/\s+/g, ' ');

  if (!normalized) return null;

  if (/^(si|s|dale|ok|okay|confirmo|confirmar|continuar|vamos|yes|yep|yeah|continue|confirm|sim|confirmar reserva)$/.test(normalized)) {
    return 'confirm';
  }
  if (/^(no|n|cancelar|cancela|otro|otro horario|elegir otro|not now|cancel|nao)$/.test(normalized)) {
    return 'cancel';
  }
  return null;
}

/** El mismo deep link que usa ReservaForm para abrir la reserva ya preseleccionada. */
export function buildVoiceBookingCheckoutHref({ sedeId, fecha, hora, canchaId, deporte } = {}) {
  const sid = String(sedeId ?? '').trim();
  const day = String(fecha ?? '').trim();
  const time = String(hora ?? '').trim();
  const court = String(canchaId ?? '').trim();
  if (!sid || !day || !time || !court) return null;

  const params = new URLSearchParams({ sedeId: sid, fecha: day, hora: time, canchaId: court });
  const sport = String(deporte ?? '').trim();
  if (sport) params.set('deporte', sport);
  return `/reservar?${params.toString()}`;
}
