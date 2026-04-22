/**
 * Valor del query `redirect` en /auth: cadenas rotas (auth en bucle, o varios `redirect=` encadenados).
 * No afecta `/mi-perfil?redirect=/torneo/1` (un solo `redirect=`).
 */
export function authRedirectValueHasNestedRedirect(raw) {
  if (!raw || typeof raw !== 'string') return false;
  const t = raw.trim();
  if (!t.startsWith('/')) return false;
  if (t.startsWith('/auth') || t.startsWith('/login')) return true;
  const matches = t.match(/redirect=/g);
  return matches != null && matches.length > 1;
}

/** Post-login / post-registro: solo rutas internas relativas. */
export function safeRedirectPath(raw) {
  if (!raw || typeof raw !== 'string') return '/';
  const t = raw.trim();
  if (authRedirectValueHasNestedRedirect(t)) return '/';
  if (!t.startsWith('/') || t.startsWith('//')) return '/';
  if (t === '/perfil') return '/mi-perfil';
  return t;
}
