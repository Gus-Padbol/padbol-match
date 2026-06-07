import React, { useId } from 'react';
import { hasUniformJerseyColors } from '../../utils/scoreboardUniformJersey';
import '../../styles/ScoreboardUniformStrip.css';

function hexToRgba(hex, alpha = 1) {
  const normalized = String(hex || '').trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return `rgba(128, 128, 128, ${alpha})`;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function UniformJerseyStrip({
  color1,
  color2,
  className = '',
  size = 'tv',
}) {
  if (!hasUniformJerseyColors({ color1, color2 })) return null;

  const clipId = useId().replace(/:/g, '');
  const glowColor = color1 || color2;
  const isDual = Boolean(color1 && color2 && color1 !== color2);
  const solidColor = color1 || color2;
  const sizeClass = size === 'compact' ? 'sb-uniform-bubble--compact' : 'sb-uniform-bubble--tv';
  const rootClass = ['sb-uniform-bubble', sizeClass, className].filter(Boolean).join(' ');

  return (
    <span
      className={rootClass}
      style={{ '--bubble-glow': hexToRgba(glowColor, 0.5) }}
      aria-hidden="true"
    >
      <svg
        className="sb-uniform-bubble__svg"
        viewBox="0 0 52 52"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id={`sb-bubble-clip-${clipId}`}>
            <circle cx="26" cy="26" r="24" />
          </clipPath>
        </defs>
        <g clipPath={`url(#sb-bubble-clip-${clipId})`}>
          {isDual ? (
            <>
              <polygon points="0,0 52,0 0,52" fill={color1} />
              <polygon points="52,0 52,52 0,52" fill={color2} />
            </>
          ) : (
            <circle cx="26" cy="26" r="24" fill={solidColor} />
          )}
        </g>
      </svg>
      <span className="sb-uniform-bubble__glass" />
      <span className="sb-uniform-bubble__highlight" />
    </span>
  );
}
