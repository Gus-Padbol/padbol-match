import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppHeader from './AppHeader';
import { hubContentPaddingTopCss, HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX } from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const titleColor = '#f1f5f9';
const bodyColor = '#cbd5e1';
const muted = '#94a3b8';

const sectionTitle = {
  margin: '28px 0 12px',
  fontSize: 'clamp(1.05rem, 3.5vw, 1.2rem)',
  fontWeight: 800,
  color: titleColor,
  lineHeight: 1.3,
};

const paragraph = {
  margin: '0 0 14px',
  fontSize: 'clamp(0.9rem, 3.2vw, 1rem)',
  lineHeight: 1.65,
  color: bodyColor,
};

const listStyle = {
  margin: '0 0 16px',
  paddingLeft: '1.15rem',
  fontSize: 'clamp(0.9rem, 3.2vw, 1rem)',
  lineHeight: 1.65,
  color: bodyColor,
};

const linkInText = {
  color: '#a5b4fc',
  fontWeight: 600,
};

const bottomNav = {
  marginTop: '36px',
  paddingTop: '20px',
  borderTop: '1px solid rgba(255,255,255,0.12)',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '10px 14px',
  fontSize: '0.9rem',
  fontWeight: 700,
};

const bottomLink = {
  color: '#e2e8f0',
  textDecoration: 'none',
};

/**
 * Contenedor común para documentos legales: header, tipografía legible y enlaces al pie.
 */
export default function LegalStaticPageLayout({ title, lead, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const { session } = useAuth();
  const { t } = useTranslation();
  const home = session?.user ? '/hub' : '/';
  const paddingTop = hubContentPaddingTopCss(location.pathname, navDock);

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        background: 'linear-gradient(180deg, #0b1020 0%, #151832 42%, #1a1040 100%)',
        color: bodyColor,
        paddingTop,
        paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <AppHeader
        title={title}
        showBack
        onBack={() => navigate(-1)}
        contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX}
      />
      <article
        style={{
          maxWidth: 'min(720px, 100%)',
          margin: '0 auto',
          padding: '12px clamp(16px, 4vw, 24px) 8px',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            margin: '8px 0 10px',
            fontSize: 'clamp(1.35rem, 4.5vw, 1.6rem)',
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1.25,
          }}
        >
          {title}
        </h1>
        {lead ? (
          <p style={{ ...paragraph, color: muted, fontSize: '0.92rem', marginBottom: '20px' }}>{lead}</p>
        ) : null}
        {children}
        <nav aria-label={t('legal.terminos')} style={bottomNav}>
          <Link to="/terminos" style={bottomLink}>
            {t('legal.terminos')}
          </Link>
          <span style={{ color: 'rgba(226,232,240,0.35)' }} aria-hidden>
            ·
          </span>
          <Link to="/privacidad" style={bottomLink}>
            {t('legal.privacidad')}
          </Link>
          <span style={{ color: 'rgba(226,232,240,0.35)' }} aria-hidden>
            ·
          </span>
          <Link to="/eliminar-cuenta" style={bottomLink}>
            {t('accountDeletion.title')}
          </Link>
          <span style={{ color: 'rgba(226,232,240,0.35)' }} aria-hidden>
            ·
          </span>
          <Link to={home} style={bottomLink}>
            {t('aboutPage.home')}
          </Link>
        </nav>
      </article>
    </div>
  );
}

export function LegalSectionTitle({ children }) {
  return <h2 style={sectionTitle}>{children}</h2>;
}

export function LegalP({ children }) {
  return <p style={paragraph}>{children}</p>;
}

export function LegalUl({ children }) {
  return <ul style={listStyle}>{children}</ul>;
}

export function LegalLi({ children }) {
  return <li style={{ marginBottom: '8px' }}>{children}</li>;
}

export function LegalA({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={linkInText}>
      {children}
    </a>
  );
}
