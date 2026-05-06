import { mapEstadoTorneoDesdeApiParaForm } from './torneoEstadoAdminApi';
import { estadoTorneoNormalizado } from './torneoEstadoFiltroPills';

const ALL_ESTADO_FORM_OPTIONS = [
  { value: 'proximo', label: 'Próximo' },
  { value: 'abierto', label: 'Inscripción abierta' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'cancelado', label: 'Cancelado' },
];

/** Agrupa el estado API/BD para reglas de UI. */
export function bucketEstadoTorneoApi(estadoRaw) {
  const n = estadoTorneoNormalizado(estadoRaw);
  if (n === 'planificacion' || n === 'proximo') return 'pre';
  if (n === 'abierto' || n === 'inscripcion_abierta') return 'abi';
  if (n === 'en_curso' || n === 'activo') return 'cur';
  if (n === 'finalizado') return 'fin';
  if (n === 'cancelado') return 'can';
  return 'pre';
}

/**
 * Opciones del select de estado en edición inline (Admin).
 * `null` = no mostrar select (solo mensaje de solo lectura).
 */
export function opcionesSelectEstadoTorneoAdmin(estadoApiRaw, isSuperAdmin) {
  if (isSuperAdmin) return ALL_ESTADO_FORM_OPTIONS;
  const b = bucketEstadoTorneoApi(estadoApiRaw);
  if (b === 'pre') {
    return ALL_ESTADO_FORM_OPTIONS.filter((o) => o.value === 'proximo' || o.value === 'abierto');
  }
  return null;
}

/** Texto de solo lectura cuando no hay selector manual (no super_admin). */
export function mensajeEstadoTorneoSoloLecturaAdmin(estadoApiRaw, isSuperAdmin) {
  if (isSuperAdmin) return null;
  if (opcionesSelectEstadoTorneoAdmin(estadoApiRaw, false) != null) return null;
  const fv = mapEstadoTorneoDesdeApiParaForm(estadoApiRaw);
  const label = ALL_ESTADO_FORM_OPTIONS.find((o) => o.value === fv)?.label || fv;
  const b = bucketEstadoTorneoApi(estadoApiRaw);
  if (b === 'abi') {
    return `Estado: ${label}. No se cambia desde el panel: usá «Iniciar torneo» en la vista del torneo (equipos y sorteo).`;
  }
  if (b === 'cur') {
    return `Estado: ${label}. Se finaliza al registrar el resultado de la final (o con la acción de finalizar en la vista del torneo).`;
  }
  if (b === 'fin' || b === 'can') {
    return `Estado: ${label}. Solo super_admin puede cambiar el estado manualmente desde aquí.`;
  }
  return null;
}

/**
 * Validación previa al guardar (alineada con el backend para no-super_admin).
 * @returns {string|null} mensaje de error o null si OK
 */
export function validarCambioEstadoTorneoAdminGuardar({
  estadoApiTorneoActual,
  estadoFormNuevo,
  isSuperAdmin,
}) {
  if (isSuperAdmin) return null;
  const prevForm = mapEstadoTorneoDesdeApiParaForm(estadoApiTorneoActual);
  const nextForm = String(estadoFormNuevo || 'proximo').toLowerCase().trim();
  if (prevForm === nextForm) return null;
  if (prevForm === 'proximo' && nextForm === 'abierto') return null;
  return 'Transición de estado no permitida: desde «Próximo» solo podés pasar a «Inscripción abierta»; el resto se gestiona desde la vista del torneo.';
}
