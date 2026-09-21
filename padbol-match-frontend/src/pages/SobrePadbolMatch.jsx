import React from 'react';
import { Link } from 'react-router-dom';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const BG = '#FFFFFF';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const ACCENT = '#E11B22';
const BORDER = '#E2E8F0';

export default function SobrePadbolMatch() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: BG,
        color: TEXT,
        paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: 390,
          margin: '0 auto',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
          boxSizing: 'border-box',
        }}
      >
        <Link
          to="/"
          style={{
            display: 'inline-block',
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 600,
            color: ACCENT,
            textDecoration: 'none',
          }}
        >
          ← {t('aboutPage.home')}
        </Link>
        <h1 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>{t('aboutPage.title')}</h1>
        <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.55, color: MUTED, fontWeight: 500 }}>
          {t('aboutPage.intro')}
        </p>
        <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.55, color: MUTED, fontWeight: 500 }}>
          {t('aboutPage.experience')}
        </p>
        <div
          style={{
            marginTop: 28,
            padding: 18,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            background: BG,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{t('aboutPage.ready')}</p>
          <Link
            to="/sedes"
            style={{
              display: 'inline-block',
              marginTop: 12,
              fontSize: 15,
              fontWeight: 800,
              color: ACCENT,
              textDecoration: 'none',
            }}
          >
            {t('aboutPage.explore')} →
          </Link>
        </div>
        <div style={{ marginTop: 40, paddingTop: 16, borderTop: `1px solid ${BORDER}`, fontSize: 13 }}>
          <Link to="/terminos" style={{ color: MUTED, fontWeight: 600, textDecoration: 'none' }}>
            {t('aboutPage.terms')}
          </Link>
          <span style={{ color: BORDER, margin: '0 8px' }}>|</span>
          <Link to="/privacidad" style={{ color: MUTED, fontWeight: 600, textDecoration: 'none' }}>
            {t('aboutPage.privacy')}
          </Link>
        </div>
      </div>
    </div>
  );
}
