import React, { useCallback, useEffect, useState } from 'react';

const MSG_UPDATED = 'PM_SW_UPDATED';
const MSG_UPDATE_AVAILABLE = 'PM_SW_UPDATE_AVAILABLE';

/**
 * Banner discreto cuando hay un nuevo service worker / caché (PWA).
 * Solo en producción (donde está registrado el SW).
 */
export default function PwaUpdateBanner() {
  const [visible, setVisible] = useState(false);

  const show = useCallback(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return undefined;

    const onSwMessage = (e) => {
      const d = e.detail;
      if (!d || typeof d !== 'object') return;
      if (d.type === MSG_UPDATED || d.type === MSG_UPDATE_AVAILABLE) show();
    };

    const onUpdateAvail = () => show();

    window.addEventListener('padbol:pwa-sw-message', onSwMessage);
    window.addEventListener('padbol:pwa-update-available', onUpdateAvail);
    return () => {
      window.removeEventListener('padbol:pwa-sw-message', onSwMessage);
      window.removeEventListener('padbol:pwa-update-available', onUpdateAvail);
    };
  }, [show]);

  const onActualizar = useCallback(() => {
    void navigator.serviceWorker?.getRegistration().then((reg) => {
      try {
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      } catch {
        /* ignore */
      }
    });
    window.location.reload();
  }, []);

  if (!visible || process.env.NODE_ENV !== 'production') return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 'max(12px, env(safe-area-inset-left, 0px))',
        right: 'max(12px, env(safe-area-inset-right, 0px))',
        bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        zIndex: 100004,
        maxWidth: 420,
        marginLeft: 'auto',
        marginRight: 'auto',
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--border, #e2e8f0)',
        background: 'var(--bg-card, #fff)',
        color: 'var(--text-primary, #0f172a)',
        boxShadow: '0 8px 28px rgba(15, 23, 42, 0.18)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, flex: '1 1 180px', minWidth: 0 }}>
        Hay una nueva versión disponible
      </span>
      <button
        type="button"
        onClick={onActualizar}
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          borderRadius: 10,
          border: 'none',
          background: '#E11B22',
          color: '#fff',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Actualizar ahora
      </button>
    </div>
  );
}
