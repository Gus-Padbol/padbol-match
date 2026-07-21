import React from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  PADBOL_LOGO_ON_DARK,
  PADBOL_LOGO_ON_DARK_TIGHT,
  PADBOL_LOGO_ON_LIGHT,
  padbolBrandLogoSrc,
} from '../constants/padbolBrandLogo';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';

/**
 * Logo horizontal oficial. `variant`:
 * - `auto` (default): según tema claro/oscuro
 * - `on-light` / `on-dark`: forzar variante
 * - `on-dark-tight`: arte on-dark sin el lienzo negro sobrante
 */
export default function PadbolBrandLogo({
  alt = 'Padbol Match',
  style,
  className,
  variant = 'auto',
}) {
  const { isDark } = useTheme();
  let src = padbolBrandLogoSrc(isDark);
  if (variant === 'on-light') src = PADBOL_LOGO_ON_LIGHT;
  if (variant === 'on-dark') src = PADBOL_LOGO_ON_DARK;
  if (variant === 'on-dark-tight') src = PADBOL_LOGO_ON_DARK_TIGHT;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ ...padbolLogoImgStyle, ...style }}
      decoding="async"
    />
  );
}
