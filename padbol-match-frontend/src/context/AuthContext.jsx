import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { refreshJugadorPerfilFromSupabase, clearJugadorPerfilLocalStorage } from '../utils/jugadorPerfil';

const AuthContext = createContext(null);

/**
 * Carga o crea `jugadores_perfil`: primero por email de la sesión, luego por `user_id`.
 * Nunca usa `email.split` como nombre al crear filas nuevas.
 */
async function refreshUserProfile(session, setUserProfile) {
  const userId = session?.user?.id ?? null;
  const email = String(session?.user?.email || '').trim();

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

  let data = null;
  let error = null;

  if (email) {
    const r1 = await supabase.from('jugadores_perfil').select('*').eq('email', email).maybeSingle();
    data = r1.data;
    error = r1.error;
  }

  if (!data && !error) {
    const r2 = await supabase.from('jugadores_perfil').select('*').eq('user_id', userId).maybeSingle();
    data = r2.data;
    error = r2.error;
  }

  if (data && !error) {
    const perfilDB = data;
    setUserProfile({
      ...perfilDB,
      nombre: perfilDB?.nombre != null ? String(perfilDB.nombre) : '',
      alias: perfilDB?.alias != null ? String(perfilDB.alias) : '',
      email: email || String(perfilDB.email || '').trim(),
    });
    const em = String(email || data.email || '').trim();
    if (em) await refreshJugadorPerfilFromSupabase(em);
    return;
  }

  const insertRow = {
    user_id: userId,
    nombre: 'Jugador',
    alias: '',
  };
  if (email) {
    insertRow.email = email;
  }

  const { data: nuevo, error: insErr } = await supabase
    .from('jugadores_perfil')
    .insert(insertRow)
    .select()
    .single();

  if (nuevo && !insErr) {
    const perfilDB = nuevo;
    setUserProfile({
      ...perfilDB,
      nombre: perfilDB?.nombre != null ? String(perfilDB.nombre) : '',
      alias: perfilDB?.alias != null ? String(perfilDB.alias) : '',
      email: email || String(perfilDB.email || '').trim(),
    });
    const em = String(email || nuevo.email || '').trim();
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
  /** Con sesión: true hasta que termine {@link refreshUserProfile} (evita saludo antes de tener `nombre`). */
  const [profileLoading, setProfileLoading] = useState(false);

  const user = session?.user ?? null;

  const loadProfile = useCallback(async (sessionArg) => {
    if (!sessionArg?.user?.id) {
      setProfileLoading(false);
      try {
        await refreshUserProfile(sessionArg, setUserProfile);
      } catch (e) {
        console.error(e);
        setUserProfile(null);
      }
      return;
    }
    setProfileLoading(true);
    try {
      await refreshUserProfile(sessionArg, setUserProfile);
    } catch (e) {
      console.error(e);
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
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
        setProfileLoading(false);
      } else if (s.user) {
        setProfileLoading(true);
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
    setProfileLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      userProfile,
      loading,
      profileLoading,
      refreshSession,
      signOutAndClear,
    }),
    [session, user, userProfile, loading, profileLoading, refreshSession, signOutAndClear]
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
