import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';

const opciones = [
  {
    title: 'Torneos',
    body: 'Inscríbete, arma un equipo y sigue el fixture.',
    icon: '🏆',
    path: '/torneos',
  },
  {
    title: 'Rankings',
    body: 'Puntos, posiciones y estadísticas.',
    icon: '📊',
    path: '/rankings',
  },
];

export default function Competir() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#FFFFFF',
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Competir" />
      <main style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: '20px 16px', boxSizing: 'border-box' }}>
        <h1 style={{ color: '#0F0F0F', margin: '0 0 8px', fontSize: 26, lineHeight: 1.1, fontWeight: 700 }}>¿Cómo quieres competir?</h1>
        <p style={{ color: '#6B6B6B', margin: '0 0 20px', fontSize: 15, lineHeight: 1.5, fontWeight: 400 }}>
          Torneos oficiales o consulta el ranking de jugadores.
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          {opciones.map((op) => (
            <button
              key={op.title}
              type="button"
              onClick={() => navigate(op.path)}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                textAlign: 'left',
                border: '1px solid #E0E0E0',
                borderRadius: 12,
                background: '#FFFFFF',
                padding: 16,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 28, width: 42, textAlign: 'center' }}>{op.icon}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: 'block', color: '#0F0F0F', fontSize: 17, marginBottom: 4, fontWeight: 700 }}>{op.title}</strong>
                <span style={{ display: 'block', color: '#6B6B6B', fontSize: 14, lineHeight: 1.45, fontWeight: 400 }}>{op.body}</span>
              </span>
              <span style={{ color: '#E11B22', fontSize: 20, fontWeight: 700 }}>›</span>
            </button>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
