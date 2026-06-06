export const DEFAULT_SCOREBOARD_COLOR_A = '#1a3a6e';
export const DEFAULT_SCOREBOARD_COLOR_B = '#6e1a1a';

function normalizeHex(hex, fallback) {
  const value = String(hex || fallback).trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  return fallback;
}

function hexWithAlpha(hex, alpha) {
  const base = normalizeHex(hex, DEFAULT_SCOREBOARD_COLOR_A);
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${base}${a}`;
}

export function resolveTeamColors(partido) {
  return {
    colorA: normalizeHex(partido?.color_a ?? partido?.colorA, DEFAULT_SCOREBOARD_COLOR_A),
    colorB: normalizeHex(partido?.color_b ?? partido?.colorB, DEFAULT_SCOREBOARD_COLOR_B),
  };
}

export function teamPanelStyle(hex, side) {
  const color = normalizeHex(hex, DEFAULT_SCOREBOARD_COLOR_A);
  const gradient = `linear-gradient(135deg, ${hexWithAlpha(color, 0.95)}, ${hexWithAlpha(color, 0.55)})`;
  if (side === 'left') {
    return {
      background: gradient,
      borderRight: `2px solid ${hexWithAlpha(color, 0.5)}`,
    };
  }
  return {
    background: gradient,
    borderLeft: `2px solid ${hexWithAlpha(color, 0.5)}`,
  };
}

export function teamAccentStyle(hex) {
  const color = normalizeHex(hex, DEFAULT_SCOREBOARD_COLOR_A);
  return {
    color,
    borderColor: color,
    background: hexWithAlpha(color, 0.1),
  };
}

export function teamButtonStyle(hex) {
  const color = normalizeHex(hex, DEFAULT_SCOREBOARD_COLOR_A);
  return {
    borderColor: color,
    color,
    background: hexWithAlpha(color, 0.08),
  };
}
