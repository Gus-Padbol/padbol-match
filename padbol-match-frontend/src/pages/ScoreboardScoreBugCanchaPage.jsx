import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ScoreboardScoreBug from '../components/scoreboard/ScoreboardScoreBug';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import useServerCronometro from '../hooks/useServerCronometro';
import { fetchPartido, fetchPartidoByCancha } from '../utils/scoreboardApi';
import '../styles/ScoreboardScoreBug.css';

const CANCHA_POLL_MS = 10000;
const PARTIDO_POLL_MS = 3000;

export default function ScoreboardScoreBugCanchaPage() {
  const { sedeId, cancha } = useParams();
  const canchaLabel = useMemo(
    () => decodeURIComponent(String(cancha || '').trim()),
    [cancha],
  );

  const [partido, setPartido] = useState(null);

  const activePartidoId = partido?.id ?? null;

  const handleUpdate = useCallback((payload) => {
    setPartido(payload);
  }, []);

  const { connected: wsConnected } = useScoreboardSocket(activePartidoId, handleUpdate);
  const timerSeconds = useServerCronometro(partido);

  const pollCancha = useCallback(async () => {
    if (!sedeId || !canchaLabel) return;
    try {
      const p = await fetchPartidoByCancha(sedeId, canchaLabel);
      setPartido(p ?? null);
    } catch (err) {
      console.error('[ScoreboardScoreBugCancha] cancha poll failed:', err);
      setPartido(null);
    }
  }, [sedeId, canchaLabel]);

  useEffect(() => {
    void pollCancha();
    const id = window.setInterval(() => {
      void pollCancha();
    }, CANCHA_POLL_MS);
    return () => window.clearInterval(id);
  }, [pollCancha]);

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
    }, PARTIDO_POLL_MS);
    return () => window.clearInterval(id);
  }, [activePartidoId, wsConnected, refreshActivePartido]);

  if (!partido) {
    return <div className="sb-scorebug-page" aria-hidden="true" />;
  }

  return (
    <div className="sb-scorebug-page">
      <ScoreboardScoreBug
        key={partido.id}
        partido={partido}
        timerSeconds={timerSeconds}
      />
    </div>
  );
}
