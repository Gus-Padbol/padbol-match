/**
 * Identidad visual oficial Padbol Match — logos horizontales.
 * - on-light: negro/rojo (fondos claros)
 * - on-dark: blanco/rojo (fondos oscuros)
 * - on-dark-tight: mismo arte on-dark recortado al contenido (sin el
 *   lienzo negro 1024×1024) para web pública y superficies donde el
 *   padding del asset se ve como un bloque negro sobredimensionado.
 * El ícono cuadrado conserva la geometría del isotipo vectorial oficial.
 */
export const PADBOL_LOGO_ON_LIGHT = '/brand/padbol-match-logo-on-light.png';
export const PADBOL_LOGO_ON_DARK = '/brand/padbol-match-logo-on-dark.png';
export const PADBOL_LOGO_ON_DARK_TIGHT =
  '/brand/padbol-match-logo-on-dark-tight.png';
export const PADBOL_ICON_SVG = '/brand/padbol-match-icon.svg';
export const PADBOL_ICON_192 = '/brand/padbol-match-icon-192.png';
export const PADBOL_ICON_512 = '/brand/padbol-match-icon-512.png';
export const PADBOL_ICON_MASKABLE_512 =
  '/brand/padbol-match-icon-maskable-512.png';
export const PADBOL_APPLE_TOUCH_ICON =
  '/brand/padbol-match-apple-touch-icon.png';

/** @param {'light'|'dark'|boolean} themeOrIsDark */
export function padbolBrandLogoSrc(themeOrIsDark) {
  const dark = themeOrIsDark === true || themeOrIsDark === 'dark';
  return dark ? PADBOL_LOGO_ON_DARK : PADBOL_LOGO_ON_LIGHT;
}
