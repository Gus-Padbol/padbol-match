import {
  esEstadoCanceladoTorneo,
  esEstadoFinalizadoTorneo,
} from './torneoEstadoFiltroPills';

/** Paginación de sedes en panel super_admin. */
export const SEDES_SUPER_ADMIN_PAGE_SIZE = 10;

/** Paginación de reservas en tab Reservas del admin. */
export const RESERVAS_ADMIN_PAGE_SIZE = 15;

/**
 * Torneos que siguen “en juego” a nivel operativo (no finalizados ni cancelados).
 * Usado en el contador del panel nacional / resumen.
 */
export function torneoConsideradoActivoPanelNacional(t) {
  return !esEstadoFinalizadoTorneo(t?.estado) && !esEstadoCanceladoTorneo(t?.estado);
}
