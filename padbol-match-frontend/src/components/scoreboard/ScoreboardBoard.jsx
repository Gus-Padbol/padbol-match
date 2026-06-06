import React, { useMemo } from 'react';
import ScoreboardWinnerScreen from './ScoreboardWinnerScreen';
import '../../styles/ScoreboardDisplay.css';

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
            <span className="sb-player__name">{j.nombre ?? j.name ?? '—'}</span>
          </li>
        );
      })}
    </ul>
  );
}

function getTorneoLabel(partido) {
  const name = String(partido?.torneo_nombre || '').trim();
  return name || 'Partido amistoso';
}

function TeamNameRow({ name, serving }) {
  return (
    <div className="sb-team-name-row">
      {serving ? <span className="sb-team-serve-dot" aria-label="Serving" title="Serving" /> : null}
      <h1 className="sb-team-name">{name}</h1>
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

    return (
      <div key={`set-${setNum}`} className={itemClass}>
        <span className="sb-set-label">{`SET ${setNum}`}</span>
        <div className={chipClass}>{content}</div>
      </div>
    );
  });

  return <div className="sb-sets-history">{chips}</div>;
}

const DEMO_SPONSOR_NAMES = [
  'PADBOL',
  'FIPA',
  'BULLPADEL',
  'GATORADE',
  'POWERADE',
  'NOBLEX',
  'ESPN',
  'ADIDAS',
];

function SponsorTicker({ names }) {
  const items = useMemo(() => {
    const list = (Array.isArray(names) ? names : [])
      .map((name) => String(name || '').trim())
      .filter(Boolean);
    return list.length > 0 ? list : DEMO_SPONSOR_NAMES;
  }, [names]);

  const trackItems = [...items, ...items];

  return (
    <div className="sb-ticker" aria-label="Sponsors">
      <div className="sb-ticker__track">
        {trackItems.map((name, index) => (
          <span key={`${name}-${index}`} className="sb-ticker__item">
            {name}
          </span>
        ))}
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
  const torneoLabel = getTorneoLabel(partido);
  const isDeuce = display.mode === 'deuce';
  const isVentaja = display.displayA === 'VENT.' || display.displayB === 'VENT.';
  const ventajaText = display.displayA === 'VENT.' || display.displayB === 'VENT.' ? 'ADV' : null;
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
  const sponsorNames = useMemo(
    () => (sponsors.length > 0
      ? sponsors.map((sp) => sp.nombre).filter(Boolean)
      : DEMO_SPONSOR_NAMES),
    [sponsors],
  );

  if (terminado && winnerName) {
    return (
      <ScoreboardWinnerScreen
        partido={partido}
        timerSeconds={timerSeconds}
        onDismiss={onWinnerDismiss}
      />
    );
  }

  return (
    <div className="sb-display">
      <div
        className={`sb-connection ${wsConnected ? 'sb-connection--ws' : 'sb-connection--poll'}`}
        title={wsConnected ? 'WebSocket activo' : 'Actualizando por polling'}
        aria-label={wsConnected ? 'Conexión en tiempo real activa' : 'Conexión por polling'}
      />

      <div className="sb-display__main">
        <aside className="sb-panel sb-panel--left">
          <div className="sb-panel__inner">
            <TeamNameRow name={partido.equipo_a_nombre} serving={partido.saque_actual === 'A'} />
            <PlayerList jugadores={partido.equipo_a_jugadores} />
          </div>
          {/* Reserved for future team logo / banner */}
          <div className="sb-panel__branding" aria-hidden="true" />
        </aside>

        <section className="sb-center">
          <div className="sb-tournament">{torneoLabel}</div>

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
                <span className="sb-score sb-score--special">
                  {isDeuce ? 'DEUCE' : ventajaText}
                </span>
              </div>
            ) : (
              <div className="sb-score-row">
                <span className={scoreClassA}>{display.displayA ?? '0'}</span>
                <div className="sb-score-divider" />
                <span className={scoreClassB}>{display.displayB ?? '0'}</span>
              </div>
            )}

            <div className="sb-timer">
              {formatTimerFromSeconds(timerSeconds)}
            </div>

            <SetHistory
              historial={partido.historial_sets}
              gamesA={partido.games_a}
              gamesB={partido.games_b}
              setsA={partido.sets_a}
              setsB={partido.sets_b}
            />
          </div>
        </section>

        <aside className="sb-panel sb-panel--right">
          <div className="sb-panel__inner">
            <TeamNameRow name={partido.equipo_b_nombre} serving={partido.saque_actual === 'B'} />
            <PlayerList jugadores={partido.equipo_b_jugadores} />
          </div>
          {/* Reserved for future team logo / banner */}
          <div className="sb-panel__branding" aria-hidden="true" />
        </aside>
      </div>

      <footer className="sb-footer">
        <SponsorTicker names={sponsorNames} />
      </footer>
    </div>
  );
}
