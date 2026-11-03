import { fetchMiRol } from './fetchMiRol';
import { userCanAccessAdminPanel } from './adminPanelRoles';
import { createCommercialAssignmentsApi } from './commercialAssignmentsApi';

/**
 * El acceso público sin `redirect` no debe devolver al usuario a la presentación.
 * Los administradores entran directamente a su panel; el resto, a su hub.
 * Un destino explícito siempre se respeta.
 */
export async function resolveRoleAwarePostLoginPath(
  destination,
  session,
  roleFetcher = fetchMiRol,
  commercialRoleFetcher = token => createCommercialAssignmentsApi(token).getRole(),
) {
  // PADBOL CRM instalado: el destino posterior al login es siempre el CRM,
  // sin importar el rol ni lo que devuelva el proveedor de autenticacion.
  try {
    if (localStorage.getItem('padbol_crm_app') === '1') {
      console.info('[login] app PADBOL CRM detectada -> /crm-leads');
      return '/crm-leads';
    }
  } catch { /* storage no disponible */ }
  const requested = String(destination || '/');
  if (requested !== '/') return requested;

  const token = String(session?.access_token || '').trim();
  if (!token) return '/hub';

  try {
    const roleData = await roleFetcher(token);
    if (userCanAccessAdminPanel(roleData?.rol)) { console.info('[login] rol admin -> /admin'); return '/admin'; }
    // Membership is verified by the server, never by an email or local/JWT metadata.
    try {
      const commercial = await commercialRoleFetcher(token);
      if (['manager', 'advisor'].includes(commercial?.role)) return '/crm-leads';
    } catch { /* No commercial membership: retain the normal player destination. */ }
    return '/hub';
  } catch (error) {
    console.warn('No se pudo resolver el destino por rol tras el ingreso:', error?.message || error);
    return '/hub';
  }
}
