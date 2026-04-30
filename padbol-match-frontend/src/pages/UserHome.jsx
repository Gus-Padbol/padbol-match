import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { getDisplayName } from '../utils/displayName';
import { formatAliasConArroba } from '../utils/jugadorPerfil';
import { loginRedirectAfterHubEntry } from '../utils/authLoginRedirect';
import {
  ciudadPaisConBandera,
  horarioDisponibleTexto,
  precioDesdeCard,
  primeraFotoSede,
} from '../utils/sedeCardUi';
import '../styles/ReservaForm.css';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export default function UserHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading, userProfile } = useAuth();
  const [hoveredHubBtn, setHoveredHubBtn] = useState(null);
  const [sedesHub, setSedesHub] = useState([]);
  const [sedesHubError, setSedesHubError] = useState('');
  const [sedesHubLoading, setSedesHubLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSedesHubError('');
    setSedesHubLoading(true);
    fetch(apiUrl('/api/sedes'))
      .then(async (res) => {
        const text = await res.text();
        if (cancelled) return;
        if (!res.ok) {
          setSedesHub([]);
          setSedesHubError('No se pudieron cargar las sedes.');
          return;
        }
        try {
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : [];
          setSedesHub(arr);
        } catch {
          setSedesHub([]);
          setSedesHubError('Respuesta inválida al cargar sedes.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSedesHub([]);
          setSedesHubError('Error de red al cargar sedes.');
        }
      })
      .finally(() => {
        if (!cancelled) setSedesHubLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sedesHubOrdenadas = useMemo(
    () =>
      [...sedesHub].sort((a, b) =>
        String(a?.nombre || '')
          .trim()
          .localeCompare(String(b?.nombre || '').trim(), 'es', { sensitivity: 'base' })
      ),
    [sedesHub]
  );

  const nombreSaludoHub = useMemo(() => {
    if (!session?.user) return '';
    const alias = String(userProfile?.alias || '').trim();
    if (alias) return formatAliasConArroba(alias);
    const full = getDisplayName(userProfile, session);
    const first = String(full || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0];
    return first || 'Jugador';
  }, [session?.user, userProfile]);

  const accesosRapidos = [
    { label: 'Reservar', icon: '⚽', action: () => navigate('/reservar') },
    { label: 'Torneos', icon: '🏆', action: () => navigate('/torneos') },
    { label: 'Ranking', icon: '🥇', action: () => navigate('/rankings') },
    { label: 'Perfil', icon: '👤', action: () => navigate('/mi-perfil') },
  ];

  const loginDesdeHubUrl = useMemo(
    () => `/login?redirect=${encodeURIComponent(loginRedirectAfterHubEntry(location))}`,
    [location.pathname, location.search]
  );

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
          display: 'block',
          margin: '20px auto 40px',
          width: '120px',
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
              : '¡Hola!'}
          </h1>
          {!session?.user ? (
            <p style={{
              textAlign: 'center',
              margin: 0,
              fontSize: '13px',
              color: '#ffffff',
              lineHeight: 1.4,
            }}
            >
              ¿Qué querés hacer hoy?
            </p>
          ) : null}
          {!authLoading && !session?.user ? (
            <p
              style={{
                textAlign: 'center',
                margin: '8px 0 0 0',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.55)',
                lineHeight: 1.45,
              }}
            >
              Puedes explorar sin registrarte
            </p>
          ) : null}
          {!authLoading && !session?.user ? (
            <button
              type="button"
              onClick={() => navigate(loginDesdeHubUrl)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '14px',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '2px solid rgba(255,255,255,0.85)',
                background: 'rgba(255,255,255,0.98)',
                color: '#312e81',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
              }}
            >
              Iniciar sesión
            </button>
          ) : null}
        </div>

        <div
          className="reserva-sede-seleccion"
          style={{
            width: '100%',
            maxWidth: '480px',
            margin: '0 auto 22px',
            padding: '0 4px',
            boxSizing: 'border-box',
            background: 'transparent',
            minHeight: 0,
          }}
        >
          <h2
            style={{
              margin: '0 0 14px 0',
              textAlign: 'center',
              color: '#fff',
              fontSize: 'clamp(1.1rem, 4vw, 1.35rem)',
              fontWeight: 800,
              textShadow: '0 2px 12px rgba(0,0,0,0.25)',
              lineHeight: 1.3,
            }}
          >
            🏟️ Nuestras sedes
          </h2>
          {sedesHubLoading ? (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: '14px', margin: '8px 0' }}>
              Cargando sedes…
            </p>
          ) : null}
          {sedesHubError ? (
            <p style={{ textAlign: 'center', color: '#fecaca', fontSize: '13px', margin: '8px 0' }}>{sedesHubError}</p>
          ) : null}
          {!sedesHubLoading && !sedesHubError && sedesHubOrdenadas.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.88)', fontSize: '14px', margin: '8px 0' }}>
              Próximamente sedes disponibles
            </p>
          ) : null}
          {!sedesHubLoading && sedesHubOrdenadas.length > 0 ? (
            <div className="reserva-sede-cards-root">
              <ul className="reserva-sede-cards-list">
                {sedesHubOrdenadas.map((sede, idx) => {
                  const foto = primeraFotoSede(sede);
                  const { flag, linea } = ciudadPaisConBandera(sede);
                  const precio = precioDesdeCard(sede);
                  const moneda = String(sede.moneda || 'ARS').trim() || 'ARS';
                  return (
                    <li
                      key={sede.id}
                      className="reserva-sede-card"
                      style={{ '--reserva-stagger': `${idx * 80}ms` }}
                    >
                      <div className="reserva-sede-card-photo-wrap">
                        {foto ? (
                          <img src={foto} alt="" className="reserva-sede-card-photo" loading="lazy" />
                        ) : (
                          <div className="reserva-sede-card-photo-placeholder" aria-hidden>
                            ⚽
                          </div>
                        )}
                      </div>
                      <div className="reserva-sede-card-body">
                        <h2 className="reserva-sede-card-name">{String(sede.nombre || 'Sede').trim()}</h2>
                        <p className="reserva-sede-card-loc">
                          {flag ? <span className="reserva-sede-card-flag">{flag}</span> : null}
                          <span>{linea}</span>
                        </p>
                        <p className="reserva-sede-card-hours">{horarioDisponibleTexto(sede)}</p>
                        <p className="reserva-sede-card-price">
                          Desde{' '}
                          <strong>
                            {Number(precio || 0).toLocaleString('es-AR')} {moneda}
                          </strong>{' '}
                          / turno
                        </p>
                        <button
                          type="button"
                          className="reserva-sede-card-btn"
                          onClick={() => navigate(`/sede/${encodeURIComponent(String(sede.id))}`)}
                        >
                          Reservar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
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
