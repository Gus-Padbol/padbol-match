import { useState, useEffect, useLayoutEffect } from 'react';
import { supabase } from '../supabaseClient';
import { fetchMiRol } from '../utils/fetchMiRol';

const STORAGE_KEY = 'user_role_data';

export default function useUserRole(currentCliente) {
  const email = currentCliente?.email ? String(currentCliente.email).trim() : null;

  const [roleData, setRoleData] = useState(null);
  /** true mientras no hay email; con email, true hasta resolver rol vía API. */
  const [loading, setLoading] = useState(() => Boolean(email));

  useLayoutEffect(() => {
    if (!email) return;
    setLoading(true);
    setRoleData(null);
  }, [email]);

  useEffect(() => {
    if (!email) {
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
        if (!token) {
          if (!cancelled) {
            setRoleData(null);
            localStorage.removeItem(STORAGE_KEY);
            setLoading(false);
          }
          return;
        }

        const data = await fetchMiRol(token);
        if (cancelled) return;

        const result = data
          ? {
              email: data.email || email,
              rol: data.rol,
              nombre: data.nombre,
              pais: data.pais,
              sedeId: data.sedeId,
              torneosOficialesHabilitados: data.torneosOficialesHabilitados ?? false,
            }
          : null;

        setRoleData(result);
        if (result) localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        else localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        if (!cancelled) {
          console.error('useUserRole fetch error:', err?.message || err);
          setRoleData(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email]);

  return {
    rol: roleData?.rol ?? null,
    nombre: roleData?.nombre ?? null,
    pais: roleData?.pais ?? null,
    sedeId: roleData?.sedeId ?? null,
    torneosOficialesHabilitados: roleData?.torneosOficialesHabilitados ?? false,
    loading,
  };
}
