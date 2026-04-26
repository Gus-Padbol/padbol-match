import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const btnVolver = {
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.22)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  padding: '8px 10px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
};

/**
 * Barra superior fija: ← Volver (opcional) y título centrado.
 * La navegación principal va en {@link BottomNav}.
 */
export default function AppHeader({ title, showBack = true, onBack, backLabel }) {
  const navigate = useNavigate();
  const { session, signOutAndClear } = useAuth();

  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    if (typeof window !== 'undefined') window.history.back();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        minHeight: '56px',
        background: '#0f172a',
        display: 'grid',
        gridTemplateColumns: 'minmax(88px, auto) 1fr minmax(44px, auto)',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        boxSizing: 'border-box',
        zIndex: 1002,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {showBack ? (
        <button
          type="button"
          onClick={handleBack}
          style={btnVolver}
          aria-label="Volver atrás"
        >
          {backLabel || '← Volver'}
        </button>
      ) : (
        <div aria-hidden style={{ minWidth: '88px' }} />
      )}

      <h3
        style={{
          color: '#fff',
          fontSize: '15px',
          fontWeight: 600,
          margin: 0,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
        title={title}
      >
        {title}
      </h3>

      {session?.user ? (
        <button
          type="button"
          onClick={async () => {
            await signOutAndClear();
            navigate('/');
          }}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          style={{
            justifySelf: 'end',
            width: 34,
            height: 34,
            padding: 0,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255,255,255,0.1)',
            color: '#e2e8f0',
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ⏻
        </button>
      ) : (
        <div aria-hidden style={{ minWidth: '44px' }} />
      )}
    </div>
  );
}
