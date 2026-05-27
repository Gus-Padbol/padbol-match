import { useState, useEffect, useLayoutEffect } from 'react';
import { supabase } from '../supabaseClient';
import { fetchMiRol } from '../utils/fetchMiRol';
import { fetchUserRoleFromSupabase } from '../utils/fetchUserRoleSupabase';
import { mergeUserRoleResults, readCachedUserRoleForEmail } from '../utils/mergeUserRoleResult';
import {
  USER_ROLE_STORAGE_KEY,
  normalizeUserRole,
  userCanAccessAdminPanel,
} from '../utils/adminPanelRoles';

const STORAGE_KEY = USER_ROLE_STORAGE_KEY;

function roleDataFromCached(email) {
  const cached = readCachedUserRoleForEmail(email);
  if (!cached) return null;
  return {
    email: cached.email,
    rol: cached.rol,
    nombre: cached.nombre,
    pais: cached.pais,
    sedeId: cached.sedeId,
    torneosOficialesHabilitados: cached.torneosOficialesHabilitados ?? false,
  };
}

export default function useUserRole(currentCliente) {
  const email = currentCliente?.email ? String(currentCliente.email).trim() : null;
  const emailKey = email ? email.toLowerCase() : null;

  const [roleData, setRoleData] = useState(() =>
    emailKey ? roleDataFromCached(emailKey) : null
  );
  /** true mientras no hay email; con email, true hasta resolver rol vía API + respaldo Supabase. */
  const [loading, setLoading] = useState(() => Boolean(emailKey));

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
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data: sessWrap } = await supabase.auth.getSession();
        const token = sessWrap?.session?.access_token;
        const authUser = sessWrap?.session?.user;

        if (!token || !authUser) {
          if (!cancelled) {
            const cachedOnly = roleDataFromCached(emailKey);
            setRoleData(cachedOnly);
            if (!cachedOnly) localStorage.removeItem(STORAGE_KEY);
            setLoading(false);
          }
          return;
        }

        let apiResult = null;
        try {
          apiResult = await fetchMiRol(token);
        } catch (apiErr) {
          console.warn('useUserRole: /api/auth/mi-rol error:', apiErr?.message || apiErr);
        }

        let supabaseResult = null;
        if (!normalizeUserRole(apiResult?.rol)) {
          try {
            supabaseResult = await fetchUserRoleFromSupabase(authUser);
          } catch (supaErr) {
            console.warn('useUserRole: Supabase user_roles fallback error:', supaErr?.message || supaErr);
          }
        }

        if (cancelled) return;

        const merged = mergeUserRoleResults({
          apiResult,
          supabaseResult,
          email: emailKey,
        });

        const result = merged?.rol
          ? {
              email: merged.email || emailKey,
              rol: normalizeUserRole(merged.rol),
              nombre: merged.nombre,
              pais: merged.pais,
              sedeId: merged.sedeId,
              torneosOficialesHabilitados: merged.torneosOficialesHabilitados ?? false,
            }
          : merged
            ? {
                email: merged.email || emailKey,
                rol: null,
                nombre: merged.nombre,
                pais: merged.pais,
                sedeId: merged.sedeId,
                torneosOficialesHabilitados: false,
              }
            : null;

        setRoleData(result);
        if (result?.rol && userCanAccessAdminPanel(result.rol)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        } else if (!result?.rol) {
          const cached = readCachedUserRoleForEmail(emailKey);
          if (cached?.rol && userCanAccessAdminPanel(cached.rol)) {
            const keep = {
              email: emailKey,
              rol: cached.rol,
              nombre: cached.nombre ?? result?.nombre ?? null,
              pais: cached.pais ?? result?.pais ?? null,
              sedeId: cached.sedeId ?? result?.sedeId ?? null,
              torneosOficialesHabilitados:
                cached.torneosOficialesHabilitados ?? result?.torneosOficialesHabilitados ?? false,
            };
            setRoleData(keep);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(keep));
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('useUserRole fetch error:', err?.message || err);
          const cached = roleDataFromCached(emailKey);
          if (cached) {
            setRoleData({
              email: cached.email || emailKey,
              rol: normalizeUserRole(cached.rol),
              nombre: cached.nombre ?? null,
              pais: cached.pais ?? null,
              sedeId: cached.sedeId ?? null,
              torneosOficialesHabilitados: cached.torneosOficialesHabilitados ?? false,
            });
          } else {
            setRoleData(null);
            localStorage.removeItem(STORAGE_KEY);
          }
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
    torneosOficialesHabilitados: roleData?.torneosOficialesHabilitados ?? false,
    loading,
  };
}
