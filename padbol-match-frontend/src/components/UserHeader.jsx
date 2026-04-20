import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function UserHeader({ onLogout, title, showBack = false, sedeNombre, compact = false }) {
  const navigate = useNavigate();

  if (compact) {
    return (
      <div style={{
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto 8px auto',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '6px 10px',
        background: 'rgba(255,255,255,0.12)',
        borderRadius: '14px',
        backdropFilter: 'blur(10px)',
      }}>
        <button
          type="button"
          onClick={() => onLogout?.()}
          style={{
            background: 'rgba(255,255,255,0.22)',
            border: 'none',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            color: 'white',
            fontSize: '15px',
            cursor: 'pointer',
          }}
          aria-label="Cerrar sesión"
        >
          ⏻
        </button>
      </div>
    );
  }

  return (
  <div style={{
    width: '100%',
    maxWidth: '900px',
    margin: '0 auto 20px auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)'
  }}>

    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      
      {showBack && (
        <div
          style={{
            padding: '6px 12px',
            marginRight: '4px',
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.28)',
            borderRadius: '9999px',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ← Volver
          </button>
        </div>
      )}

      <span style={{ fontSize: '18px' }}>
        {title === 'Ranking' && '🥇'}
        {title === 'Torneos' && '🏆'}
        {title === 'Perfil' && '👤'}
        {title === 'Reservar' && '⚽'}
        {!title && '⚽'}
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontWeight: '600', fontSize: '15px', color: 'white' }}>
          {title || 'Padbol'}
        </span>

        {sedeNombre && (
          <span style={{ fontSize: '11px', color: '#cbd5f5' }}>
            {sedeNombre}
          </span>
        )}
      </div>

    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      
      <button
        type="button"
        onClick={() => onLogout?.()}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          color: 'white',
          fontSize: '16px',
          cursor: 'pointer'
        }}
        aria-label="Cerrar sesión"
      >
        ⏻
      </button>

    </div>

  </div>
);
}