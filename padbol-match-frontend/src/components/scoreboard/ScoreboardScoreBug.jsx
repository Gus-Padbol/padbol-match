import React, { useMemo } from 'react';
import { resolveUniformJerseyColors } from '../../utils/scoreboardUniformJersey';
import '../../styles/ScoreboardScoreBug.css';

function formatTimerFromSeconds(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatPointScore(display, side) {
  if (!display) return '0';
  if (display.mode === 'deuce') return 'DEUCE';
  const val = side === 'A' ? display.displayA : display.displayB;
  if (val === 'VENT.') return 'ADV';
  return String(val ?? '0');
}

function isSpecialScore(display) {
  return display?.mode === 'deuce' || display?.displayA === 'VENT.' || display?.displayB === 'VENT.';
}

function buildSetsMeta(partido) {
  const completed = Array.isArray(partido?.historial_sets) ? partido.historial_sets : [];
  const parts = completed.map((setRow, idx) => {
    const setNum = setRow.set ?? idx + 1;
    return `SET ${setNum}: ${setRow.a}-${setRow.b}`;
  });

  const matchOngoing = Number(partido?.sets_a) < 2 && Number(partido?.sets_b) < 2;
  if (matchOngoing) {
    const currentSet = completed.length + 1;
    parts.push(`SET ${currentSet}: ${partido.games_a ?? 0}-${partido.games_b ?? 0}`);
  }

  return parts.join(' | ');
}

function UniformBar({ partido, side }) {
  const { color1, color2 } = resolveUniformJerseyColors(partido, side);
  const color = color1 || color2;
  if (!color) return null;
  return <span className="sb-scorebug__uniform" style={{ background: color }} aria-hidden="true" />;
}

export default function ScoreboardScoreBug({ partido, timerSeconds = 0 }) {
  const display = partido?.display || {};
  const scoreA = formatPointScore(display, 'A');
  const scoreB = formatPointScore(display, 'B');
  const specialScore = isSpecialScore(display);
  const setsMeta = useMemo(() => buildSetsMeta(partido), [partido]);
  const timerLabel = formatTimerFromSeconds(timerSeconds);
  const servingA = partido?.saque_actual === 'A';
  const servingB = partido?.saque_actual === 'B';

  return (
    <div className="sb-scorebug">
      <div className="sb-scorebug__pill">
        <div className="sb-scorebug__main">
          <div className="sb-scorebug__team sb-scorebug__team--a">
            <UniformBar partido={partido} side="A" />
            {servingA ? <span className="sb-scorebug__serve" aria-label="Serving" title="Serving" /> : null}
            <span className="sb-scorebug__name">{partido.equipo_a_nombre}</span>
          </div>
          <span className={`sb-scorebug__score${specialScore ? ' sb-scorebug__score--special' : ''}`}>
            {scoreA}
          </span>
          <span className="sb-scorebug__divider">-</span>
          <span className={`sb-scorebug__score${specialScore ? ' sb-scorebug__score--special' : ''}`}>
            {scoreB}
          </span>
          <div className="sb-scorebug__team sb-scorebug__team--b">
            <span className="sb-scorebug__name">{partido.equipo_b_nombre}</span>
            {servingB ? <span className="sb-scorebug__serve" aria-label="Serving" title="Serving" /> : null}
            <UniformBar partido={partido} side="B" />
          </div>
        </div>
        <p className="sb-scorebug__meta">
          {setsMeta}
          {setsMeta ? ' | ' : ''}
          {timerLabel}
        </p>
      </div>
    </div>
  );
}
