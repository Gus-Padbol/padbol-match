/**
 * Fuente única de verdad: tabs visibles / canónicos del Panel Admin por rol.
 * No concede permisos Backend; solo alinea UI y query params con lo que cada rol puede usar.
 */
import { normalizeUserRole } from './adminPanelRoles';
import { ADMIN_SEDES_TAB_ID, coerceAdminSedesTabId } from './adminSedesTab';

/** Tabs de super_admin (sin Sponsors huérfano: vive dentro de Configuración). */
export const SUPER_ADMIN_VISIBLE_TABS = Object.freeze([
  'resumen',
  'torneos',
  'reservas',
  'validaciones',
  'mi_sede',
  'config',
  'planes',
  'membresias',
  'roles',
  'sedes',
  'jugadores',
  'solicitudes',
  'profesores',
  'personalizar_hub',
  'suspensiones',
  'notificaciones',
  'scoreboard',
  'padcoins',
]);

export const EDITOR_CONTENIDO_VISIBLE_TABS = Object.freeze(['personalizar_hub', 'sponsors']);

export const EMPLEADO_VISIBLE_TABS = Object.freeze(['reservas', 'torneos']);

export const ADMIN_CLUB_VISIBLE_TABS = Object.freeze([
  'mi_sede',
  'reservas',
  'torneos',
  'validaciones',
  'scoreboard',
  'padcoins',
  'membresias',
  'notificaciones',
  'resumen',
  'jugadores',
]);

/** Sin PadCoins: Backend actual responde 403 a admin_nacional. */
export const ADMIN_NACIONAL_VISIBLE_TABS = Object.freeze([
  'resumen',
  'torneos',
  'sedes',
  'jugadores',
  'notificaciones',
]);

export function defaultAdminTabForRole(rolUsuario) {
  const rol = normalizeUserRole(rolUsuario);
  if (rol === 'empleado') return 'reservas';
  if (rol === 'editor_contenido') return 'personalizar_hub';
  if (rol === 'admin_club') return 'mi_sede';
  if (rol === 'admin_nacional') return 'resumen';
  return 'resumen';
}

export function getAllowedAdminTabsForRole(rolUsuario) {
  const rol = normalizeUserRole(rolUsuario);
  if (rol === 'editor_contenido') return EDITOR_CONTENIDO_VISIBLE_TABS;
  if (rol === 'empleado') return EMPLEADO_VISIBLE_TABS;
  if (rol === 'admin_club') return ADMIN_CLUB_VISIBLE_TABS;
  if (rol === 'admin_nacional') return ADMIN_NACIONAL_VISIBLE_TABS;
  if (rol === 'super_admin') return SUPER_ADMIN_VISIBLE_TABS;
  return Object.freeze([defaultAdminTabForRole(rol)]);
}

/** Roles autorizados por Backend PadCoins admin (no ampliar). */
export function canRoleSeePadCoins(rolUsuario) {
  const rol = normalizeUserRole(rolUsuario);
  return rol === 'super_admin' || rol === 'admin_club';
}

export function canRoleSeeSponsorsTab(rolUsuario) {
  return normalizeUserRole(rolUsuario) === 'editor_contenido';
}

/**
 * Normaliza aliases legacy (p. ej. sedes_pendientes, venues) a ids técnicos.
 */
export function normalizeAdminTabAlias(raw) {
  const t0 = String(raw || '').trim();
  if (!t0) return '';
  if (t0 === 'sedes_pendientes') return 'solicitudes';
  if (coerceAdminSedesTabId(t0) === ADMIN_SEDES_TAB_ID) return ADMIN_SEDES_TAB_ID;
  return t0;
}

/**
 * @returns {{
 *   tab: string,
 *   redirected: boolean,
 *   from: string|null,
 *   reason: 'ok'|'fallback'|'padcoins_unavailable'|'sponsors_in_config'|string
 * }}
 */
export function resolveAdminVisibleTab(raw, rolUsuario = null) {
  const rol = normalizeUserRole(rolUsuario);
  const fromRaw = String(raw || '').trim();
  const requested = normalizeAdminTabAlias(fromRaw);
  const fallback = defaultAdminTabForRole(rol);
  const allowed = new Set(getAllowedAdminTabsForRole(rol));

  if (!requested) {
    return { tab: fallback, redirected: false, from: null, reason: 'ok' };
  }

  // Sponsors: solo tab propio para editor; super_admin lo usa embebido en Configuración.
  if (requested === 'sponsors' && rol === 'super_admin') {
    return {
      tab: 'config',
      redirected: true,
      from: 'sponsors',
      reason: 'sponsors_in_config',
    };
  }

  if (requested === 'padcoins' && rol === 'admin_nacional') {
    return {
      tab: fallback,
      redirected: true,
      from: 'padcoins',
      reason: 'padcoins_unavailable',
    };
  }

  if (allowed.has(requested)) {
    return { tab: requested, redirected: false, from: null, reason: 'ok' };
  }

  return {
    tab: fallback,
    redirected: true,
    from: requested || fromRaw || null,
    reason: 'fallback',
  };
}

/** Compat: solo el tab canónico (como sanitizeAdminActiveTab). */
export function sanitizeAdminActiveTab(raw, rolUsuario = null) {
  return resolveAdminVisibleTab(raw, rolUsuario).tab;
}

/**
 * Tabs que tienen superficie de render conocida en AdminDashboard.
 * Usado por tests de coherencia UI (no sustituye Backend).
 */
export function tabHasKnownRenderSurface(tabId, rolUsuario = null) {
  const tab = String(tabId || '').trim();
  const rol = normalizeUserRole(rolUsuario);
  if (!tab) return false;
  if (rol === 'editor_contenido') {
    return tab === 'personalizar_hub' || tab === 'sponsors';
  }
  // Super_admin no tiene render de tab sponsors (solo config embebido).
  if (tab === 'sponsors') return rol === 'editor_contenido';
  if (tab === 'padcoins') return canRoleSeePadCoins(rol);
  return getAllowedAdminTabsForRole(rol).includes(tab);
}
