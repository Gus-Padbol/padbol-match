import React, { useEffect, useMemo } from 'react';
import UniformJerseyStrip from './UniformJerseyStrip';
import { hasUniformJerseyColors, resolveUniformJerseyColors } from '../../utils/scoreboardUniformJersey';
import { playVictoryFanfare } from '../../utils/scoreboardVictoryFanfare';
import '../../styles/ScoreboardDramaticResultScreen.css';
import '../../styles/ScoreboardUniformStrip.css';

function hexToRgb(hex) {
  const h = String(hex || '').trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export default function ScoreboardDramaticResultScreen({ partido }) {
  const aWins = Number(partido?.sets_a) >= 2;
  const winnerSide = aWins ? 'A' : 'B';
  const winnerName = aWins ? partido.equipo_a_nombre : partido.equipo_b_nombre;
  const loserName = aWins ? partido.equipo_b_nombre : partido.equipo_a_nombre;
  const winnerSets = aWins ? partido.sets_a : partido.sets_b;
  const loserSets = aWins ? partido.sets_b : partido.sets_a;

  const winnerUniform = resolveUniformJerseyColors(partido, winnerSide);
  const glowStyle = useMemo(() => {
    const rgb = hexToRgb(winnerUniform.color1 || winnerUniform.color2 || '#ffffff');
    if (!rgb) {
      return {
        '--sb-dramatic-glow': 'rgba(255, 255, 255, 0.5)',
        '--sb-dramatic-glow-soft': 'rgba(255, 255, 255, 0.25)',
      };
    }
    return {
      '--sb-dramatic-glow': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.75)`,
      '--sb-dramatic-glow-soft': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`,
    };
  }, [winnerUniform.color1, winnerUniform.color2]);

  useEffect(() => {
    playVictoryFanfare();
  }, [partido?.id]);

  return (
    <div className="sb-dramatic" style={glowStyle} role="status" aria-live="polite">
      <div className="sb-dramatic__loser">
        <h2 className="sb-dramatic__loser-name">{loserName}</h2>
        <p className="sb-dramatic__loser-sets">
          {loserSets}
          {' '}
          {loserSets === 1 ? 'SET' : 'SETS'}
        </p>
      </div>

      <div className="sb-dramatic__divider" aria-hidden="true" />

      <div className="sb-dramatic__winner">
        <div className="sb-dramatic__uniform">
          {hasUniformJerseyColors(winnerUniform) ? (
            <UniformJerseyStrip
              color1={winnerUniform.color1}
              color2={winnerUniform.color2}
            />
          ) : (
            <span
              className="sb-uniform-strip sb-uniform-strip--solid"
              style={{ background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)' }}
              aria-hidden="true"
            />
          )}
        </div>
        <h1 className="sb-dramatic__winner-name">{winnerName}</h1>
        <p className="sb-dramatic__sets-score">
          {winnerSets}
          -
          {loserSets}
        </p>
      </div>
    </div>
  );
}
