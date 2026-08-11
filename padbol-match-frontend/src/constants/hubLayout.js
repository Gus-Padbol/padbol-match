/**
 * Constantes de chrome fijo (header, BottomNav, paddings de contenido).
 *
 * La barra Perfil / Jugar / Competir / Notificaciones va fija abajo del viewport (móvil y desktop).
 * El padding de las pantallas usa {@link hubContentPaddingTopCss} /
 * `navDock` desde `HubNavLayoutProvider`. El offset bajo el header fijo usa la variable CSS
 * `--pm-app-header-stack-height` (ver `index.css`) alineada con `HUB_APP_HEADER_HEIGHT_PX` aquí.
 *
 * ANTES DE COMMIT si tocás este archivo: verificar en la app que sigan bien
 * — /reservar pantalla 1 (logo Padbol Match visible bajo el header),
 * — /hub (selector «Elegir deporte» + cards sin recorte arriba),
 * — /auth y /login (logo y formulario no cortados; usan hubAccesoContentPaddingTopCss / hubContentPaddingTopCss).
 */
/**
 * Layout hub: AppHeader fijo + barra de navegación (en móvil anclada abajo; en escritorio bajo el header).
 */
/**
 * Altura mínima de la fila interna del header (título / saludo); el shell suma paddings en
 * `.app-header-shell` (index.css) + `paddingBottom` en AppHeader.jsx.
 */
/** Min-height de la fila interior del header; debe coincidir con `--pm-app-header-inner-min-height` en `index.css`. */
export const HUB_APP_HEADER_HEIGHT_PX = 70;
/** Padding vertical del AppHeader (8px arriba + 8px abajo, alineado con AppHeader.jsx). */
export const APP_HEADER_OUTER_PADDING_PX = 16;
/**
 * Margen extra bajo el bloque fijo medido (bordes, tipografía, iOS): evita que logos/hero
 * queden visualmente bajo {@link AppHeader} cuando el chrome real supera unos píxeles al cálculo.
 */
export const HUB_FIXED_CHROME_SLACK_PX = 14;
export const HUB_NAV_HEIGHT_PX = 54;
/**
 * Aire entre el último contenido scrolleable y la barra fija inferior (tap target cómodo).
 */
export const HUB_BOTTOM_NAV_CONTENT_GAP_PX = 12;
/**
 * Referencia histórica (antes: nav abajo solo ≤768px). La barra va siempre abajo vía {@link HubNavLayoutProvider}.
 */
export const HUB_NAV_DOCK_BOTTOM_BREAKPOINT_PX = 768;
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

/**
 * `right` para botones flotantes (mobile). En desktop usar clase `.chatbot-fab-anchor` en index.css
 * (media query min-width 900px; PostCSS no parsea calc(max() + var())).
 */
export const hubContentColumnFabRightCss = 'max(16px, env(safe-area-inset-right, 0px))';

export const hubInstagramColumnWrapStyle = {
  maxWidth: `${HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX}px`,
  width: '100%',
  marginLeft: 'auto',
  marginRight: 'auto',
  boxSizing: 'border-box',
};

/** Ancho máximo de la barra hub inferior (alineado con columna contenido). */
export const hubBottomNavMaxWidthPx = HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX;

/** CTA flotante «Reservar cancha» en perfil público `/sede/*`: gap sobre la barra inferior. */
export const SEDE_PUBLICA_RESERVAR_GAP_ABOVE_NAV_PX = 16;
/** Altura aprox. del pill (padding 14×2 + texto 15px × 1.2). */
export const SEDE_PUBLICA_RESERVAR_BTN_HEIGHT_PX = 46;
/** Separación entre el CTA y el FAB de Chivi. */
export const SEDE_PUBLICA_RESERVAR_CHIVI_GAP_PX = 16;
/** Espacio reservado bajo el scroll (gap + nav + botón). */
export const SEDE_PUBLICA_RESERVAR_STICKY_FOOTER_PX =
  SEDE_PUBLICA_RESERVAR_GAP_ABOVE_NAV_PX + HUB_NAV_HEIGHT_PX + SEDE_PUBLICA_RESERVAR_BTN_HEIGHT_PX;

/** `bottom` del CTA flotante en `/sede/*` (16px sobre {@link HUB_NAV_HEIGHT_PX}). */
export function sedePublicaReservarStickyBottomCss() {
  return `calc(${SEDE_PUBLICA_RESERVAR_GAP_ABOVE_NAV_PX}px + ${HUB_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`;
}

