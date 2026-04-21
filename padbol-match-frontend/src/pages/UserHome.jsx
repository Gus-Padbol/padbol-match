import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppScreenHeaderHome } from '../components/AppUnifiedHeader';
import { supabase } from '../supabaseClient';

export default function UserHome() {
  const navigate = useNavigate();
  const [nombreMostrar, setNombreMostrar] = useState('');
  const [hoveredHubBtn, setHoveredHubBtn] = useState(null);

  useEffect(() => {
    const cargarPerfil = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from('jugadores_perfil')
        .select('nombre, alias')
        .eq('email', user.email)
        .single();

      if (data) {
        setNombreMostrar(
          data.alias || data.nombre || user.email.split('@')[0]
        );
      }
    };

    cargarPerfil();
  }, []);

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
      action: () => navigate('/mi-perfil'),
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '60px',
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingBottom: '32px',
      }}
    >
      <img
        src="/logo-padbol-match.png"
        alt="Padbol Match"
        style={{
          display: 'block',
          margin: '0 auto',
          marginBottom: '40px',
          width: '120px'
        }}
      />
      <AppScreenHeaderHome title="" showLogo={false} />

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
            {nombreMostrar ? `¡Hola ${nombreMostrar}!` : '¡Hola!'}
          </h1>
          <p style={{
            textAlign: 'center',
            margin: 0,
            fontSize: '13px',
            color: '#94a3b8',
            lineHeight: 1.4,
          }}>
            ¿Qué querés hacer hoy?
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}
        >
          {botonesConSede.map(({ label, icon, action }, index) => {
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
            marginTop: '20px',
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
  );
}
