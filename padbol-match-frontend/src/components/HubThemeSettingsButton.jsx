import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { IconGeroDarkTheme, IconGeroWhiteTheme } from './icons/GeroIcons';

/**
 * Toggle claro/oscuro (assets Gero: sol / luna, 24×24).
 * Modo oscuro activo → sol (pasa a claro); modo claro → luna (pasa a oscuro).
 * `barOnDark`: barra siempre oscura (p. ej. header del panel admin) para buen contraste del ícono.
 */
export default function HubThemeSettingsButton({ compact = false, barOnDark = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const outer = compact ? 32 : 36;
  const btnStyle = {
    width: outer,
    height: outer,
    minWidth: outer,
    borderRadius: 8,
    border: barOnDark ? '1px solid rgba(255,255,255,0.22)' : '1px solid var(--border)',
    background: barOnDark ? 'rgba(255,255,255,0.1)' : 'var(--bg-card)',
    color: barOnDark ? '#e2e8f0' : 'var(--text-primary)',
    cursor: 'pointer',
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
    <button
      type="button"
      onClick={() => toggleTheme()}
      style={btnStyle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      {isDark ? <IconGeroWhiteTheme size={24} /> : <IconGeroDarkTheme size={24} />}
    </button>
  );
}
