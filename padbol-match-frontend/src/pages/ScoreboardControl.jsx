import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSafeTranslation } from '../i18n/tSafe';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { getDisplayName } from '../utils/displayName';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import useServerCronometro from '../hooks/useServerCronometro';
import { fetchPartido, scoreboardAction } from '../utils/scoreboardApi';
import { resolveTeamColors, teamButtonStyle } from '../utils/scoreboardTeamColors';
import {
  listVisibleScoreboardJugadores,
  getScoreboardJerseyLabel,
  scoreboardPlayerName,
} from '../utils/scoreboardPlayers';
import { formatScoreboardVenueHeader } from '../utils/scoreboardVenueLabels';
import '../styles/ScoreboardControl.css';

function formatTimer(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatGameScore(display, side) {
  if (display.mode === 'deuce') return 'DEUCE';
  const val = side === 'A' ? display.displayA : display.displayB;
  if (val === 'VENT.') return 'ADV';
  return val ?? '0';
}

function gameScoreClassName(display, side) {
  const score = formatGameScore(display, side);
  if (score === 'DEUCE') return 'sc-game-score sc-game-score--deuce';
  if (score === 'ADV') return 'sc-game-score sc-game-score--adv';
  return 'sc-game-score';
}

/** Solo jugadores registrados (2–4). Sin placeholders ni huecos. */
function TeamPlayersBlock({ jugadores }) {
  const list = listVisibleScoreboardJugadores(jugadores, 4);

  if (list.length === 0) {
    return <ul className="sc-players" aria-label="Jugadores" />;
  }

  return (
    <ul className="sc-players" aria-label="Jugadores">
      {list.map((j, i) => {
        const name = scoreboardPlayerName(j);
        const num = getScoreboardJerseyLabel(j);
        return (
          <li key={`${name}-${j.slot ?? i}`} className="sc-player">
            {num != null ? <span className="sc-player__num">{num}</span> : null}
            <span className="sc-player__name" title={name}>{name}</span>
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
    <div className="sc-team-name-row">
      {serving ? <span className="sc-team-serve-dot" aria-label="Serving" title="Serving" /> : null}
      <h2 className="sc-team-name">{name}</h2>
    </div>
  );
}

function isCronometroPausado(partido) {
  const raw = partido?.cronometro_pausado;
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  return Boolean(raw);
}

function isCronometroRunning(partido) {
  return Boolean(partido?.display?.cronometroActivo) && !isCronometroPausado(partido);
}

function isMatchFinished(partido) {
  const estado = String(partido?.estado || '').toLowerCase();
  if (estado === 'terminado' || estado === 'finalizado') return true;
  return Number(partido?.sets_a) >= 2 || Number(partido?.sets_b) >= 2;
}

function canAdminScoreboard(rol, sedeIdPartido, sedeIdUser) {
  if (!rol) return false;
  if (rol === 'super_admin' || rol === 'admin_nacional') return true;
  if ((rol === 'admin_club' || rol === 'admin_sede') && sedeIdUser != null) {
    return Number(sedeIdUser) === Number(sedeIdPartido);
  }
  return false;
}

const OPTION_ACTIONS = {
  saque: {
    label: '⇄ Cambiar saque',
    path: (id) => `/api/scoreboard/partidos/${encodeURIComponent(String(id))}/saque`,
    refetchAfter: false,
  },
  tiebreak: {
    label: 'Tie-Break',
    path: (id) => `/api/scoreboard/partidos/${encodeURIComponent(String(id))}/tiebreak`,
    refetchAfter: false,
  },
  reset: {
    label: '🔄 Resetear partido',
    path: (partidoId) => `/api/scoreboard/partidos/${encodeURIComponent(String(partidoId))}/cronometro/reset`,
    refetchAfter: true,
  },
};

function OptionsModal({
  open,
  onClose,
  partidoId,
  terminado,
  isTiebreak,
  actionLoading,
  onRunAction,
  onUndo,
  undoCount,
}) {
  if (!open) return null;

  const isOptionDisabled = (key) => {
    if (actionLoading) return true;
    if (key === 'reset') return false;
    if (terminado) return true;
    if (key === 'tiebreak') return isTiebreak;
    return false;
  };

  const handleOptionClick = async (key) => {
    const config = OPTION_ACTIONS[key];
    if (!config || isOptionDisabled(key)) return;
    onClose();
    await onRunAction(config.path(partidoId), {
      refetchAfter: config.refetchAfter,
    });
  };

  return (
    <div
      className="sc-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="sc-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-options-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sc-options-title" className="sc-modal-sheet__title">Opciones</h2>
        <div className="sc-modal-options">
          {Object.entries(OPTION_ACTIONS).map(([key, config]) => (
            <button
              key={key}
              type="button"
              className="sc-modal-option-btn"
              disabled={isOptionDisabled(key)}
              onClick={() => handleOptionClick(key)}
            >
              {config.label}
            </button>
          ))}
          <button
            type="button"
            className="sc-modal-option-btn sc-modal-option-btn--undo"
            disabled={undoCount <= 0}
            onClick={() => {
              console.log('UNDO CLICKED');
              onUndo();
            }}
          >
            {`↩ Undo (${undoCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScoreboardControl() {
  const { t } = useSafeTranslation();
  const { partidoId } = useParams();
  const navigate = useNavigate();
  const { session, userProfile } = useAuth();

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return {
      email: em,
      nombre: getDisplayName(userProfile, session),
    };
  }, [session, userProfile]);

  const { rol, sedeId: userSedeId, loading: roleLoading } = useUserRole(currentCliente);

  const [partido, setPartido] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const autoPauseDoneRef = useRef(null);
  const runActionRef = useRef(null);

  const handleUpdate = useCallback((payload) => {
    setPartido(payload);
  }, []);

  useScoreboardSocket(partidoId, handleUpdate);
  const timerSeconds = useServerCronometro(partido);

  useEffect(() => {
    if (roleLoading) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchPartido(partidoId);
        if (!cancelled) {
          if (!canAdminScoreboard(rol, p.sede_id, userSedeId)) {
            setError(t('scoreboard.noPermission', 'No tenés permiso para controlar este scoreboard'));
            setLoading(false);
            return;
          }
          setPartido(p);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [partidoId, rol, userSedeId, roleLoading, t]);

  const refreshPartido = useCallback(async () => {
    const p = await fetchPartido(partidoId);
    setPartido(p);
    return p;
  }, [partidoId]);

  useEffect(() => {
    if (!partido) return undefined;
    const count = Array.isArray(partido.historial_puntos) ? partido.historial_puntos.length : 0;
    setUndoCount(count);
    return undefined;
  }, [partido]);

  const resolvePartidoApiId = useCallback(() => {
    const id = partido?.id ?? partidoId;
    return encodeURIComponent(String(id || '').trim());
  }, [partido?.id, partidoId]);

  const runAction = useCallback(async (path, { refetchAfter = false } = {}) => {
    setActionLoading(true);
    setError('');
    try {
      console.log('[ScoreboardControl] action:', path);
      const data = await scoreboardAction(path);
      if (refetchAfter) {
        await refreshPartido();
      } else {
        setPartido(data);
      }
      return true;
    } catch (err) {
      console.error('[ScoreboardControl] action failed:', {
        path,
        partidoId: partido?.id ?? partidoId,
        message: err?.message || err,
      });
      setError(err?.message || 'Error en la acción');
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [partido?.id, partidoId, refreshPartido]);

  runActionRef.current = runAction;

  useEffect(() => {
    if (!partido?.id) return undefined;
    if (!isMatchFinished(partido)) {
      autoPauseDoneRef.current = null;
      return undefined;
    }
    if (!isCronometroRunning(partido)) return undefined;
    if (autoPauseDoneRef.current === partido.id) return undefined;

    autoPauseDoneRef.current = partido.id;
    const path = `/api/scoreboard/partidos/${encodeURIComponent(partido.id)}/cronometro/pause`;
    void runActionRef.current?.(path, { refetchAfter: false });
    return undefined;
  }, [partido]);

  const handleUndo = useCallback(async () => {
    if (!partido?.id || undoCount <= 0) return;
    const path = `/api/scoreboard/partidos/${encodeURIComponent(partido.id)}/undo`;
    const ok = await runAction(path, { refetchAfter: true });
    if (ok) setOptionsOpen(false);
  }, [partido?.id, undoCount, runAction]);

  const handleCronometro = (accion) => {
    const path = `/api/scoreboard/partidos/${resolvePartidoApiId()}/cronometro/${accion}`;
    runAction(path, { refetchAfter: accion === 'reset' });
  };

  if (roleLoading || loading) {
    return (
      <div className="sc-control">
        <div className="sc-loading">Loading...</div>
      </div>
    );
  }

  if (!partido && error) {
    return (
      <div className="sc-control">
        <div className="sc-error">{error}</div>
        <button type="button" className="sc-secondary-btn" onClick={() => navigate('/admin')}>
          {t('scoreboard.backAdmin', 'Volver al admin')}
        </button>
      </div>
    );
  }

  const display = partido.display || {};
  const terminado = isMatchFinished(partido);
  const cronometroActivo = isCronometroRunning(partido);
  const canScorePoints = !terminado;
  const torneoLabel = getTorneoLabel(partido);
  const { colorA, colorB } = resolveTeamColors(partido);

  const winnerName = partido.sets_a >= 2
    ? partido.equipo_a_nombre
    : partido.sets_b >= 2
      ? partido.equipo_b_nombre
      : null;

  return (
    <div className="sc-control">
      <header className="sc-header">
        <p className="sc-header__torneo">{torneoLabel}</p>
        <h1 className="sc-header__title">
          {partido.equipo_a_nombre} vs {partido.equipo_b_nombre}
        </h1>
        <p className="sc-header__meta">
          {formatScoreboardVenueHeader(partido)}
          {partido.saque_actual === 'A' && (
            <span className="sc-serve-indicator" title="Team A serving" />
          )}
          {partido.saque_actual === 'B' && (
            <span className="sc-serve-indicator" title="Team B serving" />
          )}
        </p>
        <div className="sc-timer-bar">
          <span className="sc-timer">{formatTimer(timerSeconds)}</span>
          <button
            type="button"
            className="sc-timer-btn sc-timer-btn--start"
            disabled={actionLoading || terminado || cronometroActivo}
            onClick={() => handleCronometro('start')}
          >
            Start
          </button>
          <button
            type="button"
            className="sc-timer-btn sc-timer-btn--pause"
            disabled={actionLoading || terminado || !cronometroActivo}
            onClick={() => handleCronometro('pause')}
          >
            Pause
          </button>
        </div>
      </header>

      {error && <div className="sc-error">{error}</div>}

      {terminado && winnerName && (
        <div className="sc-finished-banner">
          <h2>MATCH OVER</h2>
          <p className="sc-finished-banner__winner">{winnerName}</p>
        </div>
      )}

      <div className="sc-columns">
        <div className="sc-team-card sc-team-card--a">
          <div className="sc-team-card__header">
            <TeamNameRow name={partido.equipo_a_nombre} serving={partido.saque_actual === 'A'} />
            <TeamPlayersBlock jugadores={partido.equipo_a_jugadores} />
          </div>
          <div className="sc-team-card__score-block">
            <div className={gameScoreClassName(display, 'A')}>
              {formatGameScore(display, 'A')}
            </div>
            <div className="sc-stats">
              <div>
                <strong>{partido.games_a}</strong>
                Games
              </div>
              <div>
                <strong>{partido.sets_a}</strong>
                Sets
              </div>
            </div>
            <button
              type="button"
              className="sc-point-btn sc-point-btn--a"
              style={teamButtonStyle(colorA)}
              disabled={actionLoading || terminado || !canScorePoints}
              onClick={() => runAction(
                `/api/scoreboard/partidos/${resolvePartidoApiId()}/punto/A`,
                { refetchAfter: true },
              )}
            >
              + POINT
            </button>
          </div>
        </div>

        <div className="sc-team-card sc-team-card--b">
          <div className="sc-team-card__header">
            <TeamNameRow name={partido.equipo_b_nombre} serving={partido.saque_actual === 'B'} />
            <TeamPlayersBlock jugadores={partido.equipo_b_jugadores} />
          </div>
          <div className="sc-team-card__score-block">
            <div className={gameScoreClassName(display, 'B')}>
              {formatGameScore(display, 'B')}
            </div>
            <div className="sc-stats">
              <div>
                <strong>{partido.games_b}</strong>
                Games
              </div>
              <div>
                <strong>{partido.sets_b}</strong>
                Sets
              </div>
            </div>
            <button
              type="button"
              className="sc-point-btn sc-point-btn--b"
              style={teamButtonStyle(colorB)}
              disabled={actionLoading || terminado || !canScorePoints}
              onClick={() => runAction(
                `/api/scoreboard/partidos/${resolvePartidoApiId()}/punto/B`,
                { refetchAfter: true },
              )}
            >
              + POINT
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="sc-options-btn"
        disabled={actionLoading}
        onClick={() => setOptionsOpen(true)}
      >
        ⚙️ Opciones
      </button>

      <OptionsModal
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        partidoId={partido?.id ?? partidoId}
        terminado={terminado}
        isTiebreak={partido.es_tiebreak}
        actionLoading={actionLoading}
        onRunAction={runAction}
        onUndo={handleUndo}
        undoCount={undoCount}
      />
    </div>
  );
}
