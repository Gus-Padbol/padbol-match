import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopPx,
} from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { getDisplayName } from '../utils/displayName';
import { formatAliasConArroba } from '../utils/jugadorPerfil';
import { loginRedirectAfterHubEntry } from '../utils/authLoginRedirect';

export default function UserHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading, userProfile } = useAuth();
  const [hoveredHubBtn, setHoveredHubBtn] = useState(null);

  const nombreSaludoHub = useMemo(() => {
    if (!session?.user) return '';
    const alias = String(userProfile?.alias || '').trim();
    if (alias) return formatAliasConArroba(alias);
    const full = getDisplayName(userProfile, session);
    const first = String(full || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0];
    return first || 'Jugador';
  }, [session?.user, userProfile]);

  const accesosRapidos = [
    { label: 'Reservar', icon: '⚽', action: () => navigate('/reservar') },
    { label: 'Torneos', icon: '🏆', action: () => navigate('/torneos') },
    { label: 'Ranking', icon: '🥇', action: () => navigate('/rankings') },
    { label: 'Perfil', icon: '👤', action: () => navigate('/mi-perfil') },
  ];

  const loginDesdeHubUrl = useMemo(
    () => `/login?redirect=${encodeURIComponent(loginRedirectAfterHubEntry(location))}`,
    [location.pathname, location.search]
  );

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
      <AppHeader title="Inicio" showBack={false} hubDirectLogin />
      <img
        src="/logo-padbol-match.png"
        alt="Padbol Match"
        style={{
          display: 'block',
          margin: '20px auto 40px',
          width: '120px',
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
            {session?.user
              ? `¡Hola ${nombreSaludoHub}! ¿Qué querés hacer hoy?`
              : '¡Hola!'}
          </h1>
          {!session?.user ? (
            <p style={{
              textAlign: 'center',
              margin: 0,
              fontSize: '13px',
              color: '#ffffff',
              lineHeight: 1.4,
            }}
            >
              ¿Qué querés hacer hoy?
            </p>
          ) : null}
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
          {!authLoading && !session?.user ? (
            <button
              type="button"
              onClick={() => navigate(loginDesdeHubUrl)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '14px',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '2px solid rgba(255,255,255,0.85)',
                background: 'rgba(255,255,255,0.98)',
                color: '#312e81',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
              }}
            >
              Iniciar sesión
            </button>
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
