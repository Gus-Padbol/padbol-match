import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDisplayName } from '../utils/displayName';
import { formatAliasConArroba } from '../utils/jugadorPerfil';
import { loginRedirectAfterHubEntry } from '../utils/authLoginRedirect';
import useUserRole from '../hooks/useUserRole';
import { supabase } from '../supabaseClient';
import { readAdminNavContext, clearAdminNavContext } from '../utils/adminNavContext';

const btnVolver = {
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.22)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  padding: '8px 10px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
};

const LOGOUT_BTN_SIZE = 34;

const ADMIN_ROLES_CHIP = ['super_admin', 'admin_nacional', 'admin_club'];

const PADBOL_SUPER_ADMIN_EMAIL = 'padbolinternacional@gmail.com';

/** Misma lista que en torneo admin: mientras carga `user_roles`, el hub ya oculta chip para estos emails. */
const LEGACY_GLOBAL_ADMIN_EMAILS_HEADER = [
  PADBOL_SUPER_ADMIN_EMAIL,
  'admin@padbol.com',
  'sm@padbol.com',
];

function esNombrePlaceholderJugador(s) {
  return String(s || '').trim().toLowerCase() === 'jugador';
}

function primeraPalabraHandle(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.split(/\s+/).filter(Boolean)[0] || '';
}

/** `@` + primera palabra del perfil (jugador) para chip en panel admin (admin_nacional). */
function etiquetaArrobaPrimerNombrePerfil(userProfile, sessionUser) {
  const meta = sessionUser?.user_metadata || {};
  let raw =
    (!esNombrePlaceholderJugador(userProfile?.nombre)
      ? primeraPalabraHandle(userProfile?.nombre)
      : '') ||
    primeraPalabraHandle(userProfile?.nombre_completo) ||
    primeraPalabraHandle(meta.full_name) ||
    primeraPalabraHandle(meta.name) ||
    '';
  const email = String(sessionUser?.email || '').trim().toLowerCase();
  const local = email.includes('@') ? email.split('@')[0].toLowerCase() : '';
  if (!raw && local) raw = local;
  if (!raw) raw = 'Usuario';
  const cap = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return `@${cap}`;
}

/**
 * Chip panel admin para `admin_club`: prioridad `alias` → `username` en `profiles` → `username` jugador / metadata → nombre → email local.
 * Ej.: alias "Juampi" → "@Juampi"
 */
function etiquetaArrobaAdminClubChip(userProfile, sessionUser, profilesUsernameFromDb = '') {
  const meta = sessionUser?.user_metadata || {};
  const strip = (s) => String(s || '').trim().replace(/^@+/u, '');
  const aliasSrc = strip(userProfile?.alias);
  const profUser = strip(profilesUsernameFromDb);
  const jpUser = strip(userProfile?.username);
  const metaUser = strip(meta.alias || meta.username || meta.preferred_username);
  const email = String(sessionUser?.email || '').trim().toLowerCase();
  const local = email.includes('@') ? email.split('@')[0].toLowerCase() : '';

  let raw = '';
  for (const c of [aliasSrc, profUser, jpUser, metaUser]) {
    if (c) {
      raw = primeraPalabraHandle(c) || c;
      break;
    }
  }
  if (!raw && !esNombrePlaceholderJugador(userProfile?.nombre)) {
    raw =
      primeraPalabraHandle(userProfile?.nombre) ||
      primeraPalabraHandle(userProfile?.nombre_completo) ||
      '';
  }
  if (!raw && local) raw = local;
  if (!raw) raw = 'Usuario';
  const cap = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return `@${cap}`;
}

