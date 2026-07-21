import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import {
  PUBLIC_SITE_EXPERIENCE_IDS,
  PUBLIC_SITE_EXPERIENCES,
} from '../../../constants/publicSiteExperiences';
import SportIcon from '../../../components/common/SportIcon';
import { SectionIntro, usePublicSiteText } from './SectionElements';
import { prefersReducedMotion } from '../useRevealOnScroll';

const AUTOPLAY_MS = 7000;

/**
 * Mini preview de marketing por experiencia: tokens reales de la app nativa
 * aplicados a una demo estática (sin providers, APIs ni pantallas productivas).
 * Si `experience.media.video` existe, el video real se reproduce como capa
 * sobre la demo dentro del mismo marco de teléfono; la demo queda debajo como
 * fallback (video no cargado, error o reduced motion), sin flashes ni huecos.
 */
function ExperiencePhonePreview({ experience, demoLabel, videoPlaying, videoFailed, onVideoError }) {
  const videoSrc = !videoFailed ? experience.media?.video || null : null;
  const videoRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);

  /* Cambio de experiencia: pausar el video anterior y reiniciar el nuevo
     desde 0 (load() con el src ya actualizado por React). El fade de opacidad
     evita pantallas negras: la demo con los colores del tema queda debajo. */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc) return;
    setVideoReady(false);
    el.pause();
    el.load();
  }, [videoSrc]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc) return;
    if (videoPlaying) {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      el.pause();
    }
  }, [videoPlaying, videoSrc, videoReady]);

  const vars = {
    '--exp-accent': experience.accent,
    '--exp-bg': experience.background,
    '--exp-card': experience.card,
    '--exp-text': experience.textPrimary,
    '--exp-text-2': experience.textSecondary,
    '--exp-border': experience.border,
  };

  return (
    <div className={`ps-exp-phone is-${experience.id}`} style={vars} aria-hidden="true">
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

        {videoSrc ? (
          <video
            ref={videoRef}
            className={`ps-exp-phone__video${videoReady ? ' is-ready' : ''}`}
            src={videoSrc}
            muted
            loop
            playsInline
            preload="metadata"
            tabIndex={-1}
            disablePictureInPicture
            onLoadedData={() => setVideoReady(true)}
            onError={() => onVideoError(experience.id)}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function ExperiencesSection() {
  const config = PUBLIC_SITE_SECTIONS.experiences;
  const text = usePublicSiteText();
  const [activeId, setActiveId] = useState(PUBLIC_SITE_EXPERIENCE_IDS[0]);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion());
  /* Sección visible (viewport + pestaña): gate de reproducción del video real. */
  const [mediaAllowed, setMediaAllowed] = useState(true);
  /* Videos que fallaron al cargar: la experiencia vuelve a la demo conceptual. */
  const [failedVideos, setFailedVideos] = useState({});
  const sectionRef = useRef(null);
  const interactedRef = useRef(false);
  const tablistRef = useRef(null);

  const active = PUBLIC_SITE_EXPERIENCES[activeId];
  const activeIndex = PUBLIC_SITE_EXPERIENCE_IDS.indexOf(activeId);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event) => setReducedMotion(Boolean(event.matches));
    setReducedMotion(query.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  const select = useCallback((id, { fromUser = true } = {}) => {
    if (fromUser) interactedRef.current = true;
    setActiveId(id);
  }, []);

  const step = useCallback(
    (delta, opts) => {
      const index = PUBLIC_SITE_EXPERIENCE_IDS.indexOf(activeId);
      const next =
        PUBLIC_SITE_EXPERIENCE_IDS[
          (index + delta + PUBLIC_SITE_EXPERIENCE_IDS.length) % PUBLIC_SITE_EXPERIENCE_IDS.length
        ];
      select(next, opts);
    },
    [activeId, select],
  );

  /* Autoplay lento: se detiene con interacción, pestaña oculta, fuera de viewport
     o reduced motion. */
  useEffect(() => {
    if (prefersReducedMotion() || paused || interactedRef.current) return undefined;

    let visible = !document.hidden;
    let inView = true;
    let timer = null;

    const restart = () => {
      if (timer) clearInterval(timer);
      timer = null;
      if (visible && inView && !interactedRef.current) {
        timer = setInterval(() => step(1, { fromUser: false }), AUTOPLAY_MS);
      }
    };

    const onVisibility = () => {
      visible = !document.hidden;
      restart();
    };
    document.addEventListener('visibilitychange', onVisibility);

    let observer;
    if (typeof IntersectionObserver !== 'undefined' && sectionRef.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          inView = Boolean(entry?.isIntersecting);
          restart();
        },
        { threshold: 0.25 },
      );
      observer.observe(sectionRef.current);
    }

    restart();
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, [paused, step]);

  /* Gate del video real: pausa cuando la sección sale del viewport o la
     pestaña queda oculta. Un solo observer/listener, limpiado al desmontar. */
  useEffect(() => {
    let inView = true;
    let visible = typeof document !== 'undefined' ? !document.hidden : true;
    const update = () => setMediaAllowed(visible && inView);

    const onVisibility = () => {
      visible = !document.hidden;
      update();
    };
    document.addEventListener('visibilitychange', onVisibility);

    let observer;
    if (typeof IntersectionObserver !== 'undefined' && sectionRef.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          inView = Boolean(entry?.isIntersecting);
          update();
        },
        { threshold: 0.2 },
      );
      observer.observe(sectionRef.current);
    }

    update();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, []);

  const onVideoError = useCallback((id) => {
    setFailedVideos((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

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
      ref={sectionRef}
      className={`ps-section ps-section--experiences is-exp-${activeId}`}
      aria-labelledby="ps-experiences-title"
      onPointerDown={() => {
        interactedRef.current = true;
        setPaused(true);
      }}
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
          <SectionIntro sectionKey="experiences" titleId="ps-experiences-title" />

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
            videoPlaying={mediaAllowed && !reducedMotion}
            videoFailed={Boolean(failedVideos[activeId])}
            onVideoError={onVideoError}
          />
        </div>

        <p className="ps-exp-note">{text('publicSite.experiences.note')}</p>
      </div>
    </section>
  );
}
