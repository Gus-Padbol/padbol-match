import React, { useEffect, useRef, useState } from 'react';
import { ThemeDarkModeSwitch } from '../context/ThemeContext';

/**
 * ⚙ Ajustes de apariencia en el header del hub (también en UserHome).
 * Popover con interruptor de modo oscuro.
 */
export default function HubThemeSettingsButton({ compact = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const size = compact ? 32 : 36;
  const btnStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: compact ? 16 : 18,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    padding: 0,
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={btnStyle}
        aria-label="Ajustes de apariencia"
        title="Apariencia"
      >
        ⚙️
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Preferencias de apariencia"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            minWidth: 232,
            padding: '14px 16px',
            borderRadius: 12,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
            zIndex: 5000,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
              Modo oscuro
            </span>
            <ThemeDarkModeSwitch id="hub-header-theme-dark-switch" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
