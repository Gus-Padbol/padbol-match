// Sede de torneo: existe para alojar un evento; no se reserva por hora ni pasa por checkout.
export const SEDE_TIPO_TORNEO = 'torneo';

export function esSedeTorneo(sede) {
  const tipo = typeof sede === 'string' ? sede : sede?.tipo_sede;
  return String(tipo || '').trim().toLowerCase() === SEDE_TIPO_TORNEO;
}

/** La sede sigue visible y seleccionable; lo que no se ofrece es reservar por hora. */
export function puedeReservarSede(sede) {
  return !esSedeTorneo(sede);
}

/** Deja solo las sedes que se pueden reservar por hora (excluye las de torneo). */
export function filtrarSedesReservables(sedes) {
  return (Array.isArray(sedes) ? sedes : []).filter((sede) => !esSedeTorneo(sede));
}

/** Filtra la respuesta cruda de GET /api/sedes: deja solo sedes reservables. */
export function sedesDesdeRespuesta(payload) {
  const lista = Array.isArray(payload) ? payload : (Array.isArray(payload?.sedes) ? payload.sedes : []);
  return filtrarSedesReservables(lista);
}
