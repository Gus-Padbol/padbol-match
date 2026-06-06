import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ScoreboardBoard from '../components/scoreboard/ScoreboardBoard';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import useServerCronometro from '../hooks/useServerCronometro';
import { fetchPartido, fetchSponsors } from '../utils/scoreboardApi';
import '../styles/ScoreboardDisplay.css';

export default function ScoreboardDisplay() {
  const { sedeId, partidoId } = useParams();
  const [partido, setPartido] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [error, setError] = useState('');

  const handleUpdate = useCallback((payload) => {
    setPartido(payload);
  }, []);

  const { connected: wsConnected, reconnect: reconnectWs } = useScoreboardSocket(partidoId, handleUpdate);
  const timerSeconds = useServerCronometro(partido);

  const fetchPartidoNow = useCallback(async () => {
    if (!partidoId) return;
    try {
      const p = await fetchPartido(partidoId);
      handleUpdate(p);
      setError('');
    } catch (err) {
      setError(err.message || 'Error loading match');
    }
  }, [partidoId, handleUpdate]);

  useEffect(() => {
    void fetchPartidoNow();
  }, [fetchPartidoNow]);

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

  useEffect(() => {
    if (wsConnected || !partidoId) return undefined;
    void fetchPartidoNow();
    const id = setInterval(() => {
      void fetchPartidoNow();
    }, 3000);
    return () => clearInterval(id);
  }, [wsConnected, partidoId, fetchPartidoNow]);

  useEffect(() => {
    if (!partidoId || wsConnected) return undefined;
    reconnectWs();
    const id = setInterval(() => {
      reconnectWs();
    }, 30000);
    return () => clearInterval(id);
  }, [partidoId, wsConnected, reconnectWs]);

  if (error) {
    return <div className="sb-error">{error}</div>;
  }

  if (!partido) {
    return <div className="sb-loading">Loading scoreboard...</div>;
  }

  return (
    <ScoreboardBoard
      partido={partido}
      sponsors={sponsors}
      wsConnected={wsConnected}
      timerSeconds={timerSeconds}
    />
  );
}
