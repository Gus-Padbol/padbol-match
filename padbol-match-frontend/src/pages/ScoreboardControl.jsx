import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSafeTranslation } from '../i18n/tSafe';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { getDisplayName } from '../utils/displayName';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import useServerCronometro from '../hooks/useServerCronometro';
import { fetchPartido, scoreboardAction } from '../utils/scoreboardApi';
import { resolveTeamColors, teamButtonStyle } from '../utils/scoreboardTeamColors';
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

function formatPlayersLine(jugadores) {
  const list = Array.isArray(jugadores) ? jugadores.slice(0, 4) : [];
  return list.map((j) => j.nombre ?? j.name ?? '—').join(' · ');
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

function canAdminScoreboard(rol, sedeIdPartido, sedeIdUser) {
  if (!rol) return false;
  if (rol === 'super_admin' || rol === 'admin_nacional') return true;
  if ((rol === 'admin_club' || rol === 'admin_sede') && sedeIdUser != null) {
    return Number(sedeIdUser) === Number(sedeIdPartido);
  }
  return false;
}

const OPTION_ACTIONS = {
  undo: {
    label: '↩ Deshacer punto',
    path: (partidoId) => `/api/scoreboard/partidos/${partidoId}/deshacer`,
    refetchAfter: true,
  },
  saque: {
    label: '⇄ Cambiar saque',
    path: (partidoId) => `/api/scoreboard/partidos/${partidoId}/saque`,
    refetchAfter: false,
  },
  tiebreak: {
    label: 'Tie-Break',
    path: (partidoId) => `/api/scoreboard/partidos/${partidoId}/tiebreak`,
    refetchAfter: false,
  },
};

function OptionsModal({
  open,
  onClose,
  partidoId,
  terminado,
  canUndo,
  isTiebreak,
  actionLoading,
  onRunAction,
}) {
  if (!open) return null;

  const isOptionDisabled = (key) => {
    if (actionLoading || terminado) return true;
    if (key === 'undo') return !canUndo;
    if (key === 'tiebreak') return isTiebreak;
    return false;
  };

  const handleOptionClick = async (key) => {
    const config = OPTION_ACTIONS[key];
    if (!config || isOptionDisabled(key)) return;
    onClose();
    await onRunAction(config.path(partidoId), { refetchAfter: config.refetchAfter });
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

  const runAction = async (path, { refetchAfter = false } = {}) => {
    setActionLoading(true);
    setError('');
    try {
      const data = await scoreboardAction(path);
      if (refetchAfter) {
        await refreshPartido();
      } else {
        setPartido(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCronometro = (accion) => {
    runAction(
      `/api/scoreboard/partidos/${partidoId}/cronometro/${accion}`,
      { refetchAfter: true },
    );
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
  const terminado = partido.estado === 'terminado';
  const cronometroActivo = partido.display?.cronometroActivo;
  const canScorePoints = !terminado;
  const canUndo = Array.isArray(partido.historial_puntos) && partido.historial_puntos.length > 0;
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
          {partido.cancha && `${partido.cancha} · `}
          Sede #{partido.sede_id}
          {partido.saque_actual === 'A' && (
            <span className="sc-serve-indicator" title="Team A serving" />
          )}
          {partido.saque_actual === 'B' && (
            <span className="sc-serve-indicator" title="Team B serving" />
          )}
        </p>
        <div className="sc-timer-bar">
          <span className="sc-timer">⏱ {formatTimer(timerSeconds)}</span>
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
          <button
            type="button"
            className="sc-timer-btn sc-timer-btn--reset"
            disabled={actionLoading}
            onClick={() => handleCronometro('reset')}
          >
            Reset
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
          <TeamNameRow name={partido.equipo_a_nombre} serving={partido.saque_actual === 'A'} />
          <p className="sc-players-line">{formatPlayersLine(partido.equipo_a_jugadores)}</p>
          <div className="sc-game-score">
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
            onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/punto/A`, { refetchAfter: true })}
          >
            + POINT
          </button>
        </div>

        <div className="sc-team-card sc-team-card--b">
          <TeamNameRow name={partido.equipo_b_nombre} serving={partido.saque_actual === 'B'} />
          <p className="sc-players-line">{formatPlayersLine(partido.equipo_b_jugadores)}</p>
          <div className="sc-game-score">
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
            onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/punto/B`, { refetchAfter: true })}
          >
            + POINT
          </button>
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
        partidoId={partidoId}
        terminado={terminado}
        canUndo={canUndo}
        isTiebreak={partido.es_tiebreak}
        actionLoading={actionLoading}
        onRunAction={runAction}
      />
    </div>
  );
}
