import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';

const IMG_RESERVA =
  'https://images.unsplash.com/photo-1529900740304-2e06a23f9fee?w=800&q=80';
const IMG_BUSCAR =
  'https://images.unsplash.com/photo-1575367420392-2c71baa18656?w=800&q=80';
const IMG_ARMAR =
  'https://images.unsplash.com/photo-1624526267942-ab0d87887cfd?w=800&q=80';

const opciones = [
  {
    title: 'Reservar cancha',
    body: 'Ya tengo equipo completo, quiero una cancha.',
    image: IMG_RESERVA,
    path: '/reservar',
  },
  {
    title: 'Buscar partido',
    body: 'Quiero unirme a un partido que ya existe.',
    image: IMG_BUSCAR,
    path: '/partidos-abiertos',
  },
  {
    title: 'Armar partido',
    body: 'Quiero crear un partido y sumar jugadores.',
    image: IMG_ARMAR,
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
        background: '#FFFFFF',
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Jugar" />
      <main style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: '20px 16px', boxSizing: 'border-box' }}>
        <h1 style={{ color: '#0F0F0F', margin: '0 0 20px', fontSize: 26, lineHeight: 1.15, fontWeight: 700 }}>
          ¡Vamos a jugar!
        </h1>
        <div style={{ display: 'grid', gap: 14 }}>
          {opciones.map((op) => (
            <button
              key={op.title}
              type="button"
              onClick={() => navigate(op.path)}
              style={{
                textAlign: 'left',
                border: '1px solid #E0E0E0',
                borderRadius: 12,
                background: '#FFFFFF',
                padding: 0,
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                cursor: 'pointer',
                display: 'block',
              }}
            >
              <div
                style={{
                  height: 120,
                  background: `#6B6B6B url(${op.image}) center/cover no-repeat`,
                }}
              />
              <div style={{ padding: 16 }}>
                <strong style={{ display: 'block', color: '#0F0F0F', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
                  {op.title}
                </strong>
                <span style={{ display: 'block', color: '#6B6B6B', fontSize: 14, fontWeight: 400, lineHeight: 1.45 }}>
                  {op.body}
                </span>
              </div>
            </button>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
