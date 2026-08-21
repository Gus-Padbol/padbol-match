import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import CookieConsentBanner from '../../components/CookieConsentBanner';
import ChatbotIASafe from '../../components/ChatbotIASafe';
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
  const header = document.querySelector('.public-site__nav');
  const headerHeight = Math.ceil(header?.getBoundingClientRect().height || 68);
  const targetTop = Math.max(0, window.scrollY + el.getBoundingClientRect().top - headerHeight - 16);
  window.scrollTo({ top: targetTop, behavior: reduceMotion ? 'auto' : 'smooth' });
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/** Header transparente al inicio; glass al hacer scroll. */
function useHeaderScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
  return scrolled;
}

/** Sección activa para el indicador del nav (IntersectionObserver único). */
function useActiveSection() {
  const [activeId, setActiveId] = useState(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const ids = PUBLIC_SITE_NAV_ITEMS.map(({ href }) => href.replace(/^#/, ''));
    const targets = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!targets.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: '-30% 0px -55% 0px' },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return activeId;
}

export default function PublicSiteLayout({ children }) {
  const location = useLocation();
  const { t } = useTranslation();
  const text = (key) => t(key, ES_FALLBACKS[key] || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const firstMenuLinkRef = useRef(null);
  const scrolled = useHeaderScrolled();
  const activeSectionId = useActiveSection();

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

  useEffect(() => {
    if (location.pathname !== PUBLIC_SITE_PATH) return undefined;
    const raf = window.requestAnimationFrame(() => {
      // La ruta pública de Plataforma siempre empieza por su presentación.
      // Una ancla antigua #descargar no puede desviar la entrada al final.
      if (location.hash === '#descargar') {
        window.history.replaceState(null, '', PUBLIC_SITE_PATH);
        window.scrollTo({ top: 0, behavior: 'auto' });
        return;
      }
      if (location.hash) scrollToHash(location.hash);
      else window.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [location.pathname, location.hash]);

  const chooseAnchor = (event, href) => {
    setMenuOpen(false);
    const id = String(href || '').replace(/^#/, '');
    if (!document.getElementById(id)) return;
    event.preventDefault();
    scrollToHash(href);
  };

  const publicNavHref = (hash) => (
    location.pathname === PUBLIC_SITE_PATH ? hash : `${PUBLIC_SITE_PATH}${hash}`
  );

  return (
    <div className="public-site">
      <header className={`public-site__nav${scrolled || menuOpen ? ' is-scrolled' : ''}`}>
        <div className="public-site__shell public-site__nav-inner">
          <Link
            to={PUBLIC_SITE_PATH}
            className="public-site__brand"
            aria-label={text('publicSite.brandAlt')}
          >
            <img
              src="/media/public-site/jero/padbol-match-logo-white.svg"
              className="public-site__brand-logo"
              alt={text('publicSite.brandAlt')}
            />
          </Link>

          <nav className="public-site__desktop-nav" aria-label={text('publicSite.nav.aria')}>
            <ul className="public-site__nav-links">
              {PUBLIC_SITE_NAV_ITEMS.map((item) => {
                const isActive = activeSectionId === item.href.replace(/^#/, '');
                return (
                  <li key={item.key}>
                    <a
                      href={publicNavHref(item.href)}
                      className={`public-site__nav-link${isActive ? ' is-active' : ''}`}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={(event) => chooseAnchor(event, item.href)}
                    >
                      {text(`publicSite.nav.${item.key}`)}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="public-site__nav-actions">
            <div className="public-site__lang">
              <LanguageSwitcher variant="landing" />
            </div>
            <a href={PUBLIC_SITE_CTA.login} className="public-site__login">
              {text('publicSite.nav.login')}
            </a>
            <button
              ref={menuButtonRef}
              type="button"
              className="public-site__menu-button"
              aria-expanded={menuOpen}
              aria-controls="public-site-mobile-menu"
              aria-label={text(menuOpen ? 'publicSite.nav.close' : 'publicSite.nav.menu')}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className={`public-site__menu-icon${menuOpen ? ' is-open' : ''}`} aria-hidden>
                <i />
                <i />
                <i />
              </span>
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
                href={publicNavHref(item.href)}
                key={item.key}
                onClick={(event) => chooseAnchor(event, item.href)}
              >
                {text(`publicSite.nav.${item.key}`)}
              </a>
            ))}
            <a href={PUBLIC_SITE_CTA.login} onClick={() => setMenuOpen(false)}>
              {text('publicSite.nav.login')}
            </a>
          </div>
        </nav>
      </header>

      <main id="public-site-main">{children}</main>
      <PublicSiteFooter />
      <ChatbotIASafe />
      {/* Cookies: misma capa pública que el AppShell; sin BottomNav ni LegalFooter global. */}
      <CookieConsentBanner />
    </div>
  );
}
