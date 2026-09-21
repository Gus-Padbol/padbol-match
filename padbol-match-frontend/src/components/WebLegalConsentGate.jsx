import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSafeTranslation } from '../i18n/tSafe';
import {
  LEGAL_DOCUMENTS,
  acceptCurrentLegalDocuments,
  fetchCurrentLegalAcceptance,
  hasCurrentLegalAcceptance,
} from '../utils/legalDocuments';

const EXEMPT_PATHS = new Set([
  '/',
  '/acceso',
  '/auth',
  '/auth/callback',
  '/eliminar-cuenta',
  '/login',
  '/privacidad',
  '/terminos',
]);

export default function WebLegalConsentGate({ children }) {
  const { loading, session, signOutAndClear } = useAuth();
  const { pathname } = useLocation();
  const { t } = useSafeTranslation();
  const [status, setStatus] = useState('checking');
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [verifiedUserId, setVerifiedUserId] = useState(null);
  const exempt = EXEMPT_PATHS.has(String(pathname || '').replace(/\/+$/, '') || '/');

  useEffect(() => {
    const userId = session?.user?.id;
    if (loading || !userId || exempt) {
      setStatus('accepted');
      setChecked(false);
      setVerifiedUserId(null);
      return undefined;
    }

    let active = true;
    setStatus('checking');
    setChecked(false);
    fetchCurrentLegalAcceptance()
      .then((data) => {
        if (!active) return;
        const accepted = hasCurrentLegalAcceptance(data);
        setVerifiedUserId(accepted ? userId : null);
        setStatus(accepted ? 'accepted' : 'required');
      })
      .catch(() => {
        if (active) {
          setVerifiedUserId(null);
          setStatus('error');
        }
      });

    return () => {
      active = false;
    };
  }, [exempt, loading, retryNonce, session?.user?.id]);

  const accept = useCallback(async () => {
    if (!checked || saving) return;
    setSaving(true);
    try {
      await acceptCurrentLegalDocuments('web_gate');
      setVerifiedUserId(session.user.id);
      setStatus('accepted');
    } catch {
      setStatus('save-error');
    } finally {
      setSaving(false);
    }
  }, [checked, saving, session?.user?.id]);

  if (
    loading
    || !session?.user
    || exempt
    || (status === 'accepted' && verifiedUserId === session.user.id)
  ) return children;

  const isChecking = status === 'checking'
    || (status === 'accepted' && verifiedUserId !== session.user.id);
  const isCheckError = status === 'error';

  return (
    <main style={styles.page}>
      <section aria-busy={isChecking || saving} style={styles.card}>
        <div aria-hidden style={styles.shield}>✓</div>
        <h1 style={styles.title}>{t('auth.legalGateTitle')}</h1>
        <p style={styles.body}>
          {isCheckError
            ? t('auth.legalGateCheckError')
            : t('auth.legalGateBody')}
        </p>

        {isChecking ? <div role="status">{t('general.loading')}</div> : null}

        {!isChecking ? (
          <>
            <div style={styles.links}>
              <Link to={LEGAL_DOCUMENTS.terms.url} target="_blank" rel="noopener noreferrer">
                {t('legal.terminos')} · v{LEGAL_DOCUMENTS.terms.version}
              </Link>
              <Link to={LEGAL_DOCUMENTS.privacy.url} target="_blank" rel="noopener noreferrer">
                {t('legal.privacidad')} · v{LEGAL_DOCUMENTS.privacy.version}
              </Link>
            </div>

            {!isCheckError ? (
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saving}
                  onChange={(event) => setChecked(event.target.checked)}
                  style={styles.checkbox}
                />
                <span>{t('auth.legalGateConfirmation')}</span>
              </label>
            ) : null}

            {status === 'save-error' ? (
              <p role="alert" style={styles.error}>{t('auth.legalGateSaveError')}</p>
            ) : null}

            <button
              type="button"
              disabled={!isCheckError && (!checked || saving)}
              onClick={isCheckError ? () => setRetryNonce((value) => value + 1) : () => void accept()}
              style={{
                ...styles.primaryButton,
                opacity: !isCheckError && (!checked || saving) ? 0.5 : 1,
              }}
            >
              {isCheckError ? t('general.retry') : t('auth.legalGateAccept')}
            </button>
            <button type="button" onClick={signOutAndClear} style={styles.secondaryButton}>
              {t('auth.cerrar_sesion')}
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

const styles = {
  page: {
    alignItems: 'center',
    background: 'var(--bg-page, #070b14)',
    boxSizing: 'border-box',
    color: 'var(--text-primary, #f8fafc)',
    display: 'flex',
    justifyContent: 'center',
    minHeight: '100dvh',
    padding: 24,
  },
  card: {
    background: 'var(--bg-card, #111827)',
    border: '1px solid var(--border, rgba(148,163,184,0.28))',
    borderRadius: 18,
    boxSizing: 'border-box',
    display: 'grid',
    gap: 18,
    maxWidth: 560,
    padding: 28,
    width: '100%',
  },
  shield: {
    alignItems: 'center',
    background: 'var(--accent, #f4c430)',
    borderRadius: 999,
    color: '#05070c',
    display: 'flex',
    fontSize: 22,
    fontWeight: 900,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  title: { fontSize: '1.55rem', lineHeight: 1.2, margin: 0 },
  body: { color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.6, margin: 0 },
  links: { display: 'grid', gap: 10 },
  checkboxRow: { alignItems: 'flex-start', display: 'flex', gap: 12, lineHeight: 1.55 },
  checkbox: { flexShrink: 0, height: 20, marginTop: 2, width: 20 },
  error: { color: '#fca5a5', lineHeight: 1.5, margin: 0 },
  primaryButton: {
    background: 'var(--accent, #f4c430)',
    border: 0,
    borderRadius: 10,
    color: '#05070c',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 800,
    minHeight: 48,
    padding: '12px 18px',
  },
  secondaryButton: {
    background: 'transparent',
    border: 0,
    color: 'var(--text-secondary, #cbd5e1)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    minHeight: 44,
  },
};
