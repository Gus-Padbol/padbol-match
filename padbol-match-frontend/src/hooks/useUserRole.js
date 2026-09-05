import { useState, useEffect, useLayoutEffect } from 'react';
import { supabase } from '../supabaseClient';
import { fetchMiRol } from '../utils/fetchMiRol';
import { readCachedUserRoleForEmail } from '../utils/mergeUserRoleResult';
import {
  USER_ROLE_STORAGE_KEY,
  normalizeUserRole,
} from '../utils/adminPanelRoles';

const STORAGE_KEY = USER_ROLE_STORAGE_KEY;
const ROLE_LOOKUP_TIMEOUT_MS = 12_000;

function withTimeout(promise, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ROLE_LOOKUP_TIMEOUT_MS);
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

  const [roleData, setRoleData] = useState(() =>
    emailKey ? roleDataFromCached(emailKey) : null
  );
  /** true mientras no hay email; con email, true hasta resolver rol vía GET /api/auth/mi-rol. */
  const [loading, setLoading] = useState(() => Boolean(emailKey));
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    if (!emailKey) return;
    setLoading(true);
    const cachedRow = roleDataFromCached(emailKey);
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
        const { data: sessWrap } = await withTimeout(
          supabase.auth.getSession(),
          'La sesión tardó demasiado en responder.',
        );
        const token = sessWrap?.session?.access_token;

        if (!token) {
          if (!cancelled) {
            setRoleData(null);
            localStorage.removeItem(STORAGE_KEY);
            setLoading(false);
          }
          return;
        }

        let apiResult = null;
        try {
          apiResult = await withTimeout(
            fetchMiRol(token),
            'La verificación de permisos tardó demasiado en responder.',
          );
        } catch (apiErr) {
          console.warn('useUserRole: /api/auth/mi-rol error:', apiErr?.message || apiErr);
          if (!cancelled) setError(apiErr?.message || 'No se pudo verificar el permiso administrativo.');
        }

        if (cancelled) return;

        const result = roleDataFromApi(apiResult, emailKey);
        setRoleData(result);

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
  }, [emailKey]);

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
