import React from 'react';
import { DEFAULT_SCOREBOARD_COLOR_A, DEFAULT_SCOREBOARD_COLOR_B } from '../../utils/scoreboardTeamColors';
import { resolveUniformJerseyColors } from '../../utils/scoreboardUniformJersey';
import '../../styles/ScoreboardScoreBug.css';

const DEFAULT_NAME_BG = {
  A: DEFAULT_SCOREBOARD_COLOR_A,
  B: DEFAULT_SCOREBOARD_COLOR_B,
};

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

function resolveTeamNameBg(partido, side) {
  const uniform = resolveUniformJerseyColors(partido, side);
  return uniform.color1 || DEFAULT_NAME_BG[side];
}

function getSetCells(partido, side) {
  const completed = Array.isArray(partido?.historial_sets) ? partido.historial_sets : [];
  const key = side === 'A' ? 'a' : 'b';
  const currentGames = side === 'A' ? partido.games_a : partido.games_b;
  const matchOngoing = Number(partido?.sets_a) < 2 && Number(partido?.sets_b) < 2;
  const currentSetNum = matchOngoing ? completed.length + 1 : null;

  return [1, 2, 3].map((setNum) => {
    const completedRow = completed.find((row, idx) => (row.set ?? idx + 1) === setNum);
    if (completedRow) {
      return { value: String(completedRow[key] ?? ''), active: false };
    }
    if (currentSetNum === setNum) {
      return { value: String(currentGames ?? 0), active: true };
    }
    return { value: '', active: false };
  });
}

function TeamRow({ partido, side, display, serving }) {
  const name = side === 'A' ? partido.equipo_a_nombre : partido.equipo_b_nombre;
  const nameBg = resolveTeamNameBg(partido, side);
  const setCells = getSetCells(partido, side);
  const gameScore = formatPointScore(display, side);
  const hasActiveSet = setCells.some((cell) => cell.active);
  const compactGame = isCompactGameScore(gameScore);

  return (
    <div className={`sb-scorebug__row sb-scorebug__row--${side.toLowerCase()}`}>
      <div className="sb-scorebug__name" style={{ backgroundColor: nameBg }}>
        {serving ? <span className="sb-scorebug__serve" aria-hidden="true">▶</span> : null}
        <span className="sb-scorebug__name-text">{name}</span>
      </div>
      {setCells.map((cell, idx) => (
        <div
          key={`set-${side}-${idx + 1}`}
          className={`sb-scorebug__set${cell.active ? ' sb-scorebug__set--active' : ''}`}
        >
          {cell.value}
        </div>
      ))}
      <div
        className={[
          'sb-scorebug__game',
          hasActiveSet ? 'sb-scorebug__game--active-set' : '',
          compactGame ? 'sb-scorebug__game--compact' : '',
        ].filter(Boolean).join(' ')}
      >
        {gameScore}
      </div>
    </div>
  );
}

export default function ScoreboardScoreBug({ partido, timerSeconds = 0 }) {
  const display = partido?.display || {};
  const timerLabel = formatTimerFromSeconds(timerSeconds);
  const torneoLabel = String(partido?.torneo_nombre || '').trim();
  const servingA = partido?.saque_actual === 'A';
  const servingB = partido?.saque_actual === 'B';

  return (
    <div className="sb-scorebug">
      <div className="sb-scorebug__board">
        <TeamRow partido={partido} side="A" display={display} serving={servingA} />
        <div className="sb-scorebug__row-sep" aria-hidden="true" />
        <TeamRow partido={partido} side="B" display={display} serving={servingB} />
      </div>
      <div className="sb-scorebug__footer">
        {torneoLabel ? <span className="sb-scorebug__torneo">{torneoLabel}</span> : null}
        <span className="sb-scorebug__timer">{timerLabel}</span>
      </div>
    </div>
  );
}
