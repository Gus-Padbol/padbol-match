import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { resolvePostLoginNavigatePath } from '../utils/reservaReturnUrl';
import { flushPendingOAuthLegalAcceptance, hasPendingOAuthLegalAcceptance } from '../utils/legalDocuments';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { resolveRoleAwarePostLoginPath } from '../utils/postLoginDestination';

export function resolveOAuthPostLoginPath(destination, needsProfileCompletion) {
  const dest = String(destination || '/');
  const isFipaLibrary = dest.split('?')[0] === '/fipa/documentos';
  return needsProfileCompletion && !isFipaLibrary
    ? `/completar-perfil?redirect=${encodeURIComponent(dest)}`
    : dest;
}

/**
 * Destino de `redirectTo` tras Google / Facebook OAuth (PKCE).
 * Intercambia el `code` de la URL al montar (vía `detectSessionInUrl` en supabaseClient) y redirige al hub.
 * Completar perfil (WhatsApp, género) se pide solo al reservar, armar partido o inscribirse a torneo.
 */
export default function AuthOAuthCallback() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const navigatedRef = useRef(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [legalError, setLegalError] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const necesitaCompletarPerfil = hasPendingOAuthLegalAcceptance();

    const destinoOAuth = async (activeSession) => {
      const dest = resolvePostLoginNavigatePath(window.location.search);
      const roleAwareDest = await resolveRoleAwarePostLoginPath(dest, activeSession);
      return resolveOAuthPostLoginPath(roleAwareDest, necesitaCompletarPerfil);
    };

    const go = async () => {
      let s = session;
      if (!s?.user) {
        const { data } = await supabase.auth.getSession();
        s = data?.session ?? null;
      }
      if (cancelled || navigatedRef.current) return;
      if (s?.user) {
        try {
          await flushPendingOAuthLegalAcceptance();
        } catch (error) {
          console.error('[PM Auth] no se pudo verificar aceptación legal OAuth', error);
          if (!cancelled) setLegalError(true);
          return;
        }
        navigatedRef.current = true;
        const dest = await destinoOAuth(s);
        console.log('[PM ArmarPartido restore] OAuth callback →', dest);
        navigate(dest, { replace: true });
        return;
      }
      window.setTimeout(async () => {
        if (cancelled || navigatedRef.current) return;
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          try {
            await flushPendingOAuthLegalAcceptance();
          } catch (error) {
            console.error('[PM Auth] no se pudo verificar aceptación legal OAuth', error);
            if (!cancelled) setLegalError(true);
            return;
          }
          navigatedRef.current = true;
          const dest = await destinoOAuth(data.session);
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
  }, [loading, navigate, retryNonce, session]);

  if (legalError) {
    return (
      <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, color: 'var(--text-primary)', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.35rem' }}>{t('auth.oauthLegalRecordingTitle')}</h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {t('auth.oauthLegalRecordingError')}
          </p>
          <p>
            <Link to="/terminos">{t('legal.terminos')}</Link>{' · '}
            <Link to="/privacidad">{t('legal.privacidad')}</Link>
          </p>
          <button
            type="button"
            onClick={() => {
              setLegalError(false);
              setRetryNonce((value) => value + 1);
            }}
          >
            {t('general.retry')}
          </button>
        </div>
      </div>
    );
  }

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
