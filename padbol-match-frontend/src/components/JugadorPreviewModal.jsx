import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Modal compacto: foto, nombre, @alias, categoría, sede, puntos; opción ir a perfil público. */
export default function JugadorPreviewModal({ open, onClose, data }) {
  const navigate = useNavigate();

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
        background: 'rgba(0, 0, 0, 0.6)',
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
          background: 'var(--bg-card)',
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
                background: 'linear-gradient(135deg, #E11B22, #b91c1c)',
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
          {data.aliasLabel && data.aliasLabel !== '—' ? (
            <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>{data.aliasLabel}</p>
          ) : null}
        </div>

        {row('Categoría', data.categoria)}
        {row('Sede', data.sede)}
        {data.puntosTotal != null && Number.isFinite(data.puntosTotal) ? row('Puntos', String(data.puntosTotal)) : null}
        {data.torneosCount != null && Number.isFinite(data.torneosCount) ? row('Torneos', String(data.torneosCount)) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {data.aliasSlug ? (
            <button
              type="button"
              onClick={() => {
                navigate(`/jugador/${encodeURIComponent(data.aliasSlug)}`);
                onClose();
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '2px solid #E11B22',
                background: 'var(--bg-card)',
                color: '#E11B22',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              Ver perfil completo
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: '#E11B22',
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
    </div>
  );
}
