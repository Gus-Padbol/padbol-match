import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { IconGeroUbicacion } from '../components/icons/GeroIcons';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { usePadbolLangVersion } from '../hooks/usePadbolLang';
import './LandingPage.css';

const ACCENT = '#E11B22';
const COL_MAX = 480;

const shell = {
  paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
  paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
};

const column = {
  width: '100%',
  maxWidth: COL_MAX,
  marginLeft: 'auto',
  marginRight: 'auto',
  paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
  boxSizing: 'border-box',
};

const btnPrimaryFooter = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '15px 18px',
  borderRadius: 12,
  border: 'none',
  fontWeight: 800,
  fontSize: 16,
  cursor: 'pointer',
  textDecoration: 'none',
  color: '#fff',
  background: ACCENT,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  boxShadow: 'none',
};

function HowCard({ lead, emoji, title, description }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 18px',
        background: 'var(--bg-card)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: 36, height: 4, borderRadius: 2, background: ACCENT, marginBottom: 12 }} aria-hidden />
      <div
        style={{
          fontSize: lead ? undefined : 26,
          lineHeight: 1,
          marginBottom: 10,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden
      >
        {lead != null ? lead : emoji}
      </div>
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: 17,
          fontWeight: 800,
          color: 'var(--text-primary)',
          lineHeight: 1.25,
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

export default function LandingPage() {
  const location = useLocation();
  const { t } = useTranslation();
  usePadbolLangVersion();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('landing-page-active');
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevThemeColor = meta?.getAttribute('content') ?? null;
    if (meta) meta.setAttribute('content', '#0F172A');
    return () => {
      root.classList.remove('landing-page-active');
      if (meta && prevThemeColor != null) meta.setAttribute('content', prevThemeColor);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    try {
      if (typeof document !== 'undefined') {
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      }
    } catch {
      /* ignore */
    }
  }, [location.pathname, location.key]);

  return (
    <div className="landing-page" style={shell}>
      <div className="landing-page__lang-shell">
        <div className="landing-page__lang-inner">
          <div className="landing-page__lang-bar">
            <LanguageSwitcher variant="landing" />
          </div>
        </div>
      </div>
      <header style={{ ...column, textAlign: 'center', paddingBottom: 0 }}>
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{
            ...padbolLogoImgStyle,
            width: 120,
            height: 120,
            maxWidth: '100%',
            objectFit: 'contain',
            marginBottom: 20,
            filter: 'drop-shadow(0 0 18px rgba(255, 255, 255, 0.12))',
          }}
        />
      </header>

      <main style={column}>
        <section style={{ paddingTop: 0, paddingBottom: 28, textAlign: 'center' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 500,
              lineHeight: 1.3,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            {t('landing.heroLine1')}
            <br />
            {t('landing.heroLine2')}
          </h1>
          <p
            style={{
              margin: '16px 0 0',
              fontSize: 15,
              fontWeight: 500,
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}
          >
            {t('landing.heroSub')}
          </p>
        </section>

        <section className="landing-page__cta-group">
          <Link to="/reservar" className="landing-page__cta landing-page__cta--primary">
            {t('landing.bookSlot')}
          </Link>
          <Link to="/hub" className="landing-page__cta landing-page__cta--secondary">
            {t('landing.enterPlay')}
          </Link>
          <Link to="/registro" className="landing-page__cta landing-page__cta--account">
            {t('landing.createAccount')}
          </Link>
        </section>

        <p
          style={{
            margin: '0 0 40px',
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          {t('landing.guestNote')}
        </p>

        <section style={{ marginBottom: 44 }}>
          <h2
            style={{
              margin: '0 0 20px',
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text-primary)',
            }}
          >
            {t('landing.howTitle')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <HowCard
              lead={<IconGeroUbicacion size={26} style={{ color: ACCENT }} />}
              title={t('landing.step1Title')}
              description={t('landing.step1Desc')}
            />
            <HowCard
              emoji="📅"
              title={t('landing.step2Title')}
              description={t('landing.step2Desc')}
            />
            <HowCard
              emoji="💳"
              title={t('landing.step3Title')}
              description={t('landing.step3Desc')}
            />
            <HowCard
              emoji="⚽"
              title={t('landing.step4Title')}
              description={t('landing.step4Desc')}
            />
          </div>
        </section>

        <footer
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 28,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <Link to="/contacto" style={{ ...btnPrimaryFooter, maxWidth: '100%' }}>
            {t('landing.addClub')}
          </Link>
          <Link
            to="/sobre"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: ACCENT,
              textDecoration: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('landing.whatIs')}
          </Link>
          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            <Link to="/terminos" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
              {t('landing.terms')}
            </Link>
            <span style={{ color: 'var(--border)', margin: '0 8px' }}>|</span>
            <Link to="/privacidad" style={{ color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
              {t('landing.privacy')}
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
