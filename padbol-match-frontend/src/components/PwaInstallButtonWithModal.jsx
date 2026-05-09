import React, { useCallback, useEffect, useState } from 'react';
import { isLikelyIos, isPwaStandalone } from '../utils/isPwaStandalone';

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
        📱 Instalar app
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
              background: '#fff',
              borderRadius: '16px',
              padding: '20px 18px 18px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {deferredPrompt ? (
              <>
                <h2 id="pwa-install-title" style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>
                  Instalar Padbol Match
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
                  Instalá la app en tu teléfono para abrirla como una aplicación y acceder más rápido.
                </p>
                <div>
                <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#334155', lineHeight: 1.55 }}>
                  En <strong>Android</strong> (Chrome o navegador compatible) podés usar el instalador del sistema:
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
                    background: installing ? '#94a3b8' : '#4f46e5',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '15px',
                    cursor: installing ? 'wait' : 'pointer',
                    marginBottom: '12px',
                  }}
                >
                  {installing ? 'Instalando…' : 'Instalar con el sistema'}
                </button>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                  Si preferís hacerlo a mano: menú <strong>⋮</strong> del navegador → <strong>Instalar aplicación</strong> o{' '}
                  <strong>Añadir a la pantalla principal</strong>.
                </p>
                </div>
              </>
            ) : ios ? (
              <>
                <h2 id="pwa-install-title" style={{ margin: '0 0 12px', fontSize: '18px', color: '#0f172a' }}>
                  Instalá Padbol Match
                </h2>
                <p style={{ margin: 0, fontSize: '15px', color: '#334155', lineHeight: 1.5 }}>
                  {`Tocá el botón Compartir ↑ en Safari y luego 'Agregar a inicio'.`}
                </p>
              </>
            ) : (
              <>
                <h2 id="pwa-install-title" style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>
                  Instalar Padbol Match
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
                  Instalá la app en tu teléfono para abrirla como una aplicación y acceder más rápido.
                </p>
                <div>
                <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#334155', lineHeight: 1.55 }}>
                  En <strong>Chrome</strong> o <strong>Edge</strong> (escritorio o Android), abrí el menú <strong>⋮</strong> y elegí{' '}
                  <strong>Instalar Padbol Match…</strong> o <strong>Instalar aplicación</strong>.
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
                  Si no ves la opción, puede que el navegador aún no ofrezca instalación en este dispositivo; probá con Chrome actualizado o volvé más tarde.
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
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#334155',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
