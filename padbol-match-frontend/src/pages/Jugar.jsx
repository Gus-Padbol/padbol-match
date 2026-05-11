import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';

const opciones = [
  {
    title: 'Reservar cancha',
    body: 'Elige sede, cancha y horario como siempre.',
    icon: '⚽',
    path: '/reservar',
  },
  {
    title: 'Buscar partido',
    body: 'Encuentra cupos y pide sumarte a un partido.',
    icon: '🔎',
    path: '/partidos-abiertos',
  },
  {
    title: 'Armar partido',
    body: 'Reserva, publica cupos y compártelo por WhatsApp.',
    icon: '🤝',
    path: '/armar-partido',
  },
];

export default function Jugar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Jugar" />
      <main style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: '20px 16px', boxSizing: 'border-box' }}>
        <h1 style={{ color: '#fff', margin: '0 0 8px', fontSize: 28, lineHeight: 1.1 }}>¿Cómo quieres jugar?</h1>
        <p style={{ color: 'rgba(255,255,255,0.86)', margin: '0 0 20px', fontSize: 15, lineHeight: 1.5 }}>
          Reserva una cancha o encuentra gente para completar partido.
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
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 18,
                background: '#fff',
                padding: 16,
                boxShadow: '0 12px 28px rgba(15,23,42,0.18)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 28, width: 42, textAlign: 'center' }}>{op.icon}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: 'block', color: '#0f172a', fontSize: 17, marginBottom: 4 }}>{op.title}</strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: 13, lineHeight: 1.4 }}>{op.body}</span>
              </span>
              <span style={{ color: '#667eea', fontSize: 22, fontWeight: 900 }}>›</span>
            </button>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
