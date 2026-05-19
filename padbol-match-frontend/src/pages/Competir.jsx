import React, { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { hubContentPaddingTopCss, hubMainPaddingBottomCss } from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

export default function Competir() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [searchParams] = useSearchParams();
  const deporteQ = useMemo(() => {
    const d = String(searchParams.get('deporte') || '').trim().toLowerCase();
    return d ? `?deporte=${encodeURIComponent(d)}` : '';
  }, [searchParams]);

  const opciones = useMemo(
    () => [
      {
        title: t('competir.torneosCard'),
        body: t('competir.torneosCardBody'),
        icon: '🏆',
        path: '/torneos',
      },
      {
        title: t('competir.rankingsCard'),
        body: t('competir.rankingsCardBody'),
        icon: '📊',
        path: '/rankings',
      },
    ],
    [t],
  );

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
      <AppHeader title={t('nav.competir')} />
      <main style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: '20px 16px', boxSizing: 'border-box' }}>
        <h1 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: 26, lineHeight: 1.1, fontWeight: 700 }}>
          {t('competir.howTitle')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px', fontSize: 15, lineHeight: 1.5, fontWeight: 400 }}>
          {t('competir.howSubtitle')}
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          {opciones.map((op) => (
            <button
              key={op.path}
              type="button"
              onClick={() => navigate(`${op.path}${deporteQ}`)}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                textAlign: 'left',
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: 'var(--bg-card)',
                padding: 16,
                boxShadow: 'var(--pm-shadow-card, 0 2px 8px rgba(0,0,0,0.08))',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 28, width: 42, textAlign: 'center' }}>{op.icon}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 17, marginBottom: 4, fontWeight: 700 }}>
                  {op.title}
                </strong>
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.45, fontWeight: 400 }}>
                  {op.body}
                </span>
              </span>
              <span style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 700 }}>›</span>
            </button>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
