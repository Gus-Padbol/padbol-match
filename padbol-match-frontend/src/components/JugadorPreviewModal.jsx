import React, { useEffect } from 'react';

/** Modal compacto: foto, nombre, alias, categoría, sede (sin navegar a otra ruta). */
export default function JugadorPreviewModal({ open, onClose, data }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !data) return null;

  const row = (label, value) => (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{value}</div>
    </div>
  );

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10040,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="jugador-preview-titulo"
        style={{
          background: '#fff',
          borderRadius: '16px',
          maxWidth: '380px',
          width: '100%',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          padding: '22px 20px 18px',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          {data.foto_url ? (
            <img
              src={data.foto_url}
              alt=""
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                objectFit: 'cover',
                objectPosition: 'top center',
                border: '3px solid #e2e8f0',
              }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                margin: '0 auto',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: '#fff',
                fontSize: '32px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {(data.nombreCompleto || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <h2 id="jugador-preview-titulo" style={{ margin: '14px 0 0', fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.3 }}>
            {data.nombreCompleto}
          </h2>
        </div>

        {row('Alias', data.aliasLabel)}
        {row('Categoría', data.categoria)}
        {row('Sede', data.sede)}

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            border: 'none',
            background: '#4f46e5',
            color: '#fff',
            fontWeight: 800,
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
