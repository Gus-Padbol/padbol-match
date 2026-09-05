import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LegalStaticPageLayout, {
  LegalSectionTitle,
  LegalP,
  LegalUl,
  LegalLi,
} from '../components/LegalStaticPageLayout';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { requestAccountDeletion } from '../utils/accountDeletionApi';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const EMAIL = 'padbolinternacional@gmail.com';
const EMAIL_HREF =
  'mailto:padbolinternacional@gmail.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta%20Padbol%20Match';
const linkStyle = { color: '#a5b4fc', fontWeight: 700 };

export default function EliminarCuenta() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, signOutAndClear } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRequestDeletion = async () => {
    if (busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      await requestAccountDeletion({
        accessToken: session?.access_token,
        source: 'web',
      });
      setConfirmOpen(false);
      signOutAndClear();
      navigate('/', {
        replace: true,
        state: { accountDeletionRequested: true },
      });
    } catch (error) {
      setErrorMessage(error?.message || t('accountDeletion.error'));
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LegalStaticPageLayout
      title={t('accountDeletion.title')}
      lead={t('accountDeletion.lead')}
    >
      <LegalSectionTitle>{t('accountDeletion.fromAccount')}</LegalSectionTitle>
      <LegalP>
        {session?.user ? (
          <>{t('accountDeletion.security')}</>
        ) : (
          <>
            <Link to="/acceso?redirect=%2Feliminar-cuenta" style={linkStyle}>
              {t('auth.login')}
            </Link>{' '}
            {t('accountDeletion.signInSuffix')}
          </>
        )}
      </LegalP>

      {session?.user ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 16px',
              margin: '0 0 24px',
              borderRadius: '10px',
              border: '1px solid rgba(248, 113, 113, 0.5)',
              background: 'transparent',
              color: '#fca5a5',
              font: 'inherit',
              fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.65 : 1,
            }}
          >
            {t('accountDeletion.requestButton')}
          </button>
          {errorMessage ? (
            <p role="alert" style={{ color: '#fca5a5', fontWeight: 700, margin: '0 0 24px' }}>
              {errorMessage}
            </p>
          ) : null}
        </>
      ) : null}

      <LegalSectionTitle>{t('accountDeletion.cannotSignIn')}</LegalSectionTitle>
      <LegalP>
        {t('accountDeletion.emailPrefix')}{' '}
        <a href={EMAIL_HREF} style={linkStyle}>
          {EMAIL}
        </a>
        {t('accountDeletion.emailSuffix')}
      </LegalP>

      <LegalSectionTitle>{t('accountDeletion.dataTitle')}</LegalSectionTitle>
      <LegalUl>
        <LegalLi>{t('accountDeletion.dataUnavailable')}</LegalLi>
        <LegalLi>{t('accountDeletion.dataRemoved')}</LegalLi>
        <LegalLi>
          {t('accountDeletion.dataRetention')}
        </LegalLi>
      </LegalUl>

      <LegalP>
        {t('accountDeletion.processing')}
      </LegalP>

      <ConfirmModal
        open={confirmOpen}
        title={t('accountDeletion.confirmTitle')}
        message={t('accountDeletion.confirmMessage')}
        confirmLabel={busy ? t('accountDeletion.sending') : t('accountDeletion.confirm')}
        dismissLabel={t('general.cancel')}
        busy={busy}
        confirmDanger
        onDismiss={() => setConfirmOpen(false)}
        onConfirm={() => void handleRequestDeletion()}
        titleId="eliminar-cuenta-titulo"
      />
    </LegalStaticPageLayout>
  );
}
