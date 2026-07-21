import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PadbolBrandLogo from '../../components/PadbolBrandLogo';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import CookieConsentBanner from '../../components/CookieConsentBanner';
import { ES_FALLBACKS, useSafeTranslation as useTranslation } from '../../i18n/tSafe';
import { PUBLIC_SITE_NAV_ITEMS } from '../../content/publicSiteContent';
import PublicSiteFooter from './PublicSiteFooter';
import {
  PUBLIC_SITE_CTA,
  PUBLIC_SITE_PATH,
} from '../../constants/publicSiteLinks';

function scrollToHash(hash) {
  const id = String(hash || '').replace(/^#/, '');
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

export default function PublicSiteLayout({ children }) {
  const { t } = useTranslation();
  const text = (key) => t(key, ES_FALLBACKS[key] || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const firstMenuLinkRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    firstMenuLinkRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const chooseAnchor = (event, href) => {
    event.preventDefault();
    setMenuOpen(false);
    scrollToHash(href);
  };

  return (
    <div className="public-site">
      <header className="public-site__nav">
        <div className="public-site__shell public-site__nav-inner">
          <Link
            to={PUBLIC_SITE_PATH}
            className="public-site__brand"
            aria-label={text('publicSite.brandAlt')}
          >
            <PadbolBrandLogo
              variant="on-dark"
              className="public-site__brand-logo"
              alt={text('publicSite.brandAlt')}
            />
          </Link>

          <nav className="public-site__desktop-nav" aria-label={text('publicSite.nav.aria')}>
            <ul className="public-site__nav-links">
              {PUBLIC_SITE_NAV_ITEMS.map((item) => (
                <li key={item.key}>
                  <a
                    href={item.href}
                    className="public-site__nav-link"
                    onClick={(event) => chooseAnchor(event, item.href)}
                  >
                    {text(`publicSite.nav.${item.key}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="public-site__nav-actions">
            <div className="public-site__lang">
              <LanguageSwitcher variant="landing" />
            </div>
            <Link to={PUBLIC_SITE_CTA.login} className="public-site__login">
              {text('publicSite.nav.login')}
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              className="public-site__menu-button"
              aria-expanded={menuOpen}
              aria-controls="public-site-mobile-menu"
              aria-label={text(menuOpen ? 'publicSite.nav.close' : 'publicSite.nav.menu')}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden>{menuOpen ? '×' : '☰'}</span>
            </button>
          </div>
        </div>
        <nav
          id="public-site-mobile-menu"
          className={`public-site__mobile-nav${menuOpen ? ' is-open' : ''}`}
          aria-label={text('publicSite.nav.aria')}
          hidden={!menuOpen}
        >
          <div className="public-site__shell">
            {PUBLIC_SITE_NAV_ITEMS.map((item, index) => (
              <a
                ref={index === 0 ? firstMenuLinkRef : undefined}
                href={item.href}
                key={item.key}
                onClick={(event) => chooseAnchor(event, item.href)}
              >
                {text(`publicSite.nav.${item.key}`)}
              </a>
            ))}
            <Link to={PUBLIC_SITE_CTA.login} onClick={() => setMenuOpen(false)}>
              {text('publicSite.nav.login')}
            </Link>
          </div>
        </nav>
      </header>

      <main id="public-site-main">{children}</main>
      <PublicSiteFooter />

      {/* Cookies: misma capa pública que el AppShell; sin BottomNav ni LegalFooter global. */}
      <CookieConsentBanner />
    </div>
  );
}
