/**
 * Identidad visual oficial Padbol Match — logos horizontales.
 * - on-light: negro/rojo (fondos claros)
 * - on-dark: blanco/rojo (fondos oscuros)
 * Ícono cuadrado PWA/favicon: pendiente de archivo oficial (no generar desde el horizontal).
 */
export const PADBOL_LOGO_ON_LIGHT = '/brand/padbol-match-logo-on-light.png';
export const PADBOL_LOGO_ON_DARK = '/brand/padbol-match-logo-on-dark.png';

/** @param {'light'|'dark'|boolean} themeOrIsDark */
export function padbolBrandLogoSrc(themeOrIsDark) {
  const dark = themeOrIsDark === true || themeOrIsDark === 'dark';
  return dark ? PADBOL_LOGO_ON_DARK : PADBOL_LOGO_ON_LIGHT;
}
