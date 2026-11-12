import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ScoreboardBoard from '../components/scoreboard/ScoreboardBoard';
import {scoreboardPublicPollInterval} from '../utils/scoreboardNationsLineup';
import useScoreboardSocket from '../hooks/useScoreboardSocket';
import useServerCronometro from '../hooks/useServerCronometro';
import { fetchPartido, fetchSponsors } from '../utils/scoreboardApi';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import '../styles/ScoreboardDisplay.css';

export default function ScoreboardDisplay() {
  const { t } = useTranslation();
  const { sedeId, partidoId } = useParams();
  const [partido, setPartido] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [error, setError] = useState('');
  const isNations = ['current', 'unavailable'].includes(partido?.nations_lineup_status);

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
      setError(isNations ? 'Unable to load the match.' : (err.message || t('scoreboardDisplay.matchLoadError')));
    }
  }, [partidoId, handleUpdate, t, isNations]);

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

  const pollInterval = scoreboardPublicPollInterval(partido, wsConnected);
  useEffect(() => {
    if (!pollInterval || !partidoId) return undefined;
    void fetchPartidoNow();
    const id = setInterval(() => {
      void fetchPartidoNow();
    }, pollInterval);
    return () => clearInterval(id);
  }, [pollInterval, partidoId, fetchPartidoNow]);

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
    return <div className="sb-loading">{t('scoreboardDisplay.loading')}</div>;
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
