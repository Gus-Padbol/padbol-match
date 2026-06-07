import React from 'react';
import { hasUniformJerseyColors } from '../../utils/scoreboardUniformJersey';
import '../../styles/ScoreboardUniformStrip.css';

export default function UniformJerseyStrip({ color1, color2, className = '' }) {
  if (!hasUniformJerseyColors({ color1, color2 })) return null;

  const rootClass = ['sb-uniform-strip', className].filter(Boolean).join(' ');

  if (color1 && !color2) {
    return <span className={`${rootClass} sb-uniform-strip--solid`} style={{ background: color1 }} aria-hidden="true" />;
  }
  if (!color1 && color2) {
    return <span className={`${rootClass} sb-uniform-strip--solid`} style={{ background: color2 }} aria-hidden="true" />;
  }
  if (color1 === color2) {
    return <span className={`${rootClass} sb-uniform-strip--solid`} style={{ background: color1 }} aria-hidden="true" />;
  }

  return (
    <span className={rootClass} aria-hidden="true">
      <span className="sb-uniform-strip__band" style={{ background: color1 }} />
      <span className="sb-uniform-strip__band" style={{ background: color2 }} />
    </span>
  );
}
