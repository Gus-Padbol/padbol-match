import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { IconGeroDarkTheme, IconGeroWhiteTheme } from './icons/GeroIcons';

/**
 * Toggle claro/oscuro (assets Gero: sol / luna, 24×24).
 * Modo oscuro activo → sol (pasa a claro); modo claro → luna (pasa a oscuro).
 */
export default function HubThemeSettingsButton({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const outer = compact ? 32 : 36;
  const btnStyle = {
    width: outer,
    height: outer,
    minWidth: outer,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
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
