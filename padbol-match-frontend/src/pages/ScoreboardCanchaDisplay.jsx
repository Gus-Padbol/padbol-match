import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import ScoreboardBoard from '../components/scoreboard/ScoreboardBoard';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import useServerCronometro from '../hooks/useServerCronometro';
import { fetchPartido, fetchPartidoByCancha, fetchSponsors } from '../utils/scoreboardApi';
import logo from '../logo.svg';
import '../styles/ScoreboardDisplay.css';

const CANCHA_POLL_MS = 10000;

function ScoreboardWaitingScreen({ canchaLabel }) {
  return (
    <div className="sb-waiting">
      <img src={logo} alt="Padbol Match" className="sb-waiting__logo" />
      <p className="sb-waiting__text">Waiting for match...</p>
      <p className="sb-waiting__cancha">{canchaLabel}</p>
    </div>
  );
}

export default function ScoreboardCanchaDisplay() {
  const { sedeId, cancha } = useParams();
  const canchaLabel = useMemo(
    () => decodeURIComponent(String(cancha || '').trim()),
    [cancha],
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
    if (!sedeId || !canchaLabel) return;
    try {
      const canchaPartido = await fetchPartidoByCancha(sedeId, canchaLabel);
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
      setError(err.message || 'Error loading court match');
    } finally {
      setPolling(false);
    }
  }, [sedeId, canchaLabel, loadPartidoById]);

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
    return <div className="sb-loading">Loading scoreboard...</div>;
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
