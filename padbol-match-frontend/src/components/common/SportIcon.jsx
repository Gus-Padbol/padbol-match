import React from 'react';
import { ReactComponent as PadbolIcon } from '../../assets/icons/PADBOL.svg';
import { ReactComponent as PadelIcon } from '../../assets/icons/PADEL.svg';
import { ReactComponent as PickleballIcon } from '../../assets/icons/PICKLEBALL.svg';
import { ReactComponent as TenisIcon } from '../../assets/icons/TENIS.svg';

/** Iconos Gero (`src/assets/icons/`), `fill="currentColor"` en los SVG. */
const SPORT_ICON_BY_KEY = {
  padbol: PadbolIcon,
  padel: PadelIcon,
  pickleball: PickleballIcon,
  tenis: TenisIcon,
};

/** Color por defecto en fondos oscuros (hub, hero, chips sede, partido). */
export const SPORT_ICON_COLOR_ON_DARK = '#ffffff';

/** Normaliza alias de deporte → clave de icono Gero. */
export function normalizeSportDeporte(deporte) {
  const d = String(deporte || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!d) return null;
  // MEJ-07: custom nunca remapea a Padbol ni a otro icono oficial.
  if (d === 'custom' || d === 'otro' || d === 'personalizado') return null;
  if (d.includes('padbol')) return 'padbol';
  if (d.includes('pickleball')) return 'pickleball';
  if (d.includes('padel')) return 'padel';
  if (d.includes('tenis') || d.includes('tennis')) return 'tenis';
  if (SPORT_ICON_BY_KEY[d]) return d;
  return null;
}

export function resolveSportIconComponent(deporte) {
  const key = normalizeSportDeporte(deporte);
  return key ? SPORT_ICON_BY_KEY[key] : null;
}

/**
 * Ícono de deporte (SVG Gero en `assets/icons/`).
 * @param {string} deporte
 * @param {number} [size=24]
 * @param {string} [color='#ffffff']
 */
export default function SportIcon({
  deporte,
  size = 24,
  color = SPORT_ICON_COLOR_ON_DARK,
  className,
  style,
  title,
  ...rest
}) {
  const resolvedColor = color ?? SPORT_ICON_COLOR_ON_DARK;
  const wrapperStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    flexShrink: 0,
    color: resolvedColor,
    lineHeight: 0,
    ...style,
  };

  const Icon = resolveSportIconComponent(deporte);
  if (!Icon) {
    return (
      <span
        className={className}
        style={{
          ...wrapperStyle,
          fontSize: Math.round(size * 0.72),
          lineHeight: 1,
        }}
        aria-hidden={title ? undefined : true}
        title={title}
        {...rest}
      >
        ⚽
      </span>
    );
  }
  return (
    <span
      className={className}
      style={wrapperStyle}
      title={title}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      <Icon
        width={size}
        height={size}
        fill={resolvedColor}
        className="sport-icon__svg"
        style={{
          display: 'block',
          width: size,
          height: size,
          color: resolvedColor,
        }}
        role={title ? 'img' : 'presentation'}
        aria-hidden
        aria-label={title}
      />
    </span>
  );
}
