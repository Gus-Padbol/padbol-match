import {
  equipoIdKey,
  partidoEstaFinalizado,
  parseResultadoPartido,
  partidosDelGrupo,
  resolveGanadorEquipoId,
} from './torneoPartidoResultado';

function partidoTieneMarcador(partido) {
  return partidoEstaFinalizado(partido) || parseResultadoPartido(partido).length > 0;
}

/**
 * Últimos resultados del equipo en el grupo: 'G' | 'P' (más reciente al final).
 * @param {number|string} equipoId
 * @param {object[]} partidosList
 * @param {object[]} grupoEquipos
 * @param {string|number|null} grupoLabel
 * @param {number} max
 */
export function formaRecienteEquipoGrupo(equipoId, partidosList, grupoEquipos, grupoLabel, max = 5) {
  const eid = equipoIdKey(equipoId);
  if (!eid) return [];

  const delGrupo = partidosDelGrupo(partidosList, grupoEquipos, grupoLabel);
  const ordenados = delGrupo
    .filter(partidoTieneMarcador)
    .slice()
    .sort((a, b) => {
      const ta = a?.fecha_hora ? new Date(a.fecha_hora).getTime() : 0;
      const tb = b?.fecha_hora ? new Date(b.fecha_hora).getTime() : 0;
      return tb - ta;
    });

  const chips = [];
  for (const p of ordenados) {
    const idA = equipoIdKey(p.equipo_a_id);
    const idB = equipoIdKey(p.equipo_b_id);
    if (idA !== eid && idB !== eid) continue;
    const ganador = resolveGanadorEquipoId(p);
    if (!ganador) continue;
    chips.push(ganador === eid ? 'G' : 'P');
    if (chips.length >= max) break;
  }

  return chips.reverse();
}