function etiquetaChipSuperAdminPanelMinimal(userProfile, sessionUser) {
  const email = String(sessionUser?.email || '').trim().toLowerCase();
  const local = email.includes('@') ? email.split('@')[0].toLowerCase() : '';
  const alias = String(userProfile?.alias || '').trim();
  if (alias) {
    const h = primeraPalabraHandle(alias.replace(/^@+/u, ''));
    if (h) return `@${h.charAt(0).toUpperCase()}${h.slice(1).toLowerCase()}`;
  }
  const meta = sessionUser?.user_metadata || {};
  let raw =
    (!esNombrePlaceholderJugador(userProfile?.nombre)
      ? primeraPalabraHandle(userProfile?.nombre)
      : '') ||
    primeraPalabraHandle(userProfile?.nombre_completo) ||
    primeraPalabraHandle(meta.full_name) ||
    primeraPalabraHandle(meta.name) ||
    '';
  if (email === PADBOL_SUPER_ADMIN_EMAIL && (!raw || raw.toLowerCase() === local)) {
    raw = 'Gus';
  }
  if (!raw && local) raw = local;
  if (!raw) raw = 'Usuario';
  const cap = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return `@${cap}`;
}

/** Destino del chip en hub: admins → panel; jugadores → perfil. Mientras carga el rol, usa caché local si existe. */
function readCachedRolHeader() {
  try {
    return JSON.parse(localStorage.getItem('user_role_data') || '{}')?.rol || null;
  } catch {
    return null;
  }
}

function hubChipNavigatePath(rolActual, roleLoading) {
  if (ADMIN_ROLES_CHIP.includes(rolActual || '')) return '/admin';
  if (roleLoading) {
    try {
      const raw = localStorage.getItem('user_role_data');
      const d = raw ? JSON.parse(raw) : null;
      if (ADMIN_ROLES_CHIP.includes(d?.rol || '')) return '/admin';
    } catch {
      /* ignore */
    }
  }
  return '/mi-perfil';
}

/**
 * Barra superior fija: ← Volver alineado a la izquierda (tras safe-area), título centrado, cierre de sesión.
 * Grid 1fr / auto / 1fr: con `showBack={false}` un hueco a la derecha de la 1ª columna equilibra el título.
 */
