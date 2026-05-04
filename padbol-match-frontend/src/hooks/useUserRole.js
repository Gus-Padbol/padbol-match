import { useState, useEffect, useLayoutEffect } from 'react';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'user_role_data';

export default function useUserRole(currentCliente) {
  const email = currentCliente?.email ? String(currentCliente.email).trim() : null;

  const [roleData, setRoleData] = useState(null);
  /** true mientras no hay email; con email, true hasta que termine la consulta a `user_roles` (evita rol null + loading false antes de tiempo). */
  const [loading, setLoading] = useState(() => Boolean(email));

  /** Antes del pintado: si ya hay email, no mostrar un frame con loading false y rol aún no resuelto. */
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

    supabase
      .from('user_roles')
      .select('role, nombre, pais, sede_id, email, torneos_oficiales_habilitados')
      .eq('email', email)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('useUserRole fetch error:', error.message);
        }
        console.log('[useUserRole] query result for', email, '→', data);
        const result = data
          ? {
              email,
              rol: data.role,
              nombre: data.nombre,
              pais: data.pais,
              sedeId: data.sede_id,
              torneosOficialesHabilitados: data.torneos_oficiales_habilitados ?? false,
            }
          : null;
        console.log('[useUserRole] resolved roleData:', result);
        setRoleData(result);
        if (result) localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        else localStorage.removeItem(STORAGE_KEY);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email]);

  return {
    rol:                          roleData?.rol                          ?? null,
    nombre:                       roleData?.nombre                       ?? null,
    pais:                         roleData?.pais                         ?? null,
    sedeId:                       roleData?.sedeId                       ?? null,
    torneosOficialesHabilitados:  roleData?.torneosOficialesHabilitados  ?? false,
    loading,
  };
}
