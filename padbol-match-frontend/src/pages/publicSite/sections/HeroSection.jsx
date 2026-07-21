import React from 'react';
import { Link } from 'react-router-dom';
import PadbolBrandLogo from '../../../components/PadbolBrandLogo';
import { useSafeTranslation as useTranslation } from '../../../i18n/tSafe';
import { PUBLIC_SITE_CTA } from '../../../constants/publicSiteLinks';

function scrollToHash(hash) {
  const id = String(hash || '').replace(/^#/, '');
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="public-site-hero" aria-labelledby="public-site-hero-title">
      <div className="public-site__shell public-site-hero__grid">
        <div className="public-site-hero__copy">
          <p className="public-site-hero__eyebrow">
            {t('publicSite.hero.eyebrow', 'Plataforma oficial')}
          </p>

          <PadbolBrandLogo
            variant="on-dark"
            className="public-site-hero__logo"
            alt={t('publicSite.brandAlt', 'Padbol Match')}
          />

          <h1 id="public-site-hero-title" className="public-site-hero__title">
            {t('publicSite.hero.title', 'Padbol Match')}
          </h1>

          <p className="public-site-hero__claim">
            {t(
              'publicSite.hero.claim',
              'La plataforma que convierte cada partido en una relación continua.',
            )}
          </p>

          <p className="public-site-hero__pillars">
            {t('publicSite.hero.pillars', 'Juego · Comunidad · Gestión')}
          </p>

          <p className="public-site-hero__lead">
            {t(
              'publicSite.hero.lead',
              'Una experiencia simple para el jugador y una herramienta de crecimiento, fidelización y control para cada sede.',
            )}
          </p>

          <div className="public-site-hero__ctas">
            <a
              href={PUBLIC_SITE_CTA.exploreHash}
              className="public-site-hero__cta public-site-hero__cta--primary"
              onClick={(e) => {
                e.preventDefault();
                scrollToHash(PUBLIC_SITE_CTA.exploreHash);
              }}
            >
              {t('publicSite.hero.ctaExplore', 'Conocer la plataforma')}
            </a>

            <Link
              to={PUBLIC_SITE_CTA.play}
              className="public-site-hero__cta public-site-hero__cta--secondary"
            >
              {t('publicSite.hero.ctaPlay', 'Quiero jugar')}
            </Link>

            <Link
              to={PUBLIC_SITE_CTA.venue}
              className="public-site-hero__cta public-site-hero__cta--tertiary"
            >
              {t('publicSite.hero.ctaVenue', 'Quiero incorporar Padbol Match')}
            </Link>
          </div>
        </div>

        <div className="public-site-hero__panel" aria-hidden="true" />
      </div>
    </section>
  );
}
