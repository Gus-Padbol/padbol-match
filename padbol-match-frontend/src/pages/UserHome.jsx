import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { useAuth } from '../context/AuthContext';
import { nombreDesdeFilaJugadoresPerfil } from '../utils/displayName';
import { formatAliasConArroba, PERFIL_CHANGE_EVENT } from '../utils/jugadorPerfil';
import { supabase } from '../supabaseClient';

function parteLocalEmail(email) {
  const em = String(email || '').trim();
  if (!em.includes('@')) return '';
  return em.split('@')[0].trim() || '';
}

/** Saludo hub: alias → nombre perfil → parte local del email; nunca "jugador". */
function textoSaludoDesdePerfilHub(jpRow, emailSesion) {
  const em = String(emailSesion || '').trim();
  const local = parteLocalEmail(em);
  const alias = String(jpRow?.alias || '').trim();
  if (alias) return formatAliasConArroba(alias);
  const nombrePerfil = nombreDesdeFilaJugadoresPerfil(jpRow, em).trim();
  if (nombrePerfil) {
    const first = nombrePerfil.split(/\s+/).filter(Boolean)[0] || '';
    if (first && first.toLowerCase() !== 'jugador') return first;
    if (nombrePerfil.length > 0 && nombrePerfil.toLowerCase() !== 'jugador') return nombrePerfil;
  }
  if (local && local.toLowerCase() !== 'jugador') return local;
  if (em) return local || 'Cuenta';
  return 'Cuenta';
}

export default function UserHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const [hoveredHubBtn, setHoveredHubBtn] = useState(null);
  const [perfilHubRow, setPerfilHubRow] = useState(null);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setPerfilHubRow(null);
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      supabase
        .from('jugadores_perfil')
        .select('alias,nombre,apellido,email')
        .eq('user_id', uid)
        .maybeSingle()
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.warn('[UserHome] jugadores_perfil', error.message);
            setPerfilHubRow(null);
            return;
          }
          setPerfilHubRow(data && typeof data === 'object' ? data : null);
        });
    };
    load();
    window.addEventListener(PERFIL_CHANGE_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PERFIL_CHANGE_EVENT, load);
    };
  }, [session?.user?.id]);

  const nombreSaludoHub = useMemo(() => {
    if (!session?.user) return '';
    return textoSaludoDesdePerfilHub(perfilHubRow, session.user.email);
  }, [session?.user, perfilHubRow]);

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
          paddingTop: '24px',
          height: '120px',
          marginBottom: '40px',
        }}
      />
      <div style={{ maxWidth: '820px', width: '100%', margin: '0 auto' }}>
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
          <h1 style={{
            color: 'white',
            textAlign: 'center',
            margin: '0 0 6px 0',
            fontSize: '18px',
            fontWeight: '600',
            lineHeight: 1.35,
          }}>
            {session?.user
              ? `¡Hola ${nombreSaludoHub}! ¿Qué querés hacer hoy?`
              : '¡Hola! ¿Qué querés hacer hoy?'}
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
