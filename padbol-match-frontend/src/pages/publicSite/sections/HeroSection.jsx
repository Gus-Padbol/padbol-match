import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PadbolBrandLogo from '../../../components/PadbolBrandLogo';
import { useSafeTranslation } from '../../../i18n/tSafe';
import { PUBLIC_SITE_CTA } from '../../../constants/publicSiteLinks';

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

const HERO_VIDEO = '/media/experiences/signature.mp4';

/**
 * Hero: marca primero, luego claim, subtítulo, CTAs y video de fondo.
 */
export default function HeroSection() {
  const { t } = useSafeTranslation();
  const text = (key) => t(key);
  const videoRef = useRef(null);
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (reduceMotion) {
      video.pause();
      return undefined;
    }
    const play = () => {
      const result = video.play();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    };
    play();
    return () => video.pause();
  }, [reduceMotion]);

  return (
    <section className="ps-hero" aria-labelledby="public-site-hero-title">
      <div className="public-site__shell ps-hero__content">
        <PadbolBrandLogo
          variant="on-dark-tight"
          className="ps-hero__logo"
          alt={text('publicSite.brandAlt')}
        />
        <h1 id="public-site-hero-title" className="ps-hero__claim">
          {text('publicSite.hero.claim')}
        </h1>
        <p className="ps-hero__lead">{text('publicSite.hero.lead')}</p>
        <div className="ps-hero__ctas">
          <a
            href={PUBLIC_SITE_CTA.exploreHash}
            className="ps-btn ps-btn--primary"
            onClick={(e) => {
              e.preventDefault();
              scrollToHash(PUBLIC_SITE_CTA.exploreHash);
            }}
          >
            {text('publicSite.hero.ctaExplore')}
          </a>
          <Link to={PUBLIC_SITE_CTA.venue} className="ps-btn ps-btn--secondary">
            {text('publicSite.hero.ctaVenue')}
          </Link>
          <Link to={PUBLIC_SITE_CTA.play} className="ps-btn ps-btn--ghost">
            {text('publicSite.hero.ctaPlay')}
          </Link>
        </div>
      </div>

      <div className="ps-hero__media" aria-hidden={false}>
        <video
          ref={videoRef}
          className="ps-hero__video"
          src={HERO_VIDEO}
          muted
          playsInline
          loop
          preload="metadata"
          poster=""
          aria-label={text('publicSite.hero.videoAria')}
        />
        <div className="ps-hero__scrim" aria-hidden="true" />
        <div className="ps-hero__court-lines" aria-hidden="true" />
      </div>
    </section>
  );
}
