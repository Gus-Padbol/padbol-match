import React from 'react';
import { ReactComponent as PadbolIcon } from '../assets/deportes/padbol.svg';
import { ReactComponent as FutbolIcon } from '../assets/deportes/futbol.svg';
import { ReactComponent as PadelIcon } from '../assets/deportes/padel.svg';
import { ReactComponent as PickleballIcon } from '../assets/deportes/pickleball.svg';
import { ReactComponent as SquashIcon } from '../assets/deportes/squash.svg';
import { ReactComponent as TenisIcon } from '../assets/deportes/tenis.svg';

function resolveDeporteIcon(deporte) {
  const d = String(deporte || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (d.includes('padbol')) return PadbolIcon;
  if (d.includes('futbol')) return FutbolIcon;
  if (d.includes('padel')) return PadelIcon;
  if (d.includes('pickleball')) return PickleballIcon;
  if (d.includes('squash')) return SquashIcon;
  if (d.includes('tenis') || d.includes('tennis')) return TenisIcon;
  return null;
}

/**
 * Ícono Gero por deporte (SVG en `assets/deportes/`).
 * Hereda color con `color` / `fill: currentColor` en paths.
 */
export function DeporteIcono({
  deporte,
  size = 24,
  color = 'currentColor',
  className,
  style,
  title,
  ...rest
}) {
  const Icon = resolveDeporteIcon(deporte);
  if (!Icon) {
    return (
      <span
        className={className}
        style={{ fontSize: size * 0.7, lineHeight: 1, flexShrink: 0, color, ...style }}
        aria-hidden={title ? undefined : true}
        title={title}
        {...rest}
      >
        🏅
      </span>
    );
  }
  return (
    <Icon
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', flexShrink: 0, color, ...style }}
      fill="currentColor"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...rest}
    />
  );
}

export default DeporteIcono;
