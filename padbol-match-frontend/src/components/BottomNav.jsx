import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { HubIconCampana, HubIconCorrer, HubIconPerfil, HubIconTrofeo } from './HubNavIcons';
import {
  HUB_NAV_HEIGHT_PX,
  hubBottomNavFixedTopCss,
  hubBottomNavMaxWidthPx,
  isHubNavBarHiddenPathname,
} from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { isUserHomeHubPath, scheduleHubEntryScrollReset } from '../utils/hubEntryScrollReset';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const ADMIN_PANEL_ROLES = ['super_admin', 'admin_nacional', 'admin_cadena', 'admin_club', 'empleado'];

function readCachedRol() {
  try {
    const d = JSON.parse(localStorage.getItem('user_role_data') || '{}');
    return d?.rol || null;
  } catch {
    return null;
  }
}

const BottomNav = () => {
  const { t } = useTranslation();
  const { navDock } = useHubNavLayout();
  const dockBottom = navDock === 'bottom';
  const navigate = useNavigate();
  const location = useLocation();
  const { loading: authLoading, session } = useAuth();
  const sessionEmailLower = String(session?.user?.email || '').trim().toLowerCase();
  const superAdminNavEmails = [
    'padbolinternacional@gmail.com',
    'admin@padbol.com',
    'sm@padbol.com',
    'juanpablo@padbol.com',
  ];

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { rol } = useUserRole(currentCliente);
  const rolEffective = rol || readCachedRol();

  const superAdminBottomNav =
    rolEffective === 'super_admin' || superAdminNavEmails.includes(sessionEmailLower);

  const path = location.pathname;
  const pathOnly = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const adminTabActivo = new URLSearchParams(location.search).get('tab') || 'resumen';

  const isPanelAdmin = ADMIN_PANEL_ROLES.includes(rolEffective || '');

  /** Panel /admin: siempre barra de admin (nunca Reservar/Torneos jugador). */
  const adminDashboardBottomNav = pathOnly === '/admin' && isPanelAdmin;

  /** Torneo / equipos: barra admin solo con `state.fromAdmin === true` (no sessionStorage). */
  const adminTorneoBottomNav =
    isPanelAdmin &&
    pathOnly.startsWith('/torneo') &&
    location.state?.fromAdmin === true;

  const adminBottomNavActive = adminDashboardBottomNav || adminTorneoBottomNav;

  if (isHubNavBarHiddenPathname(path)) return null;

  const adminDashboardItems = rolEffective === 'empleado' ? [
    {
      label: t('nav.admin.reservas'),
      icon: '⚽',
      path: '/admin?tab=reservas',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'reservas';
      },
    },
    {
      label: t('torneos.titulo'),
      icon: '🏆',
      path: '/admin?tab=torneos',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x.startsWith('/torneo') || (x === '/admin' && adminTabActivo === 'torneos');
      },
    },
  ] : [
    {
      label: t('nav.admin.resumen'),
      icon: '📊',
      path: '/admin?tab=resumen',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'resumen';
      },
    },
    {
      label: t('torneos.titulo'),
      icon: '🏆',
      path: '/admin?tab=torneos',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x.startsWith('/torneo') || (x === '/admin' && adminTabActivo === 'torneos');
      },
    },
    {
      label: t('nav.admin.reservas'),
      icon: '⚽',
      path: '/admin?tab=reservas',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'reservas';
      },
    },
    {
      label: t('nav.admin.validaciones'),
      icon: '⏳',
      path: '/admin?tab=validaciones',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'validaciones';
      },
    },
    {
      label: t('nav.admin.mi_sede'),
      icon: '🏟️',
      path: '/admin?tab=mi_sede',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'mi_sede';
      },
    },
    ...(superAdminBottomNav
      ? [
          {
            label: t('nav.admin.solicitudes'),
            icon: '📝',
            path: '/admin?tab=solicitudes',
            match: (p) => {
              const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
              return x === '/admin' && adminTabActivo === 'solicitudes';
            },
          },
          {
            label: t('nav.admin.config'),
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

  const adminTorneoItems = rolEffective === 'empleado' ? [
    {
      label: t('nav.admin.reservas'),
      icon: '⚽',
      path: '/admin?tab=reservas',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'reservas';
      },
    },
    {
      label: t('torneos.titulo'),
      icon: '🏆',
      path: '/admin?tab=torneos',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x.startsWith('/torneo') || (x === '/admin' && adminTabActivo === 'torneos');
      },
    },
  ] : [
    {
      label: t('nav.admin.resumen'),
      icon: '📊',
      path: '/admin?tab=resumen',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'resumen';
      },
    },
    {
      label: t('torneos.titulo'),
      icon: '🏆',
      path: '/admin?tab=torneos',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x.startsWith('/torneo') || (x === '/admin' && adminTabActivo === 'torneos');
      },
    },
    {
      label: t('nav.admin.reservas'),
      icon: '⚽',
      path: '/admin?tab=reservas',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'reservas';
      },
    },
    {
      label: t('nav.admin.validaciones'),
      icon: '⏳',
      path: '/admin?tab=validaciones',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'validaciones';
      },
    },
    {
      label: t('nav.admin.mi_sede'),
      icon: '🏟️',
      path: '/admin?tab=mi_sede',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/admin' && adminTabActivo === 'mi_sede';
      },
    },
  ];

  const jugadorHubTabs = [
    {
      label: t('nav.perfil'),
      iconKind: 'perfil',
      path: '/mi-perfil',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/mi-perfil' || x.startsWith('/mi-perfil/');
      },
    },
    {
      label: t('nav.jugar'),
      iconKind: 'jugar',
      path: '/jugar',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        if (x === '/jugar') return true;
        if (x.startsWith('/jugar/')) return true;
        if (x === '/partidos-abiertos') return true;
        if (x === '/armar-partido') return true;
        if (x === '/reservar' || x.startsWith('/reservar/')) return true;
        return false;
      },
    },
    {
      label: t('nav.competir'),
      iconKind: 'competir',
      path: '/competir',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        if (x === '/competir') return true;
        if (x === '/rankings') return true;
        if (x === '/torneos' || x.startsWith('/torneos/')) return true;
        if (x.startsWith('/torneo/')) return true;
        return false;
      },
    },
    {
      label: t('nav.notificaciones'),
      iconKind: 'campana',
      path: '/notificaciones',
      match: (p) => {
        const x = p.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
        return x === '/notificaciones';
      },
    },
  ];

  const items = adminDashboardBottomNav
    ? adminDashboardItems
    : adminTorneoBottomNav
      ? adminTorneoItems
      : jugadorHubTabs;

  const go = (item) => {
    if (authLoading) return;
    const pathOnly = item.path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    navigate(item.path);
    if (isUserHomeHubPath(pathOnly)) {
      scheduleHubEntryScrollReset();
    }
  };

  const navBarStyle = {
    background: 'var(--nav-bg)',
    ...(dockBottom
      ? {
          borderTop: '1px solid var(--nav-border)',
          borderBottom: 'none',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.06)',
        }
      : {
          borderBottom: '1px solid var(--nav-border)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }),
  };

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        width: '100%',
        boxSizing: 'border-box',
        padding: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'stretch',
        zIndex: 1001,
        overflowX: 'hidden',
        background: 'transparent',
        pointerEvents: 'none',
        ...(dockBottom
          ? {
              top: 'auto',
              bottom: 0,
              height: 'auto',
              minHeight: HUB_NAV_HEIGHT_PX,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }
          : {
              top: hubBottomNavFixedTopCss(),
              bottom: 'auto',
              height: HUB_NAV_HEIGHT_PX,
              paddingBottom: 0,
            }),
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: hubBottomNavMaxWidthPx,
          height: dockBottom ? 'auto' : '100%',
          minHeight: dockBottom ? HUB_NAV_HEIGHT_PX : undefined,
          boxSizing: 'border-box',
          padding: '2px max(4px, env(safe-area-inset-left, 0px)) 2px max(4px, env(safe-area-inset-right, 0px))',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'stretch',
          overflowX: 'hidden',
          ...navBarStyle,
        }}
      >
      {items.map((item) => {
        const isActive = item.match(path);

        const btnNav = adminBottomNavActive
          ? {
              background: isActive ? 'rgba(225, 27, 34, 0.12)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            }
          : {
              background: isActive ? 'rgba(225, 27, 34, 0.1)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            };

        const iconEl =
          item.iconKind === 'perfil' ? (
            <HubIconPerfil active={isActive} />
          ) : item.iconKind === 'jugar' ? (
            <HubIconCorrer active={isActive} />
          ) : item.iconKind === 'campana' ? (
            <HubIconCampana active={isActive} />
          ) : item.iconKind === 'competir' ? (
            <HubIconTrofeo active={isActive} />
          ) : item.icon ? (
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
          ) : null;

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
              maxWidth: adminDashboardBottomNav && superAdminBottomNav ? '72px' : '120px',
              padding: '2px 2px',
              border: 'none',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'color 0.2s ease, background 0.2s ease',
              fontWeight: isActive ? 700 : 500,
              borderRadius: '8px',
              margin: '0 2px',
              ...btnNav,
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '2px',
                lineHeight: 1,
                flexShrink: 0,
              }}
              aria-hidden
            >
              {iconEl}
            </span>
            {item.label}
          </button>
        );
      })}
      </div>
    </nav>
  );
};

export default BottomNav;
