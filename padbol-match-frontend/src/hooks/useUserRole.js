import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'user_role_data';

export default function useUserRole(currentCliente) {
  const [roleData, setRoleData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(!roleData);

  useEffect(() => {
    if (!currentCliente?.email) {
      // Logout: clear stored role
      localStorage.removeItem(STORAGE_KEY);
      setRoleData(null);
      setLoading(false);
      return;
    }

    // Always re-fetch from DB on email change to avoid stale cached roles
    setLoading(true);
    supabase
      .from('user_roles')
      .select('role, nombre, pais, sede_id, email, torneos_oficiales_habilitados')
      .eq('email', currentCliente.email)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('useUserRole fetch error:', error.message);
        }
        console.log('[useUserRole] query result for', currentCliente.email, '→', data);
        const result = data
          ? {
              email: currentCliente.email,
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
  }, [currentCliente?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    rol:                          roleData?.rol                          ?? null,
    nombre:                       roleData?.nombre                       ?? null,
    pais:                         roleData?.pais                         ?? null,
    sedeId:                       roleData?.sedeId                       ?? null,
    torneosOficialesHabilitados:  roleData?.torneosOficialesHabilitados  ?? false,
    loading,
  };
}
