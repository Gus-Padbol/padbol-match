import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ScoreboardScoreBug from '../components/scoreboard/ScoreboardScoreBug';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import useServerCronometro from '../hooks/useServerCronometro';
import { fetchPartido } from '../utils/scoreboardApi';
import '../styles/ScoreboardScoreBug.css';

export default function ScoreboardScoreBugPage() {
  const { partidoId } = useParams();
  const [partido, setPartido] = useState(null);
  const [error, setError] = useState('');

  const handleUpdate = useCallback((payload) => {
    setPartido(payload);
  }, []);

  const { connected: wsConnected } = useScoreboardSocket(partidoId, handleUpdate);
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
    if (wsConnected || !partidoId) return undefined;
    void fetchPartidoNow();
    const id = setInterval(() => {
      void fetchPartidoNow();
    }, 3000);
    return () => clearInterval(id);
  }, [wsConnected, partidoId, fetchPartidoNow]);

  if (error) {
    return <div className="sb-scorebug-page sb-scorebug__error">{error}</div>;
  }

  if (!partido) {
    return <div className="sb-scorebug-page sb-scorebug__loading">Loading…</div>;
  }

  return (
    <div className="sb-scorebug-page">
      <ScoreboardScoreBug partido={partido} timerSeconds={timerSeconds} />
    </div>
  );
}
