/**
 * Ruta a Mi perfil para alta de cuenta (registro = perfil), con redirect
 * y parámetros de torneo si el destino es una URL de torneo.
 */
export function buildMiPerfilRegistroUrl(redirectRaw) {
  const next = String(redirectRaw || '').trim();
  const match = next.match(/^\/torneo\/(\d+)\//);
  const torneoId = match ? match[1] : '';
  const qs = new URLSearchParams();
  if (torneoId) {
    qs.set('from', 'torneo');
    qs.set('id', torneoId);
  }
  if (next) qs.set('redirect', next);
  const q = qs.toString();
  return q ? `/mi-perfil?${q}` : '/mi-perfil';
}
