import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSafeTranslation } from '../../../i18n/tSafe';
import { PUBLIC_SITE_CTA } from '../../../constants/publicSiteLinks';
import PremiumGlobalGlobe from '../globe/PremiumGlobalGlobe';
import HeroStarfield from '../globe/HeroStarfield';

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

/**
 * Hero: marca + mensaje + globo global (elemento visual principal).
 * Fondo estelar sutil (sin video). Experiencias mantienen sus videos.
 */
export default function HeroSection() {
  const { t } = useSafeTranslation();
  const text = (key) => t(key);
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const [tablet, setTablet] = useState(() =>
    typeof window !== 'undefined'
      ? window.innerWidth >= 768 && window.innerWidth < 900
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setCompact(w < 768);
      setTablet(w >= 768 && w < 900);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <section className="ps-hero ps-hero--globe" aria-labelledby="public-site-hero-title">
      <div className="ps-hero__atmosphere" aria-hidden="true" />
      <HeroStarfield reducedMotion={reduceMotion} compact={compact} tablet={tablet} />

      <div className="public-site__shell ps-hero__layout">
        <div className="ps-hero__content">
          <img
            src="/media/public-site/jero/padbol-match-logo-white.svg"
            className="ps-hero__logo"
            alt={text('publicSite.brandAlt')}
          />
          <h1 id="public-site-hero-title" className="ps-hero__claim">
            {text('publicSite.hero.claim')}
          </h1>
          <p className="ps-hero__lead">{text('publicSite.hero.lead')}</p>
          <div className="ps-hero__ctas">
            <a
              href={PUBLIC_SITE_CTA.play}
              className="ps-btn ps-btn--primary ps-hero__play"
              onClick={(e) => {
                e.preventDefault();
                scrollToHash(PUBLIC_SITE_CTA.play);
              }}
            >
              <span>{text('publicSite.nav.download')}</span>
              <span className="ps-hero__play-note">iOS + Android ↓</span>
            </a>
            <div className="ps-hero__secondary-actions">
              <a
                href={PUBLIC_SITE_CTA.exploreHash}
                className="ps-hero__text-link"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToHash(PUBLIC_SITE_CTA.exploreHash);
                }}
              >
                {text('publicSite.hero.ctaExplore')} <span aria-hidden="true">↓</span>
              </a>
              <Link to={PUBLIC_SITE_CTA.venue} className="ps-hero__text-link">
                {text('publicSite.hero.ctaVenue')} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="ps-hero__globe-wrap" data-reduced-motion={reduceMotion ? 'true' : 'false'}>
          <PremiumGlobalGlobe text={text} />
        </div>
      </div>
    </section>
  );
}
