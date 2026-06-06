import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import useServerCronometro from '../hooks/useServerCronometro';
import { fetchPartido, fetchSponsors } from '../utils/scoreboardApi';
import '../styles/ScoreboardDisplay.css';

function formatTimerFromSeconds(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function PlayerList({ jugadores }) {
  const list = Array.isArray(jugadores) ? jugadores.slice(0, 4) : [];
  while (list.length < 4) list.push({ numero: list.length + 1, nombre: '—' });

  return (
    <ul className="sb-players">
      {list.map((j, i) => (
        <li key={i} className="sb-player">
          <span className="sb-player__num">{j.numero ?? j.number ?? i + 1}</span>
          <span>{j.nombre ?? j.name ?? '—'}</span>
        </li>
      ))}
    </ul>
  );
}

function Particles({ count = 12 }) {
  const items = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${10 + Math.random() * 80}%`,
      delay: `${Math.random() * 6}s`,
      duration: `${4 + Math.random() * 4}s`,
    })),
    [count],
  );

  return (
    <div className="sb-particles">
      {items.map((p) => (
        <span
          key={p.id}
          className="sb-particle"
          style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration }}
        />
      ))}
    </div>
  );
}

function getTorneoLabel(partido) {
  const name = String(partido?.torneo_nombre || '').trim();
  return name || 'Partido amistoso';
}

function SetHistory({ historial, gamesA, gamesB, setsA, setsB }) {
  const sets = Array.isArray(historial) ? historial : [];
  const boxes = [];

  sets.forEach((s) => {
    const aWins = s.a > s.b;
    boxes.push(
      <div key={`done-${s.set}`} className="sb-set-box sb-set-box--done">
        <span className={aWins ? 'sb-set-box__winner' : 'sb-set-box__loser'}>{s.a}</span>
        {' — '}
        <span className={!aWins ? 'sb-set-box__winner' : 'sb-set-box__loser'}>{s.b}</span>
      </div>,
    );
  });

  if (setsA < 2 && setsB < 2) {
    boxes.push(
      <div key="current" className="sb-set-box sb-set-box--active">
        <span>{gamesA}</span>
        {' — '}
        <span>{gamesB}</span>
      </div>,
    );
  }

  if (!boxes.length) return null;

  return <div className="sb-sets-history">{boxes.slice(0, 3)}</div>;
}

export default function ScoreboardDisplay() {
  const { sedeId, partidoId } = useParams();
  const [partido, setPartido] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [error, setError] = useState('');

  const handleUpdate = useCallback((payload) => {
    setPartido(payload);
  }, []);

  const wsConnected = useScoreboardSocket(partidoId, handleUpdate);
  const timerSeconds = useServerCronometro(partido);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, s] = await Promise.all([
          fetchPartido(partidoId),
          fetchSponsors(sedeId),
        ]);
        if (!cancelled) {
          setPartido(p);
          setSponsors(s);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [partidoId, sedeId]);

  useEffect(() => {
    if (wsConnected || !partidoId) return undefined;
    const poll = async () => {
      try {
        const p = await fetchPartido(partidoId);
        handleUpdate(p);
      } catch {
        /* polling silencioso */
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [wsConnected, partidoId, handleUpdate]);

  if (error) {
    return <div className="sb-error">{error}</div>;
  }

  if (!partido) {
    return <div className="sb-loading">Loading scoreboard...</div>;
  }

  const display = partido.display || {};
  const torneoLabel = getTorneoLabel(partido);
  const isDeuce = display.mode === 'deuce';
  const isTiebreak = partido.es_tiebreak;
  const ultimoPunto = partido.ultimo_punto;
  const terminado = partido.estado === 'terminado';
  const winnerName = partido.sets_a >= 2
    ? partido.equipo_a_nombre
    : partido.sets_b >= 2
      ? partido.equipo_b_nombre
      : null;

  const scoreClassA = isDeuce ? 'sb-score sb-score--deuce' : display.displayA === 'VENT.' ? 'sb-score sb-score--vent' : 'sb-score';
  const scoreClassB = isDeuce ? 'sb-score sb-score--deuce' : display.displayB === 'VENT.' ? 'sb-score sb-score--vent' : 'sb-score';

  return (
    <div className="sb-display">
      <div
        className={`sb-connection ${wsConnected ? 'sb-connection--ws' : 'sb-connection--poll'}`}
        title={wsConnected ? 'WebSocket activo' : 'Actualizando por polling'}
        aria-label={wsConnected ? 'Conexión en tiempo real activa' : 'Conexión por polling'}
      />
      <div className="sb-display__main">
        <aside className="sb-panel sb-panel--left">
          <div className="sb-panel__streak" />
          <Particles />
          <div className="sb-panel__inner">
            <h1 className="sb-team-name">{partido.equipo_a_nombre}</h1>
            <PlayerList jugadores={partido.equipo_a_jugadores} />
            {partido.saque_actual === 'A' ? <div className="sb-serve sb-serve--active" /> : null}
          </div>
        </aside>

        <section className="sb-center">
          <div className="sb-tournament">{torneoLabel}</div>

          {isTiebreak && (
            <div className="sb-tiebreak-badge">Tie-Break</div>
          )}

          <div
            className={`sb-point-indicator ${ultimoPunto ? 'sb-point-indicator--visible' : ''} ${ultimoPunto === 'A' ? 'sb-point-indicator--left' : 'sb-point-indicator--right'}`}
          >
            <span>POINT</span>
            <span className="sb-point-indicator__arrow">▼</span>
          </div>

          <div className="sb-score-row">
            <span className={scoreClassA}>
              {isDeuce ? 'DEUCE' : display.displayA ?? '0'}
            </span>
            <div className="sb-score-divider" />
            <span className={scoreClassB}>
              {isDeuce ? '' : display.displayB ?? '0'}
            </span>
          </div>

          <div className="sb-sets-bar">
            <div className="sb-sets-badge sb-sets-badge--blue">
              Sets {partido.sets_a}
            </div>
            <div className="sb-games-center">
              <strong>{partido.games_a}</strong>
              {' '}Games{' '}
              <strong>{partido.games_b}</strong>
            </div>
            <div className="sb-sets-badge sb-sets-badge--red">
              {partido.sets_b} Sets
            </div>
          </div>

          <SetHistory
            historial={partido.historial_sets}
            gamesA={partido.games_a}
            gamesB={partido.games_b}
            setsA={partido.sets_a}
            setsB={partido.sets_b}
          />

          <div className="sb-timer">
            ⏱ {formatTimerFromSeconds(timerSeconds)}
          </div>

          {terminado && winnerName && (
            <div className="sb-finished">
              <div className="sb-finished__title">MATCH OVER</div>
              <div className="sb-finished__winner">{winnerName}</div>
            </div>
          )}
        </section>

        <aside className="sb-panel sb-panel--right">
          <div className="sb-panel__streak" />
          <Particles />
          <div className="sb-panel__inner">
            <h1 className="sb-team-name">{partido.equipo_b_nombre}</h1>
            <PlayerList jugadores={partido.equipo_b_jugadores} />
            {partido.saque_actual === 'B' ? <div className="sb-serve sb-serve--active" /> : null}
          </div>
        </aside>
      </div>

      {sponsors.length > 0 && (
        <footer className="sb-footer">
          <div className="sb-sponsors">
            {sponsors.map((sp) => (
              <div key={sp.id} className="sb-sponsor">
                <span className="sb-sponsor__name">{sp.nombre}</span>
                {sp.categoria && <span className="sb-sponsor__cat">{sp.categoria}</span>}
              </div>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
