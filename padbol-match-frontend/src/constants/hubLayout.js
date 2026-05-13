/**
 * Layout hub: AppHeader fijo + barra de navegación (Jugar, Competir, Perfil)
 * justo debajo del header.
 */
export const HUB_APP_HEADER_HEIGHT_PX = 56;
/** Padding vertical del AppHeader (8px arriba + 8px abajo, alineado con AppHeader.jsx). */
export const APP_HEADER_OUTER_PADDING_PX = 16;
/**
 * Margen extra bajo el bloque fijo medido (bordes, tipografía, iOS): evita que logos/hero
 * queden visualmente bajo {@link AppHeader} cuando el chrome real supera unos píxeles al cálculo.
 */
export const HUB_FIXED_CHROME_SLACK_PX = 8;
export const HUB_NAV_HEIGHT_PX = 54;
export const HUB_CONTENT_PADDING_TOP_PX =
  HUB_APP_HEADER_HEIGHT_PX + HUB_NAV_HEIGHT_PX;
/** Sin barra inferior fija */
export const HUB_CONTENT_PADDING_BOTTOM_PX = 24;

/**
 * Separación extra entre el borde inferior del header fijo (+ BottomNav si aplica)
 * y el bloque del logo. El despeje principal viene de {@link hubContentPaddingTopCss}.
 */
export const HUB_LOGO_CLEARANCE_TOP_PX = 12;

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
 * Rutas sin barra hub bajo el header (auth, reserva full-bleed, admin, listado sedes).
 * El inicio del jugador (`/`, `/hub`, …) sí muestra {@link BottomNav} (Jugar / Competir / Perfil).
 * `/admin` usa solo las pestañas del propio panel (no {@link BottomNav} bajo el header).
 * Perfil de sede (`/sede/:id`) muestra la barra con estilo sobrio en {@link BottomNav}.
 */
export function isHubNavBarHiddenPathname(pathname) {
  let pathOnly = String(pathname || '/').split('?')[0].split('#')[0];
  pathOnly = pathOnly.replace(/\/+$/, '') || '/';
  if (pathOnly === '/admin' || pathOnly.startsWith('/admin/')) return true;
  if (pathOnly === '/login') return true;
  if (pathOnly === '/completar-perfil') return true;
  if (pathOnly === '/auth' || pathOnly.startsWith('/auth/')) return true;
  if (pathOnly === '/acceso' || pathOnly.startsWith('/acceso/')) return true;
  if (pathOnly === '/registro' || pathOnly.startsWith('/registro/')) return true;
  if (pathOnly === '/reservar' || pathOnly.startsWith('/reservar/')) return true;
  if (pathOnly === '/sedes' || pathOnly.startsWith('/sedes/')) return true;
  if (pathOnly === '/terminos' || pathOnly.startsWith('/terminos/')) return true;
  if (pathOnly === '/privacidad' || pathOnly.startsWith('/privacidad/')) return true;
  if (pathOnly === '/sobre' || pathOnly.startsWith('/sobre/')) return true;
  if (pathOnly === '/contacto' || pathOnly.startsWith('/contacto/')) return true;
  return false;
}

/**
 * Rutas del shell jugador (misma barra inferior): sin lupa global en {@link AppHeader}.
 */
export function isJugadorHubShellPathname(pathname) {
  let pathOnly = String(pathname || '/').split('?')[0].split('#')[0];
  pathOnly = pathOnly.replace(/\/+$/, '') || '/';
  if (pathOnly === '/jugar') return true;
  if (pathOnly.startsWith('/jugar/')) return true;
  if (pathOnly === '/competir') return true;
  if (pathOnly === '/rankings') return true;
  if (pathOnly === '/reservar' || pathOnly.startsWith('/reservar/')) return true;
  if (pathOnly === '/torneos') return true;
  if (pathOnly === '/mi-perfil' || pathOnly.startsWith('/mi-perfil/')) return true;
  if (pathOnly === '/partidos-abiertos') return true;
  if (pathOnly === '/armar-partido') return true;
  if (pathOnly === '/notificaciones') return true;
  return false;
}

/** Perfil público de sede: barra hub visible con fondo semitransparente. */
export function isSedeProfilePathname(pathname) {
  let pathOnly = String(pathname || '/').split('?')[0].split('#')[0];
  pathOnly = pathOnly.replace(/\/+$/, '') || '/';
  return pathOnly === '/sede' || pathOnly.startsWith('/sede/');
}

