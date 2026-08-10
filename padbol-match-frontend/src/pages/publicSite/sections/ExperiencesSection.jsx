import React, { useEffect, useRef, useState } from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import {
  PUBLIC_SITE_EXPERIENCE_IDS,
  PUBLIC_SITE_EXPERIENCES,
} from '../../../constants/publicSiteExperiences';
import SportIcon from '../../../components/common/SportIcon';
import { usePublicSiteText } from '../publicSiteI18n';
import { AccentWords } from './PremiumSections';

/**
 * Vista fija real de cada experiencia. Una sola opción es protagonista por vez:
 * el usuario elige la identidad y no tiene que perseguir un carrusel automático.
 */
function ExperiencePhonePreview({ experience, demoLabel }) {
  const videoRef = useRef(null);
  const vars = {
    '--exp-accent': experience.accent,
    '--exp-bg': experience.background,
    '--exp-card': experience.card,
    '--exp-text': experience.textPrimary,
    '--exp-text-2': experience.textSecondary,
    '--exp-border': experience.border,
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const isVisible = () => {
      const bounds = video.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < window.innerHeight;
    };
    const play = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute('muted', '');
      const attempt = video.play?.();
      attempt?.catch(() => {});
    };
    const playWhenVisible = () => {
      if (isVisible()) play();
    };
    const onPageVisible = () => {
      if (document.visibilityState === 'visible') playWhenVisible();
    };
    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) play();
        },
        { threshold: 0.1 },
      );

    observer?.observe(video);
    video.addEventListener('loadeddata', playWhenVisible);
    video.addEventListener('canplay', playWhenVisible);
    window.addEventListener('pageshow', playWhenVisible);
    window.addEventListener('focus', playWhenVisible);
    document.addEventListener('visibilitychange', onPageVisible);
    playWhenVisible();

    return () => {
      observer?.disconnect();
      video.removeEventListener('loadeddata', playWhenVisible);
      video.removeEventListener('canplay', playWhenVisible);
      window.removeEventListener('pageshow', playWhenVisible);
      window.removeEventListener('focus', playWhenVisible);
      document.removeEventListener('visibilitychange', onPageVisible);
    };
  }, [experience.id]);

  return (
    <div className={`ps-exp-phone is-${experience.id}`} style={vars} aria-label={`Vista previa ${experience.name}`}>
      <div className="ps-exp-phone__screen">
        <div className="ps-exp-phone__statusbar">
          <span className="ps-exp-phone__brand">Padbol Match</span>
          <span className="ps-exp-phone__badge">{demoLabel}</span>
        </div>

        <div className="ps-exp-phone__hero">
          <strong>{experience.name}</strong>
          <span className="ps-exp-phone__chiprow">
            <SportIcon deporte="padbol" size={14} color="currentColor" />
            Padbol Club Norte · 20:30
          </span>
        </div>

        <div className="ps-exp-phone__card ps-exp-phone__card--main">
          <span className="ps-exp-phone__label">Reserva</span>
          <strong>Cancha 2 · 60 min</strong>
          <span className="ps-exp-phone__meta">2/4 jugadores confirmados</span>
          <span className="ps-exp-phone__cta">Confirmar</span>
        </div>

        <div className="ps-exp-phone__row">
          <div className="ps-exp-phone__card">
            <span className="ps-exp-phone__label">Ranking</span>
            <strong>#12</strong>
          </div>
          <div className="ps-exp-phone__card">
            <span className="ps-exp-phone__label">PadCoins</span>
            <strong>340</strong>
          </div>
        </div>

        <div className="ps-exp-phone__tabbar">
          <span className="is-active" />
          <span />
          <span />
          <span />
        </div>

        <video
          key={experience.id}
          ref={videoRef}
          className="ps-exp-phone__video is-ready"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={experience.media.poster}
          aria-label={`Demostración de ${experience.name}`}
        >
          <source src={experience.media.video} type="video/mp4" />
        </video>
      </div>
    </div>
  );
}

