import React, { useEffect } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  dismissLabel,
  onConfirm,
  onDismiss,
  busy = false,
  confirmDanger = false,
  titleId = 'confirm-modal-title',
}) {
  const { t } = useTranslation();
  const confirmText = confirmLabel ?? t('general.confirm');
  const dismissText = dismissLabel ?? t('general.cancel');

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const Wrapper = 'div';

  return (
    <Wrapper
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
        background: 'rgba(0, 0, 0, 0.6)',
      }}
      role="presentation"
      onClick={busy ? undefined : onDismiss}
    >
      <Wrapper
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--bg-card)',
          borderRadius: 14,
          padding: '20px 18px 16px',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
          boxSizing: 'border-box',
        }}
      >
        <p
          id={titleId}
          style={{
            margin: '0 0 12px',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}
        >
          {title}
        </p>
        {message ? (
          <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {message}
          </p>
        ) : null}
        <Wrapper style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {dismissText}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: confirmDanger ? '#dc2626' : 'var(--accent)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {confirmText}
          </button>
        </Wrapper>
      </Wrapper>
    </Wrapper>
  );
}
