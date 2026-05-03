/**
 * Layout hub: AppHeader fijo + barra de navegación (Reservar, Torneos, Ranking, Perfil)
 * justo debajo del header.
 */
export const HUB_APP_HEADER_HEIGHT_PX = 56;
/** Padding vertical del AppHeader (8px arriba + 8px abajo, alineado con AppHeader.jsx). */
export const APP_HEADER_OUTER_PADDING_PX = 16;
export const HUB_NAV_HEIGHT_PX = 54;
export const HUB_CONTENT_PADDING_TOP_PX =
  HUB_APP_HEADER_HEIGHT_PX + HUB_NAV_HEIGHT_PX;
/** Sin barra inferior fija */
export const HUB_CONTENT_PADDING_BOTTOM_PX = 24;

/**
 * Columna principal centrada (estilo feed móvil en desktop): fondo full-bleed, contenido acotado.
 */
export const HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX = 900;

export const hubInstagramColumnWrapStyle = {
  maxWidth: `${HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX}px`,
  width: '100%',
  marginLeft: 'auto',
  marginRight: 'auto',
  boxSizing: 'border-box',
};

/** Ancho máximo de la barra hub inferior (alineado con columna contenido). */
export const hubBottomNavMaxWidthPx = HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX;

/**
 * Rutas sin barra hub: inicio, listado sedes, reserva, auth.
 * `/admin` usa solo las pestañas del propio panel (no {@link BottomNav} bajo el header).
 * Perfil de sede (`/sede/:id`) muestra la barra con estilo sobrio en {@link BottomNav}.
 */
export function isHubNavBarHiddenPathname(pathname) {
  let pathOnly = String(pathname || '/').split('?')[0].split('#')[0];
  pathOnly = pathOnly.replace(/\/+$/, '') || '/';
  if (pathOnly === '/admin' || pathOnly.startsWith('/admin/')) return true;
  if (pathOnly === '/login') return true;
  if (pathOnly === '/auth' || pathOnly.startsWith('/auth/')) return true;
  if (pathOnly === '/acceso' || pathOnly.startsWith('/acceso/')) return true;
  if (pathOnly === '/registro' || pathOnly.startsWith('/registro/')) return true;
  if (pathOnly === '/reservar' || pathOnly.startsWith('/reservar/')) return true;
  if (pathOnly === '/' || pathOnly === '/inicio' || pathOnly === '/hub' || pathOnly === '/home') return true;
  if (pathOnly === '/sedes' || pathOnly.startsWith('/sedes/')) return true;
  return false;
}

/** Perfil público de sede: barra hub visible con fondo semitransparente. */
export function isSedeProfilePathname(pathname) {
  let pathOnly = String(pathname || '/').split('?')[0].split('#')[0];
  pathOnly = pathOnly.replace(/\/+$/, '') || '/';
  return pathOnly === '/sede' || pathOnly.startsWith('/sede/');
}

/**
 * Padding-top en px bajo el header fijo (y la barra hub si aplica).
 * Perfil público `/sede` y `/sede/:id` siempre muestran header + BottomNav bajo el header.
 */
export function hubContentPaddingTopPx(pathname) {
  if (isSedeProfilePathname(pathname)) {
    return HUB_APP_HEADER_HEIGHT_PX + HUB_NAV_HEIGHT_PX;
  }
  if (isHubNavBarHiddenPathname(pathname)) {
    return HUB_APP_HEADER_HEIGHT_PX;
  }
  return HUB_APP_HEADER_HEIGHT_PX + HUB_NAV_HEIGHT_PX;
}

/**
 * Altura ocupada por el AppHeader fijo (minHeight + paddings + safe-area en iOS).
 */
export function appHeaderStackHeightCss() {
  return `calc(${HUB_APP_HEADER_HEIGHT_PX + APP_HEADER_OUTER_PADDING_PX}px + env(safe-area-inset-top, 0px))`;
}

/**
 * Offset bajo header fijo (+ barra hub si aplica) + chrome del header + safe-area.
 */
export function hubContentPaddingTopCss(pathname) {
  const basePx = hubContentPaddingTopPx(pathname);
  return `calc(${basePx + APP_HEADER_OUTER_PADDING_PX}px + env(safe-area-inset-top, 0px))`;
}

/**
 * Posición `top` del {@link BottomNav} fijo, bajo el AppHeader (misma pila que {@link hubContentPaddingTopCss} sin nav).
 */
export function hubBottomNavFixedTopCss() {
  return appHeaderStackHeightCss();
}
