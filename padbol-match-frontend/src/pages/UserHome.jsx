import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { useAuth } from '../context/AuthContext';
import { PERFIL_CHANGE_EVENT } from '../utils/jugadorPerfil';
import { supabase } from '../supabaseClient';

function esPlaceholderJugador(s) {
  return String(s || '').trim().toLowerCase() === 'jugador';
}

function capitalizarPalabraSaludo(w) {
  const t = String(w || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/**
 * Solo columna `nombre` de jugadores_perfil (p. ej. "Juan Pablo" o "Gustavo").
 * No concatena `apellido` ni usa otros campos.
 */
function nombreDesdeJugadoresPerfil(userProfile) {
  const v = String(userProfile?.nombre || '').trim();
  if (!v || esPlaceholderJugador(v)) return '';
  return v;
}

/** Solo `profiles.nombre` (nunca nombre_completo / full_name, para no mezclar con apellido). */
function nombreDesdeProfilesSoloNombre(profilesRow) {
  if (!profilesRow || typeof profilesRow !== 'object') return '';
  const v = String(profilesRow.nombre || '').trim();
  if (!v || esPlaceholderJugador(v)) return '';
  return v;
}

/** Parte local del email capitalizada (fallback si no hay nombre en perfil). */
function nombreDesdeParteLocalEmail(local) {
  const s = String(local || '').trim();
  if (!s) return '';
  if (/[a-z][A-Z]/.test(s)) {
    const parts = s.split(/(?=[A-Z])/).filter(Boolean);
    return capitalizarPalabraSaludo(parts[0] || s);
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Saludo: solo `jugadores_perfil.nombre`, luego solo `profiles.nombre`, luego email local.
 * Nunca alias ni concatenar apellido.
 */
function obtenerNombreSaludo(authUser, userProfile, profilesRow) {
  const email = String(authUser?.email || '').trim().toLowerCase();
  const local = email.includes('@') ? email.split('@')[0].trim() : '';

  const fromJp = nombreDesdeJugadoresPerfil(userProfile);
  if (fromJp) return fromJp;

  const fromProfiles = nombreDesdeProfilesSoloNombre(profilesRow);
  if (fromProfiles) return fromProfiles;

  return nombreDesdeParteLocalEmail(local);
}

export default function UserHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading, userProfile, refreshSession } = useAuth();
  const [hoveredHubBtn, setHoveredHubBtn] = useState(null);
  const [profilesRow, setProfilesRow] = useState(null);

  useEffect(() => {
    const onPerfil = () => {
      void refreshSession();
    };
    window.addEventListener(PERFIL_CHANGE_EVENT, onPerfil);
    return () => window.removeEventListener(PERFIL_CHANGE_EVENT, onPerfil);
  }, [refreshSession]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfilesRow(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        setProfilesRow(data);
        return;
      }
      const r2 = await supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle();
      if (cancelled) return;
      if (!r2.error && r2.data) setProfilesRow(r2.data);
      else setProfilesRow(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const lineaSaludo = useMemo(() => {
    if (!session?.user) return '¡Hola! ¿Qué querés hacer hoy?';
    const p = obtenerNombreSaludo(session.user, userProfile, profilesRow);
    return p ? `¡Hola ${p}! ¿Qué querés hacer hoy?` : '¡Hola! ¿Qué querés hacer hoy?';
  }, [session?.user, userProfile, profilesRow]);

  const accesosRapidos = [
    { label: 'Reservar', icon: '⚽', action: () => navigate('/reservar') },
    { label: 'Torneos', icon: '🏆', action: () => navigate('/torneos') },
    { label: 'Ranking', icon: '🥇', action: () => navigate('/rankings') },
    { label: 'Perfil', icon: '👤', action: () => navigate('/mi-perfil') },
  ];

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
      }}
    >
      <AppHeader title="Inicio" showBack={false} hubDirectLogin />
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
          marginBottom: '40px',
        }}
      />
      <div style={{ maxWidth: '820px', width: '100%', margin: '0 auto' }}>
        <div
          className="user-home-saludo-caja"
          style={{
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(10px)',
            borderRadius: '14px',
            padding: '14px 18px',
            maxWidth: '300px',
            margin: '0 auto 30px auto',
            color: 'white',
            opacity: 1,
            animation: 'none',
            WebkitAnimation: 'none',
            transition: 'none',
          }}
        >
          <h1
            className="user-home-saludo"
            style={{
              color: 'white',
              textAlign: 'center',
              margin: '0 0 6px 0',
              fontSize: '18px',
              fontWeight: '600',
              lineHeight: 1.35,
              opacity: 1,
              animation: 'none',
              WebkitAnimation: 'none',
              transition: 'none',
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
              Podés explorar sin registrarte
            </p>
          ) : null}
        </div>

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
      <BottomNav />
    </div>
  );
}
