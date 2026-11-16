import React from 'react';
import {Link} from 'react-router-dom';
import {countryFlagFromIso, countryNameFromIso} from '../../utils/countryRankingDisplay';

const name = player => String(player?.nombre || player?.name || '').trim();
const players = (board, side) => Array.isArray(board?.[`equipo_${side.toLowerCase()}_jugadores`])
  ? board[`equipo_${side.toLowerCase()}_jugadores`]
  : [];
const starters = (board, side) => players(board, side).filter(player => player.on_court === true).slice(0, 2);
const bench = (board, side) => players(board, side).filter(player => player.on_court === false);
const teamName = (board, side, copy) => {
  const iso=teamIso(board,side);
  return (iso ? countryNameFromIso(iso,'en') : '') || board?.[`equipo_${side.toLowerCase()}_nombre`] || (side === 'A' ? copy.teamA : copy.teamB);
};
const teamIso = (board, side) => String(board?.[`equipo_${side.toLowerCase()}_pais_iso`] || board?.[`equipo_${side.toLowerCase()}_iso`] || '').trim().toUpperCase();
const flagFor = iso => countryFlagFromIso(iso);
function initials(player) {
  const parts = name(player).split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || '·';
}

/** Public spectator surface. Read-only, no controls and no clock. */
export default function PracticeSpectatorView({board, status, copy, courts = null, activeCourt = 1}) {
  const history = Array.isArray(board?.historial_sets) ? board.historial_sets : [];
  const finished = ['finalizado','terminado'].includes(board?.estado);
  const activeSet = finished ? 'FINAL' : (board?.display?.mode === 'super_tiebreak' ? 'STB' : `SET ${history.length + 1}`);
  const live = board?.estado === 'en_curso' && status === 'ready' && board?.cronometro_pausado !== true;
  const stateLabel = finished ? (copy.finished || 'Finished') : board?.cronometro_pausado ? (copy.paused || 'Paused') : live ? copy.live : status === 'ready' ? copy.pending : (copy.reconnecting || copy.offline);
  const team = side => {
    const iso=teamIso(board,side), flag=flagFor(iso);
    return <div className="np-public__team">
      <div className="np-public__teamline">{flag ? <span className="np-public__flag" aria-label={iso}><img src={`/brand/flags/${iso.toLowerCase()}.svg`} alt={flag} /></span> : null}<h2>{teamName(board, side, copy)}</h2></div>
      <strong className="np-public__score">{board?.display?.[`display${side}`] ?? board?.[`score_${side.toLowerCase()}`] ?? 0}</strong>
      {board?.saque_actual === side && live ? <span className="np-public__serve"><span className="np-public__serve-dot" aria-hidden="true">●</span>{copy.serve || 'Serving'}</span> : <span className="np-public__serve" />}
      <ul className="np-public__starters" aria-label={copy.onCourt}>
        {starters(board, side).map((player, index) => <li key={`${side}-${index}`}><span className="np-public__avatar" aria-hidden="true">{initials(player)}</span><span>{name(player) || copy.onCourt}</span></li>)}
      </ul>
    </div>;
  };
  return <section className={`np-public np-public--${live ? 'live' : 'idle'}`} aria-label={copy.spectator}>
    <div className="np-public__rays" aria-hidden="true" />
    <header className="np-public__header">
      <img className="np-public__brand" src="/brand/padbol-match-logo-white-practice.svg" alt="Padbol Match" />
      <h1>NATIONS CUP</h1>
      <p className="np-public__edition">{(board?.torneo_edicion || '').trim() || ''}</p>
      <div className="np-public__live"><span className={`np-public__dot${live ? ' is-live' : ''}`} />{stateLabel.toUpperCase()}</div>
    </header>
    {courts?.length ? <div className="np-public__courts" aria-label={copy.choose}>{courts.map((court, index) => court.href ? <Link key={court.id || index} to={court.href} className={`np-public__court${Number(activeCourt) === index + 1 || court.active ? ' is-active' : ''}`}>{court.label || `${copy.court} ${index + 1}`}</Link> : court.onSelect ? <button type="button" key={court.id || index} onClick={court.onSelect} className={`np-public__court${Number(activeCourt) === index + 1 ? ' is-active' : ''}`}>{court.label || `${copy.court} ${index + 1}`}</button> : <span key={court.id || index} className={`np-public__court${Number(activeCourt) === index + 1 || court.active ? ' is-active' : ''}`}>{court.label || `${copy.court} ${index + 1}`}</span>)}</div> : null}
    <div className="np-public__card" role="group" aria-label={copy.points}>
      <div className="np-public__teams">{team('A')}<span className="np-public__dash" aria-hidden="true">–</span>{team('B')}</div>
      <div className="np-public__setrow"><span>{activeSet}</span><strong>{copy.games.toUpperCase()} {board?.games_a ?? 0}–{board?.games_b ?? 0}</strong></div>
      {history.length ? <div className="np-public__history">{history.map((set, index) => <span key={index}>{set.type === 'super_tiebreak' ? 'STB' : `SET ${set.set ?? index + 1}`} {set.type === 'super_tiebreak' ? `${set.points_a}-${set.points_b}` : `${set.a}-${set.b}`}</span>)}</div> : null}
    </div>
    <div className="np-public__sets"><span className="np-public__rule" />{copy.setsWon || 'Sets won'} {board?.sets_a ?? 0}–{board?.sets_b ?? 0}<span className="np-public__rule" /></div>
    <details className="np-public__bench"><summary>{copy.bench}<span aria-hidden="true">⌄</span></summary>
      <div className="np-public__bench-grid">{['A','B'].map(side => <div key={side}><h3>{teamName(board, side, copy)}</h3>{bench(board, side).length ? bench(board, side).map((player, index) => <p key={index}>{name(player) || copy.bench}</p>) : <p>—</p>}</div>)}</div>
    </details>
    <p className="np-public__updated"><span className={`np-public__dot${live ? ' is-live' : ''}`} />{status === 'ready' ? (copy.updatedLive || 'Updated live') : (copy.reconnecting || copy.offline)}</p>
  </section>;
}
