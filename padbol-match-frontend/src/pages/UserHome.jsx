import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopPx,
} from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { getDisplayName } from '../utils/displayName';

export default function UserHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading, userProfile, signOutAndClear } = useAuth();
  const [hoveredHubBtn, setHoveredHubBtn] = useState(null);

  const accesosRapidos = [
    { label: 'Reservar', icon: '⚽', action: () => navigate('/reservar') },
    { label: 'Torneos', icon: '🏆', action: () => navigate('/torneos') },
    { label: 'Ranking', icon: '🥇', action: () => navigate('/rankings') },
    { label: 'Perfil', icon: '👤', action: () => navigate('/mi-perfil') },
  ];

  const tituloSaludo = session?.user
    ? `¡Hola ${getDisplayName(userProfile, session)}!`
    : '¡Hola!';

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: `${hubContentPaddingTopPx(location.pathname)}px`,
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
      }}
    >
      <AppHeader title="Inicio" showBack={false} />
      {session?.user && (
        <button
          type="button"
          onClick={async () => {
            await signOutAndClear();
            navigate('/');
          }}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255,255,255,0.15)',
            color: 'white',
            fontSize: 18,
            cursor: 'pointer',
            zIndex: 1003,
          }}
          title="Cerrar sesión"
        >
          ⏻
        </button>
      )}
      <img
        src="/logo-padbol-match.png"
        alt="Padbol Match"
        style={{
          display: 'block',
          margin: '0 auto',
          marginBottom: '40px',
          width: '120px'
        }}
      />
      <div style={{ maxWidth: '820px', width: '100%', margin: '0 auto' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(10px)',
            borderRadius: '14px',
            padding: '14px 18px',
            maxWidth: '300px',
            margin: '0 auto 30px auto',
            color: 'white',
          }}
        >
          <h1 style={{
            color: 'white',
            textAlign: 'center',
            margin: '0 0 6px 0',
            fontSize: '18px',
            fontWeight: '600',
            lineHeight: 1.35,
          }}>
            {tituloSaludo}
          </h1>
          <p style={{
            textAlign: 'center',
            margin: 0,
            fontSize: '13px',
            color: '#ffffff',
            lineHeight: 1.4,
          }}>
            ¿Qué quieres hacer hoy?
          </p>
          {!authLoading && !session?.user ? (
            <p
              style={{
                textAlign: 'center',
                margin: '8px 0 0 0',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.55)',
                lineHeight: 1.45,
              }}
            >
              Puedes explorar sin registrarte
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            width: '100%',
            maxWidth: '420px',
            margin: '0 auto 20px auto',
          }}
        >
          {accesosRapidos.map(({ label, icon, action }, index) => {
            const isHovered = hoveredHubBtn === index;
            return (
              <button
                key={label}
                type="button"
                onClick={action}
                onMouseEnter={() => setHoveredHubBtn(index)}
                onMouseLeave={() => setHoveredHubBtn(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '18px',
                  borderRadius: '16px',
                  background: '#ffffff',
                  boxShadow: isHovered
                    ? '0 14px 30px rgba(0,0,0,0.2)'
                    : '0 10px 25px rgba(0,0,0,0.15)',
                  border: 'none',
                  transition: 'all 0.2s ease',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '28px', lineHeight: 1, marginBottom: '6px' }}>{icon}</span>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', lineHeight: 1.2 }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => navigate('/sedes')}
          style={{
            width: '100%',
            maxWidth: '420px',
            margin: '0 auto',
            display: 'block',
            padding: '16px',
            borderRadius: '16px',
            border: 'none',
            fontWeight: '600',
            background: 'rgba(255,255,255,0.9)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
            cursor: 'pointer',
            color: '#1e293b',
          }}
        >
          Explorar sedes
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
