import React, { useEffect, useMemo, useState } from 'react';
import ScoreboardDramaticResultScreen from './ScoreboardDramaticResultScreen';
import ScoreboardWinnerScreen from './ScoreboardWinnerScreen';
import UniformJerseyStrip from './UniformJerseyStrip';
import { fetchJugadoresTemp } from '../../utils/scoreboardApi';
import {
  listVisibleScoreboardJugadores,
  getScoreboardJerseyLabel,
  scoreboardPlayerName,
} from '../../utils/scoreboardPlayers';
import { resolveUniformJerseyColors } from '../../utils/scoreboardUniformJersey';
import '../../styles/ScoreboardDisplay.css';

function mergeJugadoresWithTemp(jugadores, equipo, tempList, jerseyFields = []) {
  const side = String(equipo || 'A').toLowerCase();
  const list = Array.isArray(jugadores) ? jugadores : [];
  const bySlot = new Map();
  list.forEach((j, idx) => {
    const slot = Number(j?.slot);
    const key = Number.isFinite(slot) && slot >= 1 && slot <= 4 ? slot : idx + 1;
    if (key >= 1 && key <= 4) bySlot.set(key, j);
  });
  const temps = (Array.isArray(tempList) ? tempList : []).filter(
    (j) => String(j.equipo || '').toLowerCase() === side,
  );

  return [1, 2, 3, 4].map((slot) => {
    const baseJ = bySlot.get(slot) || {};
    const temp = temps.find((t) => Number(t.slot) === slot);
    const nombre = scoreboardPlayerName(temp) || scoreboardPlayerName(baseJ);
    const partidoJersey = jerseyFields[slot - 1];
    const jersey = temp?.numero ?? baseJ.jersey ?? baseJ.numero ?? partidoJersey ?? null;

    return {
      ...baseJ,
      slot,
      nombre,
      jersey,
      numero: jersey,
      foto_url: temp?.foto_url || baseJ.foto_url || '',
    };
  });
}

function formatTimerFromSeconds(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const HEX_CLUSTER_SIZE = 320;
const HEX_RADIUS = 18;
const HEX_GRID_COLS = 7;
const HEX_GRID_ROWS = 7;

function hexagonPath(cx, cy, radius) {
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = ((Math.PI * 2) / 6) * index - Math.PI / 2;
    return [
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
    ];
  });
  return `M ${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ')} Z`;
}

function buildHexClusterGrid(anchor) {
  const horizStep = Math.sqrt(3) * HEX_RADIUS;
  const vertStep = 1.5 * HEX_RADIUS;
  const margin = HEX_RADIUS;
  const hexes = [];

  for (let row = 0; row < HEX_GRID_ROWS; row += 1) {
    for (let col = 0; col < HEX_GRID_COLS; col += 1) {
      const rowOffset = (row % 2) * (horizStep / 2);
      let cx;
      let cy;

      if (anchor === 'top-right') {
        cx = HEX_CLUSTER_SIZE - margin - col * horizStep - rowOffset;
        cy = margin + row * vertStep;
      } else {
        cx = margin + col * horizStep + rowOffset;
        cy = HEX_CLUSTER_SIZE - margin - row * vertStep;
      }

      hexes.push({ key: `${anchor}-${row}-${col}`, cx, cy });
    }
  }

  return hexes;
}

function HexClusterSvg({ variant, stroke }) {
  const hexes = useMemo(
    () => buildHexClusterGrid(variant),
    [variant],
  );

  return (
    <svg
      className={`sb-hex-cluster sb-hex-cluster--${variant}`}
      xmlns="http://www.w3.org/2000/svg"
      width={HEX_CLUSTER_SIZE}
      height={HEX_CLUSTER_SIZE}
      viewBox={`0 0 ${HEX_CLUSTER_SIZE} ${HEX_CLUSTER_SIZE}`}
      aria-hidden="true"
    >
      {hexes.map((hex) => (
        <path
          key={hex.key}
          d={hexagonPath(hex.cx, hex.cy, HEX_RADIUS)}
          fill="none"
          stroke={stroke}
          strokeWidth="0.8"
        />
      ))}
    </svg>
  );
}

function playerInitial(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts[0].slice(0, 1).toUpperCase();
}

