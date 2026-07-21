import React from 'react';
import { Link } from 'react-router-dom';
import PadbolBrandLogo from '../../../components/PadbolBrandLogo';
import { ES_FALLBACKS, useSafeTranslation } from '../../../i18n/tSafe';
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

const ECOSYSTEM_NODES = [
  { key: 'player', className: 'is-player' },
  { key: 'venue', className: 'is-venue' },
  { key: 'scoreboard', className: 'is-scoreboard' },
  { key: 'ranking', className: 'is-ranking' },
  { key: 'padcoins', className: 'is-padcoins' },
];

export default function HeroSection() {
  const { t } = useSafeTranslation();
  const text = (key) => t(key, ES_FALLBACKS[key] || '');

  return (
    <section className="public-site-hero" aria-labelledby="public-site-hero-title">
      {/* Composición abstracta CSS: trama, luces y líneas (solo decorativa) */}
      <div className="public-site-hero__backdrop" aria-hidden="true">
        <span className="public-site-hero__grid-lines" />
        <span className="public-site-hero__glow public-site-hero__glow--red" />
        <span className="public-site-hero__glow public-site-hero__glow--blue" />
        <span className="public-site-hero__court-line" />
      </div>

      <div className="public-site__shell public-site-hero__grid">
        <div className="public-site-hero__copy" data-ps-reveal>
          <p className="public-site-hero__eyebrow">{text('publicSite.hero.eyebrow')}</p>
          <PadbolBrandLogo
            variant="on-dark"
            className="public-site-hero__logo"
            alt={text('publicSite.brandAlt')}
          />

          <h1 id="public-site-hero-title" className="public-site-hero__title">
            {text('publicSite.hero.claim')}
          </h1>

          <p className="public-site-hero__pillars">{text('publicSite.hero.pillars')}</p>

          <p className="public-site-hero__lead">{text('publicSite.hero.lead')}</p>

          <div className="public-site-hero__ctas">
            <a
              href={PUBLIC_SITE_CTA.exploreHash}
              className="public-site-hero__cta public-site-hero__cta--primary"
              onClick={(e) => {
                e.preventDefault();
                scrollToHash(PUBLIC_SITE_CTA.exploreHash);
              }}
            >
              {text('publicSite.hero.ctaExplore')}
            </a>

            <Link to={PUBLIC_SITE_CTA.play} className="public-site-hero__cta public-site-hero__cta--secondary">
              {text('publicSite.hero.ctaPlay')}
            </Link>

            <Link to={PUBLIC_SITE_CTA.venue} className="public-site-hero__cta public-site-hero__cta--tertiary">
              {text('publicSite.hero.ctaVenue')}
            </Link>
          </div>
        </div>

        {/* Vista conceptual del ecosistema conectado (representación, no captura) */}
        <div
          className="public-site-hero__ecosystem"
          role="img"
          aria-label={text('publicSite.hero.ecosystemAria')}
          data-ps-reveal
          data-ps-reveal-order="2"
        >
          <span className="public-site-hero__eco-ring" aria-hidden="true" />
          <span className="public-site-hero__eco-ring public-site-hero__eco-ring--outer" aria-hidden="true" />
          <div className="public-site-hero__eco-core">
            <strong>{text('publicSite.hero.ecosystemCore')}</strong>
            <span>{text('publicSite.hero.ecosystemCoreSub')}</span>
          </div>
          {ECOSYSTEM_NODES.map(({ key, className }) => (
            <div key={key} className={`public-site-hero__eco-node ${className}`}>
              <span className="public-site-hero__eco-dot" aria-hidden="true" />
              {text(`publicSite.hero.ecosystem.${key}`)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
