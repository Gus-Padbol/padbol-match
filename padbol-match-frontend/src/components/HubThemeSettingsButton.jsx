import React from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Toggle directo claro/oscuro en el header del hub (misma huella que el antiguo ⚙).
 * Modo oscuro activo → ☀️ (pasa a claro); modo claro → 🌙 (pasa a oscuro).
 */
export default function HubThemeSettingsButton({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
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
    <button
      type="button"
      onClick={() => toggleTheme()}
      style={btnStyle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
