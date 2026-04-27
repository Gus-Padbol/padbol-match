/**
 * Layout hub: AppHeader fijo + barra de navegación (Reservar, Torneos, Ranking, Perfil)
 * justo debajo del header.
 */
export const HUB_APP_HEADER_HEIGHT_PX = 56;
export const HUB_NAV_HEIGHT_PX = 54;
export const HUB_CONTENT_PADDING_TOP_PX =
  HUB_APP_HEADER_HEIGHT_PX + HUB_NAV_HEIGHT_PX;
/** Sin barra inferior fija */
export const HUB_CONTENT_PADDING_BOTTOM_PX = 24;

/**
 * Rutas sin barra hub: inicio, listado sedes, reserva, auth.
 * Perfil de sede (`/sede/:id`) muestra la barra con estilo sobrio en {@link BottomNav}.
 */
export function isHubNavBarHiddenPathname(pathname) {
  let pathOnly = String(pathname || '/').split('?')[0].split('#')[0];
  pathOnly = pathOnly.replace(/\/+$/, '') || '/';
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

/** padding-top del contenido según si la barra hub está visible bajo el header. */
export function hubContentPaddingTopPx(pathname) {
  return isHubNavBarHiddenPathname(pathname)
    ? HUB_APP_HEADER_HEIGHT_PX
    : HUB_CONTENT_PADDING_TOP_PX;
}
