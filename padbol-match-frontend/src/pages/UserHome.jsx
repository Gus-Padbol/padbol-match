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
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';

const HUB_COLUMN_MAX = 390;

const HUB_CARD_IMAGES = {
  partidos: 'https://images.unsplash.com/photo-1526676531761-c6e1654d599b?w=800&q=80',
  torneos: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  perfil: 'https://images.unsplash.com/photo-1534438327276-14e53078660e?w=800&q=80',
  sedes: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
};

const ADMIN_ROLES_CHIP = ['super_admin', 'admin_nacional', 'admin_club', 'empleado'];
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
  const [deporteElegido, setDeporteElegido] = useState('');
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

  const irPartidosCerca = () => {
    const q = deporteElegido ? `?deporte=${encodeURIComponent(deporteElegido)}` : '';
    navigate(`/jugar/buscar${q}`);
  };

  const bigCards = [
    {
      key: 'partidos',
      titulo: 'Partidos cerca de ti',
      subtitulo: 'Si no hay, ¡Crea uno!',
      image: HUB_CARD_IMAGES.partidos,
      onClick: irPartidosCerca,
    },
    {
      key: 'torneos',
      titulo: 'Torneos',
      subtitulo: 'Torneos y rankings.',
      image: HUB_CARD_IMAGES.torneos,
      onClick: () => navigate('/competir'),
    },
    {
      key: 'perfil',
      titulo: 'Mi perfil',
      subtitulo: 'Perfil, estadísticas e historial.',
      image: HUB_CARD_IMAGES.perfil,
      onClick: () => navigate('/mi-perfil'),
    },
    {
      key: 'sedes',
      titulo: 'Explorar sedes',
      subtitulo: '',
      image: HUB_CARD_IMAGES.sedes,
      onClick: () => navigate('/sedes'),
    },
  ];

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
                onClick={() => navigate(isOnAdmin ? '/' : '/admin')}
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
                  onChange={(e) => setDeporteElegido(e.target.value)}
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
            {bigCards.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={c.onClick}
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: 152,
                  textAlign: 'left',
                  border: 'none',
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  background: `#6B6B6B url(${c.image}) center/cover no-repeat`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(225,27,34,0.55) 100%)',
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    minHeight: 152,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: 16,
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ display: 'block', color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1.25, textShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
                    {c.titulo}
                  </span>
                  {c.subtitulo ? (
                    <span style={{ display: 'block', marginTop: 6, color: 'rgba(255,255,255,0.95)', fontSize: 14, fontWeight: 400, lineHeight: 1.35 }}>
                      {c.subtitulo}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
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
