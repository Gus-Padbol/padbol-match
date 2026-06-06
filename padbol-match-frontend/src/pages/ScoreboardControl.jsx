import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSafeTranslation } from '../i18n/tSafe';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { getDisplayName } from '../utils/displayName';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import useServerCronometro from '../hooks/useServerCronometro';
import { fetchPartido, scoreboardAction } from '../utils/scoreboardApi';
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
  if (val === 'VENT.') return 'VENTAJA';
  return val ?? '0';
}

function canAdminScoreboard(rol, sedeIdPartido, sedeIdUser) {
  if (!rol) return false;
  if (rol === 'super_admin' || rol === 'admin_nacional') return true;
  if ((rol === 'admin_club' || rol === 'admin_sede') && sedeIdUser != null) {
    return Number(sedeIdUser) === Number(sedeIdPartido);
  }
  return false;
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

  const runAction = async (path) => {
    setActionLoading(true);
    setError('');
    try {
      const data = await scoreboardAction(path);
      setPartido(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCronometro = (accion) => {
    runAction(`/api/scoreboard/partidos/${partidoId}/cronometro/${accion}`);
  };

  if (roleLoading || loading) {
    return (
      <div className="sc-control">
        <div className="sc-loading">{t('scoreboard.loading', 'Cargando...')}</div>
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
  const canScorePoints = partido.estado === 'en_curso' && partido.cronometro_pausado === false;
  const canUndo = Array.isArray(partido.historial_puntos) && partido.historial_puntos.length > 0;

  const winnerName = partido.sets_a >= 2
    ? partido.equipo_a_nombre
    : partido.sets_b >= 2
      ? partido.equipo_b_nombre
      : null;

  return (
    <div className="sc-control">
      <header className="sc-header">
        <h1 className="sc-header__title">
          {partido.equipo_a_nombre} vs {partido.equipo_b_nombre}
        </h1>
        <p className="sc-header__meta">
          {partido.cancha && `${partido.cancha} · `}
          {t('scoreboard.sede', 'Sede')} #{partido.sede_id}
          {partido.saque_actual === 'A' && (
            <span className="sc-serve-indicator" title={t('scoreboard.serveA', 'Saque equipo A')} />
          )}
          {partido.saque_actual === 'B' && (
            <span className="sc-serve-indicator" title={t('scoreboard.serveB', 'Saque equipo B')} />
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
            {t('scoreboard.start', 'START')}
          </button>
          <button
            type="button"
            className="sc-timer-btn sc-timer-btn--pause"
            disabled={actionLoading || terminado || !cronometroActivo}
            onClick={() => handleCronometro('pause')}
          >
            {t('scoreboard.pause', 'PAUSE')}
          </button>
          <button
            type="button"
            className="sc-timer-btn sc-timer-btn--reset"
            disabled={actionLoading}
            onClick={() => handleCronometro('reset')}
          >
            {t('scoreboard.reset', 'RESET')}
          </button>
        </div>
      </header>

      {error && <div className="sc-error">{error}</div>}

      {terminado && winnerName && (
        <div className="sc-finished-banner">
          <h2>{t('scoreboard.finished', 'PARTIDO TERMINADO')}</h2>
          <p className="sc-finished-banner__winner">{winnerName}</p>
        </div>
      )}

      <div className="sc-columns">
        <div className="sc-team-card sc-team-card--a">
          <h2 className="sc-team-name">{partido.equipo_a_nombre}</h2>
          <div className="sc-game-score">
            {formatGameScore(display, 'A')}
          </div>
          <div className="sc-stats">
            <div>
              <strong>{partido.games_a}</strong>
              {t('scoreboard.gamesShort', 'Games')}
            </div>
            <div>
              <strong>{partido.sets_a}</strong>
              {t('scoreboard.setsShort', 'Sets')}
            </div>
          </div>
          <button
            type="button"
            className="sc-point-btn sc-point-btn--a"
            disabled={actionLoading || terminado || !canScorePoints}
            onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/punto/A`)}
          >
            + {t('scoreboard.pointBtn', 'PUNTO')}
          </button>
        </div>

        <div className="sc-team-card sc-team-card--b">
          <h2 className="sc-team-name">{partido.equipo_b_nombre}</h2>
          <div className="sc-game-score">
            {formatGameScore(display, 'B')}
          </div>
          <div className="sc-stats">
            <div>
              <strong>{partido.games_b}</strong>
              {t('scoreboard.gamesShort', 'Games')}
            </div>
            <div>
              <strong>{partido.sets_b}</strong>
              {t('scoreboard.setsShort', 'Sets')}
            </div>
          </div>
          <button
            type="button"
            className="sc-point-btn sc-point-btn--b"
            disabled={actionLoading || terminado || !canScorePoints}
            onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/punto/B`)}
          >
            + {t('scoreboard.pointBtn', 'PUNTO')}
          </button>
        </div>
      </div>

      <div className="sc-secondary">
        <button
          type="button"
          className="sc-secondary-btn"
          disabled={actionLoading || terminado || !canUndo}
          onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/deshacer`)}
        >
          ↩ {t('scoreboard.undo', 'Deshacer')}
        </button>
        <button
          type="button"
          className="sc-secondary-btn"
          disabled={actionLoading || terminado}
          onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/saque`)}
        >
          ⇄ {t('scoreboard.changeServe', 'Cambiar saque')}
        </button>
        <button
          type="button"
          className="sc-secondary-btn sc-secondary-btn--tiebreak"
          disabled={actionLoading || terminado || partido.es_tiebreak}
          onClick={() => runAction(`/api/scoreboard/partidos/${partidoId}/tiebreak`)}
        >
          {t('scoreboard.tiebreak', 'TIE-BREAK')}
        </button>
      </div>
    </div>
  );
}
