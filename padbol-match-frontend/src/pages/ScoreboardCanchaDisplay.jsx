import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import ScoreboardBoard from '../components/scoreboard/ScoreboardBoard';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import useServerCronometro from '../hooks/useServerCronometro';
import { fetchPartido, fetchPartidoByCancha, fetchSponsors } from '../utils/scoreboardApi';
import { PADBOL_LOGO_ON_DARK } from '../constants/padbolBrandLogo';
import { resolveScoreboardCanchaLabel } from '../utils/scoreboardVenueLabels';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import '../styles/ScoreboardDisplay.css';

const CANCHA_POLL_MS = 10000;

function ScoreboardWaitingScreen({ canchaLabel }) {
  const { t } = useTranslation();
  return (
    <div className="sb-waiting">
      <img src={PADBOL_LOGO_ON_DARK} alt="Padbol Match" className="sb-waiting__logo" />
      <p className="sb-waiting__text">{t('scoreboardDisplay.waiting')}</p>
      <p className="sb-waiting__cancha">{canchaLabel}</p>
    </div>
  );
}

export default function ScoreboardCanchaDisplay() {
  const { t } = useTranslation();
  const { sedeId, cancha } = useParams();
  const canchaFromRoute = useMemo(
    () => decodeURIComponent(String(cancha || '').trim()),
    [cancha],
  );
  // Label legible en espera TV; la resolución por sede/cancha sigue usando el valor de ruta.
  const canchaLabel = useMemo(
    () => resolveScoreboardCanchaLabel({ cancha: canchaFromRoute }),
    [canchaFromRoute],
  );

  const [partido, setPartido] = useState(null);
  const [activePartidoId, setActivePartidoId] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);

  const activePartidoIdRef = useRef(null);

  const handleUpdate = useCallback((payload) => {
    setPartido(payload);
  }, []);

  const handleWinnerDismiss = useCallback(() => {
    activePartidoIdRef.current = null;
    setActivePartidoId(null);
    setPartido(null);
  }, []);

  const { connected: wsConnected, reconnect: reconnectWs } = useScoreboardSocket(
    activePartidoId,
    handleUpdate,
  );
  const timerSeconds = useServerCronometro(partido);

  const loadPartidoById = useCallback(async (partidoId) => {
    const full = await fetchPartido(partidoId);
    setPartido(full);
    setError('');
    return full;
  }, []);

  const pollCancha = useCallback(async () => {
    // Lookup por el valor de ruta/DB (puede ser "Court One"); el label visible ya está normalizado.
    if (!sedeId || !canchaFromRoute) return;
    try {
      const canchaPartido = await fetchPartidoByCancha(sedeId, canchaFromRoute);
      const nextPartidoId = canchaPartido?.id ?? null;

      if (!nextPartidoId) {
        activePartidoIdRef.current = null;
        setActivePartidoId(null);
        setPartido(null);
        setError('');
        return;
      }

      if (nextPartidoId !== activePartidoIdRef.current) {
        activePartidoIdRef.current = nextPartidoId;
        setActivePartidoId(nextPartidoId);
        await loadPartidoById(nextPartidoId);
      }
    } catch (err) {
      setError(err.message || t('scoreboardDisplay.courtMatchLoadError'));
    } finally {
      setPolling(false);
    }
  }, [sedeId, canchaFromRoute, loadPartidoById, t]);

  useEffect(() => {
    setPolling(true);
    void pollCancha();
    const id = window.setInterval(() => {
      void pollCancha();
    }, CANCHA_POLL_MS);
    return () => window.clearInterval(id);
  }, [pollCancha]);

  useEffect(() => {
    if (!sedeId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSponsors(sedeId);
        if (!cancelled) setSponsors(s);
      } catch {
        /* sponsors opcionales */
      }
    })();
    return () => { cancelled = true; };
  }, [sedeId]);

  const refreshActivePartido = useCallback(async () => {
    if (!activePartidoId) return;
    try {
      const p = await fetchPartido(activePartidoId);
      handleUpdate(p);
    } catch {
      /* fallback silencioso */
    }
  }, [activePartidoId, handleUpdate]);

  useEffect(() => {
    if (!activePartidoId) return undefined;
    void refreshActivePartido();
    return undefined;
  }, [activePartidoId, refreshActivePartido]);

  useEffect(() => {
    if (!activePartidoId || wsConnected) return undefined;
    void refreshActivePartido();
    const id = window.setInterval(() => {
      void refreshActivePartido();
    }, 3000);
    return () => window.clearInterval(id);
  }, [activePartidoId, wsConnected, refreshActivePartido]);

  useEffect(() => {
    if (!activePartidoId || wsConnected) return undefined;
    reconnectWs();
    const id = window.setInterval(() => {
      reconnectWs();
    }, 30000);
    return () => window.clearInterval(id);
  }, [activePartidoId, wsConnected, reconnectWs]);

  if (error && !partido) {
    return <div className="sb-error">{error}</div>;
  }

  if (polling && !partido) {
    return <div className="sb-loading">{t('scoreboardDisplay.loading')}</div>;
  }

  if (!partido) {
    return <ScoreboardWaitingScreen canchaLabel={canchaLabel} />;
  }

  return (
    <ScoreboardBoard
      key={partido.id}
      partido={partido}
      sponsors={sponsors}
      wsConnected={wsConnected}
      timerSeconds={timerSeconds}
      onWinnerDismiss={handleWinnerDismiss}
    />
  );
}
