import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { resolvePostLoginNavigatePath } from '../utils/reservaReturnUrl';

/**
 * Destino de `redirectTo` tras Google / Facebook OAuth (PKCE).
 * Intercambia el `code` de la URL al montar (vía `detectSessionInUrl` en supabaseClient) y redirige al hub.
 * Completar perfil (WhatsApp, género) se pide solo al reservar, armar partido o inscribirse a torneo.
 */
export default function AuthOAuthCallback() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    const go = async () => {
      let s = session;
      if (!s?.user) {
        const { data } = await supabase.auth.getSession();
        s = data?.session ?? null;
      }
      if (cancelled || navigatedRef.current) return;
      if (s?.user) {
        navigatedRef.current = true;
        const dest = resolvePostLoginNavigatePath(window.location.search);
        console.log('[PM ArmarPartido restore] OAuth callback →', dest);
        navigate(dest, { replace: true });
        return;
      }
      window.setTimeout(async () => {
        if (cancelled || navigatedRef.current) return;
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          navigatedRef.current = true;
          const dest = resolvePostLoginNavigatePath(window.location.search);
          console.log('[PM ArmarPartido restore] OAuth callback (retry) →', dest);
          navigate(dest, { replace: true });
          return;
        }
        navigatedRef.current = true;
        navigate('/', { replace: true });
      }, 400);
    };

    void go();
    return () => {
      cancelled = true;
    };
  }, [loading, session, navigate]);

  return (
    <div
      style={{
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        color: 'var(--text-secondary)',
        fontWeight: 600,
        fontSize: '15px',
      }}
    >
      Conectando con tu cuenta…
    </div>
  );
}