/** Rutas permitidas en `location.state.sedeBackPath` al salir del perfil público de sede. */
const SEDE_PUBLIC_BACK_PATH_ALLOWLIST = new Set(['/hub', '/sedes']);

/**
 * Destino fijo para «Volver» en `/sede` y `/sede/:id` (evita `history.back()` y loops con calendario u otras pantallas).
 * Si la navegación a la sede envió `location.state.sedeBackPath` (p. ej. desde el listado `/sedes`), se respeta si está en la lista blanca; si no, `/hub`.
 */
export function resolveSedePublicaBackToPath(locationState) {
  const raw = locationState?.sedeBackPath;
  if (typeof raw !== 'string') return '/hub';
  const norm = raw.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (SEDE_PUBLIC_BACK_PATH_ALLOWLIST.has(norm)) return norm;
  return '/hub';
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
  return `calc(${basePx + APP_HEADER_OUTER_PADDING_PX + HUB_FIXED_CHROME_SLACK_PX}px + env(safe-area-inset-top, 0px))`;
}

/**
 * UserHome: reserva en el flujo la misma vertical que el chrome fijo (header saludo + barra
 * Jugar/Competir/Perfil) más un extra para la segunda línea («Bienvenido»). Así el scroll no
 * ocupa todo el viewport, el saludo queda descubierto y las cards se recortan por el borde inferior.
 */
export const HUB_USERHOME_CHROME_EXTRA_FOR_GREETING_PX = 18;

export function hubUserHomeChromeSpacerHeightCss(pathname) {
  const basePx =
    hubContentPaddingTopPx(pathname) +
    APP_HEADER_OUTER_PADDING_PX +
    HUB_FIXED_CHROME_SLACK_PX +
    HUB_USERHOME_CHROME_EXTRA_FOR_GREETING_PX;
  return `calc(${basePx}px + env(safe-area-inset-top, 0px))`;
}

/**
 * Como {@link hubContentPaddingTopCss} más {@link HUB_LOGO_CLEARANCE_TOP_PX} para logos/hero que no queden bajo la barra fija.
 */
export function hubContentPaddingTopWithLogoClearanceCss(pathname) {
  const basePx =
    hubContentPaddingTopPx(pathname) +
    APP_HEADER_OUTER_PADDING_PX +
    HUB_LOGO_CLEARANCE_TOP_PX +
    HUB_FIXED_CHROME_SLACK_PX;
  return `calc(${basePx}px + env(safe-area-inset-top, 0px))`;
}

/**
 * Posición `top` del {@link BottomNav} fijo, bajo el AppHeader (misma pila que {@link hubContentPaddingTopCss} sin nav).
 */
export function hubBottomNavFixedTopCss() {
  return appHeaderStackHeightCss();
}

/**
 * Rutas donde se muestra el botón flotante del asistente IA (no admin, no auth ni pagos).
 */
export function isChatbotIAVisiblePathname(pathname) {
  let p = String(pathname || '/').split('?')[0].split('#')[0];
  p = p.replace(/\/+$/, '') || '/';
  if (p === '/admin' || p.startsWith('/admin')) return false;
  if (p === '/login' || p === '/auth' || p.startsWith('/auth/')) return false;
  if (p === '/completar-perfil') return false;
  if (p === '/pago-exitoso' || p === '/pago-fallido') return false;
  if (p === '/unirse' || p === '/join') return false;
  if (p.startsWith('/invitar-admin-club')) return false;
  if (p === '/terminos' || p.startsWith('/terminos/')) return false;
  if (p === '/privacidad' || p.startsWith('/privacidad/')) return false;
  return true;
}

/** Altura aproximada del pie global de enlaces legales (padding + texto). */
export const LEGAL_FOOTER_GLOBAL_SPACER_PX = 52;

/**
 * Pie global con enlaces a /terminos y /privacidad.
 * La landing (`/`) tiene su propio footer; las páginas legales incluyen navegación al final del texto.
 */
export function isLegalFooterGlobalBarVisiblePathname(pathname) {
  let p = String(pathname || '/').split('?')[0].split('#')[0];
  p = p.replace(/\/+$/, '') || '/';
  if (p === '/') return false;
  if (p === '/terminos' || p.startsWith('/terminos/')) return false;
  if (p === '/privacidad' || p.startsWith('/privacidad/')) return false;
  if (p === '/sobre' || p.startsWith('/sobre/')) return false;
  if (p === '/contacto' || p.startsWith('/contacto/')) return false;
  return true;
}
