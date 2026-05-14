import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { refreshJugadorPerfilFromSupabase, clearJugadorPerfilLocalStorage } from '../utils/jugadorPerfil';
import { authSessionUsaProveedorGoogle } from '../utils/perfilJugadorMinimo';

const AuthContext = createContext(null);

/** Logs temporales (consola móvil): buscar `[PM Auth]`. Quitar cuando el bug violeta esté resuelto. */
const PM_AUTH_LOG = '[PM Auth]';

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

/** Tras cerrar sesión o ir a la landing: evita scroll heredado (contenido “abajo”, pantalla negra arriba). */
function resetViewportScroll() {
  try {
    window.scrollTo(0, 0);
    if (typeof document !== 'undefined') {
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
  } catch {
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

  console.log(`${PM_AUTH_LOG} refreshUserProfile enter`, { userId: userId ?? null, emailLen: email.length });

  if (!userId) {
    try {
      localStorage.removeItem('userProfile');
    } catch (_) {
      /* ignore */
    }
    clearJugadorPerfilLocalStorage();
    setUserProfile(null);
    console.log(`${PM_AUTH_LOG} refreshUserProfile exit (no userId)`);
    return;
  }

  let data = null;
  let error = null;

  if (email) {
    console.log(`${PM_AUTH_LOG} refreshUserProfile query jugadores_perfil by email…`);
    const r1 = await supabase.from('jugadores_perfil').select('*').eq('email', email).maybeSingle();
    if (r1.error) error = r1.error;
    else data = r1.data;
    console.log(`${PM_AUTH_LOG} refreshUserProfile email query done`, { hasRow: Boolean(data), hasError: Boolean(r1.error) });
  }

  if (!data) {
    console.log(`${PM_AUTH_LOG} refreshUserProfile query jugadores_perfil by user_id…`);
    const r2 = await supabase.from('jugadores_perfil').select('*').eq('user_id', userId).maybeSingle();
    if (r2.error && !error) error = r2.error;
    if (r2.data) data = r2.data;
    console.log(`${PM_AUTH_LOG} refreshUserProfile user_id query done`, { hasRow: Boolean(data), hasError: Boolean(r2.error) });
  }

  /** Google OAuth: no crear fila vacía; el usuario completa WhatsApp y género en `/completar-perfil`. */
  if (!data && !error && authSessionUsaProveedorGoogle(session)) {
    setUserProfile(null);
    console.log(`${PM_AUTH_LOG} refreshUserProfile exit (Google sin fila, perfil null)`);
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
    if (em) {
      console.log(`${PM_AUTH_LOG} refreshUserProfile refreshJugadorPerfilFromSupabase…`);
      await refreshJugadorPerfilFromSupabase(em);
      console.log(`${PM_AUTH_LOG} refreshUserProfile refreshJugadorPerfilFromSupabase done`);
    }
    console.log(`${PM_AUTH_LOG} refreshUserProfile exit (fila existente)`);
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
    deportes_preferidos: [],
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
    console.log(`${PM_AUTH_LOG} refreshUserProfile insert ok`);
    setUserProfile({
      ...perfilDB,
      nombre: perfilDB?.nombre != null ? String(perfilDB.nombre) : '',
      nombre_saludo: perfilDB?.nombre_saludo != null ? String(perfilDB.nombre_saludo) : '',
      apodo: perfilDB?.apodo != null ? String(perfilDB.apodo) : '',
      alias: perfilDB?.alias != null ? String(perfilDB.alias) : '',
      email: email || String(perfilDB.email || '').trim(),
    });
    const em = String(email || nuevo.email || '').trim();
    if (em) {
      console.log(`${PM_AUTH_LOG} refreshUserProfile refreshJugadorPerfilFromSupabase (post-insert)…`);
      await refreshJugadorPerfilFromSupabase(em);
      console.log(`${PM_AUTH_LOG} refreshUserProfile refreshJugadorPerfilFromSupabase (post-insert) done`);
    }
  } else {
    console.log(`${PM_AUTH_LOG} refreshUserProfile insert falló o sin fila`, { insErr: insErr?.message ?? insErr });
    setUserProfile(null);
  }
  console.log(`${PM_AUTH_LOG} refreshUserProfile exit (fin rama insert/fallback)`);
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

  /** Encadena cargas de perfil para que un `refresh` anterior no cierre `profileLoading` ni pise el perfil del usuario actual. */
  const profileLoadChainRef = useRef(Promise.resolve());

  const user = session?.user ?? null;

  useEffect(() => {
    console.log(`${PM_AUTH_LOG} profileLoading (state) =`, profileLoading, {
      sessionUid: session?.user?.id ?? null,
    });
  }, [profileLoading, session?.user?.id]);

  const loadProfile = useCallback((sessionArg) => {
    const uid = sessionArg?.user?.id ?? null;
    console.log(`${PM_AUTH_LOG} loadProfile scheduled`, { uid });

    const run = async () => {
      console.log(`${PM_AUTH_LOG} loadProfile START`, { uid });
      clearSaludoHomeLocalStorage();
      if (!sessionArg?.user?.id) {
        setProfileLoading(false);
        try {
          await refreshUserProfile(sessionArg, setUserProfile);
          console.log(`${PM_AUTH_LOG} loadProfile END (sin sesión)`, { uid });
        } catch (e) {
          console.error(`${PM_AUTH_LOG} loadProfile error (sin sesión)`, e);
          setUserProfile(null);
          console.log(`${PM_AUTH_LOG} loadProfile END catch (sin sesión)`, { uid });
        }
        return;
      }
      setProfileLoading(true);
      try {
        await refreshUserProfile(sessionArg, setUserProfile);
        console.log(`${PM_AUTH_LOG} loadProfile END ok`, { uid });
      } catch (e) {
        console.error(`${PM_AUTH_LOG} loadProfile error`, e);
        setUserProfile(null);
        console.log(`${PM_AUTH_LOG} loadProfile END catch`, { uid });
      } finally {
        setProfileLoading(false);
        console.log(`${PM_AUTH_LOG} loadProfile finally profileLoading=false`, { uid });
      }
    };

    profileLoadChainRef.current = profileLoadChainRef.current.catch(() => {}).then(run);
    return profileLoadChainRef.current;
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

  const signOutAndClear = useCallback(() => {
    profileLoadChainRef.current = Promise.resolve();
    try {
      localStorage.removeItem('userProfile');
    } catch (_) {
      /* ignore */
    }
    clearJugadorPerfilLocalStorage();
    setSession(null);
    setUserProfile(null);
    setProfileLoading(false);
    /** Cierre remoto en segundo plano: el estado local ya es “sin sesión” para pintar la landing sin esperar la red. */
    void supabase.auth.signOut().catch(() => {});
    resetViewportScroll();
    requestAnimationFrame(() => {
      resetViewportScroll();
      window.setTimeout(resetViewportScroll, 0);
    });
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
