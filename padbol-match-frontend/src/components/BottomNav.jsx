import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HUB_APP_HEADER_HEIGHT_PX,
  HUB_NAV_HEIGHT_PX,
} from '../constants/hubLayout';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading: authLoading } = useAuth();
  const path = location.pathname;

  const items = [
    { label: 'Reservar', icon: '⚽', path: '/reservar', match: (p) => p === '/reservar' },
    {
      label: 'Torneos',
      icon: '🏆',
      path: '/torneos',
      match: (p) => p === '/torneos' || p.startsWith('/torneo'),
    },
    { label: 'Ranking', icon: '📊', path: '/rankings', match: (p) => p === '/rankings' },
    { label: 'Perfil', icon: '👤', path: '/mi-perfil', match: (p) => p === '/mi-perfil' },
  ];

  const go = (item) => {
    if (authLoading) return;
    navigate(item.path);
  };

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed',
        top: HUB_APP_HEADER_HEIGHT_PX,
        left: 0,
        width: '100%',
        height: HUB_NAV_HEIGHT_PX,
        boxSizing: 'border-box',
        padding: '2px 4px',
        background: '#f8fafc',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'stretch',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
        zIndex: 1001,
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
              padding: '2px 2px',
              border: 'none',
              background: isActive ? 'rgba(34, 197, 94, 0.14)' : 'transparent',
              color: isActive ? '#15803d' : '#64748b',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'color 0.2s ease, background 0.2s ease',
              fontWeight: isActive ? 700 : 500,
              borderRadius: '10px',
              margin: '0 2px',
            }}
          >
            <span
              style={{
                fontSize: '18px',
                marginBottom: '1px',
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