export default function ExperiencesSection() {
  const config = PUBLIC_SITE_SECTIONS.experiences;
  const text = usePublicSiteText();
  const [activeId, setActiveId] = useState(PUBLIC_SITE_EXPERIENCE_IDS[0]);
  const tablistRef = useRef(null);

  const active = PUBLIC_SITE_EXPERIENCES[activeId];
  const activeIndex = PUBLIC_SITE_EXPERIENCE_IDS.indexOf(activeId);

  const select = (id) => setActiveId(id);
  const step = (delta) => {
    const next = PUBLIC_SITE_EXPERIENCE_IDS[
      (activeIndex + delta + PUBLIC_SITE_EXPERIENCE_IDS.length) % PUBLIC_SITE_EXPERIENCE_IDS.length
    ];
    select(next);
  };

  const onTabKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextId =
      PUBLIC_SITE_EXPERIENCE_IDS[
        (activeIndex + delta + PUBLIC_SITE_EXPERIENCE_IDS.length) %
          PUBLIC_SITE_EXPERIENCE_IDS.length
      ];
    select(nextId);
    tablistRef.current?.querySelector(`#ps-exp-tab-${nextId}`)?.focus();
  };

  return (
    <section
      id={config.id}
      className={`ps-section ps-section--experiences is-exp-${activeId}`}
      aria-labelledby="ps-experiences-title"
      style={{
        '--exp-accent': active.accent,
        '--exp-bg': active.background,
      }}
    >
      {/* Dos columnas en desktop: bloque de contenido (intro + selector +
          copy activo) a la izquierda y dispositivo a la derecha, centrados
          entre sí. En móvil apila: selector, copy, teléfono, nota. */}
      <div className="public-site__shell ps-exp-layout">
        <div className="ps-exp-main">
          <header className="ps-exp-intro">
            <h2 id="ps-experiences-title"><AccentWords value={text('publicSite.experiences.title')} terms={['Cinco experiencias']} /></h2>
            <p>{text('publicSite.experiences.text')}</p>
          </header>

          <div
            ref={tablistRef}
            className="ps-exp-tabs"
            role="tablist"
            aria-label={text('publicSite.experiences.selectorAria')}
          >
            {PUBLIC_SITE_EXPERIENCE_IDS.map((id) => (
              <button
                key={id}
                id={`ps-exp-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={id === activeId}
                aria-controls={`ps-exp-panel-${id}`}
                tabIndex={id === activeId ? 0 : -1}
                className={`ps-exp-tab${id === activeId ? ' is-active' : ''}`}
                style={{ '--exp-tab-accent': PUBLIC_SITE_EXPERIENCES[id].accent }}
                onClick={() => select(id)}
                onKeyDown={onTabKeyDown}
              >
                <span className="ps-exp-tab__dot" aria-hidden="true" />
                {PUBLIC_SITE_EXPERIENCES[id].name}
              </button>
            ))}
          </div>

          <div
            id={`ps-exp-panel-${activeId}`}
            className="ps-exp-stage"
            role="tabpanel"
            aria-labelledby={`ps-exp-tab-${activeId}`}
          >
            <div className="ps-exp-stage__copy" data-ps-reveal>
              <p className="ps-exp-stage__index" aria-hidden="true">
                {String(activeIndex + 1).padStart(2, '0')} / 05
              </p>
              <h3>{active.name}</h3>
              <p className="ps-exp-stage__audience">{active.audience}</p>
              <p>{text(`publicSite.experiences.items.${activeId}.text`)}</p>

              <div className="ps-exp-stage__controls">
                <button
                  type="button"
                  className="ps-exp-arrow"
                  aria-label={text('publicSite.experiences.prev')}
                  onClick={() => step(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="ps-exp-arrow"
                  aria-label={text('publicSite.experiences.next')}
                  onClick={() => step(1)}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="ps-exp-device">
          <ExperiencePhonePreview
            experience={active}
            demoLabel={text('publicSite.experiences.demoBadge')}
          />
        </div>

        <div className="ps-exp-mobile-detail" aria-live="polite">
          <p>{active.audience}</p>
        </div>

        <p className="ps-exp-note">{text('publicSite.experiences.note')}</p>
      </div>
    </section>
  );
}
