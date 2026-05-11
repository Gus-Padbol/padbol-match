import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isLegalFooterGlobalBarVisiblePathname } from '../constants/hubLayout';

/**
 * Pie global con enlaces a documentos legales. No se muestra en la landing (tiene su propio pie) ni en las páginas legales.
 */
export default function LegalFooterBar() {
  const { pathname } = useLocation();
  if (!isLegalFooterGlobalBarVisiblePathname(pathname)) return null;

  return (
    <footer
      role="contentinfo"
      style={{
        flexShrink: 0,
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid rgba(148, 163, 184, 0.35)',
        background: 'rgba(248, 250, 252, 0.98)',
        textAlign: 'center',
      }}
    >
      <nav aria-label="Información legal" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 12px' }}>
        <Link
          to="/terminos"
          style={{ color: '#334155', fontWeight: 700, fontSize: 'clamp(0.82rem, 2.8vw, 0.9rem)', textDecoration: 'none' }}
        >
          Términos y Condiciones
        </Link>
        <span style={{ color: '#94a3b8' }} aria-hidden>
          ·
        </span>
        <Link
          to="/privacidad"
          style={{ color: '#334155', fontWeight: 700, fontSize: 'clamp(0.82rem, 2.8vw, 0.9rem)', textDecoration: 'none' }}
        >
          Política de Privacidad
        </Link>
      </nav>
    </footer>
  );
}
