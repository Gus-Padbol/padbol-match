/**
 * Identidad visual oficial Padbol Match — logos horizontales.
 * - on-light: negro/rojo (fondos claros)
 * - on-dark: blanco/rojo (fondos oscuros)
 * - on-dark-tight: mismo arte on-dark recortado al contenido (sin el
 *   lienzo negro 1024×1024) para web pública y superficies donde el
 *   padding del asset se ve como un bloque negro sobredimensionado.
 * Ícono cuadrado PWA/favicon: pendiente de archivo oficial (no generar desde el horizontal).
 */
export const PADBOL_LOGO_ON_LIGHT = '/brand/padbol-match-logo-on-light.png';
export const PADBOL_LOGO_ON_DARK = '/brand/padbol-match-logo-on-dark.png';
export const PADBOL_LOGO_ON_DARK_TIGHT =
  '/brand/padbol-match-logo-on-dark-tight.png';

/** @param {'light'|'dark'|boolean} themeOrIsDark */
export function padbolBrandLogoSrc(themeOrIsDark) {
  const dark = themeOrIsDark === true || themeOrIsDark === 'dark';
  return dark ? PADBOL_LOGO_ON_DARK : PADBOL_LOGO_ON_LIGHT;
}
