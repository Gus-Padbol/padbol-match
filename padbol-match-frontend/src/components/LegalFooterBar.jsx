import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HUB_BOTTOM_NAV_CONTENT_GAP_PX,
  HUB_NAV_HEIGHT_PX,
  isHubNavBarHiddenPathname,
  isLegalFooterGlobalBarVisiblePathname,
} from '../constants/hubLayout';
import { useTheme } from '../context/ThemeContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

/**
 * Pie global con enlaces a documentos legales. No se muestra en la landing (tiene su propio pie) ni en las páginas legales.
 */
export default function LegalFooterBar() {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const { navDock } = useHubNavLayout();
  const { t } = useTranslation();
  if (!isLegalFooterGlobalBarVisiblePathname(pathname)) return null;
  const isNaplesEnglish = String(pathname || '').replace(/\/+$/, '') === '/nations-cup/nations-cup-napoli-2026/inscripcion';
  const copy = (key, english) => (isNaplesEnglish ? english : t(key));
  const deletionLabel = isNaplesEnglish ? 'Delete your account' : t('accountDeletion.title');

  const linkColor =
    theme === 'dark' ? '#cbd5e1' : '#475569';

  const footerNavLift =
    !isHubNavBarHiddenPathname(pathname) && navDock === 'bottom'
      ? HUB_NAV_HEIGHT_PX + HUB_BOTTOM_NAV_CONTENT_GAP_PX
      : 0;

  const footerStyle = {
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
    padding: `8px 16px calc(8px + env(safe-area-inset-bottom, 0px) + ${footerNavLift}px)`,
    background: 'transparent',
    borderTop: 'none',
    textAlign: 'center',
  };

  const linkBase = {
    fontWeight: 600,
    fontSize: '13px',
    textDecoration: 'underline',
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '44px',
    color: linkColor,
  };

  const companyStyle = {
    margin: 0,
    color: linkColor,
    fontSize: '13px',
    lineHeight: 1.45,
  };

  return (
    <footer role="contentinfo" style={footerStyle}>
      <nav
        aria-label={copy('legal.terminos', 'Terms and Conditions')}
        style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '14px' }}
      >
        <Link to="/terminos" style={linkBase}>
          {copy('legal.terminos', 'Terms and Conditions')}
        </Link>
        <Link to="/privacidad" style={linkBase}>
          {copy('legal.privacidad', 'Privacy Policy')}
        </Link>
        <Link to="/eliminar-cuenta" style={linkBase}>
          {deletionLabel}
        </Link>
      </nav>
      <p style={companyStyle}>
        © 2026 Padbol.{' '}
        <a href="https://padbol.com/company" style={linkBase}>
          {copy('publicSite.footer.legalOwner', 'Operated by ENTERTAINMENT SPORT SERVICE LLC.')}
        </a>
      </p>
    </footer>
  );
}
