import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isLegalFooterGlobalBarVisiblePathname } from '../constants/hubLayout';
import { useTheme } from '../context/ThemeContext';

/**
 * Pie global con enlaces a documentos legales. No se muestra en la landing (tiene su propio pie) ni en las páginas legales.
 */
export default function LegalFooterBar() {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  if (!isLegalFooterGlobalBarVisiblePathname(pathname)) return null;

  const linkColor =
    theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(15, 23, 42, 0.38)';

  const footerStyle = {
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 16px calc(8px + env(safe-area-inset-bottom, 0px))',
    background: 'transparent',
    borderTop: 'none',
    textAlign: 'center',
  };

  const linkBase = {
    fontWeight: 600,
    fontSize: '11px',
    textDecoration: 'none',
    color: linkColor,
  };

  return (
    <footer role="contentinfo" style={footerStyle}>
      <nav
        aria-label="Información legal"
        style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '14px' }}
      >
        <Link to="/terminos" style={linkBase}>
          Términos y Condiciones
        </Link>
        <Link to="/privacidad" style={linkBase}>
          Política de Privacidad
        </Link>
      </nav>
    </footer>
  );
}
