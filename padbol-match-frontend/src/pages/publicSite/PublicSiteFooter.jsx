import React from 'react';
import { Link } from 'react-router-dom';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { PUBLIC_SITE_NAV_ITEMS } from '../../content/publicSiteContent';
import { ES_FALLBACKS, useSafeTranslation } from '../../i18n/tSafe';

export default function PublicSiteFooter() {
  const { t } = useSafeTranslation();
  const text = (key) => t(key, ES_FALLBACKS[key] || '');
  const links = [
    ...PUBLIC_SITE_NAV_ITEMS.map(({ key, href, to }) => ({
      key,
      href,
      to,
      label: text(`publicSite.footer.${key}`),
    })),
    { key: 'contact', to: '/contacto', label: text('publicSite.footer.contact') },
    { key: 'privacy', to: '/privacidad', label: text('publicSite.footer.privacy') },
    { key: 'terms', to: '/terminos', label: text('publicSite.footer.terms') },
  ];

  return (
    <footer className="public-site-footer">
      <div className="public-site__shell">
        <div className="public-site-footer__top">
          <div className="public-site-footer__brand">
            <a
              className="public-site-footer__padbol-lockup"
              href="https://padbol.com"
              aria-label="Visitar Padbol"
            >
              <span className="public-site-footer__padbol-mark" aria-hidden="true"><i /><i /><i /></span>
              <span>PADBOL</span>
            </a>
            <p className="public-site-footer__product-of">Un producto de Padbol.</p>
            <p className="public-site-footer__developed-by">{text('publicSite.footer.developedBy')}</p>
            <Link to="/contacto" className="public-site-footer__contact">
              ¿Necesitás ayuda? Contactanos <span aria-hidden="true">→</span>
            </Link>
          </div>
          <nav aria-label={text('publicSite.footer.aria')}>
            <ul className="public-site-footer__links">
              {links.map(({ key, href, to, label }) => (
                <li key={key}>
                  {href ? <a href={href}>{label}</a> : <Link to={to}>{label}</Link>}
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="public-site-footer__bottom">
          <div className="public-site-footer__language">
            <span>{text('publicSite.footer.language')}</span>
            <LanguageSwitcher variant="landing" />
          </div>
          <p className="public-site-footer__copyright">
            © 2026 Padbol. Operated by{' '}
            <a href="https://padbol.com/company">
              Entertainment and Sports Services LLC
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
