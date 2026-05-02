/**
 * Badges de estado de torneo: misma semántica en listado público y vista detalle.
 * Alineado con estados de API / Supabase (`abierto`, `inscripcion_abierta`, `proximo`, etc.).
 */
export const TORNEO_ESTADO_PUBLICO_STYLE = {
  planificacion: { label: 'Próximo', bg: '#e5e7eb', color: '#374151' },
  proximo: { label: 'Próximo', bg: '#e5e7eb', color: '#374151' },
  inscripcion_abierta: { label: 'Inscripción abierta', bg: '#dcfce7', color: '#166534' },
  abierto: { label: 'Inscripción abierta', bg: '#dcfce7', color: '#166534' },
  en_curso: { label: 'En curso', bg: '#bbf7d0', color: '#14532d' },
  activo: { label: 'En curso', bg: '#bbf7d0', color: '#14532d' },
  finalizado: { label: 'Finalizado', bg: '#4b5563', color: '#f9fafb' },
  cancelado: { label: 'Cancelado', bg: '#94a3b8', color: '#fff' },
};

export function badgeTorneoEstadoPublico(estadoRaw) {
  const k = String(estadoRaw || '').toLowerCase().trim();
  if (!k) return null;
  return TORNEO_ESTADO_PUBLICO_STYLE[k] || null;
}
