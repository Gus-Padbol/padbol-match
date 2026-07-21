import React from 'react';
import { Link } from 'react-router-dom';
import PadbolBrandLogo from '../../components/PadbolBrandLogo';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import CookieConsentBanner from '../../components/CookieConsentBanner';
import { useSafeTranslation as useTranslation } from '../../i18n/tSafe';
import {
  PUBLIC_SITE_ANCHORS,
  PUBLIC_SITE_CTA,
  PUBLIC_SITE_PATH,
} from '../../constants/publicSiteLinks';

const NAV_ITEMS = [
  { key: 'platform', hash: PUBLIC_SITE_ANCHORS.platform, labelKey: 'publicSite.nav.platform', fallback: 'Plataforma' },
  { key: 'players', hash: PUBLIC_SITE_ANCHORS.players, labelKey: 'publicSite.nav.players', fallback: 'Para jugadores' },
  { key: 'venues', hash: PUBLIC_SITE_ANCHORS.venues, labelKey: 'publicSite.nav.venues', fallback: 'Para sedes' },
  { key: 'download', hash: PUBLIC_SITE_ANCHORS.download, labelKey: 'publicSite.nav.download', fallback: 'Descargar' },
];

function scrollToHash(hash) {
  const id = String(hash || '').replace(/^#/, '');
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

export default function PublicSiteLayout({ children }) {
  const { t } = useTranslation();

  return (
    <div className="public-site">
      <header className="public-site__nav">
        <div className="public-site__shell public-site__nav-inner">
          <Link
            to={PUBLIC_SITE_PATH}
            className="public-site__brand"
            aria-label={t('publicSite.brandAlt', 'Padbol Match')}
          >
            <PadbolBrandLogo
              variant="on-dark"
              className="public-site__brand-logo"
              alt={t('publicSite.brandAlt', 'Padbol Match')}
            />
          </Link>

          <nav aria-label={t('publicSite.nav.aria', 'Navegación principal')}>
            <ul className="public-site__nav-links">
              {NAV_ITEMS.map((item) => (
                <li key={item.key}>
                  <a
                    href={item.hash}
                    className="public-site__nav-link"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToHash(item.hash);
                    }}
                  >
                    {t(item.labelKey, item.fallback)}
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
              {t('publicSite.nav.login', 'Ingresar')}
            </Link>
          </div>
        </div>
      </header>

      <main id="public-site-main">{children}</main>

      {/* Cookies: misma capa pública que el AppShell; sin BottomNav ni LegalFooter global. */}
      <CookieConsentBanner />
    </div>
  );
}
