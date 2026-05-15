import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

/**
 * Destino de `redirectTo` tras Google / Facebook OAuth (PKCE).
 * Intercambia el `code` de la URL al montar (vía `detectSessionInUrl` en supabaseClient) y redirige al hub;
 * {@link PerfilJugadorDatosMinimosGate} envía a `/completar-perfil` si falta WhatsApp o género.
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
        navigate('/hub', { replace: true });
        return;
      }
      window.setTimeout(async () => {
        if (cancelled || navigatedRef.current) return;
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          navigatedRef.current = true;
          navigate('/hub', { replace: true });
          return;
        }
        navigatedRef.current = true;
        navigate('/login', { replace: true });
      }, 400);
    };

    void go();
    return () => {
      cancelled = true;
    };
  }, [loading, session?.user?.id, navigate]);

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
