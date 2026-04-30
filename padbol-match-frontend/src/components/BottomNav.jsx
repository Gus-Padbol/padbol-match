import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { readAdminNavContext } from '../utils/adminNavContext';
import {
  HUB_NAV_HEIGHT_PX,
  hubBottomNavFixedTopCss,
  isHubNavBarHiddenPathname,
  isSedeProfilePathname,
} from '../constants/hubLayout';

const ADMIN_PANEL_ROLES = ['super_admin', 'admin_nacional', 'admin_club'];

function readCachedRol() {
  try {
    const d = JSON.parse(localStorage.getItem('user_role_data') || '{}');
    return d?.rol || null;
  } catch {
    return null;
  }
}

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading: authLoading, session } = useAuth();
  const path = location.pathname;
  const pathOnly = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const adminTabActivo = new URLSearchParams(location.search).get('tab') || 'resumen';

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { rol } = useUserRole(currentCliente);
  const rolEffective = rol || readCachedRol();

  const isPanelAdmin = ADMIN_PANEL_ROLES.includes(rolEffective || '');

  /** Panel /admin: siempre barra de admin (nunca Reservar/Torneos jugador). */
  const adminDashboardBottomNav = pathOnly === '/admin' && isPanelAdmin;

  /** Torneo / equipos con contexto admin (desde panel o flag de sesión). */
  const adminTorneoBottomNav =
    isPanelAdmin &&
    pathOnly.startsWith('/torneo') &&
    (Boolean(location.state?.fromAdmin) || readAdminNavContext());

  const adminBottomNavActive = adminDashboardBottomNav || adminTorneoBottomNav;

  if (isHubNavBarHiddenPathname(path)) return null;

  const sedeSobrio = isSedeProfilePathname(path);

  /** Perfil público con id: `/sede/123` (no solo `/sede`). */
  const isSedePublicDetailPath = (() => {
    const x = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    return /^\/sede\/[^/]+/.test(x);
  })();

  const matchHubInicio = (p) => {
    const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    return x === '/' || x === '/inicio' || x === '/hub' || x === '/home';
  };

  const adminDashboardItems = [
    {
      label: 'Resumen',
      icon: '📊',
      path: '/admin?tab=resumen',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'resumen';
      },
    },
    {
      label: 'Torneos',
      icon: '🏆',
      path: '/admin?tab=torneos',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x.startsWith('/torneo') || (x === '/admin' && adminTabActivo === 'torneos');
      },
    },
    {
      label: 'Reservas',
      icon: '⚽',
      path: '/admin?tab=reservas',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'reservas';
      },
    },
    {
      label: 'Validaciones',
      icon: '⏳',
      path: '/admin?tab=validaciones',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'validaciones';
      },
    },
    {
      label: 'Mi Sede',
      icon: '🏟️',
      path: '/admin?tab=mi_sede',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'mi_sede';
      },
    },
    ...(rolEffective === 'super_admin'
      ? [
          {
            label: 'Config',
            icon: '⚙️',
            path: '/admin?tab=config',
            match: (p) => {
              const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
              return x === '/admin' && adminTabActivo === 'config';
            },
          },
        ]
      : []),
  ];

  const adminTorneoItems = [
    {
      label: 'Resumen',
      icon: '📊',
      path: '/admin?tab=resumen',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'resumen';
      },
    },
    {
      label: 'Torneos',
      icon: '🏆',
      path: '/admin?tab=torneos',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x.startsWith('/torneo') || (x === '/admin' && adminTabActivo === 'torneos');
      },
    },
    {
      label: 'Reservas',
      icon: '⚽',
      path: '/admin?tab=reservas',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'reservas';
      },
    },
    {
      label: 'Validaciones',
      icon: '⏳',
      path: '/admin?tab=validaciones',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'validaciones';
      },
    },
    {
      label: 'Mi Sede',
      icon: '🏟️',
      path: '/admin?tab=mi_sede',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'mi_sede';
      },
    },
  ];

  const items = adminDashboardBottomNav
    ? adminDashboardItems
    : adminTorneoBottomNav
      ? adminTorneoItems
      : sedeSobrio
        ? [
            {
              label: 'Inicio',
              icon: '🏠',
              path: '/',
              match: matchHubInicio,
              homePadbolLogo: isSedePublicDetailPath,
            },
            {
              label: 'Torneos',
              icon: '🏆',
              path: '/torneos',
              match: (p) => p === '/torneos' || p.startsWith('/torneo'),
            },
            { label: 'Ranking', icon: '📊', path: '/rankings', match: (p) => p === '/rankings' },
            { label: 'Perfil', icon: '👤', path: '/mi-perfil', match: (p) => p === '/mi-perfil' },
          ]
        : [
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

  const navBarStyle =
    sedeSobrio && !adminBottomNavActive
      ? {
          background: 'rgba(0, 0, 0, 0.32)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
        }
      : {
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
        };

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed',
        top: hubBottomNavFixedTopCss(),
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100%',
        height: HUB_NAV_HEIGHT_PX,
        boxSizing: 'border-box',
        padding: '2px 4px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'stretch',
        zIndex: 1001,
        overflowX: 'hidden',
        ...navBarStyle,
      }}
    >
      {items.map((item) => {
        const isActive = item.match(path);

        const btnSobrio =
          sedeSobrio && !adminBottomNavActive
            ? {
                background: isActive ? 'rgba(34, 197, 94, 0.28)' : 'transparent',
                color: isActive ? '#bbf7d0' : 'rgba(248, 250, 252, 0.82)',
              }
            : {
                background: isActive ? 'rgba(34, 197, 94, 0.14)' : 'transparent',
                color: isActive ? '#15803d' : '#64748b',
              };

        return (
          <button
            key={`${item.label}-${item.path}`}
            type="button"
            onClick={() => go(item)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              maxWidth: adminDashboardBottomNav && rolEffective === 'super_admin' ? '72px' : '120px',
              padding: '2px 2px',
              border: 'none',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'color 0.2s ease, background 0.2s ease',
              fontWeight: isActive ? 700 : 500,
              borderRadius: '10px',
              margin: '0 2px',
              ...btnSobrio,
            }}
          >
            {item.homePadbolLogo ? (
              <img
                src="/logo-padbol-match.png"
                alt=""
                width={24}
                height={24}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  objectFit: 'contain',
                  display: 'block',
                  marginBottom: '1px',
                  opacity: sedeSobrio ? (isActive ? 1 : 0.92) : 1,
                  flexShrink: 0,
                }}
                aria-hidden
              />
            ) : (
              <span
                style={{
                  fontSize: '18px',
                  marginBottom: '1px',
                  lineHeight: 1,
                  opacity: sedeSobrio ? (isActive ? 1 : 0.92) : 1,
                }}
                aria-hidden
              >
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
