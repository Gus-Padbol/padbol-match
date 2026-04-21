import React from 'react';

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
 * Barra superior fija: solo ← Volver (historial del navegador) y título centrado.
 */
const AppHeader = ({ title }) => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      minHeight: '56px',
      background: '#0f172a',
      display: 'grid',
      gridTemplateColumns: 'minmax(88px, auto) 1fr minmax(88px, auto)',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 10px',
      boxSizing: 'border-box',
      zIndex: 1002,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') window.history.back();
      }}
      style={btnVolver}
      aria-label="Volver atrás"
    >
      ← Volver
    </button>

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

    <div aria-hidden style={{ minWidth: '44px' }} />
  </div>
);

export default AppHeader;
