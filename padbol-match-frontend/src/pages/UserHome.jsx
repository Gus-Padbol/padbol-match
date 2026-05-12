import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import {
  HUB_NAV_HEIGHT_PX,
  hubBottomNavMaxWidthPx,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { nombreRealDesdePerfilOauth } from '../utils/displayName';
import PwaInstallButtonWithModal from '../components/PwaInstallButtonWithModal';
import { PERFIL_CHANGE_EVENT } from '../utils/jugadorPerfil';
import { isPwaStandalone } from '../utils/isPwaStandalone';
import useUserRole from '../hooks/useUserRole';
import { DEPORTES_CANCHA_SEDE_KEYS, DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';

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

const HUB_CARD_HEIGHT_PX = 180;

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
  color: '#0F0F0F',
  padding: '14px 24px',
  borderRadius: '8px',
  border: '1px solid #E0E0E0',
  background: '#F5F5F5',
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
  const { rol, loading: roleLoading } = useUserRole(currentCliente);

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
  const padR = 'calc(12px + env(safe-area-inset-right, 0px))';

  const bigCards = useMemo(() => {
    const q = deporteQuery(deporteElegido);
    const rows = hubCmsStatus === 'ok' && Array.isArray(hubCmsRows) ? hubCmsRows : [];
    return HUB_FIXED_ACTIONS.map((slot) => {
      const imageUrl = pickHubCmsPhotoUrl(rows, slot.cmsPhotoIds);
      return {
        key: slot.key,
        titulo: tituloHubCardConDeporte(slot.titulo, deporteElegido),
        subtitulo: slot.subtitulo,
        imageUrl,
        onClick: () => navigate(`${slot.to}${q}`),
      };
    });
  }, [hubCmsStatus, hubCmsRows, navigate, deporteElegido]);

  const scrollPaddingBottom = `calc(${HUB_NAV_HEIGHT_PX + 28}px + env(safe-area-inset-bottom, 0px))`;

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: '#FFFFFF',
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
          background: '#FFFFFF',
          paddingBottom: '8px',
          paddingLeft: padL,
          paddingRight: padR,
          borderBottom: '1px solid #E0E0E0',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: hubBottomNavMaxWidthPx,
            marginLeft: 'auto',
            marginRight: 'auto',
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
                      border: '2px solid #E0E0E0',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: '#F5F5F5',
                      color: '#E11B22',
                      fontSize: 18,
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      border: '2px solid #E0E0E0',
                    }}
                  >
                    {hubInicial}
                  </span>
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: '#0F0F0F',
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
                  <div style={{ color: '#6B6B6B', fontSize: 14, fontWeight: 400, marginTop: 2 }}>Bienvenido de nuevo.</div>
                </div>
              </button>
            ) : (
              <>
                <span
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#F5F5F5',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                    border: '1px solid #E0E0E0',
                  }}
                  aria-hidden
                >
                  👋
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: '#0F0F0F',
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
                  border: '1px solid #E0E0E0',
                  background: '#F5F5F5',
                  color: '#0F0F0F',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isOnAdmin ? '←' : '⚙'}
              </button>
            ) : null}
            {!session?.user && authLoading ? (
              <span style={{ color: '#6B6B6B', fontSize: 12 }}>…</span>
            ) : !session?.user ? (
              <button
                type="button"
                onClick={() => navigate('/auth')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#E11B22',
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
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          boxSizing: 'border-box',
          paddingTop: hubContentPaddingTopCss(location.pathname),
          paddingBottom: scrollPaddingBottom,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            ...hubInstagramColumnWrapStyle,
            width: '100%',
            maxWidth: HUB_COLUMN_MAX,
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
            paddingTop: 16,
            boxSizing: 'border-box',
          }}
        >
          <img
            src="/logo-padbol-match.png"
            alt="Padbol Match"
            style={{
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto',
              height: 56,
              width: 'auto',
              maxWidth: 'min(88vw, 320px)',
              objectFit: 'contain',
              marginBottom: 20,
            }}
          />

          {session?.user ? (
            <label style={{ display: 'block', width: '100%', marginBottom: 18 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B6B6B', marginBottom: 6 }}>Elegir deporte</span>
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
                    padding: '14px 40px 14px 14px',
                    borderRadius: 8,
                    border: '1px solid #E0E0E0',
                    background: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: 400,
                    color: '#0F0F0F',
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
                    color: '#6B6B6B',
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
                margin: '0 0 16px',
                fontSize: 14,
                fontWeight: 400,
                color: '#6B6B6B',
                lineHeight: 1.45,
              }}
            >
              Puedes explorar sin registrarte
            </p>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', marginBottom: 20 }}>
            {bigCards.map((c) => {
              const hasPhoto = Boolean(c.imageUrl);
              return (
              <button
                key={c.key}
                type="button"
                onClick={c.onClick}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: HUB_CARD_HEIGHT_PX,
                  minHeight: HUB_CARD_HEIGHT_PX,
                  maxHeight: HUB_CARD_HEIGHT_PX,
                  textAlign: 'left',
                  border: 'none',
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  backgroundColor: hasPhoto ? '#1a1a1a' : '#2d2d2d',
                  backgroundImage: hasPhoto ? `url(${c.imageUrl})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(225, 27, 34, 0.48)',
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'flex-start',
                    padding: '14px 16px 16px',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      color: '#fff',
                      fontSize: 18,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      textShadow: '0 1px 3px rgba(0,0,0,0.45)',
                    }}
                  >
                    {c.titulo}
                  </span>
                  {c.subtitulo ? (
                    <span
                      style={{
                        display: 'block',
                        marginTop: 6,
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 700,
                        lineHeight: 1.35,
                        textShadow: '0 1px 3px rgba(0,0,0,0.45)',
                      }}
                    >
                      {c.subtitulo}
                    </span>
                  ) : null}
                </div>
              </button>
            );
            })}
          </div>
        </div>

        {!isPwaStandalone() ? (
          <div
            style={{
              marginTop: 'auto',
              flexShrink: 0,
              width: '100%',
              maxWidth: HUB_COLUMN_MAX,
              boxSizing: 'border-box',
              paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
              paddingTop: 12,
            }}
          >
            <div
              style={{
                padding: '16px',
                borderRadius: 12,
                background: '#F5F5F5',
                border: '1px solid #E0E0E0',
                boxSizing: 'border-box',
                textAlign: 'center',
                color: '#0F0F0F',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 400, lineHeight: 1.45, color: '#6B6B6B' }}>
                Instala Padbol Match en tu teléfono para abrirla como app y entrar más rápido.
              </p>
              <PwaInstallButtonWithModal buttonStyle={hubPwaInstallButtonStyle} />
            </div>
          </div>
        ) : null}
      </div>
      <BottomNav />
    </div>
  );
}
