import React, {useMemo} from 'react';
import NationsRefereePanel from '../scoreboard/NationsRefereePanel';

/**
 * Adapter only: maps the existing practice CAS resource to the recovered 19df
 * NationsRefereePanel controller. No new visual implementation and no awards.
 */
export default function PracticeRefereePanel({data, board, revision, status = 'ready', refreshing = false, busy, pending, notice, onCommand, onRefresh, onRetry, allowIssueLink = false}) {
  const controller = useMemo(() => {
    const lineups = data?.lineups || {};
    const players = side => Array.isArray(lineups[side]) ? lineups[side].map(player => ({...player, name: player.name || player.nombre})) : [];
    const active = side => players(side).filter(player => player.on_court === true).map(player => player.id);
    const teams = Object.fromEntries(['A','B'].map(side => [side, {players: players(side)}]));
    const membership = {A:'A', B:'B'};
    const markers = ['A','B'].map(side => ({teamId: side, state: {active: active(side), revision}}));
    const snapshot = {
      mode: 'nations', epoch: revision, coherent: true, clockSynced: true,
      window: data?.substitution_window || {allowed:false},
      board: {...board, equipo_a_jugadores: players('A'), equipo_b_jugadores: players('B')},
      context: {membership, hasBaseline: String(board?.estado || '').toLowerCase() !== 'pendiente', canStart: true, teams},
      markers,
    };
    const act = async (kind, extra = {}) => {
      if (kind === 'point') return onCommand('point', {team: extra.side});
      if (kind === 'substitution') return onCommand('substitution', {team: extra.teamId, swaps: extra.swaps});
      if (['start','pause','resume','undo'].includes(kind)) return onCommand(kind, extra);
      if (kind === 'retry') return onRetry ? onRetry() : false;
      if (kind === 'close') return false;
      return undefined;
    };
    return {snapshot, loading: status === 'loading', busy: Boolean(busy), error: notice, pending, syncing: Boolean(refreshing) || status !== 'ready', feedback: '', act, refresh: onRefresh};
  }, [data, board, revision, status, refreshing, busy, pending, notice, onCommand, onRefresh, onRetry]);
  return <NationsRefereePanel controller={controller} allowIssueLink={allowIssueLink}/>;
}
