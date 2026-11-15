import React, {useRef} from 'react';
import useServerCronometro from '../../hooks/useServerCronometro';

const name = player => String(player?.nombre || player?.name || '').trim();
const rows = (board, side) => Array.isArray(board?.[`equipo_${side.toLowerCase()}_jugadores`]) ? board[`equipo_${side.toLowerCase()}_jugadores`] : [];
export function PracticeStatus({board, status, copy}) {
  const live = status === 'ready' && board?.estado === 'en_curso' && board?.display?.cronometroActivo === true && board?.cronometro_pausado !== true;
  const label = status === 'refreshing' ? copy.refreshing : status !== 'ready' ? copy.offline : ['finalizado','terminado'].includes(board?.estado) ? copy.finished : board?.cronometro_pausado === true ? copy.paused : live ? copy.live : copy.pending;
  return <span className={`np-status ${live ? 'np-status--live' : ''}`} role="status">{label}</span>;
}
export default function PracticeBoard({board, status, copy}) {
  const seconds = useServerCronometro(status === 'ready' ? board : {...board, display: {...board.display, cronometroActivo: false}});
  const lastClock = useRef(0);
  // Keep the last visible clock when the source cannot be refreshed.
  if (status === 'ready') lastClock.current = seconds;
  const elapsed = Math.max(0, Math.floor(lastClock.current));
  const time = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const history = Array.isArray(board.historial_sets) ? board.historial_sets : [];
  const finished = ['finalizado','terminado'].includes(board.estado);
  const columns = history.map((set, index) => ({key: index, label: set.type === 'super_tiebreak' ? 'STB' : `${copy.set} ${index + 1}`, A: set.type === 'super_tiebreak' ? set.points_a : set.a, B: set.type === 'super_tiebreak' ? set.points_b : set.b}));
  if (!finished && columns.length < 3) columns.push({key: 'current', label: board.display?.mode === 'super_tiebreak' ? 'STB' : `${copy.set} ${history.length + 1}`, A: board.display?.mode === 'super_tiebreak' ? board.display?.displayA ?? board.score_a : board.games_a, B: board.display?.mode === 'super_tiebreak' ? board.display?.displayB ?? board.score_b : board.games_b});
  return <section className="np-board" aria-label={copy.spectator}>
    <div className="np-board-top"><PracticeStatus board={board} status={status} copy={copy}/><span className="np-clock" aria-label={copy.time}>{time}</span></div>
    <div className="np-score" role="group" aria-label={copy.points}><div><h2>{board.equipo_a_nombre || copy.teamA}</h2><strong>{board.display?.displayA ?? board.score_a ?? 0}</strong></div><span className="np-score-dash">–</span><div><h2>{board.equipo_b_nombre || copy.teamB}</h2><strong>{board.display?.displayB ?? board.score_b ?? 0}</strong></div></div>
    <div className="np-table-wrap"><table className="np-sets"><thead><tr><th scope="col">{copy.team}</th>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}<th scope="col">{copy.sets}</th></tr></thead><tbody>{['A','B'].map(side => <tr key={side}><th scope="row">{side === 'A' ? board.equipo_a_nombre || copy.teamA : board.equipo_b_nombre || copy.teamB}</th>{columns.map(column => <td key={column.key}>{column[side] ?? '–'}</td>)}<td>{side === 'A' ? board.sets_a ?? 0 : board.sets_b ?? 0}</td></tr>)}</tbody></table></div>
    <h3 className="np-eyebrow">{copy.onCourt}</h3><div className="np-players">{['A','B'].map(side => <div key={side}><h4>{side === 'A' ? board.equipo_a_nombre || copy.teamA : board.equipo_b_nombre || copy.teamB}</h4>{rows(board, side).filter(player => player.on_court === true).map((player, index) => <div className="np-player" key={`${side}-${index}`}><span className="np-avatar" aria-hidden="true">{String(player.jersey ?? player.numero ?? '').slice(0, 3) || side}</span><span>{name(player)}</span></div>)}</div>)}</div>
    <details className="np-bench" aria-label={copy.bench}><summary>{copy.bench}</summary><div className="np-players">{['A','B'].map(side => <div key={side}><h4>{side === 'A' ? board.equipo_a_nombre || copy.teamA : board.equipo_b_nombre || copy.teamB}</h4>{rows(board, side).filter(player => player.on_court === false).map((player, index) => <div className="np-player" key={`${side}-${index}`}><span>{name(player)}</span></div>)}</div>)}</div></details>
  </section>;
}
