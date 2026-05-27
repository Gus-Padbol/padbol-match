/** Roles con acceso al panel `/admin` (tabla `user_roles.role`). */
export const ADMIN_PANEL_ROLES = [
  'super_admin',
  'admin_nacional',
  'admin_club',
  'empleado',
  'editor_contenido',
];

export const USER_ROLE_STORAGE_KEY = 'user_role_data';

export function readCachedUserRoleData() {
  try {
    const raw = localStorage.getItem(USER_ROLE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Normaliza variantes (`admin club`, `Admin_Club`) → `admin_club`. */
export function normalizeUserRole(rol) {
  const r = String(rol || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!r) return null;
  if (ADMIN_PANEL_ROLES.includes(r)) return r;
  if (r === 'adminclub' || r === 'admin_de_club') return 'admin_club';
  if (r === 'superadmin') return 'super_admin';
  if (r === 'adminnacional') return 'admin_nacional';
  if (r === 'editorcontenido') return 'editor_contenido';
  return r;
}

export function userCanAccessAdminPanel(rol) {
  return ADMIN_PANEL_ROLES.includes(normalizeUserRole(rol) || '');
}

/**
 * Rol efectivo: API (`/api/auth/mi-rol`) → caché local → JWT metadata.
 * @param {{ rolFromApi?: string|null, session?: object|null }} params
 */
export function resolveEffectiveUserRole({ rolFromApi, session, rolFallback }) {
  const fromHook = normalizeUserRole(rolFromApi);
  const fromExtra = normalizeUserRole(rolFallback);
  if (fromHook && ADMIN_PANEL_ROLES.includes(fromHook)) return fromHook;
  if (fromExtra && ADMIN_PANEL_ROLES.includes(fromExtra)) return fromExtra;
  if (fromHook) return fromHook;
  if (fromExtra) return fromExtra;

  const sessionEmail = String(session?.user?.email || '').trim().toLowerCase();
  const rawCache = readCachedUserRoleData();
  const cacheEmail = String(rawCache?.email || '').trim().toLowerCase();
  const cacheOk = !sessionEmail || !cacheEmail || cacheEmail === sessionEmail;
  const cached = cacheOk ? normalizeUserRole(rawCache?.rol) : null;
  if (cached && ADMIN_PANEL_ROLES.includes(cached)) return cached;

  const jwt = normalizeUserRole(
    session?.user?.app_metadata?.role ?? session?.user?.user_metadata?.role
  );
  return ADMIN_PANEL_ROLES.includes(jwt) ? jwt : fromHook || fromExtra || cached || jwt || null;
}
