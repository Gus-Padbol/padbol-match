import React, { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  HUB_BOTTOM_NAV_CONTENT_GAP_PX,
  HUB_NAV_HEIGHT_PX,
  LEGAL_FOOTER_GLOBAL_SPACER_PX,
  isHubNavBarHiddenPathname,
  isLegalFooterGlobalBarVisiblePathname,
} from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';

export const COOKIES_CONSENT_STORAGE_KEY = 'cookies_consent';
export const COOKIES_CONSENT_ACCEPTED = 'accepted';
export const COOKIES_CONSENT_ESSENTIAL = 'essential';

function readConsent() {
  if (typeof window === 'undefined') return null;
  try {
    const v = String(localStorage.getItem(COOKIES_CONSENT_STORAGE_KEY) || '').trim();
    if (v === COOKIES_CONSENT_ACCEPTED || v === COOKIES_CONSENT_ESSENTIAL) return v;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Banner único de consentimiento de cookies (localStorage `cookies_consent`).
 * Se despega del borde inferior si hay pie legal o barra hub fija abajo, para no tapar navegación.
 */
export default function CookieConsentBanner() {
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [visible, setVisible] = useState(() => readConsent() == null);

  const bottomOffsetPx = useMemo(() => {
    let extra = 0;
    if (isLegalFooterGlobalBarVisiblePathname(location.pathname)) {
      extra += LEGAL_FOOTER_GLOBAL_SPACER_PX;
    }
    if (!isHubNavBarHiddenPathname(location.pathname) && navDock === 'bottom') {
      extra += HUB_NAV_HEIGHT_PX + HUB_BOTTOM_NAV_CONTENT_GAP_PX;
    }
    return extra;
  }, [location.pathname, navDock]);

  const persist = useCallback((value) => {
    try {
      localStorage.setItem(COOKIES_CONSENT_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookies"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        zIndex: 10055,
        bottom:
          bottomOffsetPx > 0
            ? `calc(env(safe-area-inset-bottom, 0px) + ${bottomOffsetPx}px)`
            : 'env(safe-area-inset-bottom, 0px)',
        padding:
          '12px max(12px, env(safe-area-inset-left, 0px)) 12px max(12px, env(safe-area-inset-right, 0px))',
        boxSizing: 'border-box',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -8px 28px rgba(15, 23, 42, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 10,
        maxWidth: 900,
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '100%',
      }}
    >
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, fontWeight: 600, color: 'var(--text-primary)' }}>
        Usamos cookies para mejorar tu experiencia.
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          onClick={() => persist(COOKIES_CONSENT_ESSENTIAL)}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--pm-color-muted-bg)',
            color: 'var(--text-primary)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flex: '1 1 140px',
            minWidth: 0,
          }}
        >
          Solo esenciales
        </button>
        <button
          type="button"
          onClick={() => persist(COOKIES_CONSENT_ACCEPTED)}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #e11b22 0%, #b91c1c 100%)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flex: '1 1 140px',
            minWidth: 0,
            boxShadow: '0 4px 14px rgba(225, 27, 34, 0.35)',
          }}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
