import React, { useEffect } from 'react';

/**
 * Modal de confirmación para cancelar una reserva.
 * Botón primario (rojo): confirma la cancelación.
 * Botón secundario (gris): descarta y vuelve al contexto anterior.
 */
export default function ConfirmCancelReservaModal({
  open,
  title = '¿Cancelar la reserva?',
  message,
  confirmLabel = 'Sí, cancelar reserva',
  dismissLabel = 'Volver al resumen',
  onConfirm,
  onDismiss,
  busy = false,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:
          'max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        background: 'rgba(15, 23, 42, 0.55)',
      }}
      role="presentation"
      onClick={busy ? undefined : onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-cancel-reserva-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '22px 20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          boxSizing: 'border-box',
        }}
      >
        <h2
          id="confirm-cancel-reserva-title"
          style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}
        >
          {title}
        </h2>
        {message ? (
          <p style={{ margin: '0 0 18px', fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>{message}</p>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              width: '100%',
              padding: '13px 16px',
              borderRadius: '12px',
              border: 'none',
              background: busy ? '#fca5a5' : '#dc2626',
              color: '#fff',
              fontWeight: 800,
              fontSize: '15px',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            style={{
              width: '100%',
              padding: '13px 16px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              background: '#f1f5f9',
              color: '#475569',
              fontWeight: 700,
              fontSize: '15px',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
