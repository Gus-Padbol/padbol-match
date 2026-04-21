import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { refreshJugadorPerfilFromSupabase, clearJugadorPerfilLocalStorage } from '../utils/jugadorPerfil';

const AuthContext = createContext(null);

/**
 * Carga o crea `jugadores_perfil` por `user_id` (UUID de `session.user.id`).
 */
async function refreshUserProfile(session, setUserProfile) {
  const userId = session?.user?.id ?? null;
  if (!userId) {
    try {
      localStorage.removeItem('userProfile');
    } catch (_) {
      /* ignore */
    }
    clearJugadorPerfilLocalStorage();
    setUserProfile(null);
    return;
  }

  const { data, error } = await supabase
    .from('jugadores_perfil')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data && !error) {
    setUserProfile(data);
    const em = String(data.email || '').trim();
    if (em) await refreshJugadorPerfilFromSupabase(em);
    return;
  }

  const nombreBase = session?.user?.email?.split('@')[0] || 'Jugador';

  const { data: nuevo, error: insErr } = await supabase
    .from('jugadores_perfil')
    .insert({
      user_id: userId,
      nombre: nombreBase,
      alias: nombreBase,
    })
    .select()
    .single();

  if (nuevo && !insErr) {
    setUserProfile(nuevo);
    const em = String(nuevo.email || '').trim();
    if (em) await refreshJugadorPerfilFromSupabase(em);
  } else {
    setUserProfile(null);
  }
}

/**
 * Sesión = tiempo real Supabase (onAuthStateChange + getSession).
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;

  const loadProfile = useCallback(async (sessionArg) => {
    try {
      await refreshUserProfile(sessionArg, setUserProfile);
    } catch (e) {
      console.error(e);
      setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem('userProfile');
    } catch (_) {
      /* ignore */
    }
    clearJugadorPerfilLocalStorage();

    const applyAuthSession = (nextSession) => {
      const s = nextSession ?? null;
      if (!s) {
        try {
          localStorage.removeItem('userProfile');
        } catch (_) {
          /* ignore */
        }
        clearJugadorPerfilLocalStorage();
        setUserProfile(null);
      }
      setSession(s);
      setLoading(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applyAuthSession(nextSession);
    });

    supabase.auth.getSession().then(({ data }) => {
      applyAuthSession(data?.session ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void loadProfile(session);
  }, [session, loadProfile]);

  const refreshSession = useCallback(async () => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s ?? null);
    await loadProfile(s ?? null);
  }, [loadProfile]);

  const signOutAndClear = useCallback(async () => {
    await supabase.auth.signOut();
    try {
      localStorage.removeItem('userProfile');
    } catch (_) {
      /* ignore */
    }
    clearJugadorPerfilLocalStorage();
    setSession(null);
    setUserProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      userProfile,
      loading,
      refreshSession,
      signOutAndClear,
    }),
    [session, user, userProfile, loading, refreshSession, signOutAndClear]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
