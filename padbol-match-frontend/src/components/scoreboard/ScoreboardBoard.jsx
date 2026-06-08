import React, { useEffect, useMemo, useState } from 'react';
import ScoreboardDramaticResultScreen from './ScoreboardDramaticResultScreen';
import ScoreboardWinnerScreen from './ScoreboardWinnerScreen';
import UniformJerseyStrip from './UniformJerseyStrip';
import { fetchJugadoresTemp } from '../../utils/scoreboardApi';
import { resolveUniformJerseyColors } from '../../utils/scoreboardUniformJersey';
import '../../styles/ScoreboardDisplay.css';

function mergeJugadoresWithTemp(jugadores, equipo, tempList) {
  const side = String(equipo || 'A').toLowerCase();
  const base = Array.isArray(jugadores) ? jugadores.slice(0, 4) : [];
  const temps = (Array.isArray(tempList) ? tempList : []).filter(
    (j) => String(j.equipo || '').toLowerCase() === side,
  );

  return [0, 1, 2, 3].map((idx) => {
    const slot = idx + 1;
    const temp = temps.find((t) => Number(t.slot) === slot);
    const baseJ = base[idx] || {};
    if (!temp) return baseJ;
    return {
      ...baseJ,
      nombre: temp.nombre || baseJ.nombre || baseJ.name,
      jersey: temp.numero ?? baseJ.jersey ?? baseJ.numero,
      numero: temp.numero ?? baseJ.numero ?? baseJ.jersey,
      foto_url: temp.foto_url || baseJ.foto_url,
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

function resolvePlayerJersey(jugador, index) {
  const raw = jugador?.jersey ?? jugador?.numero ?? jugador?.number;
  const parsed = parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 99) return parsed;
  return index + 1;
}

const HEX_SPARKLES_LEFT = [
  { x: 14, y: 16, delay: '0s' },
  { x: 38, y: 34, delay: '1.4s' },
  { x: 22, y: 58, delay: '2.8s' },
  { x: 48, y: 72, delay: '0.6s' },
  { x: 30, y: 88, delay: '3.6s' },
];

const HEX_SPARKLES_RIGHT = [
  { x: 86, y: 18, delay: '0.8s' },
  { x: 62, y: 36, delay: '2.2s' },
  { x: 78, y: 54, delay: '1.1s' },
  { x: 52, y: 70, delay: '3.2s' },
  { x: 70, y: 86, delay: '1.9s' },
];

function hexSparklePath(cx, cy, size = 1.8) {
  const s = size;
  return `M ${cx} ${cy - s} L ${cx + s * 0.866} ${cy - s * 0.5} L ${cx + s * 0.866} ${cy + s * 0.5} L ${cx} ${cy + s} L ${cx - s * 0.866} ${cy + s * 0.5} L ${cx - s * 0.866} ${cy - s * 0.5} Z`;
}

function PanelHexMesh({ variant }) {
  const patternId = `sb-hex-pattern-${variant}`;
  const sparkles = variant === 'left' ? HEX_SPARKLES_LEFT : HEX_SPARKLES_RIGHT;

  return (
    <div className="sb-panel__hex-mesh" aria-hidden="true">
      <svg className="sb-panel__hex-mesh-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <defs>
          <pattern
            id={patternId}
            x="0"
            y="0"
            width="20"
            height="34.64"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M10,0 L20,5.77 L20,17.32 L10,23.09 L0,17.32 L0,5.77 Z"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.65"
            />
            <path
              d="M10,17.32 L20,23.09 L20,34.64 L10,40.41 L0,34.64 L0,23.09 Z"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.65"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <svg
        className="sb-panel__hex-sparkles-svg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {sparkles.map((sparkle, index) => (
          <path
            key={`${variant}-sparkle-${index}`}
            className="sb-hex-sparkle"
            d={hexSparklePath(sparkle.x, sparkle.y)}
            style={{ animationDelay: sparkle.delay }}
          />
        ))}
      </svg>
    </div>
  );
}

function PlayerList({ jugadores }) {
  const list = Array.isArray(jugadores) ? jugadores.slice(0, 4) : [];
  while (list.length < 4) list.push({ nombre: '—' });

  return (
    <ul className="sb-players">
      {list.map((j, i) => {
        const jersey = resolvePlayerJersey(j, i);
        const jerseyLabel = String(jersey);
        const isTwoDigit = jerseyLabel.length >= 2;

        return (
          <li key={i} className="sb-player">
            <span className={`sb-player__num ${isTwoDigit ? 'sb-player__num--two-digit' : ''}`}>
              {jerseyLabel}
            </span>
            <span className="sb-player__name-wrap">
              {j.foto_url ? (
                <img src={j.foto_url} alt="" className="sb-player__photo" />
              ) : null}
              <span className="sb-player__name">{j.nombre ?? j.name ?? '—'}</span>
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

const TICKER_LOGO_SLOTS = 8;

function TickerLogoGroup({ groupId, items, ariaHidden = false }) {
  return (
    <div className="sb-ticker__group" aria-hidden={ariaHidden || undefined}>
      {items.map((slot) => (
        <span key={`${groupId}-logo-${slot}`} className="sb-ticker__item">
          <img
            src="/padbol-match-logo.png"
            alt={ariaHidden ? '' : 'Padbol Match'}
            className="sb-ticker__logo"
          />
        </span>
      ))}
    </div>
  );
}

function SponsorTicker() {
  const items = useMemo(
    () => Array.from({ length: TICKER_LOGO_SLOTS }, (_, index) => index),
    [],
  );

  return (
    <div className="sb-ticker" aria-label="Padbol Match">
      <div className="sb-ticker__track">
        <TickerLogoGroup groupId="a" items={items} />
        <TickerLogoGroup groupId="b" items={items} ariaHidden />
      </div>
    </div>
  );
}

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

  const jugadoresA = useMemo(
    () => mergeJugadoresWithTemp(partido.equipo_a_jugadores, 'A', jugadoresTemp),
    [partido.equipo_a_jugadores, jugadoresTemp],
  );
  const jugadoresB = useMemo(
    () => mergeJugadoresWithTemp(partido.equipo_b_jugadores, 'B', jugadoresTemp),
    [partido.equipo_b_jugadores, jugadoresTemp],
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
      <div
        className={`sb-connection ${wsConnected ? 'sb-connection--ws' : 'sb-connection--poll'}`}
        title={wsConnected ? 'WebSocket activo' : 'Actualizando por polling'}
        aria-label={wsConnected ? 'Conexión en tiempo real activa' : 'Conexión por polling'}
      />

      <div className="sb-display__main">
        <aside className="sb-panel sb-panel--left">
          <PanelHexMesh variant="left" />
          <div className="sb-panel__inner">
            <TeamNameRow
              name={partido.equipo_a_nombre}
              serving={partido.saque_actual === 'A'}
              color1={uniformA.color1}
              color2={uniformA.color2}
            />
            <PlayerList jugadores={jugadoresA} />
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
              <span>PUNTO</span>
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
                    <span className="sb-score sb-score--special">ADV</span>
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
          <PanelHexMesh variant="right" />
          <div className="sb-panel__inner">
            <TeamNameRow
              name={partido.equipo_b_nombre}
              serving={partido.saque_actual === 'B'}
              color1={uniformB.color1}
              color2={uniformB.color2}
            />
            <PlayerList jugadores={jugadoresB} />
          </div>
          {/* Reserved for future team logo / banner */}
          <div className="sb-panel__branding" aria-hidden="true" />
        </aside>
      </div>

      <footer className="sb-footer">
        <SponsorTicker />
      </footer>
    </div>
  );
}
