import { fetchMiRol } from './fetchMiRol';
import { userCanAccessAdminPanel } from './adminPanelRoles';

/**
 * El acceso público sin `redirect` no debe devolver al usuario a la presentación.
 * Los administradores entran directamente a su panel; el resto, a su hub.
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
  if (!token) return '/hub';

  try {
    const roleData = await roleFetcher(token);
    return userCanAccessAdminPanel(roleData?.rol) ? '/admin' : '/hub';
  } catch (error) {
    console.warn('No se pudo resolver el destino por rol tras el ingreso:', error?.message || error);
    return '/hub';
  }
}