/** `bottom` del FAB Chivi en `/sede/*` (CTA + gap). */
export function sedePublicaChiviFabBottomCss() {
  return `calc(${SEDE_PUBLICA_RESERVAR_GAP_ABOVE_NAV_PX}px + ${SEDE_PUBLICA_RESERVAR_BTN_HEIGHT_PX}px + ${SEDE_PUBLICA_RESERVAR_CHIVI_GAP_PX}px + ${HUB_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`;
}

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
  if (pathOnly === '/eliminar-cuenta' || pathOnly.startsWith('/eliminar-cuenta/')) return true;
  if (pathOnly === '/sobre' || pathOnly.startsWith('/sobre/')) return true;
  if (pathOnly === '/contacto' || pathOnly.startsWith('/contacto/')) return true;
  if (pathOnly === '/plataforma' || pathOnly.startsWith('/plataforma/')) return true;
  if (pathOnly === '/administradores' || pathOnly.startsWith('/administradores/')) return true;
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
const SEDE_PUBLIC_BACK_PATH_ALLOWLIST = new Set(['/hub', '/sedes', '/reservar', '/armar-partido']);

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
 * Perfil público `/sede` y `/sede/:id`: sin AppHeader en vista cargada; BottomNav abajo del viewport.
 */
export function hubContentPaddingTopPx(pathname, navDock = 'top') {
  const dockBottom = navDock === 'bottom';
  const navVisible = !isHubNavBarHiddenPathname(pathname);
  const includeTopNavRow = navVisible && !dockBottom;
  return HUB_APP_HEADER_HEIGHT_PX + (includeTopNavRow ? HUB_NAV_HEIGHT_PX : 0);
}

/**
 * Píxeles adicionales bajo `--pm-app-header-stack-height`: fila hub superior (si aplica) + slack.
 * La safe-area del notch va dentro de `--pm-app-header-stack-height` (no duplicar aquí).
 */
export function hubScrollChromeTopExtraPx(pathname, navDock = 'top') {
  const dockBottom = navDock === 'bottom';
  const navVisible = !isHubNavBarHiddenPathname(pathname);
  const includeTopNavRow = navVisible && !dockBottom;
  return (includeTopNavRow ? HUB_NAV_HEIGHT_PX : 0) + HUB_FIXED_CHROME_SLACK_PX;
}

/**
 * Altura ocupada por el AppHeader fijo (padding shell + fila interior + safe-area en iOS).
 * Definición canónica: variable CSS `--pm-app-header-stack-height` en `index.css`.
 */
export function appHeaderStackHeightCss() {
  return 'var(--pm-app-header-stack-height)';
}

/**
 * Offset del contenido scrolleable bajo el header fijo (+ fila hub superior si aplica + slack).
 */
export function hubContentPaddingTopCss(pathname, navDock = 'top') {
  return `calc(var(--pm-app-header-stack-height) + ${hubScrollChromeTopExtraPx(pathname, navDock)}px)`;
}

/**
 * Padding inferior del “main” cuando hay {@link BottomNav} fija abajo (móvil): evita que el contenido quede bajo la barra.
 */
export function hubMainPaddingBottomCss(pathname, navDock = 'top') {
  const b = HUB_CONTENT_PADDING_BOTTOM_PX;
  const safe = 'env(safe-area-inset-bottom, 0px)';
  if (isHubNavBarHiddenPathname(pathname)) {
    return `calc(${b}px + ${safe})`;
  }
  if (navDock === 'bottom') {
    return `calc(${b + HUB_NAV_HEIGHT_PX + HUB_BOTTOM_NAV_CONTENT_GAP_PX}px + ${safe})`;
  }
  return `calc(${b}px + ${safe})`;
}

/**
 * Área inferior reservada en el scroll interno del hub (/hub) para la nav fija abajo.
 */
export function hubHubScrollPaddingBottomCss(navDock = 'top') {
  const gap = 28;
  if (navDock === 'bottom') {
    return `calc(${HUB_NAV_HEIGHT_PX + gap}px + env(safe-area-inset-bottom, 0px))`;
  }
  return `calc(${gap}px + env(safe-area-inset-bottom, 0px))`;
}

/** /jugar: ~8–12px entre BottomNav y «Elegir deporte» (menos slack que el hub genérico). */
export const HUB_JUGAR_BELOW_NAV_GAP_PX = 8;
/** Recorte vs. constantes conservadoras de header/nav en /jugar. */
export const HUB_JUGAR_CHROME_TRIM_PX = 20;

/** Padding-top del shell /jugar (header + nav + aire mínimo bajo la barra). */
export function hubJugarContentPaddingTopCss(pathname, navDock = 'top') {
  const basePx = hubContentPaddingTopPx(pathname, navDock);
  const chromePx = Math.max(HUB_APP_HEADER_HEIGHT_PX, basePx - HUB_JUGAR_CHROME_TRIM_PX);
  return `calc(${chromePx + HUB_JUGAR_BELOW_NAV_GAP_PX}px + env(safe-area-inset-top, 0px))`;
}

/** Extra bajo el header en `/login` y `/auth` para que el logo no quede cortado al scroll (móvil ~390px). */
export const HUB_ACCESO_LOGIN_EXTRA_TOP_PX = 36;

