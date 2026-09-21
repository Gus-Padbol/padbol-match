import { supabase } from '../supabaseClient';

/** Evita signUp/signIn/updateUser concurrentes (rate limit Supabase). */
let authInProgress = false;

function devLog(label) {
  if (process.env.NODE_ENV === 'development') {
    console.log(label);
  }
}

function err(msg) {
  return { message: msg };
}

function safeInternalEmailRedirectPath(raw) {
  const path = String(raw || '').trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path.split('#')[0];
}

/** Construye el callback de confirmación sin aceptar dominios aportados por el cliente. */
export function buildSignUpEmailRedirectUrl(
  origin,
  { emailRedirectPath = null, hasReservaFormRestore = false } = {},
) {
  const base = String(origin || '').replace(/\/$/, '');
  if (!base) return undefined;
  const requestedPath = safeInternalEmailRedirectPath(emailRedirectPath);
  if (requestedPath) {
    return `${base}/login?redirect=${encodeURIComponent(requestedPath)}`;
  }
  return `${base}${hasReservaFormRestore ? '/reservar' : '/login'}`;
}

/**
 * Única vía para mutaciones de auth con contraseña (signIn, signUp, updateUser).
 * No reintenta. No usar dentro de useEffect — solo en handlers (click / submit).
 *
 * @param {{ kind: 'signIn'; email: string; password: string }
 *   | { kind: 'signUp'; email: string; password: string; emailRedirectPath?: string|null; options?: object }
 *   | { kind: 'updateUser'; updates: { password?: string } }} payload
 * @returns {Promise<{ data: object; error: object | null }>}
 */
export async function handleAuthOnce(payload) {
  const kind = payload?.kind;
  if (kind !== 'signIn' && kind !== 'signUp' && kind !== 'updateUser') {
    return { data: { user: null, session: null }, error: err('Operación de autenticación no válida.') };
  }

  if (authInProgress) {
    return {
      data: { user: null, session: null },
      error: err('Ya hay una operación de cuenta en curso. Espera un momento e intenta de nuevo.'),
    };
  }

  if (kind === 'updateUser') {
    const updates = payload.updates || {};
    if (updates.password != null) {
      const p = String(updates.password);
      if (!p) {
        return { data: { user: null }, error: err('La contraseña es obligatoria.') };
      }
      if (p.length < 6) {
        return { data: { user: null }, error: err('La contraseña debe tener al menos 6 caracteres.') };
      }
    }
  } else {
    const email = String(payload.email || '').trim();
    const password = payload.password != null ? String(payload.password) : '';
    if (!email || !password) {
      return {
        data: { user: null, session: null },
        error: err('Completa correo y contraseña antes de continuar.'),
      };
    }
    if (kind === 'signUp' && password.length < 6) {
      return {
        data: { user: null, session: null },
        error: err('La contraseña debe tener al menos 6 caracteres.'),
      };
    }
  }

  authInProgress = true;
  devLog('AUTH START');
  try {
    if (kind === 'signIn') {
      return await supabase.auth.signInWithPassword({
        email: String(payload.email).trim(),
        password: String(payload.password),
      });
    }
    if (kind === 'signUp') {
      const emailTrim = String(payload.email).trim();
      const prevData =
        payload.options?.data && typeof payload.options.data === 'object' ? payload.options.data : {};
      // La identidad visible se completa dentro de la cuenta. No convertir la
      // parte local del correo en un nombre de jugador provisional.
      const nombreMeta = String(prevData.nombre || '').trim() || 'Jugador';
      const origin =
        typeof window !== 'undefined' && window.location?.origin ? String(window.location.origin) : '';
      const reservaRestoreRaw =
        typeof window !== 'undefined'
          ? window.sessionStorage?.getItem('padbol_reserva_pendiente') ||
            window.sessionStorage?.getItem('padbol_reserva_form_restore_v1')
          : null;
      const hasReservaFormRestore =
        reservaRestoreRaw != null && String(reservaRestoreRaw).trim() !== '';
      const emailRedirectTo = buildSignUpEmailRedirectUrl(origin, {
        emailRedirectPath: payload.emailRedirectPath,
        hasReservaFormRestore,
      });
      return await supabase.auth.signUp({
        email: emailTrim,
        password: String(payload.password),
        options: {
          ...(payload.options || {}),
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: {
            ...prevData,
            nombre: nombreMeta,
          },
        },
      });
    }
    return await supabase.auth.updateUser(payload.updates);
  } finally {
    authInProgress = false;
    devLog('AUTH END');
  }
}
