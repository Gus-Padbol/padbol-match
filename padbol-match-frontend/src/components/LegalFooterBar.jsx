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

  const isAdminPanel = pathname === '/admin' || pathname.startsWith('/admin/');
  const linkFontSize = 'clamp(0.82rem, 2.8vw, 0.9rem)';
  const linkBase = { fontWeight: 700, fontSize: linkFontSize, textDecoration: 'none' };

  const footerStyle = isAdminPanel
    ? {
        flexShrink: 0,
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
        borderTop:
          theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(148, 163, 184, 0.35)',
        background: 'transparent',
        textAlign: 'center',
      }
    : {
        flexShrink: 0,
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid rgba(148, 163, 184, 0.35)',
        background: 'rgba(248, 250, 252, 0.98)',
        textAlign: 'center',
      };

  const linkColor = isAdminPanel
    ? theme === 'dark'
      ? 'rgba(255, 255, 255, 0.4)'
      : '#64748B'
    : '#334155';

  const sepColor = isAdminPanel
    ? theme === 'dark'
      ? 'rgba(255, 255, 255, 0.25)'
      : '#94a3b8'
    : '#94a3b8';

  return (
    <footer role="contentinfo" style={footerStyle}>
      <nav aria-label="Información legal" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 12px' }}>
        <Link to="/terminos" style={{ ...linkBase, color: linkColor }}>
          Términos y Condiciones
        </Link>
        <span style={{ color: sepColor }} aria-hidden>
          ·
        </span>
        <Link to="/privacidad" style={{ ...linkBase, color: linkColor }}>
          Política de Privacidad
        </Link>
      </nav>
    </footer>
  );
}
