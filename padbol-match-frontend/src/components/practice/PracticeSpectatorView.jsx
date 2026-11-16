import React from 'react';
import useServerCronometro from '../../hooks/useServerCronometro';
import {PracticeStatus} from './PracticeBoard';

const name = player => String(player?.nombre || player?.name || '').trim();
const players = (board, side) => Array.isArray(board?.[`equipo_${side.toLowerCase()}_jugadores`])
  ? board[`equipo_${side.toLowerCase()}_jugadores`]
  : [];
const starters = (board, side) => players(board, side).filter(player => player.on_court === true).slice(0, 2);
const bench = (board, side) => players(board, side).filter(player => player.on_court === false);
const teamName = (board, side, copy) => board?.[`equipo_${side.toLowerCase()}_nombre`] || (side === 'A' ? copy.teamA : copy.teamB);
function initials(player) {
  const parts = name(player).split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || '·';
}
function clockText(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Public, read-only view. No controls and no private data. */
export default function PracticeSpectatorView({board, status, copy}) {
  const seconds = useServerCronometro(status === 'ready' ? board : {...board, display: {...board.display, cronometroActivo: false}});
  const history = Array.isArray(board?.historial_sets) ? board.historial_sets : [];
  const currentSet = history.length + 1;
  const activeSet = board?.display?.mode === 'super_tiebreak' ? 'STB' : `${copy.set} ${currentSet}`;
  return <section className="np-spectator" aria-label={copy.spectator}>
    <div className="np-spectator__top"><PracticeStatus board={board} status={status} copy={copy}/><span className="np-spectator__clock" aria-label={copy.time}>{clockText(seconds)}</span></div>
    <div className="np-spectator__score" role="group" aria-label={copy.points}>
      {['A','B'].map(side => <div className="np-spectator__side" key={side}>
        <h2>{teamName(board, side, copy)}</h2>
        <strong>{board?.display?.[`display${side}`] ?? board?.[`score_${side.toLowerCase()}`] ?? 0}</strong>
        <span className="np-spectator__serve">{board?.saque_actual === side && board?.estado === 'en_curso' ? '● Saque' : ' '}</span>
        <ul className="np-spectator__starters" aria-label={copy.onCourt}>
          {starters(board, side).map((player, index) => <li key={`${side}-${index}`}><span className="np-spectator__avatar" aria-hidden="true">{initials(player)}</span><span>{name(player) || copy.onCourt}</span></li>)}
        </ul>
      </div>)}
    </div>
    <div className="np-spectator__sets" aria-label={copy.sets}>
      <span>{activeSet}</span>
      <strong>{board?.games_a ?? 0} <small>–</small> {board?.games_b ?? 0}</strong>
      <span>{copy.sets}: {board?.sets_a ?? 0}–{board?.sets_b ?? 0}</span>
      {history.length ? <div className="np-spectator__history">{history.map((set, index) => <span key={index}>{set.type === 'super_tiebreak' ? 'STB' : `${copy.set} ${set.set ?? index + 1}`} {set.type === 'super_tiebreak' ? `${set.points_a}-${set.points_b}` : `${set.a}-${set.b}`}</span>)}</div> : null}
    </div>
    <details className="np-spectator__bench"><summary>{copy.bench}</summary>
      <div className="np-spectator__bench-grid">{['A','B'].map(side => <div key={side}><h3>{teamName(board, side, copy)}</h3>{bench(board, side).length ? bench(board, side).map((player, index) => <p key={index}>{name(player) || copy.bench}</p>) : <p>—</p>}</div>)}</div>
    </details>
    <p className="np-spectator__note">{copy.spectator} · {copy.note}</p>
  </section>;
}
