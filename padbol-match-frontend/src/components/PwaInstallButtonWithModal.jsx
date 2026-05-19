import React, { useCallback, useEffect, useState } from 'react';
import { isLikelyIos, isPwaStandalone } from '../utils/isPwaStandalone';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { usePadbolLangVersion } from '../hooks/usePadbolLang';

const btnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '13px',
  fontWeight: 600,
  color: '#E2E8F0',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(255, 255, 255, 0.22)',
  background: 'rgba(255, 255, 255, 0.06)',
  boxSizing: 'border-box',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export default function PwaInstallButtonWithModal({ buttonStyle: buttonStyleProp } = {}) {
  const { t } = useTranslation();
  usePadbolLangVersion();
  const [open, setOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [ios] = useState(() => isLikelyIos());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isPwaStandalone()) return undefined;
    const onBip = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const runNativeInstall = useCallback(async () => {
    const ev = deferredPrompt;
    if (!ev?.prompt) return;
    setInstalling(true);
    try {
      await ev.prompt();
      await ev.userChoice?.catch(() => {});
    } catch {
      /* ignore */
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
      setOpen(false);
    }
  }, [deferredPrompt]);

  if (isPwaStandalone()) return null;

  const mergedBtn = { ...btnStyle, ...buttonStyleProp };

  return (
    <>
      <button type="button" style={mergedBtn} onClick={() => setOpen(true)}>
        📱 {t('pwa.installApp')}
      </button>
      {open ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20000,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            style={{
              width: '100%',
              maxWidth: '420px',
              maxHeight: 'min(90vh, 640px)',
              overflowY: 'auto',
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '20px 18px 18px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {deferredPrompt ? (
              <>
                <h2 id="pwa-install-title" style={{ margin: '0 0 8px', fontSize: '18px', color: 'var(--text-primary)' }}>
                  {t('pwa.installTitle')}
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {t('pwa.installBody')}
                </p>
                <div>
                <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                  {t('pwa.installAndroidLead')}
                </p>
                <button
                  type="button"
                  disabled={installing}
                  onClick={() => void runNativeInstall()}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: installing ? '#94a3b8' : 'var(--accent)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '15px',
                    cursor: installing ? 'wait' : 'pointer',
                    marginBottom: '12px',
                  }}
                >
                  {installing ? t('pwa.installing') : t('pwa.installWithSystem')}
                </button>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {t('pwa.installManualAndroid')}
                </p>
                </div>
              </>
            ) : ios ? (
              <>
                <h2 id="pwa-install-title" style={{ margin: '0 0 12px', fontSize: '18px', color: 'var(--text-primary)' }}>
                  {t('pwa.installTitleIos')}
                </h2>
                <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {t('pwa.installIosBody')}
                </p>
              </>
            ) : (
              <>
                <h2 id="pwa-install-title" style={{ margin: '0 0 8px', fontSize: '18px', color: 'var(--text-primary)' }}>
                  {t('pwa.installTitle')}
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {t('pwa.installBody')}
                </p>
                <div>
                <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                  {t('pwa.installDesktopLead')}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {t('pwa.installDesktopHint')}
                </p>
                </div>
              </>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-page)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('pwa.close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
