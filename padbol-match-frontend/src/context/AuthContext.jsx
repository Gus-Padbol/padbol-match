import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { refreshJugadorPerfilFromSupabase, clearJugadorPerfilLocalStorage } from '../utils/jugadorPerfil';
import { authSessionUsaProveedorGoogle } from '../utils/perfilJugadorMinimo';

const AuthContext = createContext(null);

/** Caché legacy del saludo en home; se borra al (re)cargar perfil para no mostrar nombre completo viejo. */
const LS_SALUDO_NOMBRE = 'padbol_nombre_saludo';
const LS_SALUDO_UID = 'padbol_nombre_saludo_uid';

function clearSaludoHomeLocalStorage() {
  try {
    localStorage.removeItem(LS_SALUDO_NOMBRE);
    localStorage.removeItem(LS_SALUDO_UID);
  } catch (_) {
    /* ignore */
  }
}

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

  /** Google OAuth: no crear fila vacía; el usuario completa WhatsApp y género en `/completar-perfil`. */
  if (!data && !error && authSessionUsaProveedorGoogle(session)) {
    setUserProfile(null);
    return;
  }

  if (data && !error) {
    const perfilDB = data;
    setUserProfile({
      ...perfilDB,
      nombre: perfilDB?.nombre != null ? String(perfilDB.nombre) : '',
      nombre_saludo: perfilDB?.nombre_saludo != null ? String(perfilDB.nombre_saludo) : '',
      apodo: perfilDB?.apodo != null ? String(perfilDB.apodo) : '',
      alias: perfilDB?.alias != null ? String(perfilDB.alias) : '',
      email: email || String(perfilDB.email || '').trim(),
    });
    const em = String(email || data.email || '').trim();
    if (em) await refreshJugadorPerfilFromSupabase(em);
    return;
  }

  const meta = session?.user?.user_metadata || {};
  const fullNameOAuth = String(meta.full_name || meta.name || '').trim();
  const nombreTokensOAuth = fullNameOAuth ? fullNameOAuth.split(/\s+/).filter(Boolean) : [];
  const nombreMeta =
    String(meta.nombre || '').trim() || (nombreTokensOAuth.length ? nombreTokensOAuth[0] : '') || '';
  const apellidoMeta =
    String(meta.apellido || '').trim() ||
    (nombreTokensOAuth.length > 1 ? nombreTokensOAuth.slice(1).join(' ').trim() : '');
  const generoMeta = String(meta.genero || '').trim();
  const nw = meta.notificaciones_whatsapp;
  const notificacionesWhatsapp =
    nw === true || nw === 'true' || String(nw || '').toLowerCase() === 'true';
  const insertRow = {
    user_id: userId,
    nombre: nombreMeta || 'Jugador',
    apellido: apellidoMeta || null,
    alias: '',
    notificaciones_whatsapp: notificacionesWhatsapp,
  };
  if (generoMeta) insertRow.genero = generoMeta;
  const waMeta = String(meta.whatsapp || '').trim();
  if (waMeta) insertRow.whatsapp = waMeta;
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
      nombre_saludo: perfilDB?.nombre_saludo != null ? String(perfilDB.nombre_saludo) : '',
      apodo: perfilDB?.apodo != null ? String(perfilDB.apodo) : '',
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
 * La navegación tras login/registro la hace {@link AccesoCuenta} (destino por defecto "/").
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  /** Con sesión: true hasta que termine {@link refreshUserProfile} (evita saludo antes de tener `apodo`/perfil). */
  const [profileLoading, setProfileLoading] = useState(false);

  const user = session?.user ?? null;

  const loadProfile = useCallback(async (sessionArg) => {
    clearSaludoHomeLocalStorage();
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
