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
