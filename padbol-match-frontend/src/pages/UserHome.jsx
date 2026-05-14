import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import {
  HUB_NAV_HEIGHT_PX,
  hubBottomNavMaxWidthPx,
  hubInstagramColumnWrapStyle,
  hubUserHomeChromeSpacerHeightCss,
} from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { nombreRealDesdePerfilOauth } from '../utils/displayName';
import PwaInstallButtonWithModal from '../components/PwaInstallButtonWithModal';
import { PERFIL_CHANGE_EVENT } from '../utils/jugadorPerfil';
import { isPwaStandalone } from '../utils/isPwaStandalone';
import useUserRole from '../hooks/useUserRole';
import { useHubSponsors } from '../hooks/useHubSponsors';
import HubTercerTiempoSponsor from '../components/HubTercerTiempoSponsor';
import { DEPORTES_CANCHA_SEDE_KEYS, DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { hubCardPhotoFallback, hubCardPhotoPorDeporte } from '../constants/hubFotosPorDeporte';
import { pickHubDeporteRow } from '../utils/hubDeporteConfig';
import HubThemeSettingsButton from '../components/HubThemeSettingsButton';
import './UserHome.css';

const HUB_COLUMN_MAX = 390;

/** Cuatro acciones fijas del hub (orden fijo). `cmsPhotoIds`: ids en hub-config para foto opcional. */
const HUB_FIXED_ACTIONS = [
  {
    key: 'reservar',
    titulo: 'Reservar cancha',
    subtitulo: 'Ya tengo equipo, quiero una cancha.',
    to: '/reservar',
    cmsPhotoIds: ['reservar'],
  },
  {
    key: 'buscar_partido',
    titulo: 'Buscar partido',
    subtitulo: 'Quiero unirme a un partido que ya existe.',
    to: '/jugar/buscar',
    cmsPhotoIds: ['buscar_partido', 'partidos'],
  },
  {
    key: 'torneos',
    titulo: 'Torneos',
    subtitulo: 'Torneos y rankings.',
    to: '/competir',
    cmsPhotoIds: ['torneos'],
  },
  {
    key: 'armar_partido',
    titulo: 'Armar partido',
    subtitulo: 'Quiero crear un partido y sumar jugadores.',
    to: '/jugar/armar',
    cmsPhotoIds: ['armar_partido', 'jugar', 'armar-partido'],
  },
];

const HUB_CARD_OVERLAY = 'rgba(180, 20, 20, 0.35)';
const HUB_CARD_FALLBACK_BG = '#2d2d2d';
/** Altura fija de cada card del hub (impacto visual). */
const HUB_CARD_HEIGHT_PX = 130;
/** Separación entre cards del hub. */
const HUB_CARD_GAP_PX = 8;
/** Alto del bloque con scroll interno (cards + 3er Tiempo + PWA): ~3.5 cards + gaps; el resto se ve al desplazar. */
const HUB_CARDS_STACK_MAX_PX = 3.5 * HUB_CARD_HEIGHT_PX + 3 * HUB_CARD_GAP_PX;
/** Aire bajo el chrome fijo antes del contenido (máx. compacto para acercar «Elegir deporte» arriba). */
const USER_HOME_SCROLL_INNER_PAD_TOP_PX = 0;

function deporteQuery(deporteElegido) {
  const dep = String(deporteElegido || '').trim().toLowerCase();
  return dep && DEPORTES_CANCHA_SEDE_KEYS.includes(dep) ? `?deporte=${encodeURIComponent(dep)}` : '';
}

function etiquetaDeporteHub(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_OPTIONS.find((d) => d.key === k)?.label || '';
}

/** Título con sufijo de deporte si aplica; subtítulos fijos del producto. */
function tituloHubCardConDeporte(tituloBase, deporteKey) {
  if (!deporteKey || !DEPORTES_CANCHA_SEDE_KEYS.includes(deporteKey)) return tituloBase;
  const label = etiquetaDeporteHub(deporteKey);
  return `${tituloBase} · ${label}`;
}

function pickHubCmsPhotoUrl(rows, cmsPhotoIds) {
  if (!Array.isArray(rows) || !cmsPhotoIds?.length) return '';
  for (const wantedId of cmsPhotoIds) {
    const row = rows.find((r) => {
      if (r == null || typeof r !== 'object') return false;
      if (r.activo === false || r.activo === 'false' || r.activo === 0) return false;
      return String(r.id || '').trim() === wantedId;
    });
    const foto = row && String(row.foto_url || '').trim();
    if (foto) return foto;
  }
  return '';
}

/** Persiste el filtro «Elegir deporte» del hub entre visitas (misma pestaña / sesión). */
const HUB_DEPORTE_SESSION_KEY = 'padbol_hub_deporte_filter';

const HUB_API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

const ADMIN_ROLES_CHIP = ['super_admin', 'admin_nacional', 'admin_club', 'empleado', 'editor_contenido'];
const LEGACY_GLOBAL_ADMIN_EMAILS = [
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
];

function readCachedRolHeader() {
  try {
    return JSON.parse(localStorage.getItem('user_role_data') || '{}')?.rol || null;
  } catch {
    return null;
  }
}

function emailEsLegacyAdminHub(emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();
  return LEGACY_GLOBAL_ADMIN_EMAILS.includes(email);
}

const hubPwaInstallButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  padding: '14px 24px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

function esPlaceholderJugador(s) {
  return String(s || '').trim().toLowerCase() === 'jugador';
}

function capitalizarPalabraSaludo(w) {
  const t = String(w || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function nombreDesdeApodoPerfil(userProfile) {
  if (!userProfile || typeof userProfile !== 'object') return '';
  const raw = userProfile.apodo;
  if (raw == null) return '';
  const v = String(raw).trim();
  return v || '';
}

function primerNombreDesdePerfil(userProfile) {
  const v = String(userProfile?.nombre || '').trim();
  if (!v || esPlaceholderJugador(v)) return '';
  const first = v.split(/\s+/).filter(Boolean)[0] || '';
  return first ? capitalizarPalabraSaludo(first) : '';
}

export default function UserHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading, userProfile, profileLoading, refreshSession } = useAuth();
  const [nombreFinal, setNombreFinal] = useState(null);
  const [deporteElegido, setDeporteElegido] = useState(() => {
    try {
      const raw = sessionStorage.getItem(HUB_DEPORTE_SESSION_KEY);
      const k = String(raw || '').trim().toLowerCase();
      return DEPORTES_CANCHA_SEDE_KEYS.includes(k) ? k : '';
    } catch {
      return '';
    }
  });
  const [hubCmsStatus, setHubCmsStatus] = useState('loading');
  const [hubCmsRows, setHubCmsRows] = useState([]);
  const [hubDeporteStatus, setHubDeporteStatus] = useState('loading');
  const [hubDeporteRows, setHubDeporteRows] = useState([]);
  /** Si la URL de fondo falla al cargar, se oculta y se usa el fondo gris oscuro. */
  const [hubCardImageFailed, setHubCardImageFailed] = useState({});
  const [hubAdminRolEver, setHubAdminRolEver] = useState(() => {
    if (ADMIN_ROLES_CHIP.includes(readCachedRolHeader() || '')) return true;
    if (emailEsLegacyAdminHub(session?.user?.email)) return true;
    return false;
  });

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { rol, loading: roleLoading, sedeId: hubSedeId, pais: hubPaisUsuario } = useUserRole(currentCliente);

  useEffect(() => {
    if (!session?.user) {
      setHubAdminRolEver(false);
      return;
    }
    if (emailEsLegacyAdminHub(session.user.email)) setHubAdminRolEver((p) => p || true);
    if (ADMIN_ROLES_CHIP.includes(rol || '')) setHubAdminRolEver((p) => p || true);
  }, [session?.user, rol]);

  const rolEffective = useMemo(() => {
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

  const esRolAdminHub =
    hubAdminRolEver ||
    ADMIN_ROLES_CHIP.includes(rolEffective || '') ||
    (Boolean(roleLoading) &&
      LEGACY_GLOBAL_ADMIN_EMAILS.includes(String(session?.user?.email || '').trim().toLowerCase()));
  const isOnAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const showAdminShortcut = Boolean(session?.user) && esRolAdminHub;

  useEffect(() => {
    const onPerfil = () => {
      void refreshSession();
    };
    window.addEventListener(PERFIL_CHANGE_EVENT, onPerfil);
    return () => window.removeEventListener(PERFIL_CHANGE_EVENT, onPerfil);
  }, [refreshSession]);

  useEffect(() => {
    if (session?.user) return;
    setNombreFinal(null);
    try {
      localStorage.removeItem('padbol_nombre_saludo');
      localStorage.removeItem('padbol_nombre_saludo_uid');
    } catch {
      /* ignore */
    }
  }, [session?.user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${HUB_API_BASE}/api/hub-config`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data)) {
          setHubCmsStatus('error');
          setHubCmsRows([]);
          return;
        }
        setHubCmsRows(data);
        setHubCmsStatus('ok');
      } catch {
        if (!cancelled) {
          setHubCmsStatus('error');
          setHubCmsRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${HUB_API_BASE}/api/hub-deporte-config`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data)) {
          setHubDeporteStatus('error');
          setHubDeporteRows([]);
          return;
        }
        setHubDeporteRows(data);
        setHubDeporteStatus('ok');
      } catch {
        if (!cancelled) {
          setHubDeporteStatus('error');
          setHubDeporteRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHubCardImageFailed({});
  }, [hubCmsRows, hubCmsStatus, hubDeporteRows, hubDeporteStatus, deporteElegido]);

  useEffect(() => {
    if (!session?.user) return;
    if (authLoading || profileLoading) return;
    if (!userProfile) {
      setNombreFinal('');
      return;
    }
    const ap = nombreDesdeApodoPerfil(userProfile);
    if (ap) {
      setNombreFinal(ap.charAt(0).toUpperCase() + ap.slice(1));
      return;
    }
    const nom = primerNombreDesdePerfil(userProfile);
    if (nom) {
      setNombreFinal(nom);
      return;
    }
    const fullLine = nombreRealDesdePerfilOauth(userProfile, session);
    if (fullLine) {
      const first = fullLine.split(/\s+/).filter(Boolean)[0] || fullLine;
      setNombreFinal(capitalizarPalabraSaludo(first));
      return;
    }
    setNombreFinal('');
  }, [session, userProfile, authLoading, profileLoading]);

  const lineaSaludo = useMemo(() => {
    if (!session?.user) return 'Hola';
    if (nombreFinal) return `Hola, ${nombreFinal}`;
    return 'Hola';
  }, [session?.user, nombreFinal]);

  const nombreTitulo = nombreFinal || (session?.user ? lineaSaludo.replace(/^Hola,?\s*/i, '').trim() : '');

  const hubFotoUrl = String(userProfile?.foto_url || userProfile?.foto || '').trim();
  const hubInicial = String(lineaSaludo.replace(/^Hola,?\s*/i, '').trim() || '?')
    .charAt(0)
    .toUpperCase();

  const padL = 'calc(12px + env(safe-area-inset-left, 0px))';
  const padR = 'calc(16px + env(safe-area-inset-right, 0px))';

  const paisParaSponsors = String(hubPaisUsuario || userProfile?.pais || '').trim();
  const { tercerTiempoSponsor } = useHubSponsors({
    sedeId: hubSedeId != null && Number.isFinite(Number(hubSedeId)) ? Number(hubSedeId) : null,
    pais: paisParaSponsors,
    enabled: true,
  });

  const bigCards = useMemo(() => {
    const q = deporteQuery(deporteElegido);
    const rows = hubCmsStatus === 'ok' && Array.isArray(hubCmsRows) ? hubCmsRows : [];
    const depRows = Array.isArray(hubDeporteRows) ? hubDeporteRows : [];
    const hubDeporteOk = hubDeporteStatus === 'ok';
    return HUB_FIXED_ACTIONS.map((slot) => {
      const depRow = hubDeporteOk ? pickHubDeporteRow(depRows, deporteElegido, slot.key) : null;
      const depFoto = depRow && String(depRow.foto_url || '').trim();
      const cmsUrl = pickHubCmsPhotoUrl(rows, slot.cmsPhotoIds);
      const porDeporte = deporteElegido ? hubCardPhotoPorDeporte(deporteElegido, slot.key) : '';
      const fallbackUrl = porDeporte || hubCardPhotoFallback(slot.key);
      const imageUrl = depFoto || cmsUrl || fallbackUrl;
      const tituloBase =
        depRow && String(depRow.titulo || '').trim() ? String(depRow.titulo).trim() : slot.titulo;
      const subtitulo =
        depRow != null && depRow.subtitulo != null ? String(depRow.subtitulo) : slot.subtitulo;
      return {
        key: slot.key,
        titulo: tituloHubCardConDeporte(tituloBase, deporteElegido),
        subtitulo,
        imageUrl,
        onClick: () => navigate(`${slot.to}${q}`),
      };
    });
  }, [hubCmsStatus, hubCmsRows, hubDeporteStatus, hubDeporteRows, navigate, deporteElegido]);

  const scrollPaddingBottom = `calc(${HUB_NAV_HEIGHT_PX + 28}px + env(safe-area-inset-bottom, 0px))`;
  const userHomeChromeSpacerH = hubUserHomeChromeSpacerHeightCss(location.pathname);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        boxSizing: 'border-box',
      }}
    >
      <header
        className="app-header-shell"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1002,
          minHeight: '56px',
          background: 'var(--nav-bg)',
          paddingBottom: '8px',
          paddingLeft: padL,
          paddingRight: padR,
          borderBottom: '1px solid var(--nav-border)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: hubBottomNavMaxWidthPx,
            marginLeft: 'auto',
            marginRight: 'auto',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            minHeight: 56,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            {session?.user ? (
              <button
                type="button"
                onClick={() => navigate('/mi-perfil')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minWidth: 0,
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
                aria-label="Ir a mi perfil"
              >
                {hubFotoUrl ? (
                  <img
                    src={hubFotoUrl}
                    alt=""
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '2px solid var(--border)',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'var(--bg-card)',
                      color: 'var(--accent)',
                      fontSize: 18,
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      border: '2px solid var(--border)',
                    }}
                  >
                    {hubInicial}
                  </span>
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: 22,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {nombreTitulo ? `¡Hola ${nombreTitulo}!` : lineaSaludo}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 400, marginTop: 2 }}>Bienvenido de nuevo.</div>
                </div>
              </button>
            ) : (
              <>
                <span
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--bg-card)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                    border: '1px solid var(--border)',
                  }}
                  aria-hidden
                >
                  👋
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: 22,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {lineaSaludo}
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <HubThemeSettingsButton compact />
            {showAdminShortcut ? (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    isOnAdmin
                      ? '/'
                      : rolEffective === 'editor_contenido'
                        ? '/admin?tab=personalizar_hub'
                        : '/admin'
                  )
                }
                aria-label={isOnAdmin ? 'Volver a la app' : 'Ir a Admin'}
                title={isOnAdmin ? 'App' : 'Admin'}
                style={{
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isOnAdmin ? '←' : '⚙'}
              </button>
            ) : null}
            {!session?.user && authLoading ? (
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>…</span>
            ) : !session?.user ? (
              <button
                type="button"
                onClick={() => navigate('/auth')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Ingresar
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: '100%',
          height: userHomeChromeSpacerH,
          pointerEvents: 'none',
          background: 'var(--bg-page)',
        }}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          boxSizing: 'border-box',
          paddingTop: USER_HOME_SCROLL_INNER_PAD_TOP_PX,
          paddingBottom: scrollPaddingBottom,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          background: 'var(--bg-page)',
        }}
      >
        <div
          style={{
            ...hubInstagramColumnWrapStyle,
            width: '100%',
            maxWidth: HUB_COLUMN_MAX,
            marginLeft: 'auto',
            marginRight: 'auto',
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
            paddingTop: 0,
            paddingBottom: 0,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          {session?.user ? (
            <label style={{ display: 'block', width: '100%', marginBottom: 2, marginTop: 0, flexShrink: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                }}
              >
                Elegir deporte
              </span>
              <div style={{ position: 'relative' }}>
                <select
                  value={deporteElegido}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDeporteElegido(v);
                    try {
                      if (v) sessionStorage.setItem(HUB_DEPORTE_SESSION_KEY, v);
                      else sessionStorage.removeItem(HUB_DEPORTE_SESSION_KEY);
                    } catch {
                      /* ignore */
                    }
                  }}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    padding: '10px 40px 10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    fontSize: 15,
                    fontWeight: 400,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Todos los deportes</option>
                  {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                  }}
                >
                  ▼
                </span>
              </div>
            </label>
          ) : null}

          {!authLoading && !session?.user ? (
            <p
              style={{
                textAlign: 'center',
                margin: '0 0 6px',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                lineHeight: 1.35,
                flexShrink: 0,
              }}
            >
              Puedes explorar sin registrarte
            </p>
          ) : null}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: HUB_CARD_GAP_PX,
              width: '100%',
              maxHeight: HUB_CARDS_STACK_MAX_PX,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              flexShrink: 0,
              marginBottom: 0,
            }}
          >
            {bigCards.map((c) => {
              const failId = `${c.key}|${c.imageUrl || ''}`;
              const showPhoto = Boolean(c.imageUrl) && !hubCardImageFailed[failId];
              return (
              <button
                key={c.key}
                type="button"
                onClick={c.onClick}
                className="hub-surface-card"
                style={{
                  position: 'relative',
                  width: '100%',
                  flex: '0 0 auto',
                  textAlign: 'left',
                  border: 'none',
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  backgroundColor: showPhoto ? '#1a1a1a' : HUB_CARD_FALLBACK_BG,
                }}
              >
                {showPhoto && c.imageUrl ? (
                  <div
                    key={failId}
                    className="hub-card-cover-layer"
                    style={{ backgroundImage: `url(${c.imageUrl})` }}
                    aria-hidden
                  />
                ) : null}
                {c.imageUrl ? (
                  <img
                    alt=""
                    src={c.imageUrl}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    onError={() => {
                      setHubCardImageFailed((prev) => {
                        if (prev[failId]) return prev;
                        return { ...prev, [failId]: true };
                      });
                    }}
                  />
                ) : null}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: HUB_CARD_OVERLAY,
                  }}
                />
                <div
                  className="hub-surface-card__text"
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'flex-start',
                    boxSizing: 'border-box',
                  }}
                >
                  <span className="hub-surface-card__title">{c.titulo}</span>
                  {c.subtitulo ? (
                    <span className="hub-surface-card__sub">{c.subtitulo}</span>
                  ) : null}
                </div>
              </button>
            );
            })}
            <HubTercerTiempoSponsor sponsor={tercerTiempoSponsor} />

            {!isPwaStandalone() ? (
              <div
                style={{
                  flexShrink: 0,
                  width: '100%',
                  marginTop: 14,
                  paddingBottom: 8,
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    color: 'var(--text-primary)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 400, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                    Instala Padbol Match en tu teléfono para abrirla como app y entrar más rápido.
                  </p>
                  <PwaInstallButtonWithModal buttonStyle={hubPwaInstallButtonStyle} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
