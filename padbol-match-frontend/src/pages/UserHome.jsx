import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import JugadorNotificationsBell from '../components/JugadorNotificationsBell';
import {
  HUB_NAV_HEIGHT_PX,
  hubBottomNavMaxWidthPx,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { nombreRealDesdePerfilOauth } from '../utils/displayName';
import PwaInstallButtonWithModal from '../components/PwaInstallButtonWithModal';
import { DEPORTE_LABEL_PARTIDO_ABIERTO } from '../components/PartidoAbiertoCard';
import { PERFIL_CHANGE_EVENT } from '../utils/jugadorPerfil';
import { isPwaStandalone } from '../utils/isPwaStandalone';
import useUserRole from '../hooks/useUserRole';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

const HUB_COLUMN_MAX = 390;

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
  fontWeight: 700,
  color: '#1e293b',
  padding: '12px 20px',
  borderRadius: '12px',
  border: 'none',
  background: '#ffffff',
  boxShadow: '0 8px 22px rgba(0,0,0,0.18)',
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

function horaCorta(hora) {
  const h = String(hora || '').trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(h);
  return m ? `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}` : h || '—';
}

function PartidoAbiertoRailCard({ partido, onNavigate }) {
  const confirmados = Array.isArray(partido?.jugadores_confirmados) ? partido.jugadores_confirmados : [];
  const requeridos = Math.max(2, parseInt(String(partido?.jugadores_requeridos || '4'), 10) || 4);
  const faltan = Math.max(0, requeridos - confirmados.length);
  const capitanFoto = String(partido?.capitan_foto_url || '').trim();
  const capitanNombre = String(partido?.capitan_nombre || '').trim() || 'Capitán';
  const deporte = DEPORTE_LABEL_PARTIDO_ABIERTO[partido?.deporte] || partido?.deporte || 'Partido';

  return (
    <button
      type="button"
      onClick={onNavigate}
      style={{
        flex: '0 0 auto',
        width: 'min(280px, 78vw)',
        maxWidth: 280,
        textAlign: 'left',
        border: '1px solid rgba(226,232,240,0.95)',
        borderRadius: 16,
        background: '#fff',
        boxShadow: '0 10px 28px rgba(15,23,42,0.12)',
        padding: 12,
        boxSizing: 'border-box',
        cursor: 'pointer',
        display: 'grid',
        gap: 8,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {capitanFoto ? (
          <img
            src={capitanFoto}
            alt=""
            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#667eea,#764ba2)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            {capitanNombre.charAt(0).toUpperCase()}
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{deporte}</div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {partido?.sede_nombre || 'Sede'}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
        {String(partido?.fecha || '').slice(0, 10)} · {horaCorta(partido?.hora)}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: faltan > 0 ? '#047857' : '#4338ca',
          background: faltan > 0 ? '#ecfdf5' : '#eef2ff',
          borderRadius: 999,
          padding: '6px 10px',
          display: 'inline-block',
          width: 'fit-content',
        }}
      >
        {faltan > 0 ? `Faltan ${faltan} jugador${faltan === 1 ? '' : 'es'}` : 'Completo'}
      </div>
    </button>
  );
}

export default function UserHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading, userProfile, profileLoading, refreshSession } = useAuth();
  const [partidosAbiertos, setPartidosAbiertos] = useState([]);
  const [partidosLoading, setPartidosLoading] = useState(true);
  const [nombreFinal, setNombreFinal] = useState(null);
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

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/partidos-abiertos`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPartidosAbiertos(Array.isArray(data) ? data.slice(0, 24) : []);
      })
      .catch(() => {
        if (!cancelled) setPartidosAbiertos([]);
      })
      .finally(() => {
        if (!cancelled) setPartidosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lineaSaludo = useMemo(() => {
    if (!session?.user) return 'Hola';
    if (nombreFinal) return `Hola, ${nombreFinal}`;
    return 'Hola';
  }, [session?.user, nombreFinal]);

  const hubFotoUrl = String(userProfile?.foto_url || userProfile?.foto || '').trim();
  const hubInicial = String(lineaSaludo.replace(/^Hola,?\s*/i, '').trim() || '?')
    .charAt(0)
    .toUpperCase();

  const padL = 'calc(12px + env(safe-area-inset-left, 0px))';
  const padR = 'calc(12px + env(safe-area-inset-right, 0px))';

  const modulos = [
    {
      key: 'jugar',
      icon: '🎮',
      titulo: 'JUGAR',
      descripcion: 'Reservá una cancha o unite a un partido',
      onClick: () => navigate('/jugar'),
    },
    {
      key: 'competir',
      icon: '🏆',
      titulo: 'COMPETIR',
      descripcion: 'Torneos y rankings',
      onClick: () => navigate('/competir'),
    },
    {
      key: 'perfil',
      icon: '👤',
      titulo: 'MI PERFIL',
      descripcion: 'Tu perfil, estadísticas e historial',
      onClick: () => navigate('/mi-perfil'),
    },
  ];

  const partidosDestacadosArriba = !partidosLoading && partidosAbiertos.length > 0;
  const partidosBloqueAbajo = partidosLoading || partidosAbiertos.length === 0;

  const scrollPaddingBottom = `calc(${HUB_NAV_HEIGHT_PX + 28}px + env(safe-area-inset-bottom, 0px))`;

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
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
          background: '#0f172a',
          paddingBottom: '8px',
          paddingLeft: padL,
          paddingRight: padR,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
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
          <button
            type="button"
            onClick={() => {
              if (session?.user) navigate('/mi-perfil');
            }}
            disabled={!session?.user}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 0,
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: '4px 0',
              cursor: session?.user ? 'pointer' : 'default',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
            aria-label={session?.user ? 'Ir a mi perfil' : undefined}
          >
            {session?.user ? (
              hubFotoUrl ? (
                <img
                  src={hubFotoUrl}
                  alt=""
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: '2px solid rgba(255,255,255,0.25)',
                  }}
                />
              ) : (
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 800,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {hubInicial}
                </span>
              )
            ) : (
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
                aria-hidden
              >
                👋
              </span>
            )}
            <span
              style={{
                color: '#f8fafc',
                fontSize: 17,
                fontWeight: 700,
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {lineaSaludo}
            </span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {session?.user ? <JugadorNotificationsBell compact /> : null}
            {showAdminShortcut ? (
              <button
                type="button"
                onClick={() => navigate(isOnAdmin ? '/' : '/admin')}
                aria-label={isOnAdmin ? 'Volver a la app' : 'Ir a Admin'}
                title={isOnAdmin ? 'App' : 'Admin'}
                style={{
                  height: 34,
                  padding: '0 8px',
                  borderRadius: 999,
                  border: 'none',
                  background: 'rgba(255,255,255,0.14)',
                  color: '#e2e8f0',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isOnAdmin ? '←' : '⚙'}
              </button>
            ) : null}
            {!session?.user && authLoading ? (
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>…</span>
            ) : !session?.user ? (
              <button
                type="button"
                onClick={() => navigate('/auth')}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.28)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#f8fafc',
                  fontSize: 12,
                  fontWeight: 700,
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
            paddingTop: 8,
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
              height: 100,
              width: 'auto',
              maxWidth: 'min(92vw, 400px)',
              objectFit: 'contain',
              marginBottom: 22,
            }}
          />

          {partidosDestacadosArriba ? (
            <section
              style={{
                width: '100%',
                margin: '0 auto 18px',
                borderRadius: 20,
                padding: 16,
                boxSizing: 'border-box',
                background: '#fff',
                boxShadow: '0 14px 36px rgba(15,23,42,0.14)',
                border: '1px solid rgba(226,232,240,0.85)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: 0, color: '#0f172a', fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>Partidos abiertos</h2>
                  <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.45, fontWeight: 600 }}>
                    Partidos disponibles para sumarte
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/partidos-abiertos')}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    background: 'linear-gradient(135deg,#667eea,#764ba2)',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: 'pointer',
                    flexShrink: 0,
                    fontFamily: 'inherit',
                  }}
                >
                  Ver todos
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  overflowX: 'auto',
                  paddingBottom: 4,
                  marginLeft: -4,
                  marginRight: -4,
                  paddingLeft: 4,
                  paddingRight: 4,
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                }}
              >
                {partidosAbiertos.map((p) => (
                  <PartidoAbiertoRailCard key={p.id} partido={p} onNavigate={() => navigate('/partidos-abiertos')} />
                ))}
              </div>
            </section>
          ) : null}

          {!authLoading && !session?.user ? (
            <p
              style={{
                textAlign: 'center',
                margin: '0 0 16px',
                fontSize: 14,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                lineHeight: 1.45,
              }}
            >
              Podés explorar sin registrarte
            </p>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', marginBottom: 16 }}>
            {modulos.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={m.onClick}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  borderRadius: 20,
                  padding: '20px 18px',
                  background: '#fff',
                  boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }} aria-hidden>
                  {m.icon}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 17, fontWeight: 900, color: '#0f172a', letterSpacing: 0.02 }}>{m.titulo}</span>
                  <span style={{ display: 'block', marginTop: 6, fontSize: 14, color: '#64748b', fontWeight: 600, lineHeight: 1.4 }}>
                    {m.descripcion}
                  </span>
                </span>
                <span style={{ fontSize: 22, color: '#667eea', fontWeight: 900, flexShrink: 0 }} aria-hidden>
                  ›
                </span>
              </button>
            ))}
          </div>

          {partidosBloqueAbajo ? (
            <section
              style={{
                width: '100%',
                margin: '0 auto 12px',
                borderRadius: 14,
                padding: '10px 12px 12px',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.92)',
                boxShadow: '0 6px 18px rgba(15,23,42,0.08)',
                border: '1px solid rgba(226,232,240,0.75)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: partidosLoading ? 0 : 8,
                }}
              >
                <h2 style={{ margin: 0, color: '#64748b', fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>Partidos abiertos</h2>
                <button
                  type="button"
                  onClick={() => navigate('/partidos-abiertos')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    padding: '4px 6px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  Ver todos
                </button>
              </div>

              {partidosLoading ? (
                <p style={{ margin: 0, color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '6px 0 2px' }}>
                  Cargando…
                </p>
              ) : (
                <div
                  style={{
                    background: 'rgba(248,250,252,0.95)',
                    borderRadius: 12,
                    padding: '10px 10px 12px',
                    textAlign: 'center',
                    border: '1px dashed #e2e8f0',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4, opacity: 0.85 }}>🤝</div>
                  <p style={{ margin: '0 0 8px', color: '#94a3b8', fontSize: 12, lineHeight: 1.4, fontWeight: 600 }}>
                    Sin partidos publicados aún
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/armar-partido')}
                    style={{
                      border: 'none',
                      borderRadius: 10,
                      padding: '8px 14px',
                      background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      boxShadow: '0 4px 12px rgba(22,163,74,0.25)',
                    }}
                  >
                    Armar el primero
                  </button>
                </div>
              )}
            </section>
          ) : null}

          <button
            type="button"
            onClick={() => navigate('/sedes')}
            style={{
              width: '100%',
              margin: '0 auto 8px',
              display: 'block',
              padding: '14px 16px',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.35)',
              fontWeight: 700,
              background: 'rgba(255,255,255,0.18)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 15,
              fontFamily: 'inherit',
            }}
          >
            Explorar sedes
          </button>
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
                padding: '14px 16px 16px',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.22)',
                boxSizing: 'border-box',
                textAlign: 'center',
                color: '#fff',
              }}
            >
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, lineHeight: 1.45, opacity: 0.95 }}>
                Instalá Padbol Match en tu teléfono para abrirla como app y entrar más rápido.
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