/** Igual que {@link hubContentPaddingTopCss} más {@link HUB_ACCESO_LOGIN_EXTRA_TOP_PX} (login / acceso). */
export function hubAccesoContentPaddingTopCss(pathname, navDock = 'top') {
  return `calc(var(--pm-app-header-stack-height) + ${hubScrollChromeTopExtraPx(pathname, navDock) + HUB_ACCESO_LOGIN_EXTRA_TOP_PX}px)`;
}

/**
 * UserHome: reserva en el flujo la misma vertical que el chrome fijo (header saludo + barra
 * Jugar/Competir/Perfil) más un extra para la segunda línea («Bienvenido»). Así el scroll no
 * ocupa todo el viewport, el saludo queda descubierto y las cards se recortan por el borde inferior.
 */
/** UserHome: aire extra bajo header+barra hub superior antes del primer bloque scroll (saludo + «Elegir deporte»). */
export const HUB_USERHOME_CHROME_EXTRA_FOR_GREETING_PX = 70;

/**
 * UserHome con {@link HUB_NAV_DOCK_BOTTOM_BREAKPOINT_PX|nav anclada abajo}: solo 8–12px entre header de saludo y el scroll
 * (la fila Jugar/Competir no suma altura bajo el header).
 */
export const HUB_USERHOME_CHROME_EXTRA_GREETING_BOTTOM_DOCK_PX = 10;

/** UserHome invitado: header una sola línea (sin «Bienvenido de nuevo»); menos hueco bajo el chrome fijo. */
export const HUB_USERHOME_CHROME_EXTRA_FOR_GUEST_PX = 10;

/**
 * Altura del bloque “spacer” bajo el header fijo de UserHome.
 * @param {{ guest?: boolean }} [opts] — `guest: true` sin sesión (invitado).
 */
export function hubUserHomeChromeSpacerHeightCss(pathname, opts, navDock = 'top') {
  const guest = Boolean(opts?.guest);
  const extra = guest
    ? HUB_USERHOME_CHROME_EXTRA_FOR_GUEST_PX
    : navDock === 'bottom'
      ? HUB_USERHOME_CHROME_EXTRA_GREETING_BOTTOM_DOCK_PX
      : HUB_USERHOME_CHROME_EXTRA_FOR_GREETING_PX;
  return `calc(var(--pm-app-header-stack-height) + ${hubScrollChromeTopExtraPx(pathname, navDock) + extra}px)`;
}

/**
 * Como {@link hubContentPaddingTopCss} más {@link HUB_LOGO_CLEARANCE_TOP_PX} para logos/hero que no queden bajo la barra fija.
 */
export function hubContentPaddingTopWithLogoClearanceCss(pathname, navDock = 'top') {
  return `calc(var(--pm-app-header-stack-height) + ${hubScrollChromeTopExtraPx(pathname, navDock) + HUB_LOGO_CLEARANCE_TOP_PX}px)`;
}

/**
 * Posición `top` del {@link BottomNav} cuando va bajo el AppHeader (viewport ancho; misma pila que el padding superior sin fila de tabs).
 */
export function hubBottomNavFixedTopCss() {
  return appHeaderStackHeightCss();
}

/**
 * Rutas donde se muestra el botón flotante del asistente IA (hub / inicio / home / perfil público de sede / landing pública).
 */
export function isChatbotIAVisiblePathname(pathname) {
  let p = String(pathname || '/').split('?')[0].split('#')[0];
  p = p.replace(/\/+$/, '') || '/';
  return p === '/hub' || p === '/inicio' || p === '/home' || p === '/plataforma' || isSedeProfilePathname(pathname);
}

/** Altura aproximada del pie global de enlaces legales (padding + texto). */
export const LEGAL_FOOTER_GLOBAL_SPACER_PX = 76;

/**
 * Pie global con enlaces legales y de eliminación de cuenta.
 * La landing (`/`) tiene su propio footer; las páginas legales incluyen navegación al final del texto.
 */
export function isLegalFooterGlobalBarVisiblePathname(pathname) {
  let p = String(pathname || '/').split('?')[0].split('#')[0];
  p = p.replace(/\/+$/, '') || '/';
  if (p === '/') return false;
  if (p === '/terminos' || p.startsWith('/terminos/')) return false;
  if (p === '/privacidad' || p.startsWith('/privacidad/')) return false;
  if (p === '/eliminar-cuenta' || p.startsWith('/eliminar-cuenta/')) return false;
  if (p === '/sobre' || p.startsWith('/sobre/')) return false;
  if (p === '/contacto' || p.startsWith('/contacto/')) return false;
  if (p === '/plataforma' || p.startsWith('/plataforma/')) return false;
  if (p === '/administradores' || p.startsWith('/administradores/')) return false;
  if (p === '/sede' || p.startsWith('/sede/')) return false;
  return true;
}
