import React from 'react';
import { useParams } from 'react-router-dom';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const pageStyle = {
  minHeight: '100vh',
  margin: 0,
  padding: '2rem',
  boxSizing: 'border-box',
  background: '#0f0f14',
  color: '#f1f5f9',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'system-ui, sans-serif',
  textAlign: 'center',
};

export default function ScoreboardControl() {
  const { t } = useTranslation();
  const { partidoId } = useParams();

  return (
    <div style={pageStyle}>
      <h1 style={{ margin: '0 0 1rem', fontSize: '1.75rem' }}>
        {t('scoreboard.arbiterPanel', 'Panel del árbitro - En construcción')}
      </h1>
      <p style={{ margin: 0, opacity: 0.6, fontSize: '1rem' }}>
        Partido: {partidoId}
      </p>
    </div>
  );
}
