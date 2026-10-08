import { useState, useEffect, useLayoutEffect } from 'react';
import { supabase } from '../supabaseClient';
import { fetchMiRol } from '../utils/fetchMiRol';
import { fetchUserRoleFromSupabase } from '../utils/fetchUserRoleSupabase';
import { readCachedUserRoleForEmail } from '../utils/mergeUserRoleResult';
import {
  USER_ROLE_STORAGE_KEY,
  normalizeUserRole,
} from '../utils/adminPanelRoles';

const STORAGE_KEY = USER_ROLE_STORAGE_KEY;
// Una consulta de permisos no debe bloquear el panel indefinidamente. Si este
// primer camino no responde, se usa inmediatamente el respaldo autenticado.
const ROLE_LOOKUP_TIMEOUT_MS = 12_000;

function withTimeout(promise, message, timeoutMs = ROLE_LOOKUP_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function roleDataFromCached(email) {
  const cached = readCachedUserRoleForEmail(email);
  if (!cached) return null;
  return {
    email: cached.email,
    rol: cached.rol,
    nombre: cached.nombre,
    pais: cached.pais,
    sedeId: cached.sedeId,
    organizacionId: cached.organizacionId ?? null,
    torneosOficialesHabilitados: cached.torneosOficialesHabilitados ?? false,
  };
}

function roleDataFromApi(apiResult, emailKey) {
  if (!apiResult?.rol) return null;
  return {
    email: apiResult.email || emailKey,
    rol: normalizeUserRole(apiResult.rol),
    nombre: apiResult.nombre ?? null,
    pais: apiResult.pais ?? null,
    sedeId: apiResult.sedeId ?? null,
    organizacionId: apiResult.organizacionId ?? null,
    torneosOficialesHabilitados: apiResult.torneosOficialesHabilitados ?? false,
  };
}

export default function useUserRole(currentCliente) {
  const email = currentCliente?.email ? String(currentCliente.email).trim() : null;
  const emailKey = email ? email.toLowerCase() : null;
  const userId = String(currentCliente?.id || '').trim();
  const accessToken = String(currentCliente?.accessToken || '').trim();

  const [roleData, setRoleData] = useState(() =>
    emailKey ? roleDataFromCached(emailKey) : null
  );
  /** true mientras no hay email; con email, true hasta resolver rol vía GET /api/auth/mi-rol. */
  const [loading, setLoading] = useState(() => Boolean(emailKey && !roleDataFromCached(emailKey)));
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    if (!emailKey) return;
    const cachedRow = roleDataFromCached(emailKey);
    setLoading(!cachedRow);
    if (cachedRow) setRoleData(cachedRow);
  }, [emailKey]);

  useEffect(() => {
    if (!emailKey) {
      localStorage.removeItem(STORAGE_KEY);
      setRoleData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setError(null);
        // AuthContext ya resolvió la sesión antes de montar el panel. Reutilizar su
        // token evita pedir la misma sesión otra vez y quedar atrapado en el lock
        // interno de Supabase cuando hay varias pestañas abiertas.
        let token = accessToken;
        let authUser = { id: userId, email: emailKey };
        if (!token) {
          const { data: sessWrap } = await withTimeout(
            supabase.auth.getSession(),
            'La sesión tardó demasiado en responder.',
          );
          token = sessWrap?.session?.access_token;
          authUser = sessWrap?.session?.user || authUser;
        }

        if (!token) {
          if (!cancelled) {
            setRoleData(null);
            localStorage.removeItem(STORAGE_KEY);
            setLoading(false);
          }
          return;
        }

        let apiResult = null;
        let apiError = null;
        try {
          apiResult = await withTimeout(
            fetchMiRol(token),
            'La verificación de permisos tardó demasiado en responder.',
          );
        } catch (apiErr) {
          console.warn('useUserRole: /api/auth/mi-rol error:', apiErr?.message || apiErr);
          apiError = apiErr;
        }

        // Respaldo autenticado directo: si el backend está reiniciando o una petición
        // queda bloqueada por el navegador, RLS sólo permite leer la fila del usuario
        // conectado. Así el panel no depende de un único salto de red.
        if (!apiResult?.rol) {
          try {
            apiResult = await withTimeout(
              fetchUserRoleFromSupabase(authUser),
              'La verificación alternativa de permisos tardó demasiado en responder.',
              10_000,
            );
          } catch (fallbackErr) {
            console.warn('useUserRole: respaldo Supabase error:', fallbackErr?.message || fallbackErr);
            if (!apiError) apiError = fallbackErr;
          }
        }

        if (cancelled) return;

        const result = roleDataFromApi(apiResult, emailKey);
        setRoleData(result);
        setError(result?.rol ? null : (apiError?.message || null));

        if (result?.rol) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('useUserRole fetch error:', err?.message || err);
          setRoleData(null);
          setError(err?.message || 'No se pudo resolver la sesión.');
          localStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [emailKey, userId, accessToken]);

  return {
    rol: roleData?.rol ?? null,
    nombre: roleData?.nombre ?? null,
    pais: roleData?.pais ?? null,
    sedeId: roleData?.sedeId ?? null,
    organizacionId: roleData?.organizacionId ?? null,
    torneosOficialesHabilitados: roleData?.torneosOficialesHabilitados ?? false,
    loading,
    error,
  };
}
