import React, { useEffect } from 'react';
import { DEFAULT_SCOREBOARD_COLOR_B } from '../../utils/scoreboardTeamColors';
import { resolveUniformJerseyColors } from '../../utils/scoreboardUniformJersey';
import '../../styles/ScoreboardScoreBug.css';

const SCOREBUG_NAME_BG_A = '#1565c0';
const SCOREBUG_DEFAULT_NAME_BG_B = DEFAULT_SCOREBOARD_COLOR_B;
const DARK_COLOR_LUMINANCE_THRESHOLD = 100;

function hexToRgb(hex) {
  const normalized = String(hex || '').trim().replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function colorLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 255;
  return (0.299 * rgb.r) + (0.587 * rgb.g) + (0.114 * rgb.b);
}

function isColorTooDark(hex) {
  return colorLuminance(hex) < DARK_COLOR_LUMINANCE_THRESHOLD;
}

function lightenHexColor(hex, amount = 0.3) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (channel) => Math.round(channel + ((255 - channel) * amount));
  const r = mix(rgb.r);
  const g = mix(rgb.g);
  const b = mix(rgb.b);
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function formatTimerFromSeconds(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatPointScore(display, side) {
  if (!display) return '0';
  if (display.mode === 'deuce') return 'D';
  const val = side === 'A' ? display.displayA : display.displayB;
  if (val === 'VENT.') return 'AD';
  return String(val ?? '0');
}

function isCompactGameScore(score) {
  return score === 'D' || score === 'AD' || score === 'DEUCE' || score === 'ADV';
}

function resolveTeamColor(partido, side) {
  if (side === 'A') return SCOREBUG_NAME_BG_A;
  const uniform = resolveUniformJerseyColors(partido, side);
  let bg = uniform.color1 || SCOREBUG_DEFAULT_NAME_BG_B;
  if (isColorTooDark(bg)) {
    bg = lightenHexColor(bg, 0.3);
  }
  return bg;
}

function getCurrentSetNumber(partido) {
  const completed = Array.isArray(partido?.historial_sets) ? partido.historial_sets : [];
  const matchOngoing = Number(partido?.sets_a) < 2 && Number(partido?.sets_b) < 2;
  if (!matchOngoing) return null;
  return completed.length + 1;
}

function getSetCells(partido, side) {
  const completed = Array.isArray(partido?.historial_sets) ? partido.historial_sets : [];
  const key = side === 'A' ? 'a' : 'b';
  const currentGames = side === 'A' ? partido.games_a : partido.games_b;
  const currentSetNum = getCurrentSetNumber(partido);

  return [1, 2, 3].map((setNum) => {
    const completedRow = completed.find((row, idx) => (row.set ?? idx + 1) === setNum);
    if (completedRow) {
      return { value: String(completedRow[key] ?? ''), active: false, future: false, completed: true };
    }
    if (currentSetNum === setNum) {
      return { value: String(currentGames ?? 0), active: true, future: false, completed: false };
    }
    return { value: '—', active: false, future: true, completed: false };
  });
}

function TeamRow({ partido, side, display, serving }) {
  const name = side === 'A' ? partido.equipo_a_nombre : partido.equipo_b_nombre;
  const teamColor = resolveTeamColor(partido, side);
  const setCells = getSetCells(partido, side);
  const gameScore = formatPointScore(display, side);
  const compactGame = isCompactGameScore(gameScore);

  return (
    <div className={`sb-scorebug__row sb-scorebug__row--${side.toLowerCase()}`}>
      <div className="sb-scorebug__team">
        <div className="sb-scorebug__flag" style={{ backgroundColor: teamColor }} aria-hidden="true" />
        <div className="sb-scorebug__name" style={{ backgroundColor: teamColor }}>
          <span className="sb-scorebug__name-text sb-bug-team-name" lang="es">{name}</span>
        </div>
        <div className={`sb-scorebug__serve${serving ? ' sb-scorebug__serve--on' : ''}`} aria-hidden="true">
          {serving ? '▶' : null}
        </div>
      </div>
      {setCells.map((cell, idx) => (
        <div
          key={`set-${side}-${idx + 1}`}
          className={[
            'sb-scorebug__set',
            cell.active ? 'sb-scorebug__set--active' : '',
            cell.future ? 'sb-scorebug__set--future' : '',
            cell.completed ? 'sb-scorebug__set--completed' : '',
          ].filter(Boolean).join(' ')}
        >
          {cell.value}
        </div>
      ))}
      <div className={['sb-scorebug__game', compactGame ? 'sb-scorebug__game--compact' : ''].filter(Boolean).join(' ')}>
        {gameScore}
      </div>
    </div>
  );
}

export default function ScoreboardScoreBug({ partido, timerSeconds = 0 }) {
  const display = partido.display || {};
  const timerLabel = formatTimerFromSeconds(timerSeconds);
  const torneoLabel = String(partido?.torneo_nombre || '').trim();
  const servingA = partido.saque_actual === 'A';
  const servingB = partido.saque_actual === 'B';

  useEffect(() => {
    console.log('nombres:', partido?.equipo_a_nombre, partido?.equipo_b_nombre);
  }, [partido?.equipo_a_nombre, partido?.equipo_b_nombre]);

  return (
    <div className="sb-scorebug">
      <div className="sb-scorebug__board">
        <TeamRow partido={partido} side="A" display={display} serving={servingA} />
        <TeamRow partido={partido} side="B" display={display} serving={servingB} />

        <div className="sb-scorebug__footer">
          <span className="sb-scorebug__footer-torneo">{torneoLabel}</span>
          <span className="sb-scorebug__footer-timer">{timerLabel}</span>
        </div>
      </div>
    </div>
  );
}
