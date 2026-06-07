import React from 'react';
import { hasUniformJerseyColors } from '../../utils/scoreboardUniformJersey';
import '../../styles/ScoreboardUniformStrip.css';

const SIZE_CLASS = {
  tv: 'sb-uniform-strip--tv',
  'tv-vertical': 'sb-uniform-strip--tv-vertical',
  compact: 'sb-uniform-strip--compact',
};

export default function UniformJerseyStrip({
  color1,
  color2,
  className = '',
  size = 'tv',
}) {
  if (!hasUniformJerseyColors({ color1, color2 })) return null;

  const isDual = Boolean(color1 && color2 && color1 !== color2);
  const solidColor = color1 || color2;
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.tv;
  const rootClass = ['sb-uniform-strip', sizeClass, className].filter(Boolean).join(' ');

  return (
    <span
      className={rootClass}
      style={isDual ? undefined : { background: solidColor }}
      aria-hidden="true"
    >
      {isDual ? (
        <>
          <span className="sb-uniform-strip__band" style={{ background: color1 }} />
          <span className="sb-uniform-strip__band" style={{ background: color2 }} />
        </>
      ) : null}
      <span className="sb-uniform-strip__sheen" />
    </span>
  );
}
