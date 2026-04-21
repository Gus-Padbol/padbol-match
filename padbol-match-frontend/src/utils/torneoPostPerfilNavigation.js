import { safeRedirectPath } from './safeRedirect';

/**
 * Tras completar perfil en contexto torneo: vuelve a la ruta en `redirect`,
 * normalizando /torneo/:id (vista general) a /torneo/:id/equipos.
 * Conserva query string (ej. ?crear=1).
 */
export function normalizeTorneoPostPerfilPath(redirectRaw, torneoIdFromQuery) {
  const idQ = String(torneoIdFromQuery || '').trim();
  const queryIdOk = /^\d+$/.test(idQ);
  const raw = String(redirectRaw || '').trim();
  const next = raw ? safeRedirectPath(raw) : '/';

  if (!raw && queryIdOk) {
    return `/torneo/${idQ}/equipos`;
  }
  if (!next.startsWith('/torneo/')) {
    return next;
  }

  let pathname = '';
  let search = '';
  try {
    const u = new URL(next, 'https://padbol.local');
    pathname = u.pathname;
    search = u.search || '';
  } catch {
    return next;
  }

  const m = pathname.match(/^\/torneo\/(\d+)(\/.*)?$/);
  if (!m) return next;
  const tid = m[1];
  const rest = m[2] || '';
  if (rest === '' || rest === '/') {
    return `/torneo/${tid}/equipos${search}`;
  }
  return `${pathname}${search}`;
}
