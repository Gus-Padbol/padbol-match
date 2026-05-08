import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_LOGO_CLEARANCE_TOP_PX,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { useAuth } from '../context/AuthContext';
import { PERFIL_CHANGE_EVENT, formatAliasConArroba } from '../utils/jugadorPerfil';
import { buildWhatsAppMeUrl, primerNombreSaludo } from '../utils/whatsappContactUrl';

const MATCHMAKING_API_BASE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

function esPlaceholderJugador(s) {
  return String(s || '').trim().toLowerCase() === 'jugador';
}

function capitalizarPalabraSaludo(w) {
  const t = String(w || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** `apodo` en jugadores_perfil (vacío → no aplica). Lee explícitamente la columna. */
function nombreDesdeApodoPerfil(userProfile) {
  if (!userProfile || typeof userProfile !== 'object') return '';
  const raw = userProfile.apodo;
  if (raw == null) return '';
  const v = String(raw).trim();
  return v || '';
}

/** Primer token de `nombre` (columna perfil), sin apellido en el saludo. */
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
  const [hoveredHubBtn, setHoveredHubBtn] = useState(null);
  const [jugadoresDisponibles, setJugadoresDisponibles] = useState([]);
  const [matchmakingNeedsClub, setMatchmakingNeedsClub] = useState(false);
  const [matchmakingCargando, setMatchmakingCargando] = useState(false);
  const [matchmakingError, setMatchmakingError] = useState('');
  /** Nombre para el saludo: se fija una sola vez al tener perfil listo (evita parpadeo por re-renders). */
  const [nombreFinal, setNombreFinal] = useState(null);

  useEffect(() => {
    const onPerfil = () => {
      void refreshSession();
    };
    window.addEventListener(PERFIL_CHANGE_EVENT, onPerfil);
    return () => window.removeEventListener(PERFIL_CHANGE_EVENT, onPerfil);
  }, [refreshSession]);

  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    if (!accessToken) {
      setJugadoresDisponibles([]);
      setMatchmakingNeedsClub(false);
      setMatchmakingError('');
      setMatchmakingCargando(false);
      return;
    }
    let cancelled = false;
    setMatchmakingCargando(true);
    setMatchmakingError('');
    (async () => {
      try {
        const res = await fetch(`${MATCHMAKING_API_BASE}/api/jugadores/disponibles-matchmaking`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setJugadoresDisponibles([]);
          setMatchmakingNeedsClub(false);
          setMatchmakingError(typeof j?.error === 'string' ? j.error : 'No se pudieron cargar los jugadores');
          return;
        }
        setJugadoresDisponibles(Array.isArray(j?.jugadores) ? j.jugadores : []);
        setMatchmakingNeedsClub(Boolean(j?.needsClub));
      } catch (e) {
        if (!cancelled) {
          setJugadoresDisponibles([]);
          setMatchmakingNeedsClub(false);
          setMatchmakingError('No se pudieron cargar los jugadores');
        }
      } finally {
        if (!cancelled) setMatchmakingCargando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, userProfile?.busca_companero, userProfile?.ciudad, userProfile?.sede_id]);

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
    setNombreFinal(null);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) return;
    if (authLoading || profileLoading || userProfile == null) return;
    setNombreFinal((prev) => {
      if (prev !== null) return prev;
      const ap = nombreDesdeApodoPerfil(userProfile);
      if (ap) return ap.charAt(0).toUpperCase() + ap.slice(1);
      const nom = primerNombreDesdePerfil(userProfile);
      if (nom) return nom;
      return '';
    });
  }, [session?.user, authLoading, profileLoading, userProfile]);

  const sufijo = '¿Qué quieres hacer hoy?';
  const lineaSaludo = !session?.user
    ? `¡Hola! ${sufijo}`
    : nombreFinal
      ? `¡Hola, ${nombreFinal}! ${sufijo}`
      : `¡Hola! ${sufijo}`;

  const accesosRapidos = [
    { label: 'Reservar', icon: '⚽', action: () => navigate('/reservar') },
    { label: 'Torneos', icon: '🏆', action: () => navigate('/torneos') },
    { label: 'Ranking', icon: '🥇', action: () => navigate('/rankings') },
    { label: 'Perfil', icon: '👤', action: () => navigate('/mi-perfil') },
  ];

  const hayListaMatchmaking = session?.user && (matchmakingCargando || jugadoresDisponibles.length > 0 || matchmakingNeedsClub || matchmakingError);

  const mensajeWaMatchmaking = useMemo(
    () => (nombreDestino) => {
      const n = primerNombreSaludo(nombreDestino) || 'Jugador';
      return `Hola ${n}, te vi en Padbol Match buscando compañero. ¿Jugamos juntos?`;
    },
    []
  );

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
      <AppHeader title="Inicio" showBack={false} hubDirectLogin />
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
          paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
      <div
        style={{
          ...hubInstagramColumnWrapStyle,
          paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        }}
      >
      <img
        src="/logo-padbol-match.png"
        alt="Padbol Match"
        style={{
          ...padbolLogoImgStyle,
          display: 'block',
          marginLeft: 'auto',
          marginRight: 'auto',
          width: 'auto',
          height: '120px',
          minWidth: '120px',
          minHeight: '120px',
          maxWidth: 'min(92vw, 360px)',
          objectFit: 'contain',
          objectPosition: 'center center',
          marginTop: HUB_LOGO_CLEARANCE_TOP_PX,
          marginBottom: '40px',
        }}
      />
      <div style={{ width: '100%', margin: '0 auto' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(10px)',
            borderRadius: '14px',
            padding: '14px 18px',
            maxWidth: '300px',
            margin: '0 auto 30px auto',
            color: 'white',
          }}
        >
          <h1
            style={{
              color: 'white',
              textAlign: 'center',
              margin: '0 0 6px 0',
              fontSize: '18px',
              fontWeight: '600',
              lineHeight: 1.35,
              minHeight: '2.7em',
              transition: 'none',
              animation: 'none',
            }}
          >
            {lineaSaludo}
          </h1>
          {!authLoading && !session?.user ? (
            <p
              style={{
                textAlign: 'center',
                margin: '12px 0 0 0',
                fontSize: '14px',
                fontWeight: 600,
                color: '#ffffff',
                lineHeight: 1.45,
              }}
            >
              Puedes explorar sin registrarte
            </p>
          ) : null}
        </div>

        {hayListaMatchmaking ? (
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              margin: '0 auto 20px auto',
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: '16px',
              padding: '16px 16px 14px',
              boxSizing: 'border-box',
              color: 'white',
            }}
          >
            <h2
              style={{
                margin: '0 0 10px 0',
                fontSize: '17px',
                fontWeight: 800,
                textAlign: 'center',
                color: 'white',
              }}
            >
              Jugadores disponibles
            </h2>
            {matchmakingError ? (
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#fecaca', textAlign: 'center' }}>
                {matchmakingError}
              </p>
            ) : null}
            {matchmakingNeedsClub && !matchmakingCargando ? (
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', opacity: 0.92, textAlign: 'center', lineHeight: 1.45 }}>
                Completa tu <strong>club habitual</strong> en Mi perfil para ver jugadores de tu sede que buscan compañero.
              </p>
            ) : null}
            {matchmakingCargando ? (
              <p style={{ margin: 0, fontSize: '14px', textAlign: 'center', opacity: 0.85 }}>Cargando…</p>
            ) : jugadoresDisponibles.length === 0 && !matchmakingNeedsClub ? (
              <p style={{ margin: 0, fontSize: '14px', textAlign: 'center', opacity: 0.88 }}>
                Por ahora no hay jugadores buscando compañero en tu sede.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  maxHeight: 'min(52vh, 360px)',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {jugadoresDisponibles.map((j) => {
                  const aliasTxt = j.alias ? formatAliasConArroba(j.alias) : '';
                  const cat = j.categoria || '—';
                  const foto = String(j.foto_url || '').trim();
                  const waUrl = j.whatsapp_me_digits
                    ? buildWhatsAppMeUrl(j.whatsapp_me_digits, mensajeWaMatchmaking(j.nombre))
                    : null;
                  const inicial = String(j.nombre || '?')
                    .trim()
                    .charAt(0)
                    .toUpperCase();
                  return (
                    <li
                      key={String(j.user_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        background: 'rgba(0,0,0,0.12)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}
                    >
                      {foto ? (
                        <img
                          src={foto}
                          alt=""
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          aria-hidden
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: '18px',
                            flexShrink: 0,
                          }}
                        >
                          {inicial}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '15px', lineHeight: 1.25 }}>{j.nombre}</div>
                        {aliasTxt ? (
                          <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>{aliasTxt}</div>
                        ) : null}
                        <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px' }}>Categoría: {cat}</div>
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              marginTop: '8px',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              background: '#25D366',
                              color: '#fff',
                              fontWeight: 800,
                              fontSize: '13px',
                              textDecoration: 'none',
                            }}
                          >
                            Contactar por WhatsApp
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            width: '100%',
            maxWidth: '420px',
            margin: '0 auto 20px auto',
          }}
        >
          {accesosRapidos.map(({ label, icon, action }, index) => {
            const isHovered = hoveredHubBtn === index;
            return (
              <button
                key={label}
                type="button"
                onClick={action}
                onMouseEnter={() => setHoveredHubBtn(index)}
                onMouseLeave={() => setHoveredHubBtn(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '18px',
                  borderRadius: '16px',
                  background: '#ffffff',
                  boxShadow: isHovered
                    ? '0 14px 30px rgba(0,0,0,0.2)'
                    : '0 10px 25px rgba(0,0,0,0.15)',
                  border: 'none',
                  transition: 'all 0.2s ease',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '28px', lineHeight: 1, marginBottom: '6px' }}>{icon}</span>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', lineHeight: 1.2 }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => navigate('/sedes')}
          style={{
            width: '100%',
            maxWidth: '420px',
            margin: '0 auto',
            display: 'block',
            padding: '16px',
            borderRadius: '16px',
            border: 'none',
            fontWeight: '600',
            background: 'rgba(255,255,255,0.9)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
            cursor: 'pointer',
            color: '#1e293b',
          }}
        >
          Explorar sedes
        </button>
      </div>
      </div>
      </div>
      <BottomNav />
    </div>
  );
}
