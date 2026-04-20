import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppScreenHeaderHome } from '../components/AppUnifiedHeader';

const API_BASE = 'https://padbol-backend.onrender.com';

export default function UserHome({ currentCliente, onLogout }) {
  const navigate = useNavigate();
  const [sedeUbicacion, setSedeUbicacion] = useState('');
  const [sedeNombreApi, setSedeNombreApi] = useState('');

  const ultimaSedeId =
    typeof localStorage !== 'undefined' ? localStorage.getItem('ultima_sede')?.trim() || '' : '';

  const sedeNombre =
    typeof localStorage !== 'undefined' ? localStorage.getItem('ultima_sede_nombre') : null;
  const nombreClub = `${sedeNombre ?? ''}`.trim() || sedeNombreApi.trim();

  useEffect(() => {
    const ciudadLS = localStorage.getItem('ultima_sede_ciudad')?.trim();
    const paisLS = localStorage.getItem('ultima_sede_pais')?.trim();
    const id = localStorage.getItem('ultima_sede')?.trim();

    if (ciudadLS || paisLS) {
      setSedeUbicacion([ciudadLS, paisLS].filter(Boolean).join(', '));
    } else {
      setSedeUbicacion('');
    }

    if (!id) {
      setSedeNombreApi('');
      return;
    }

    let cancelled = false;
    fetch(`${API_BASE}/api/sedes`)
      .then((r) => r.json())
      .then((list) => {
        if (cancelled) return;
        const s = (Array.isArray(list) ? list : []).find((x) => String(x.id) === String(id));
        if (!s) {
          if (!ciudadLS && !paisLS) setSedeUbicacion('');
          setSedeNombreApi('');
          return;
        }
        const nombreLS = localStorage.getItem('ultima_sede_nombre')?.trim();
        if (!nombreLS && s.nombre) {
          const n = String(s.nombre).trim();
          if (n) {
            localStorage.setItem('ultima_sede_nombre', n);
            setSedeNombreApi(n);
          } else {
            setSedeNombreApi('');
          }
        } else {
          setSedeNombreApi('');
        }
        if (!ciudadLS && !paisLS) {
          setSedeUbicacion([s.ciudad, s.pais].filter(Boolean).join(', ') || '');
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (!ciudadLS && !paisLS) setSedeUbicacion('');
          setSedeNombreApi('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const irACambiarSede = () => {
    localStorage.removeItem('ultima_sede');
    localStorage.removeItem('ultima_sede_nombre');
    setSedeNombreApi('');
    navigate('/sedes');
  };

  const botonesConSede = [
    {
      label: 'Reservar',
      icon: '⚽',
      action: () => navigate('/reservar'),
    },
    {
      label: 'Torneos',
      icon: '🏆',
      action: () => navigate('/torneos'),
    },
    {
      label: 'Ranking',
      icon: '🥇',
      action: () => navigate('/rankings'),
    },
    {
      label: 'Perfil',
      icon: '👤',
      action: () => navigate('/perfil'),
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        padding: '6px 8px 10px',
      }}
    >
      <AppScreenHeaderHome title="Inicio" onLogout={onLogout}>
        {ultimaSedeId ? (
          <button
            type="button"
            onClick={irACambiarSede}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.28)',
              borderRadius: '9999px',
              cursor: 'pointer',
              lineHeight: 1.25,
            }}
          >
            Cambiar sede
          </button>
        ) : null}
      </AppScreenHeaderHome>

      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(10px)',
            borderRadius: '14px',
            padding: '8px 10px 10px',
            marginBottom: '10px',
            color: 'white',
          }}
        >
          {/* 1) Saludo — izquierda */}
          <div
            style={{
              fontSize: '21px',
              fontWeight: 800,
              marginBottom: '0',
              textAlign: 'left',
              lineHeight: 1.18,
            }}
          >
            ¡Hola{currentCliente?.nombre ? ` ${currentCliente.nombre}` : ''}!
          </div>

          {/* 2) Bloque sede — solo con nombre real (LS o API); sin placeholder */}
          {nombreClub ? (
            <div
              style={{
                textAlign: 'center',
                marginTop: '5px',
                marginBottom: '5px',
              }}
            >
              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.58)',
                  marginBottom: '3px',
                  letterSpacing: '0.04em',
                  lineHeight: 1.2,
                }}
              >
                Estás en
              </div>
              <div
                style={{
                  fontSize: 'clamp(1.1rem, 3.5vw, 1.45rem)',
                  fontWeight: 900,
                  color: 'rgba(255,255,255,0.98)',
                  lineHeight: 1.1,
                  letterSpacing: '0.045em',
                  marginBottom: sedeUbicacion ? '3px' : '0',
                  wordBreak: 'break-word',
                }}
              >
                {nombreClub.toUpperCase()}
              </div>
              {sedeUbicacion ? (
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.62)',
                    lineHeight: 1.25,
                  }}
                >
                  {sedeUbicacion}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 3) Subtítulos */}
          {ultimaSedeId ? (
            <div
              style={{
                fontSize: '12.5px',
                fontWeight: 500,
                opacity: 0.88,
                textAlign: 'left',
                marginTop: '4px',
                lineHeight: 1.3,
              }}
            >
              Elige qué quieres hacer.
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  opacity: 0.92,
                  textAlign: 'left',
                  marginTop: '6px',
                  lineHeight: 1.35,
                }}
              >
                Elige tu sede
              </div>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 500,
                  opacity: 0.88,
                  textAlign: 'left',
                  marginTop: '4px',
                  lineHeight: 1.3,
                }}
              >
                ¿Hoy qué quieres hacer?
              </div>
            </>
          )}
        </div>

        {ultimaSedeId ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
          }}
        >
          {botonesConSede.map(({ label, icon, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                minHeight: '88px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                background: 'rgba(255,255,255,0.88)',
                border: '1px solid rgba(255,255,255,0.45)',
                borderRadius: '14px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                cursor: 'pointer',
                padding: '10px 9px',
              }}
            >
              <span style={{ fontSize: '1.65rem', lineHeight: 1 }}>{icon}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', lineHeight: 1.2 }}>
                {label}
              </span>
            </button>
          ))}
        </div>
        ) : null}

        {ultimaSedeId ? (
          <button
            type="button"
            onClick={() => navigate(`/sede/${ultimaSedeId}`)}
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '9px 12px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.32)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              lineHeight: 1.25,
              boxSizing: 'border-box',
            }}
          >
            Ver mi club
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/sedes')}
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '10px 12px',
              fontSize: '14px',
              fontWeight: 700,
              color: '#1f2937',
              background: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(255,255,255,0.45)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              lineHeight: 1.25,
              boxSizing: 'border-box',
              boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            }}
          >
            Explorar sedes
          </button>
        )}
      </div>
    </div>
  );
}