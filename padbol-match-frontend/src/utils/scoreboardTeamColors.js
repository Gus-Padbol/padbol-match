export const DEFAULT_SCOREBOARD_COLOR_A = '#1a3a6e';
export const DEFAULT_SCOREBOARD_COLOR_B = '#6e1a1a';

function normalizeHex(hex, fallback) {
  const value = String(hex || fallback).trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  return fallback;
}

function hexToRgb(hex) {
  const base = normalizeHex(hex, DEFAULT_SCOREBOARD_COLOR_A).slice(1);
  return {
    r: parseInt(base.slice(0, 2), 16),
    g: parseInt(base.slice(2, 4), 16),
    b: parseInt(base.slice(4, 6), 16),
  };
}

export function rgbaFromHex(hex, alpha, fallback = DEFAULT_SCOREBOARD_COLOR_A) {
  const { r, g, b } = hexToRgb(normalizeHex(hex, fallback));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveTeamColors(partido) {
  return {
    colorA: normalizeHex(partido?.color_a ?? partido?.colorA, DEFAULT_SCOREBOARD_COLOR_A),
    colorB: normalizeHex(partido?.color_b ?? partido?.colorB, DEFAULT_SCOREBOARD_COLOR_B),
  };
}

export function teamPanelStyle(hex, side) {
  const color = normalizeHex(hex, DEFAULT_SCOREBOARD_COLOR_A);
  const tint = rgbaFromHex(color, 0.15, color);
  const glow = rgbaFromHex(color, 0.3, color);
  const base = {
    background: `linear-gradient(135deg, ${tint} 0%, #0a0a0a 60%)`,
  };
  if (side === 'left') {
    return {
      ...base,
      borderLeft: `3px solid ${color}`,
      boxShadow: `inset 3px 0 20px ${glow}`,
    };
  }
  return {
    ...base,
    borderRight: `3px solid ${color}`,
    boxShadow: `inset -3px 0 20px ${glow}`,
  };
}

export function teamAccentStyle(hex) {
  const color = normalizeHex(hex, DEFAULT_SCOREBOARD_COLOR_A);
  return {
    color: '#ffffff',
    borderColor: color,
    background: 'transparent',
  };
}

export function teamBarStyle(hex) {
  const color = normalizeHex(hex, DEFAULT_SCOREBOARD_COLOR_A);
  return {
    background: color,
    color: '#ffffff',
  };
}

export function teamButtonStyle(hex) {
  const color = normalizeHex(hex, DEFAULT_SCOREBOARD_COLOR_A);
  return {
    borderColor: color,
    color,
    background: rgbaFromHex(color, 0.08, color),
  };
}
