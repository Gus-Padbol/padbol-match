import React, { useEffect, useMemo } from 'react';
import '../../styles/ScoreboardWinnerScreen.css';

function formatTimerFromSeconds(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const CONFETTI_COLORS = ['#FFD700', '#ffffff', '#00aaff', '#ff3333'];

function Confetti() {
  const particles = useMemo(
    () => Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${3 + Math.random() * 4}s`,
      size: `${4 + Math.random() * 8}px`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 360,
    })),
    [],
  );

  return (
    <div className="sb-winner-confetti" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="sb-winner-confetti__piece"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            '--sb-confetti-rot': `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}

function TrophyIcon() {
  return (
    <svg
      className="sb-winner-trophy"
      viewBox="0 0 120 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M30 18h60v12c0 18-8 32-22 38v10H52v18h16V78H52V68C38 62 30 48 30 30V18z"
        fill="#FFD700"
      />
      <path
        d="M18 22h14v8c0 10-4 16-10 18M102 22H88v8c0 10 4 16 10 18"
        stroke="#FFD700"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect x="36" y="112" width="48" height="10" rx="2" fill="#FFD700" />
      <rect x="28" y="122" width="64" height="12" rx="3" fill="#C9A000" />
    </svg>
  );
}

function WinnerSetHistory({ historial }) {
  const sets = Array.isArray(historial) ? historial : [];
  if (!sets.length) return null;

  return (
    <div className="sb-winner-sets">
      {sets.map((s) => {
        const aWins = s.a > s.b;
        return (
          <div key={`winner-set-${s.set}`} className="sb-winner-set-box">
            <span className={aWins ? 'sb-winner-set-box__winner' : 'sb-winner-set-box__loser'}>{s.a}</span>
            {' — '}
            <span className={!aWins ? 'sb-winner-set-box__winner' : 'sb-winner-set-box__loser'}>{s.b}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ScoreboardWinnerScreen({ partido, timerSeconds = 0, onDismiss }) {
  const winnerName = partido.sets_a >= 2
    ? partido.equipo_a_nombre
    : partido.sets_b >= 2
      ? partido.equipo_b_nombre
      : partido.equipo_a_nombre;

  const duration = partido?.display?.cronometroSegundos ?? timerSeconds;

  useEffect(() => {
    if (!onDismiss) return undefined;
    const id = setTimeout(onDismiss, 30000);
    return () => clearTimeout(id);
  }, [onDismiss, partido?.id]);

  return (
    <div className="sb-winner">
      <Confetti />
      <div className="sb-winner__content">
        <TrophyIcon />
        <h2 className="sb-winner__label">WINNER</h2>
        <h1 className="sb-winner__name">{winnerName}</h1>
        <p className="sb-winner__sets-score">
          {partido.sets_a}
          {' — '}
          {partido.sets_b}
        </p>
        <p className="sb-winner__duration">
          ⏱ {formatTimerFromSeconds(duration)}
        </p>
        <WinnerSetHistory historial={partido.historial_sets} />
      </div>
    </div>
  );
}
