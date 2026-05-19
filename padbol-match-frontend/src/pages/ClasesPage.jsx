import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import ClasesHub from '../components/Clases/ClasesHub';
import { useAuth } from '../context/AuthContext';
import { hubContentPaddingTopCss, hubMainPaddingBottomCss } from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import useUserRole from '../hooks/useUserRole';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

export default function ClasesPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const { session } = useAuth();
  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    return em ? { email: em } : null;
  }, [session?.user?.email]);
  const { sedeId: hubSedeId } = useUserRole(currentCliente);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
        paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title={t('clases.titulo')} />
      <main style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: '16px 14px 24px', boxSizing: 'border-box' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>{t('clases.pageTitle')}</h1>
        <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          {t('clases.pageSubtitle')}
        </p>
        <ClasesHub sedeId={hubSedeId} />
      </main>
      <BottomNav />
    </div>
  );
}
