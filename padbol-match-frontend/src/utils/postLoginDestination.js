import { fetchMiRol } from './fetchMiRol';
import { userCanAccessAdminPanel } from './adminPanelRoles';

/**
 * El acceso web sin `redirect` es exclusivamente administrativo.
 * Los administradores entran directamente a su panel; el resto vuelve al sitio público.
 * Un destino explícito siempre se respeta.
 */
export async function resolveRoleAwarePostLoginPath(
  destination,
  session,
  roleFetcher = fetchMiRol,
) {
  const requested = String(destination || '/');
  if (requested !== '/') return requested;

  const token = String(session?.access_token || '').trim();
  if (!token) return '/plataforma';

  try {
    const roleData = await roleFetcher(token);
    return userCanAccessAdminPanel(roleData?.rol) ? '/admin' : '/plataforma';
  } catch (error) {
    console.warn('No se pudo resolver el destino por rol tras el ingreso:', error?.message || error);
    return '/plataforma';
  }
}