function PlayerList({ jugadores, teamSide = 'left' }) {
  const avatarClass = teamSide === 'right' ? 'sb-player__avatar--right' : 'sb-player__avatar--left';
  // Solo registrados con identidad (nombre). No rellenar a 4 ni renderizar placeholders.
  const list = listVisibleScoreboardJugadores(jugadores, 4);

  if (list.length === 0) {
    return <ul className="sb-players" aria-label="Jugadores" />;
  }

  return (
    <ul className="sb-players" aria-label="Jugadores">
      {list.map((j, i) => {
        const jerseyLabel = getScoreboardJerseyLabel(j);
        const isTwoDigit = jerseyLabel != null && jerseyLabel.length >= 2;
        const displayName = scoreboardPlayerName(j);
        const fotoUrl = String(j.foto_url || '').trim();

        return (
          <li key={`${displayName}-${j.slot ?? i}`} className="sb-player">
            <span className={`sb-player__avatar ${avatarClass}`}>
              {fotoUrl ? (
                <img src={fotoUrl} alt="" className="sb-player__avatar-img" />
              ) : (
                <span className="sb-player__avatar-initial" aria-hidden="true">
                  {playerInitial(displayName)}
                </span>
              )}
            </span>
            {jerseyLabel != null ? (
              <span className={`sb-player__num ${isTwoDigit ? 'sb-player__num--two-digit' : ''}`}>
                {jerseyLabel}
              </span>
            ) : null}
            <span className="sb-player__name-wrap">
              <span className="sb-player__name">{displayName}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function formatTorneoNombreLines(text) {
  const normalized = String(text || '').trim().toUpperCase();
  if (!normalized) return [];
  if (normalized.length <= 20) return [normalized];

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const mid = Math.ceil(normalized.length / 2);
    return [normalized.slice(0, mid), normalized.slice(mid)].filter(Boolean);
  }

  const totalLen = normalized.length;
  let bestSplit = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const line1 = words.slice(0, i).join(' ');
    const diff = Math.abs(line1.length - totalLen / 2);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }

  const line1 = words.slice(0, bestSplit).join(' ');
  const line2 = words.slice(bestSplit).join(' ');
  return line2 ? [line1, line2] : [line1];
}

function TournamentBrand({ torneoNombre, logoTorneoUrl }) {
  const hasTorneoNombre = Boolean(String(torneoNombre || '').trim());
  const hasTorneoLogo = Boolean(String(logoTorneoUrl || '').trim());
  if (!hasTorneoNombre && !hasTorneoLogo) return null;

  const torneoLines = hasTorneoNombre ? formatTorneoNombreLines(torneoNombre) : [];

  return (
    <div className={`sb-tournament-brand${hasTorneoLogo && hasTorneoNombre ? ' sb-tournament-brand--logo-and-name' : ''}`}>
      {hasTorneoLogo ? (
        <img
          src={logoTorneoUrl}
          alt=""
          className="sb-tournament-brand__torneo-logo"
        />
      ) : null}
      {hasTorneoNombre ? (
        <div className={`sb-tournament-brand__name${hasTorneoLogo ? ' sb-tournament-brand__name--small' : ''}`}>
          {torneoLines.map((line, index) => (
            <span key={`${line}-${index}`} className="sb-tournament-brand__name-line">{line}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TeamNameRow({ name, serving, color1, color2 }) {
  return (
    <div className="sb-team-name-block">
      <h1 className="sb-team-name">{name}</h1>
      <div className="sb-team-name-meta">
        {serving ? <span className="sb-team-serve-dot" aria-label="Serving" title="Serving" /> : null}
        <UniformJerseyStrip color1={color1} color2={color2} size="tv" />
      </div>
    </div>
  );
}

function SetHistory({ historial, gamesA, gamesB, setsA, setsB }) {
  const completedSets = Array.isArray(historial) ? historial : [];
  const currentSetNum = completedSets.length + 1;
  const matchOngoing = setsA < 2 && setsB < 2;

  const chips = [1, 2, 3].map((setNum) => {
    const completed = completedSets.find((s, idx) => (s.set ?? idx + 1) === setNum);
    const isCurrent = matchOngoing && setNum === currentSetNum && !completed;

    let content = '–';
    let chipClass = 'sb-set-box sb-set-box--future';
    let itemClass = 'sb-set-history-item sb-set-history-item--future';

    if (completed) {
      const aWins = completed.a > completed.b;
      chipClass = 'sb-set-box sb-set-box--done';
      itemClass = 'sb-set-history-item';
      content = (
        <>
          <span className={aWins ? 'sb-set-box__winner' : 'sb-set-box__loser'}>{completed.a}</span>
          {' – '}
          <span className={!aWins ? 'sb-set-box__winner' : 'sb-set-box__loser'}>{completed.b}</span>
        </>
      );
    } else if (isCurrent) {
      chipClass = 'sb-set-box sb-set-box--active';
      itemClass = 'sb-set-history-item';
      content = (
        <>
          <span>{gamesA}</span>
          {' – '}
          <span>{gamesB}</span>
        </>
      );
    }

    const labelClass = isCurrent
      ? 'sb-set-label sb-set-label--active'
      : !completed && itemClass.includes('future')
        ? 'sb-set-label sb-set-label--future'
        : 'sb-set-label';

    return (
      <div key={`set-${setNum}`} className={itemClass}>
        <span className={labelClass}>{`SET ${setNum}`}</span>
        <div className={chipClass}>{content}</div>
      </div>
    );
  });

  return <div className="sb-sets-history">{chips}</div>;
}

const TICKER_LOGO_COUNT = 4;

const TICKER_LOGOS = Array.from({ length: TICKER_LOGO_COUNT * 2 }, (_, index) => index);

export default function ScoreboardBoard({
  partido,
  sponsors = [],
  wsConnected = false,
  timerSeconds = 0,
  onWinnerDismiss,
}) {
  const display = partido.display || {};
  const torneoNombre = String(partido?.torneo_nombre || '').trim();
  const logoTorneoUrl = String(partido?.logo_torneo_url || '').trim();
  const hasTorneoBrand = Boolean(torneoNombre || logoTorneoUrl);
  const isDeuce = display.mode === 'deuce';
  const isVentaja = display.displayA === 'VENT.' || display.displayB === 'VENT.';
  const ventajaTeamName = display.displayA === 'VENT.'
    ? partido.equipo_a_nombre
    : display.displayB === 'VENT.'
      ? partido.equipo_b_nombre
      : null;
  const isTiebreak = partido.es_tiebreak;
  const isSingleCenterScore = isDeuce || isVentaja;
  const ultimoPunto = partido.ultimo_punto;
  const terminado = partido.estado === 'terminado';
  const winnerName = partido.sets_a >= 2
    ? partido.equipo_a_nombre
    : partido.sets_b >= 2
      ? partido.equipo_b_nombre
      : null;

  const scoreClassA = isDeuce ? 'sb-score sb-score--deuce' : display.displayA === 'VENT.' ? 'sb-score sb-score--vent' : 'sb-score';
  const scoreClassB = isDeuce ? 'sb-score sb-score--deuce' : display.displayB === 'VENT.' ? 'sb-score sb-score--vent' : 'sb-score';
  const uniformA = resolveUniformJerseyColors(partido, 'A');
  const uniformB = resolveUniformJerseyColors(partido, 'B');
  const [jugadoresTemp, setJugadoresTemp] = useState([]);
  const [showConfettiWinner, setShowConfettiWinner] = useState(false);

  const jerseyFieldsA = useMemo(
    () => [partido.jersey_a1, partido.jersey_a2, partido.jersey_a3, partido.jersey_a4],
    [partido.jersey_a1, partido.jersey_a2, partido.jersey_a3, partido.jersey_a4],
  );
  const jerseyFieldsB = useMemo(
    () => [partido.jersey_b1, partido.jersey_b2, partido.jersey_b3, partido.jersey_b4],
    [partido.jersey_b1, partido.jersey_b2, partido.jersey_b3, partido.jersey_b4],
  );

  const jugadoresA = useMemo(
    () => mergeJugadoresWithTemp(partido.equipo_a_jugadores, 'A', jugadoresTemp, jerseyFieldsA),
    [partido.equipo_a_jugadores, jugadoresTemp, jerseyFieldsA],
  );
  const jugadoresB = useMemo(
    () => mergeJugadoresWithTemp(partido.equipo_b_jugadores, 'B', jugadoresTemp, jerseyFieldsB),
    [partido.equipo_b_jugadores, jugadoresTemp, jerseyFieldsB],
  );

  useEffect(() => {
    if (!partido?.id || terminado) {
      setJugadoresTemp([]);
      return undefined;
    }

    let cancelled = false;
    const loadTempJugadores = async () => {
      try {
        const rows = await fetchJugadoresTemp(partido.id);
        if (!cancelled) setJugadoresTemp(rows);
      } catch {
        /* polling silencioso */
      }
    };

    void loadTempJugadores();
    const intervalId = window.setInterval(loadTempJugadores, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [partido?.id, terminado]);

  useEffect(() => {
    if (!terminado || !winnerName) {
      setShowConfettiWinner(false);
      return undefined;
    }
    setShowConfettiWinner(false);
    const id = window.setTimeout(() => setShowConfettiWinner(true), 4000);
    return () => window.clearTimeout(id);
  }, [terminado, winnerName, partido?.id]);

  if (terminado && winnerName) {
    if (!showConfettiWinner) {
      return <ScoreboardDramaticResultScreen partido={partido} />;
    }
    return (
      <ScoreboardWinnerScreen
        partido={partido}
        timerSeconds={timerSeconds}
        onDismiss={onWinnerDismiss}
      />
    );
  }

  return (
    <div className={`sb-display${hasTorneoBrand ? ' sb-display--has-torneo' : ''}`}>
      <div className="sb-display__overlay" aria-hidden="true">
        <HexClusterSvg variant="top-right" stroke="rgba(100,180,255,0.12)" />
        <HexClusterSvg variant="bottom-left" stroke="rgba(255,100,100,0.12)" />
      </div>
      <div
        className={`sb-connection ${wsConnected ? 'sb-connection--ws' : 'sb-connection--poll'}`}
        title={wsConnected ? 'WebSocket active' : 'Updating via polling'}
        aria-label={wsConnected ? 'Real-time connection active' : 'Polling connection'}
      />

      <div className="sb-display__main">
        <aside className="sb-panel sb-panel--left">
          <div className="sb-panel__inner">
            <TeamNameRow
              name={partido.equipo_a_nombre}
              serving={partido.saque_actual === 'A'}
              color1={uniformA.color1}
              color2={uniformA.color2}
            />
            <PlayerList jugadores={jugadoresA} teamSide="left" />
          </div>
          {/* Reserved for future team logo / banner */}
          <div className="sb-panel__branding" aria-hidden="true" />
        </aside>

        <section className="sb-center">
          <TournamentBrand torneoNombre={torneoNombre} logoTorneoUrl={logoTorneoUrl} />

          <div className="sb-center__block">
            {isTiebreak && <div className="sb-tiebreak-badge">Tie-Break</div>}

            <div
              className={`sb-point-indicator ${ultimoPunto ? 'sb-point-indicator--visible' : ''}`}
            >
              <span className="sb-point-indicator__triangle" aria-hidden="true" />
              <span>POINT</span>
            </div>

            {isSingleCenterScore ? (
              <div className="sb-score-row">
                {isDeuce ? (
                  <span className="sb-score sb-score--special">DEUCE</span>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <span className="sb-score sb-score--special">ADVANTAGE</span>
                    {ventajaTeamName ? (
                      <span
                        style={{
                          fontSize: '2vw',
                          color: 'rgba(255, 255, 255, 0.7)',
                          textAlign: 'center',
                          marginTop: '1vh',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                        }}
                      >
                        {ventajaTeamName}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <div className="sb-score-row">
                <span className={scoreClassA}>{display.displayA ?? '0'}</span>
                <div className="sb-score-divider" />
                <span className={scoreClassB}>{display.displayB ?? '0'}</span>
              </div>
            )}

            <SetHistory
              historial={partido.historial_sets}
              gamesA={partido.games_a}
              gamesB={partido.games_b}
              setsA={partido.sets_a}
              setsB={partido.sets_b}
            />

            <div className="sb-timer">
              {formatTimerFromSeconds(timerSeconds)}
            </div>
          </div>
        </section>

        <aside className="sb-panel sb-panel--right">
          <div className="sb-panel__inner">
            <TeamNameRow
              name={partido.equipo_b_nombre}
              serving={partido.saque_actual === 'B'}
              color1={uniformB.color1}
              color2={uniformB.color2}
            />
            <PlayerList jugadores={jugadoresB} teamSide="right" />
          </div>
          {/* Reserved for future team logo / banner */}
          <div className="sb-panel__branding" aria-hidden="true" />
        </aside>
      </div>

      <footer className="sb-footer" aria-label="Padbol Match">
        <div className="sb-ticker-track">
          <div className="sb-ticker-content">
            {TICKER_LOGOS.map((index) => (
              <img
                key={`ticker-logo-${index}`}
                src="/brand/padbol-match-logo-on-dark.png"
                alt={index === 0 ? 'Padbol Match' : ''}
                className="sb-ticker-logo"
              />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
