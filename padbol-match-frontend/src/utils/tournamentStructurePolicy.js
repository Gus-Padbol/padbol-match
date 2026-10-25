export const TOURNAMENT_FIXTURE_LOCK_MESSAGE='Este torneo ya tiene partidos generados. El formato y los cupos quedan bloqueados para conservar el fixture. Puedes editar los demás datos.';
export function hasTournamentFixture(tournament,stats,matchCount) {
 return [matchCount,stats?.total_partidos,stats?.partidos_total,tournament?.partidos_total,tournament?.total_partidos].some(value=>Number.isFinite(Number(value))&&Number(value)>0);
}
export function tournamentStructureChanged(previous,next) {
 const capacity=value=>value==null||String(value).trim()===''?'':String(Number(value));
 return String(previous?.tipo_torneo||'')!==String(next?.tipo_torneo||'')||capacity(previous?.cupos_maximos)!==capacity(next?.cupos_maximos);
}
