import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { headerNombreVisible } from '../utils/displayName';
import { formatAliasConArroba } from '../utils/jugadorPerfil';
import useUserRole from '../hooks/useUserRole';
import { supabase } from '../supabaseClient';
import { clearAdminNavContext } from '../utils/adminNavContext';
import {
  HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX,
  isJugadorHubShellPathname,
  isSedeProfilePathname,
  resolveSedePublicaBackToPath,
} from '../constants/hubLayout';
import JugadorNotificationsBell from './JugadorNotificationsBell';
import HubThemeSettingsButton from './HubThemeSettingsButton';
import { useTheme } from '../context/ThemeContext';

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

const ADMIN_ROLES_CHIP = ['super_admin', 'admin_nacional', 'admin_club', 'empleado', 'editor_contenido'];

const PADBOL_SUPER_ADMIN_EMAIL = 'padbolinternacional@gmail.com';

function SearchIconSvg({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Misma lista que en torneo admin: mientras carga `user_roles`, el hub ya oculta chip para estos emails. */
const LEGACY_GLOBAL_ADMIN_EMAILS_HEADER = [
  PADBOL_SUPER_ADMIN_EMAIL,
  'admin@padbol.com',
  'sm@padbol.com',
];

function emailEsLegacyAdminHub(emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();
  return LEGACY_GLOBAL_ADMIN_EMAILS_HEADER.includes(email);
}

function readCachedRolHeader() {
  try {
    return JSON.parse(localStorage.getItem('user_role_data') || '{}')?.rol || null;
  } catch {
    return null;
  }
}

/** Destino del chip en hub: admins → panel; jugadores → perfil. Mientras carga el rol, usa caché local si existe. */
function hubChipNavigatePath(rolActual, roleLoading) {
  if (rolActual === 'editor_contenido') return '/admin?tab=personalizar_hub';
  if (ADMIN_ROLES_CHIP.includes(rolActual || '')) return '/admin';
  if (roleLoading) {
    try {
      const raw = localStorage.getItem('user_role_data');
      const d = raw ? JSON.parse(raw) : null;
      if (d?.rol === 'editor_contenido') return '/admin?tab=personalizar_hub';
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
  /** Si se define (px), en desktop sustituye el max-width por defecto del cuerpo (~900px). */
  contentMaxWidth = null,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { session, signOutAndClear, userProfile, loading: authLoading } = useAuth();
  const titleStr = String(title ?? '').trim();
  const hideLogoutEffective = hideLogout;

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { rol, sedeId, loading: roleLoading } = useUserRole(currentCliente);
  /** Una vez admin (user_roles, caché, email legacy), el hub no revierte aunque el fetch deje `rol` null o limpie caché. */
  const [hubAdminRolEver, setHubAdminRolEver] = useState(() => {
    if (ADMIN_ROLES_CHIP.includes(readCachedRolHeader() || '')) return true;
    if (emailEsLegacyAdminHub(session?.user?.email)) return true;
    return false;
  });
  useEffect(() => {
    if (!session?.user) {
      setHubAdminRolEver(false);
      return;
    }
    if (emailEsLegacyAdminHub(session.user.email)) {
      setHubAdminRolEver((prev) => prev || true);
      return;
    }
    if (ADMIN_ROLES_CHIP.includes(rol || '')) {
      setHubAdminRolEver((prev) => prev || true);
    }
  }, [session?.user, rol, session?.user?.email]);
  /** Rol desde DB/caché; si aún no hay fila `user_roles` (p. ej. otro proyecto/host), usar rol en JWT de Supabase Auth. */
  const rolEffectiveHeader = useMemo(() => {
    const cached = readCachedRolHeader();
    const fromJwt = (() => {
      const r = String(
        session?.user?.app_metadata?.role ?? session?.user?.user_metadata?.role ?? ''
      )
        .trim()
        .toLowerCase();
      return ADMIN_ROLES_CHIP.includes(r) ? r : null;
    })();
    return rol || cached || fromJwt;
  }, [rol, session?.user?.app_metadata?.role, session?.user?.user_metadata?.role]);
  const isPanelAdminUser = ADMIN_ROLES_CHIP.includes(rolEffectiveHeader || '');
  const [adminSedeNombre, setAdminSedeNombre] = useState('');

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

  const jugadorHubShellPath = useMemo(() => isJugadorHubShellPathname(pathOnly), [pathOnly]);

  /**
   * Lupa: hub principal (con sesión), rutas donde antes era global, excepto shell del jugador logueado
   * (Ranking / Reservar / Torneos / Mi perfil), donde solo debe verse foto + apodo.
   */
  const showHeaderSearch = useMemo(() => {
    const p = pathOnly;
    if (p === '/admin' || p.startsWith('/admin/')) return false;
    if (!session?.user) return false;
    if (jugadorHubShellPath) return false;
    return true;
  }, [pathOnly, session?.user, jugadorHubShellPath]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({ jugadores: [], torneos: [], sedes: [] });
  const searchWrapRef = useRef(null);

  /** /torneo/:id/equipos sin venir del panel: mismo ancho hub, título corto "Equipos". */
  const headerTitleDisplay = useMemo(() => {
    if (!/^\/torneo\/[^/]+\/equipos$/u.test(pathOnly)) return titleStr;
    if (location.state?.fromAdmin === true) return titleStr;
    if (titleStr === 'Gestión del torneo' || titleStr === 'Inscripción') return 'Equipos';
    return titleStr;
  }, [pathOnly, location.state?.fromAdmin, titleStr]);

  /** Rutas del hub jugador (/, /hub, …): chip con apodo o nombre real; atajo Admin para admins (logout en Mi Perfil). */
  const hubInicioPath =
    pathOnly === '/' ||
    pathOnly === '/inicio' ||
    pathOnly === '/hub' ||
    pathOnly === '/home';

  const adminFlowSurface = useMemo(() => {
    if (!session?.user || !isPanelAdminUser) return false;
    if (pathOnly === '/admin' || pathOnly.startsWith('/admin/')) return true;
    const fromAdminNav = location.state?.fromAdmin === true;
    if (!fromAdminNav) return false;
    if (pathOnly.startsWith('/torneo')) return true;
    if (pathOnly.startsWith('/equipo/')) return true;
    return false;
  }, [session?.user, isPanelAdminUser, pathOnly, location.state]);

  const hubLightBar =
    (jugadorHubShellPath || isSedeProfilePathname(pathOnly)) && !adminFlowSurface && !adminPanelMinimalHeader;

  const authEmail = String(session?.user?.email || '').trim().toLowerCase();
  /** Panel admin (barra compacta): logout rápido. En flujo jugador el cierre va en Mi Perfil. */
  const showLogoutAdminHeader = !hideLogoutEffective && Boolean(session?.user);
  const hubNombreCorto = useMemo(() => {
    const base = headerNombreVisible(userProfile, session);
    const email = String(session?.user?.email || '').trim().toLowerCase();
    if (email === PADBOL_SUPER_ADMIN_EMAIL) {
      const local = email.includes('@') ? email.split('@')[0].toLowerCase() : '';
      const b = String(base || '').trim().toLowerCase();
      if (!base || b === local || b === 'jugador') return 'Gus';
    }
    return base;
  }, [userProfile, session]);

  const hubChipLabel = useMemo(() => {
    if (!session?.user || roleLoading) return hubNombreCorto;
    if (jugadorHubShellPath && !adminFlowSurface) {
      return hubNombreCorto;
    }
    const r = rolEffectiveHeader || '';
    if (adminFlowSurface) {
      return hubNombreCorto;
    }
    if (r === 'super_admin') return 'Super Admin';
    if (r === 'admin_nacional') return 'Admin Nacional';
    if (r === 'admin_club') return adminSedeNombre ? `Admin · ${adminSedeNombre}` : 'Admin';
    return hubNombreCorto;
  }, [
    session?.user,
    roleLoading,
    jugadorHubShellPath,
    rolEffectiveHeader,
    adminSedeNombre,
    hubNombreCorto,
    adminFlowSurface,
  ]);

  /** Destino del chip: admins (rol en DB/caché/JWT) → /admin; jugadores → /mi-perfil; también en shell Ranking/Reservar/Torneos/Perfil. */
  const hubChipNavPath = useMemo(
    () => hubChipNavigatePath(rolEffectiveHeader, roleLoading),
    [rolEffectiveHeader, roleLoading]
  );

  const hubFotoUrl = String(userProfile?.foto_url || userProfile?.foto || '').trim();
  const hubInicial = String(hubNombreCorto || '?')
    .charAt(0)
    .toUpperCase();
  const esRolAdminHub =
    hubAdminRolEver ||
    ADMIN_ROLES_CHIP.includes(rolEffectiveHeader || '') ||
    (Boolean(roleLoading) && LEGACY_GLOBAL_ADMIN_EMAILS_HEADER.includes(authEmail));
  /** En el hub de inicio (`hubDirectLogin` + /) siempre mostrar ⚙ aunque quede `adminFlowSurface` por contexto; fuera del hub, el atajo se oculta en flujo admin. Nunca en shell Ranking/Reservar/Torneos/Mi perfil. */
  const showAdminShortcutHub =
    !hideLogoutEffective &&
    esRolAdminHub &&
    !jugadorHubShellPath &&
    (!adminFlowSurface || (hubDirectLogin && hubInicioPath));

  const isOnAdmin = pathOnly === '/admin' || pathOnly.startsWith('/admin/');
  const showJugadorNotifications =
    Boolean(session?.user) &&
    !isOnAdmin &&
    !adminFlowSurface &&
    !isSedeProfilePathname(pathOnly);
  /** Torneo / equipo desde el panel: sin chip @ a la derecha; volver = avatar + nombre (no texto «← Admin»). */
  const adminTorneoEquipoDesdePanel = adminFlowSurface && !isOnAdmin;
  /** Hub: chip más chico y título más angosto para no tapar “Inicio”. */
  const compactHubChip = hubDirectLogin && hubInicioPath && Boolean(session?.user);

  /** Hub inicio con sesión: super admin → [⚙ Admin] sin chip; resto → chip (logout en Mi Perfil). */
  const hubHomeCompactHeader =
    hubDirectLogin && hubInicioPath && Boolean(session?.user);
  const muestraChipUsuarioHubDerecha =
    hubDirectLogin &&
    Boolean(session?.user) &&
    !(hubHomeCompactHeader && esRolAdminHub);
  const hubHeaderControlCount =
    (showAdminShortcutHub ? 1 : 0) +
    (showJugadorNotifications ? 1 : 0) +
    (muestraChipUsuarioHubDerecha ? 1 : 0);
  const hideHubCenterTitle = hubHomeCompactHeader && hubHeaderControlCount > 2;
  /** Hub inicio (UserHome): ⚙ Admin siempre columna izquierda — mismo criterio para super_admin y admin_club. */
  const botonAdminIzquierdaEnHub =
    showAdminShortcutHub && hubDirectLogin && hubInicioPath && Boolean(session?.user);

  /** Admin en hub inicio: ⚙ a la izquierda; título central puede ocultarse si hay muchos controles. */
  const adminHubInicioCompacto = hubHomeCompactHeader && showAdminShortcutHub;
  const shouldHideHubCenterTitle = adminHubInicioCompacto || hideHubCenterTitle;

  /** Chip identidad en la barra grid: nunca en hub inicio con `hubDirectLogin` (chip solo en /admin vía layout minimal o en rutas admin/torneo fuera del hub raíz). Incluye shell jugador (Ranking, Reservar, Torneos, Mi perfil). */
  const jugadorChipEnHeaderGrid =
    Boolean(session?.user) &&
    !adminTorneoEquipoDesdePanel &&
    !adminPanelMinimalHeader &&
    ((hubDirectLogin && muestraChipUsuarioHubDerecha) ||
      (adminFlowSurface && !(hubDirectLogin && hubInicioPath)) ||
      jugadorHubShellPath);

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
    if (isSedeProfilePathname(pathOnly)) {
      navigate(resolveSedePublicaBackToPath(location.state));
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
  /** Mín. 16px al borde derecho (toggle ☀️/🌙 en ~390px) + safe area; todas las pantallas con esta shell. */
  const padR = 'calc(16px + env(safe-area-inset-right, 0px))';

  useEffect(() => {
    if (!showHeaderSearch) {
      setSearchOpen(false);
    }
  }, [showHeaderSearch]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const handleDocClick = (ev) => {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(ev.target)) {
        setSearchOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [searchOpen]);

  useEffect(() => {
    const q = String(searchTerm || '').trim();
    if (!searchOpen || q.length < 3) {
      setSearchResults({ jugadores: [], torneos: [], sedes: [] });
      setSearchLoading(false);
      return undefined;
    }
    setSearchLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const qLike = `%${q}%`;
        const jugadoresP = supabase
          .from('jugadores_perfil')
          .select('alias, nombre, apellido, foto_url, nivel, nombre_completo')
          .or(`nombre.ilike.${qLike},apellido.ilike.${qLike},alias.ilike.${qLike},nombre_completo.ilike.${qLike}`)
          .limit(3);
        const torneosP = supabase
          .from('torneos')
          .select('id, nombre, fecha_inicio, estado, sede_id')
          .ilike('nombre', qLike)
          .order('fecha_inicio', { ascending: false })
          .limit(3);
        const sedesP = supabase
          .from('sedes')
          .select('id, nombre, ciudad, pais')
          .or(`nombre.ilike.${qLike},ciudad.ilike.${qLike}`)
          .limit(3);
        const [jRes, tRes, sRes] = await Promise.all([jugadoresP, torneosP, sedesP]);
        const torneosRows = Array.isArray(tRes.data) ? tRes.data : [];
        const sedeIds = [...new Set(torneosRows.map((r) => r?.sede_id).filter((id) => id != null))];
        let sedesById = {};
        if (sedeIds.length) {
          const { data: sedesRows } = await supabase.from('sedes').select('id, nombre').in('id', sedeIds);
          sedesById = Object.fromEntries((sedesRows || []).map((s) => [String(s.id), s.nombre]));
        }
        if (!cancelled) {
          setSearchResults({
            jugadores: (jRes.data || []).filter((r) => String(r?.alias || '').trim()),
            torneos: torneosRows.map((r) => ({
              ...r,
              sede_nombre: sedesById[String(r.sede_id)] || '',
            })),
            sedes: sRes.data || [],
          });
        }
      } catch {
        if (!cancelled) setSearchResults({ jugadores: [], torneos: [], sedes: [] });
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchTerm, searchOpen]);

  /** Solo desktop: max-width vía CSS (`.app-header-inner--max-body`), alineado al cuerpo (~900px). */
  const headerInnerCssVarStyle = useMemo(() => {
    const resolved =
      contentMaxWidth === null || contentMaxWidth === undefined || contentMaxWidth === ''
        ? HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX
        : Number(contentMaxWidth);
    if (!Number.isFinite(resolved) || resolved <= 0) return undefined;
    return { '--pm-header-inner-max': `${resolved}px` };
  }, [contentMaxWidth]);

  /** Panel admin: chip con apodo o nombre real (mismo criterio que el hub); nunca `alias`. */
  const adminMinimalRolCorto = useMemo(() => {
    if (!session?.user) return '';
    const r = rolEffectiveHeader || '';
    if (roleLoading && !r) return '…';
    if (r === 'super_admin' || r === 'admin_club' || r === 'admin_nacional') return hubNombreCorto;
    return 'Admin';
  }, [session?.user, roleLoading, rolEffectiveHeader, hubNombreCorto]);

  /** Inicial desde el mismo texto que el chip del header. */
  const adminMinimalInicial = useMemo(() => {
    const linea = String(hubNombreCorto || '').trim();
    if (linea) return linea.charAt(0).toUpperCase();
    const em = String(session?.user?.email || '').trim();
    if (em) return em.charAt(0).toUpperCase();
    return '?';
  }, [hubNombreCorto, session?.user?.email]);

  /** Texto junto al avatar en «volver al panel» (torneo/equipo desde admin): apodo o nombre real. */
  const adminPanelBackNombreLinea = useMemo(() => hubNombreCorto, [hubNombreCorto]);

  /** Ruta /admin: siempre barra compacta con sesión (refuerzo si falta el prop). */
  const useAdminMinimalLayout =
    adminPanelMinimalHeader || (Boolean(session?.user) && isOnAdmin);

  const renderSearchResultsSection = (titleTxt, rows, renderRow, onViewAll) => (
    <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 800, marginBottom: '4px' }}>{titleTxt}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sin resultados</div>
      ) : (
        rows.map(renderRow)
      )}
      <button
        type="button"
        onClick={onViewAll}
        style={{ marginTop: '4px', background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
      >
        Ver todos
      </button>
    </div>
  );

  const closeSearchPanel = () => {
    setSearchOpen(false);
    setSearchTerm('');
  };

  const searchUiBlock = !showHeaderSearch ? null : (
    <div ref={searchWrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {searchOpen ? (
        <div
          role="presentation"
          onClick={closeSearchPanel}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 12990,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding:
              'max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))',
            boxSizing: 'border-box',
            touchAction: 'none',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar en Padbol Match"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '600px',
              maxHeight:
                'min(85vh, calc(100svh - max(24px, env(safe-area-inset-top, 0px)) - max(24px, env(safe-area-inset-bottom, 0px))))',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-card)',
              borderRadius: '14px',
              boxShadow: '0 14px 34px rgba(2,6,23,0.25)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar jugadores, torneos o sedes…"
                enterKeyHint="search"
                style={{
                  flex: 1,
                  minWidth: 0,
                  boxSizing: 'border-box',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  padding: '10px 12px',
                  fontSize: '16px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                onClick={closeSearchPanel}
                aria-label="Cerrar búsqueda"
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--pm-color-muted-bg)',
                  color: 'var(--text-primary)',
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                padding: '10px 12px 14px',
              }}
            >
              {String(searchTerm || '').trim().length < 3 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Escribe al menos 3 caracteres.</div>
              ) : searchLoading ? (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Buscando…</div>
              ) : (
                <div style={{ display: 'grid', gap: '6px' }}>
                  {renderSearchResultsSection(
                    'Jugadores',
                    searchResults.jugadores,
                    (j, i) => (
                      <button
                        key={`j-${i}-${j.alias}`}
                        type="button"
                        onClick={() => {
                          closeSearchPanel();
                          navigate(`/jugador/${encodeURIComponent(String(j.alias || '').trim())}`);
                        }}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 0',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {j.foto_url ? (
                          <img src={j.foto_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)' }} />
                        )}
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                          {String(j.nombre || '').trim() || String(j.nombre_completo || '').trim() || 'Jugador'} ·{' '}
                          {formatAliasConArroba(j.alias)} · {j.nivel || '—'}
                        </span>
                      </button>
                    ),
                    () => {
                      closeSearchPanel();
                      navigate('/rankings');
                    }
                  )}
                  {renderSearchResultsSection(
                    'Torneos',
                    searchResults.torneos,
                    (t, i) => (
                      <button
                        key={`t-${i}-${t.id}`}
                        type="button"
                        onClick={() => {
                          closeSearchPanel();
                          navigate(`/torneo/${t.id}`);
                        }}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 0',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                          {t.nombre} · {t.sede_nombre || 'Sin sede'} · {String(t.fecha_inicio || '').slice(0, 10)} · {t.estado || '—'}
                        </span>
                      </button>
                    ),
                    () => {
                      closeSearchPanel();
                      navigate('/torneos');
                    }
                  )}
                  {renderSearchResultsSection(
                    'Sedes',
                    searchResults.sedes,
                    (s, i) => (
                      <button
                        key={`s-${i}-${s.id}`}
                        type="button"
                        onClick={() => {
                          closeSearchPanel();
                          navigate(`/sede/${s.id}`);
                        }}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 0',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                          {s.nombre} · {s.ciudad || '—'} · {s.pais || '—'}
                        </span>
                      </button>
                    ),
                    () => {
                      closeSearchPanel();
                      navigate('/sedes');
                    }
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setSearchOpen((v) => !v);
          if (searchOpen) setSearchTerm('');
        }}
        aria-label="Buscar"
        title="Buscar"
        style={{
          width: LOGOUT_BTN_SIZE,
          height: LOGOUT_BTN_SIZE,
          padding: 0,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.1)',
          color: '#e2e8f0',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <SearchIconSvg size={16} />
      </button>
    </div>
  );

  if (useAdminMinimalLayout) {
    const adminMinimalRow = (
      <>
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
              border: '1px solid var(--border)',
              background: 'var(--pm-color-muted-bg)',
              color: 'var(--text-primary)',
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
                  border: '1px solid var(--border)',
                }}
              />
            ) : (
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #E11B22, #b91c1c)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1px solid var(--border)',
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
        {searchUiBlock}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {session?.user ? <HubThemeSettingsButton compact barOnDark={theme === 'dark'} /> : null}
          {showLogoutAdminHeader && session?.user ? (
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
                background: 'var(--pm-color-muted-bg)',
                color: 'var(--text-primary)',
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
      </>
    );
    return (
      <div
        className="app-header-shell"
        style={{
          minHeight: '56px',
          background: 'var(--nav-bg)',
          paddingBottom: '8px',
          paddingLeft: padL,
          paddingRight: padR,
          borderBottom: '1px solid var(--nav-border)',
        }}
      >
        <div
          className="app-header-inner app-header-inner--max-body"
          style={headerInnerCssVarStyle}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              minHeight: '56px',
              minWidth: 0,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {adminMinimalRow}
          </div>
        </div>
      </div>
    );
  }

  /** `auto | 1fr | auto`: la columna central cede espacio al título con ellipsis; izq./der. al ancho intrínseco (chip, ☀️/🌙, campana) sin recortar en ~390px. */
  const headerGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    alignItems: 'center',
    columnGap: '8px',
    minHeight: '56px',
  };

  return (
    <div
      className="app-header-shell"
      style={{
        minHeight: '56px',
        background: hubLightBar ? 'var(--nav-bg)' : '#0f172a',
        paddingBottom: '8px',
        paddingLeft: padL,
        paddingRight: padR,
        borderBottom: hubLightBar ? '1px solid var(--nav-border)' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="app-header-inner app-header-inner--max-body" style={headerInnerCssVarStyle}>
      <div style={headerGridStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: hubHomeCompactHeader ? 'flex-start' : showBack ? 'flex-start' : 'flex-end',
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        {botonAdminIzquierdaEnHub ? (
          adminShortcutButton
        ) : hubHomeCompactHeader ? (
          <span
            aria-hidden
            style={{
              width: LOGOUT_BTN_SIZE,
              height: LOGOUT_BTN_SIZE,
              flexShrink: 0,
            }}
          />
        ) : showBack ? (
          adminFlowSurface ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label={pathOnly === '/admin' || pathOnly.startsWith('/admin/') ? 'Volver al inicio' : 'Volver al panel de administración'}
              title={pathOnly === '/admin' || pathOnly.startsWith('/admin/') ? 'Inicio' : 'Panel admin'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                maxWidth: 'min(52vw, 240px)',
                padding: '4px 10px 4px 4px',
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
                    background: 'linear-gradient(135deg, #E11B22, #b91c1c)',
                    color: '#fff',
                    fontSize: 13,
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
                  fontSize: 12,
                  fontWeight: 700,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  textAlign: 'left',
                  lineHeight: 1.2,
                }}
              >
                {adminPanelBackNombreLinea}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBack}
              style={{
                ...(hubLightBar
                  ? {
                      ...btnVolver,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }
                  : btnVolver),
                flexShrink: 0,
              }}
              aria-label="Volver atrás"
            >
              {displayBackLabel}
            </button>
          )
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
          width: '100%',
          maxWidth: compactHubChip ? 'min(38vw, 168px)' : 'min(72vw, 420px)',
          justifySelf: 'center',
        }}
      >
        {headerTitleDisplay ? (
          !shouldHideHubCenterTitle ? (
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                color: titleColor || (hubLightBar ? 'var(--text-primary)' : '#fff'),
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
              title={`${headerTitleDisplay} — Ir al inicio`}
              aria-label={`${headerTitleDisplay}, ir al inicio`}
            >
              {headerTitleDisplay}
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
          justifyContent:
            showAdminShortcutHub || (hubDirectLogin && !session?.user && !authLoading) ? 'flex-end' : 'flex-start',
          alignItems: 'center',
          flexShrink: 0,
          minWidth: 'min-content',
          boxSizing: 'border-box',
          justifySelf: hubDirectLogin && !session?.user && !authLoading ? 'end' : undefined,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: 0,
          }}
        >
            {jugadorChipEnHeaderGrid ? (
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
                  aria-label={
                    adminFlowSurface
                      ? 'Ir al panel de administración'
                      : hubChipNavPath === '/admin'
                        ? 'Ir al panel de administración'
                        : 'Ir a mi perfil'
                  }
                  title={
                    adminFlowSurface ? 'Panel admin' : hubChipNavPath === '/admin' ? 'Panel admin' : 'Mi perfil'
                  }
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
                    border: hubLightBar
                      ? '1px solid var(--border)'
                      : adminFlowSurface
                        ? '1px solid rgba(255,255,255,0.28)'
                        : 'none',
                    background: hubLightBar ? 'var(--bg-card)' : 'rgba(255,255,255,0.12)',
                    color: hubLightBar ? 'var(--text-primary)' : '#f8fafc',
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
                        border: hubLightBar ? '1px solid var(--border)' : '1px solid rgba(255,255,255,0.25)',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: adminFlowSurface ? 22 : compactHubChip ? 22 : 28,
                        height: adminFlowSurface ? 22 : compactHubChip ? 22 : 28,
                        borderRadius: '50%',
                        background: hubLightBar ? 'var(--bg-card)' : 'linear-gradient(135deg, #E11B22, #b91c1c)',
                        color: hubLightBar ? 'var(--accent)' : '#fff',
                        fontSize: adminFlowSurface ? 10 : compactHubChip ? 10 : 12,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: hubLightBar ? '1px solid var(--border)' : 'none',
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
            {showAdminShortcutHub && !botonAdminIzquierdaEnHub ? adminShortcutButton : null}
            {jugadorHubShellPath && hubLightBar ? (
              <HubThemeSettingsButton compact={compactHubChip} />
            ) : null}
            {showJugadorNotifications ? (
              <JugadorNotificationsBell compact={compactHubChip} headerLight={hubLightBar} />
            ) : null}
            {searchUiBlock}
            {hubDirectLogin && !session?.user && !authLoading ? (
              <button
                type="button"
                onClick={() => navigate('/auth')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.28)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(248,250,252,0.88)',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: 'none',
                }}
              >
                Ingresar
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
            ) : null}
          </div>
      </div>
      </div>
      </div>
    </div>
  );
}
