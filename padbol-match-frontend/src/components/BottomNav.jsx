import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authUrlWithRedirect } from '../utils/authLoginRedirect';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const path = location.pathname;

  const items = [
    { label: 'Reservar', icon: '⚽', path: '/reservar', match: (p) => p === '/reservar' },
    { label: 'Torneos', icon: '🏆', path: '/torneos', match: (p) => p === '/torneos' },
    { label: 'Ranking', icon: '📊', path: '/rankings', match: (p) => p === '/rankings' },
    { label: 'Perfil', icon: '👤', path: '/mi-perfil', match: (p) => p === '/mi-perfil' },
  ];

  const go = (item) => {
    if (authLoading) return;
    if (item.path === '/mi-perfil' || item.path === '/reservar') {
      if (!session?.user) {
        navigate(authUrlWithRedirect(item.path));
        return;
      }
    }
    navigate(item.path);
  };

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '65px',
        background: '#0f172a',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        zIndex: 1001,
        boxSizing: 'border-box',
      }}
    >
      {items.map((item) => {
        const isActive = item.match(path);

        return (
          <button
            key={item.path}
            type="button"
            onClick={() => go(item)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              maxWidth: '120px',
              padding: '6px 4px',
              border: 'none',
              background: 'transparent',
              color: isActive ? '#22c55e' : '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'color 0.2s ease, transform 0.2s ease',
              fontWeight: isActive ? 700 : 500,
            }}
          >
            <span
              style={{
                fontSize: '20px',
                marginBottom: '2px',
                lineHeight: 1,
              }}
              aria-hidden
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
