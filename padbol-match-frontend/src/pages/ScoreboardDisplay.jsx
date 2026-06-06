import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPartido } from '../utils/scoreboardApi';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const pageStyle = {
  width: '100vw',
  height: '100vh',
  margin: 0,
  padding: '2rem',
  boxSizing: 'border-box',
  background: '#06060a',
  color: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'system-ui, sans-serif',
  textAlign: 'center',
};

export default function ScoreboardDisplay() {
  const { t } = useTranslation();
  const { sedeId, partidoId } = useParams();
  const [partido, setPartido] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPartido(partidoId);
        if (!cancelled) setPartido(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error al cargar partido');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [partidoId]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <p style={{ fontSize: '1.5rem', margin: 0 }}>
          {t('scoreboard.loading', 'Cargando scoreboard...')}
        </p>
        <p style={{ marginTop: '1rem', opacity: 0.5, fontSize: '0.9rem' }}>
          {partidoId}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <p style={{ color: '#fca5a5', fontSize: '1.25rem' }}>{error}</p>
        <p style={{ opacity: 0.5, marginTop: '1rem' }}>{partidoId}</p>
      </div>
    );
  }

  const display = partido?.display || {};

  return (
    <div style={pageStyle}>
      <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 700 }}>
        {partido?.equipo_a_nombre || 'Equipo A'}
        {' '}
        <span style={{ opacity: 0.4 }}>vs</span>
        {' '}
        {partido?.equipo_b_nombre || 'Equipo B'}
      </h1>
      <p style={{ margin: '0 0 1.5rem', opacity: 0.6, fontSize: '0.95rem' }}>
        Sede {sedeId}
        {partido?.cancha ? ` · ${partido.cancha}` : ''}
      </p>
      <div style={{ fontSize: '4rem', fontWeight: 700, letterSpacing: '0.05em' }}>
        {display.displayA ?? partido?.score_a ?? 0}
        <span style={{ opacity: 0.3, margin: '0 1rem' }}>:</span>
        {display.displayB ?? partido?.score_b ?? 0}
      </div>
      <p style={{ marginTop: '1.5rem', opacity: 0.5, fontSize: '0.85rem' }}>
        {partidoId}
      </p>
    </div>
  );
}
