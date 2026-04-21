import { supabase } from '../supabaseClient';
import { safeRedirectPath } from './safeRedirect';
import { normalizeTorneoPostPerfilPath } from './torneoPostPerfilNavigation';
import { whatsappDigitsValido } from './authIdentidad';
import { isPerfilTorneoCompleto } from './jugadorPerfil';

/**
 * Tras login/registro: si falta WhatsApp válido en clientes, ir a completar perfil con redirect;
 * si el destino es un torneo y falta perfil deportivo mínimo, ir a /mi-perfil con from=id y redirect;
 * si no, volver a la ruta original (torneo, reserva, etc.).
 */
export async function navigateAfterAuth({ navigate, redirectRaw, replace = true, session: sessionIn = null }) {
  const next = safeRedirectPath(redirectRaw || '');
  const session = sessionIn;
  const authEmail = session?.user?.email?.trim();
  if (!authEmail) {
    const gate = next && next !== '/home' && next !== '/hub' && next !== '/' ? `?redirect=${encodeURIComponent(next)}` : '';
    navigate(`/auth${gate}`, { replace });
    return;
  }
  const { data: cliente } = await supabase
    .from('clientes')
    .select('whatsapp')
    .eq('email', authEmail)
    .maybeSingle();
  const waOk = whatsappDigitsValido(cliente?.whatsapp);
  if (!waOk && next !== '/mi-perfil') {
    const q =
      next && next !== '/' && next !== '/home' && next !== '/hub' ? `?redirect=${encodeURIComponent(next)}` : '';
    navigate(`/mi-perfil${q}`, { replace });
    return;
  }
  const torneoMatch = String(next).match(/^\/torneo\/(\d+)(\/|$|\?)/);
  const torneoIdFromRedirect = torneoMatch ? torneoMatch[1] : null;
  if (torneoIdFromRedirect && !isPerfilTorneoCompleto() && next !== '/mi-perfil') {
    const tail =
      next && next !== '/' && next !== '/home' && next !== '/hub'
        ? `&redirect=${encodeURIComponent(next)}`
        : '';
    navigate(
      `/mi-perfil?from=torneo&id=${encodeURIComponent(torneoIdFromRedirect)}${tail}`,
      { replace }
    );
    return;
  }
  const dest = normalizeTorneoPostPerfilPath(redirectRaw || '', '');
  const sinDestinoUtil = !dest || dest === '/home' || dest === '/';
  navigate(sinDestinoUtil ? '/hub' : dest, { replace });
}