export default function AppHeader({
  title,
  showBack = true,
  onBack,
  backLabel,
  titleColor,
  /** Si true, no se muestra el botón de cerrar sesión (p. ej. perfil público de sede). */
  hideLogout = false,
  /** Hub principal: entrada directa a login o chip de usuario (no depende de reservar). */
  hubDirectLogin = false,
  /**
   * Panel /admin: chip compacto a la izquierda, logout a la derecha; sin ← Inicio ni menú ⋮.
   */
  adminPanelMinimalHeader = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, signOutAndClear, userProfile, loading: authLoading } = useAuth();
  const titleStr = String(title ?? '').trim();
  const hideLogoutEffective = hideLogout;

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { rol, sedeId, loading: roleLoading } = useUserRole(currentCliente);
  const rolEffectiveHeader = useMemo(() => rol || readCachedRolHeader(), [rol]);
  const isPanelAdminUser = ADMIN_ROLES_CHIP.includes(rolEffectiveHeader || '');
  const [adminSedeNombre, setAdminSedeNombre] = useState('');
  const [profilesUsernameClubChip, setProfilesUsernameClubChip] = useState('');
  useEffect(() => {
    if (rol !== 'admin_club' || !session?.user?.id) {
      setProfilesUsernameClubChip('');
      return undefined;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.username != null && String(data.username).trim()) {
          setProfilesUsernameClubChip(String(data.username).trim());
        } else {
          setProfilesUsernameClubChip('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rol, session?.user?.id]);

  useEffect(() => {
    if (rol !== 'admin_club' || !sedeId) {
      setAdminSedeNombre('');
      return undefined;
    }
    let cancelled = false;
    supabase
      .from('sedes')
      .select('nombre')
      .eq('id', sedeId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setAdminSedeNombre(String(data?.nombre || '').trim());
      });
    return () => {
      cancelled = true;
    };
  }, [rol, sedeId]);

  const pathOnly = useMemo(
    () =>
      String(location.pathname || '/')
        .split('?')[0]
        .split('#')[0]
        .replace(/\/+$/, '') || '/',
    [location.pathname]
  );

  const adminFlowSurface = useMemo(() => {
    if (!session?.user || !isPanelAdminUser) return false;
    const adminContextFlag = readAdminNavContext();
    const fromAdminNav = Boolean(location.state?.fromAdmin);
    if (pathOnly === '/admin' || pathOnly.startsWith('/admin/')) return true;
    if (adminContextFlag || fromAdminNav) return true;
    if (pathOnly.startsWith('/torneo') && (adminContextFlag || fromAdminNav)) return true;
    if (pathOnly.startsWith('/equipo/') && (adminContextFlag || fromAdminNav)) return true;
    return false;
  }, [session?.user, isPanelAdminUser, pathOnly, location.state]);

  const authEmail = String(session?.user?.email || '').trim().toLowerCase();
  const showLogout = !hideLogoutEffective && Boolean(session?.user);
  const loginFromHubUrl = `/login?redirect=${encodeURIComponent(loginRedirectAfterHubEntry(location))}`;
  const hubNombreCorto = (() => {
    const alias = String(userProfile?.alias || '').trim();
    if (alias) return formatAliasConArroba(alias);
    const full = String(getDisplayName(userProfile, session) || '').trim();
    if (full) {
      const first = full.split(/\s+/).filter(Boolean)[0];
      if (first) return first;
    }
    const em = String(session?.user?.email || '').trim();
    return em || 'Cuenta';
  })();
  const hubChipLabel = useMemo(() => {
    if (!session?.user || roleLoading) return hubNombreCorto;
    if (adminFlowSurface) {
      if (rol === 'super_admin') return etiquetaChipSuperAdminPanelMinimal(userProfile, session.user);
      if (rol === 'admin_club') return etiquetaArrobaAdminClubChip(userProfile, session.user, profilesUsernameClubChip);
      if (rol === 'admin_nacional') return etiquetaArrobaPrimerNombrePerfil(userProfile, session.user);
      return hubNombreCorto;
    }
    if (rol === 'super_admin') return 'Super Admin';
    if (rol === 'admin_nacional') return 'Admin Nacional';
    if (rol === 'admin_club') return adminSedeNombre ? `Admin · ${adminSedeNombre}` : 'Admin';
    return hubNombreCorto;
  }, [session?.user, roleLoading, rol, adminSedeNombre, hubNombreCorto, adminFlowSurface, userProfile, profilesUsernameClubChip]);

  const hubChipNavPath = useMemo(
    () => hubChipNavigatePath(rol, roleLoading),
    [rol, roleLoading]
  );

  const hubFotoUrl = String(userProfile?.foto_url || userProfile?.foto || '').trim();
  const hubInicial = String(hubNombreCorto || '?')
    .charAt(0)
    .toUpperCase();
  const esRolAdminHub =
    ADMIN_ROLES_CHIP.includes(rolEffectiveHeader || '') ||
    (Boolean(roleLoading) && LEGACY_GLOBAL_ADMIN_EMAILS_HEADER.includes(authEmail));
  const showAdminShortcutHub = !hideLogoutEffective && esRolAdminHub && !adminFlowSurface;
  const isOnAdmin = pathOnly === '/admin' || pathOnly.startsWith('/admin/');
  const miPerfilLogoutSpacing =
    showLogout && (pathOnly === '/mi-perfil' || pathOnly.startsWith('/mi-perfil/'));

  const hubInicioPath =
    pathOnly === '/' ||
    pathOnly === '/inicio' ||
    pathOnly === '/hub' ||
    pathOnly === '/home';
  /** Hub: chip más chico y título más angosto para no tapar “Inicio”. */
  const compactHubChip = hubDirectLogin && hubInicioPath && Boolean(session?.user);

  /** Hub inicio con sesión: super admin → [⚙ Admin] + [⏻] sin chip; resto → chip + logout; “Inicio” oculto si >2 controles o super admin. */
  const hubHomeCompactHeader =
    hubDirectLogin && hubInicioPath && Boolean(session?.user);
  const muestraChipUsuarioHubDerecha =
    hubDirectLogin &&
    Boolean(session?.user) &&
    !(hubHomeCompactHeader && esRolAdminHub);
  const hubHeaderControlCount =
    (showAdminShortcutHub ? 1 : 0) +
    (muestraChipUsuarioHubDerecha ? 1 : 0) +
    (showLogout ? 1 : 0);
  const hideHubCenterTitle = hubHomeCompactHeader && hubHeaderControlCount > 2;
  /** Admin en hub inicio: ⚙ a la izquierda; título central puede ocultarse si hay muchos controles. */
  const adminHubInicioCompacto = hubHomeCompactHeader && showAdminShortcutHub;
  const shouldHideHubCenterTitle = adminHubInicioCompacto || hideHubCenterTitle;

  const displayBackLabel = useMemo(() => {
    if (backLabel) return backLabel;
    if (!showBack) return '← Volver';
    if (typeof onBack === 'function') return '← Volver';
    if (adminFlowSurface) {
      return pathOnly === '/admin' || pathOnly.startsWith('/admin/') ? '← Inicio' : '← Admin';
    }
    return '← Volver';
  }, [backLabel, showBack, onBack, adminFlowSurface, pathOnly]);

  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    if (adminFlowSurface) {
      if (pathOnly === '/admin' || pathOnly.startsWith('/admin/')) {
        clearAdminNavContext();
        navigate('/');
        return;
      }
      navigate('/admin');
      return;
    }
    if (typeof window !== 'undefined') window.history.back();
  };

  const adminShortcutButton =
    showAdminShortcutHub ? (
      <button
        type="button"
        onClick={() => navigate(isOnAdmin ? '/' : '/admin')}
        aria-label={isOnAdmin ? 'Volver a la app' : 'Ir a Admin'}
        title={isOnAdmin ? 'Volver a la app' : 'Admin'}
        style={{
          height: LOGOUT_BTN_SIZE,
          padding: '0 10px',
          borderRadius: '999px',
          border: 'none',
          background: 'rgba(255,255,255,0.14)',
          color: '#e2e8f0',
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isOnAdmin ? '← App' : '⚙ Admin'}
      </button>
    ) : null;

  const padL = 'calc(8px + env(safe-area-inset-left, 0px))';
  const padR = 'calc(8px + env(safe-area-inset-right, 0px))';

  /** Panel admin: chip solo identidad jugador (@Gus / @Juan), sin texto “← Hub”. */
  const adminMinimalRolCorto = useMemo(() => {
    if (!session?.user) return '';
    if (roleLoading) return '…';
    if (rol === 'super_admin') return etiquetaChipSuperAdminPanelMinimal(userProfile, session.user);
    if (rol === 'admin_club') return etiquetaArrobaAdminClubChip(userProfile, session.user, profilesUsernameClubChip);
    if (rol === 'admin_nacional') return etiquetaArrobaPrimerNombrePerfil(userProfile, session.user);
    return 'Admin';
  }, [session?.user, roleLoading, rol, userProfile, profilesUsernameClubChip]);

  /** Inicial desde `nombre` del perfil (no alias); fallback email. */
  const adminMinimalInicial = useMemo(() => {
    const n = String(userProfile?.nombre || '').trim();
    if (n) return n.charAt(0).toUpperCase();
    const em = String(session?.user?.email || '').trim();
    if (em) return em.charAt(0).toUpperCase();
    return '?';
  }, [userProfile?.nombre, session?.user?.email]);

  /** Ruta /admin: siempre barra compacta con sesión (refuerzo si falta el prop). */
  const useAdminMinimalLayout =
    adminPanelMinimalHeader || (Boolean(session?.user) && isOnAdmin);

  if (useAdminMinimalLayout) {
    return (
      <div
        className="app-header-shell"
        style={{
          overflowX: 'hidden',
          minHeight: '56px',
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          paddingBottom: '8px',
          paddingLeft: padL,
          paddingRight: padR,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {session?.user ? (
          <button
            type="button"
            onClick={() => {
              clearAdminNavContext();
              navigate('/');
            }}
            aria-label="Volver al hub como jugador"
            title="Volver al hub"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              maxWidth: 'min(58vw, 220px)',
              padding: '3px 8px 3px 3px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.28)',
              background: 'rgba(255,255,255,0.12)',
              color: '#f8fafc',
              cursor: 'pointer',
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {hubFotoUrl ? (
              <img
                src={hubFotoUrl}
                alt=""
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              />
            ) : (
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {adminMinimalInicial}
              </span>
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {adminMinimalRolCorto}
            </span>
          </button>
        ) : (
          <span aria-hidden style={{ width: 32, height: 32, flexShrink: 0 }} />
        )}
        {showLogout && session?.user ? (
          <button
            type="button"
            onClick={async () => {
              await signOutAndClear();
              navigate('/');
            }}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            style={{
              width: LOGOUT_BTN_SIZE,
              height: LOGOUT_BTN_SIZE,
              padding: 0,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: '#e2e8f0',
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ⏻
          </button>
        ) : (
          <span aria-hidden style={{ width: LOGOUT_BTN_SIZE, height: LOGOUT_BTN_SIZE, flexShrink: 0 }} />
        )}
      </div>
    );
  }

  return (
    <div
      className="app-header-shell"
      style={{
        overflowX: 'hidden',
        minHeight: '56px',
        background: '#0f172a',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
        alignItems: 'center',
        columnGap: '8px',
        paddingBottom: '8px',
        paddingLeft: padL,
        paddingRight: padR,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: hubHomeCompactHeader ? 'flex-start' : showBack ? 'flex-start' : 'flex-end',
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        {hubHomeCompactHeader ? (
          adminShortcutButton || (
            <span
              aria-hidden
              style={{
                width: LOGOUT_BTN_SIZE,
                height: LOGOUT_BTN_SIZE,
                flexShrink: 0,
              }}
            />
          )
        ) : showBack ? (
          <button
            type="button"
            onClick={handleBack}
            style={{ ...btnVolver, flexShrink: 0 }}
            aria-label="Volver atrás"
          >
            {displayBackLabel}
          </button>
        ) : (
          <span
            aria-hidden
            style={{
              width: LOGOUT_BTN_SIZE,
              height: LOGOUT_BTN_SIZE,
              flexShrink: 0,
            }}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minWidth: 0,
          maxWidth: compactHubChip ? 'min(38vw, 168px)' : 'min(72vw, 420px)',
        }}
      >
        {titleStr ? (
          !shouldHideHubCenterTitle ? (
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                color: titleColor || '#fff',
                fontSize: '15px',
                fontWeight: 600,
                margin: 0,
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                padding: '4px 6px',
                fontFamily: 'inherit',
                width: '100%',
                maxWidth: '100%',
              }}
              title={`${titleStr} — Ir al inicio`}
              aria-label={`${titleStr}, ir al inicio`}
            >
              {titleStr}
            </button>
          ) : (
            <span
              aria-hidden
              style={{
                display: 'block',
                width: 0,
                height: 1,
                overflow: 'hidden',
              }}
            />
          )
        ) : (
          <span
            aria-hidden
            style={{
              display: 'block',
              width: 0,
              height: 1,
              overflow: 'hidden',
            }}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: showLogout || showAdminShortcutHub ? 'flex-end' : (miPerfilLogoutSpacing ? 'flex-end' : 'flex-start'),
          alignItems: 'center',
          minWidth: 0,
          width: '100%',
          marginLeft: miPerfilLogoutSpacing ? 'auto' : undefined,
          marginRight: showLogout || showAdminShortcutHub ? '16px' : hubDirectLogin && !session?.user && !authLoading ? '8px' : 0,
          paddingLeft: miPerfilLogoutSpacing ? '8px' : 0,
          paddingRight: miPerfilLogoutSpacing ? '8px' : 0,
          boxSizing: 'border-box',
          justifySelf: hubDirectLogin && !session?.user && !authLoading ? 'end' : undefined,
        }}
      >
        {showLogout || showAdminShortcutHub ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginLeft: miPerfilLogoutSpacing ? 'auto' : 0,
            }}
          >
            {((hubDirectLogin && muestraChipUsuarioHubDerecha) || adminFlowSurface) && session?.user ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  position: 'relative',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    navigate(adminFlowSurface ? '/admin' : hubChipNavPath);
                  }}
                  aria-label={adminFlowSurface ? 'Ir al panel de administración' : hubChipNavPath === '/admin' ? 'Ir al panel de administración' : 'Ir a mi perfil'}
                  title={adminFlowSurface ? 'Panel admin' : hubChipNavPath === '/admin' ? 'Panel admin' : 'Mi perfil'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: adminFlowSurface ? 4 : compactHubChip ? 4 : 6,
                    maxWidth: adminFlowSurface
                      ? 'min(34vw, 132px)'
                      : compactHubChip
                        ? 'min(30vw, 100px)'
                        : 'min(42vw, 160px)',
                    padding: adminFlowSurface ? '2px 8px 2px 2px' : compactHubChip ? '3px 6px 3px 3px' : '4px 8px 4px 4px',
                    borderRadius: '999px',
                    border: adminFlowSurface ? '1px solid rgba(255,255,255,0.28)' : 'none',
                    background: 'rgba(255,255,255,0.12)',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    flexShrink: 1,
                    minWidth: 0,
                  }}
                >
                  {hubFotoUrl && !adminFlowSurface ? (
                    <img
                      src={hubFotoUrl}
                      alt=""
                      style={{
                        width: compactHubChip ? 22 : 28,
                        height: compactHubChip ? 22 : 28,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '1px solid rgba(255,255,255,0.25)',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: adminFlowSurface ? 22 : compactHubChip ? 22 : 28,
                        height: adminFlowSurface ? 22 : compactHubChip ? 22 : 28,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        color: '#fff',
                        fontSize: adminFlowSurface ? 10 : compactHubChip ? 10 : 12,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {hubInicial}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: adminFlowSurface ? 11 : compactHubChip ? 10 : 12,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {hubChipLabel}
                  </span>
                </button>
              </div>
            ) : null}
            {showAdminShortcutHub && !hubHomeCompactHeader ? adminShortcutButton : null}
            {showLogout ? (
              <button
                type="button"
                onClick={async () => {
                  await signOutAndClear();
                  navigate('/');
                }}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                style={{
                  width: LOGOUT_BTN_SIZE,
                  height: LOGOUT_BTN_SIZE,
                  padding: 0,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#e2e8f0',
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ⏻
              </button>
            ) : null}
          </div>
        ) : hubDirectLogin && !session?.user && !authLoading ? (
          <button
            type="button"
            onClick={() => navigate(loginFromHubUrl)}
            style={{
              padding: '8px 12px',
              borderRadius: '999px',
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'rgba(148,163,184,0.2)',
              color: '#e2e8f0',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              marginLeft: 'auto',
            }}
          >
            Iniciar sesión
          </button>
        ) : hubDirectLogin && !session?.user && authLoading ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.65)',
              padding: '8px 4px',
            }}
          >
            …
          </span>
        ) : !hideLogoutEffective ? (
          <span
            aria-hidden
            style={{
              width: LOGOUT_BTN_SIZE,
              height: LOGOUT_BTN_SIZE,
              flexShrink: 0,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
