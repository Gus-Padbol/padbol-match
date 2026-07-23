import React, { useMemo } from 'react';
import {
  buildBinarySequence,
  decorateBinaryAccents,
  selectBinaryBands,
  selectFrontFragments,
  BINARY_STREAM_TYPOGRAPHY,
} from './binaryStreamData';

/**
 * Corriente binaria vertical cyan (detalle de fondo).
 * Caída arriba→abajo; sin rojo; detrás del contenido principal.
 */
export default function BinaryDataStream({
  reducedMotion = false,
  compact = false,
  tablet = false,
  bandCount = null,
  direction = 'ttb',
  speedScale = 1,
  opacityScale = 1,
  color = 'cyan',
  density = 'normal',
  position = 'left',
  className = '',
  showFrontFragments = false,
}) {
  const bands = useMemo(() => {
    let list = selectBinaryBands({ compact, tablet, reducedMotion });
    if (bandCount != null && Number.isFinite(bandCount)) {
      list = list.slice(0, Math.max(0, bandCount));
    }
    if (density === 'sparse') {
      list = list.filter((_, i) => i % 2 === 0);
    }
    return list.map((b) => ({
      ...b,
      text: buildBinarySequence(b.seed, b.length),
      durationSec: Math.max(14, b.durationSec * speedScale),
      opacity: Math.min(1, b.opacity * opacityScale),
      rotateDeg: 0,
    }));
  }, [compact, tablet, reducedMotion, bandCount, density, speedScale, opacityScale]);

  const fronts = useMemo(() => {
    if (!showFrontFragments) return [];
    return selectFrontFragments({ compact, tablet, reducedMotion }).map((b) => ({
      ...b,
      text: buildBinarySequence(b.seed, b.length),
      durationSec: Math.max(14, b.durationSec * speedScale),
      opacity: Math.min(1, b.opacity * opacityScale),
    }));
  }, [compact, tablet, reducedMotion, showFrontFragments, speedScale, opacityScale]);

  const dirClass = direction === 'btt' ? 'is-btt' : 'is-ttb';
  const posClass = position === 'left' ? 'is-left' : 'is-right';
  const colorClass = 'is-cyan';
  const viewportClass = compact ? 'is-mobile' : tablet ? 'is-tablet' : 'is-desktop';
  const gap = compact
    ? BINARY_STREAM_TYPOGRAPHY.lineGapPx.mobile
    : tablet
      ? BINARY_STREAM_TYPOGRAPHY.lineGapPx.tablet
      : BINARY_STREAM_TYPOGRAPHY.lineGapPx.desktop;

  return (
    <div
      className={`ps-binary-stream ${dirClass} ${posClass} ${colorClass} ${viewportClass} ${className}`.trim()}
      aria-hidden="true"
      data-binary-stream="true"
      data-band-count={bands.length}
      data-front-count={fronts.length}
      data-motion={reducedMotion ? 'static' : 'fall'}
      data-position={position}
      data-orientation="vertical"
      data-rotate="0"
      data-motion-axis="y"
      data-color="cyan"
      data-flow="top-to-bottom"
      data-letter-spacing={
        compact
          ? BINARY_STREAM_TYPOGRAPHY.letterSpacing.mobile
          : tablet
            ? BINARY_STREAM_TYPOGRAPHY.letterSpacing.tablet
            : BINARY_STREAM_TYPOGRAPHY.letterSpacing.desktop
      }
      style={{ '--ps-bin-gap': `${gap}px` }}
    >
      <div className="ps-binary-stream__group" data-plane="back" data-binary-group="true">
        {bands.map((band) => (
          <BinaryBand key={band.id} band={band} reducedMotion={reducedMotion} />
        ))}
      </div>
    </div>
  );
}

function BinaryBand({ band, reducedMotion }) {
  const doubled = `${band.text}${band.text}`;
  const segments = useMemo(
    () => decorateBinaryAccents(doubled, band.seed),
    [doubled, band.seed],
  );
  const style = {
    '--ps-bin-rotate': `${band.rotateDeg}deg`,
    '--ps-bin-duration': `${band.durationSec}s`,
    '--ps-bin-delay': `${band.delaySec}s`,
    '--ps-bin-opacity': String(band.opacity),
    '--ps-bin-size': `${band.fontPx}px`,
    animationPlayState: reducedMotion ? 'paused' : 'running',
  };

  return (
    <div
      className={`ps-binary-stream__band is-${band.depth} is-tone-${band.colorTone || 'primary'}`}
      data-band-id={band.id}
      data-depth={band.depth}
      data-duration={band.durationSec}
      data-font-px={band.fontPx}
      data-opacity={band.opacity}
      data-rotate={band.rotateDeg}
      style={style}
    >
      <span className="ps-binary-stream__track" data-binary-text={band.text}>
        {segments.map((seg, i) =>
          seg.type === 'ice' ? (
            <span key={`${band.id}-ice-${i}`} className="ps-binary-stream__ice">
              {seg.text}
            </span>
          ) : (
            <span key={`${band.id}-base-${i}`}>{seg.text}</span>
          ),
        )}
      </span>
    </div>
  );
}
