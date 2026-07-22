import React from 'react';
import { Link } from 'react-router-dom';
import SportIcon from '../../../components/common/SportIcon';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../../../constants/deportesCanchaSede';
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

/* Ancho de un panel del mapa (mundo completo). Se duplica para loop continuo. */
const MAP_W = 480;

/*
 * Siluetas continentales más reconocibles (proyección plana del panel).
 * Contornos físicos únicamente — sin países ni fronteras.
 * data-continent ancla tests y semántica SVG.
 */
const CONTINENT_PATHS = [
  {
    id: 'north-america',
    d:
      'M42 108 C62 78 98 62 138 68 C168 72 198 88 212 112 C228 138 222 168 208 188 ' +
      'C198 208 178 218 158 222 C148 248 128 262 108 252 C88 258 72 238 68 212 ' +
      'C58 188 48 158 42 132 C40 120 42 112 42 108 Z ' +
      'M168 218 C182 228 178 252 162 258 C148 252 150 232 160 224 Z ' +
      'M78 248 C92 258 88 278 72 282 C62 274 64 256 78 248 Z',
  },
  {
    id: 'south-america',
    d:
      'M138 268 C168 258 192 272 198 302 C202 338 188 372 168 398 C152 412 138 408 128 392 ' +
      'C118 368 112 338 118 308 C120 288 128 272 138 268 Z ' +
      'M152 398 C158 412 148 428 136 422 C132 410 142 402 152 398 Z',
  },
  {
    id: 'europe',
    d:
      'M258 92 C278 78 302 82 318 96 C332 108 328 128 318 138 C308 148 292 146 280 138 ' +
      'C268 128 258 112 258 92 Z ' +
      'M292 138 C308 142 318 158 308 168 C296 168 288 152 292 138 Z ' +
      'M268 148 C278 152 276 168 264 168 C258 158 260 150 268 148 Z',
  },
  {
    id: 'africa',
    d:
      'M268 168 C298 158 328 172 338 198 C348 228 342 268 328 298 C312 328 288 338 268 328 ' +
      'C248 318 238 288 242 252 C244 218 252 178 268 168 Z ' +
      'M298 318 C312 328 308 348 292 348 C284 338 288 322 298 318 Z',
  },
  {
    id: 'asia',
    d:
      'M328 72 C368 58 418 68 452 98 C468 122 472 158 458 188 C442 218 408 228 382 218 ' +
      'C362 232 338 228 328 208 C312 178 308 138 318 108 C320 92 324 78 328 72 Z ' +
      'M388 218 C412 228 432 252 422 272 C398 278 378 252 388 218 Z ' +
      'M438 188 C458 198 468 218 458 232 C442 232 432 208 438 188 Z',
  },
  {
    id: 'oceania',
    d:
      'M398 298 C428 288 458 302 462 328 C452 348 428 352 408 342 C396 328 394 308 398 298 Z ' +
      'M428 348 C448 352 458 372 448 382 C428 382 418 362 428 348 Z ' +
      'M462 318 C478 322 482 338 472 342 C462 338 458 324 462 318 Z',
  },
];

/* Hubs de actividad sobre continentes (nodos de la red). */
const GLOBE_HUBS = [
  [88, 128], [128, 148], [168, 118], [198, 158], [118, 198],
  [158, 288], [178, 328], [148, 368], [168, 398],
  [278, 108], [302, 128], [288, 148],
  [288, 198], [312, 248], [278, 288], [298, 318],
  [358, 108], [398, 138], [428, 168], [378, 188], [418, 208], [448, 148],
  [418, 318], [438, 348], [452, 328],
];

/*
 * 36 arcos internacionales permanentes (curvas Q).
 * Línea base siempre visible + pulso luminoso independiente.
 */
const GLOBE_ARCS = [
  { id: 'c01', d: 'M88,128 Q200,48 278,108' },
  { id: 'c02', d: 'M128,148 Q230,70 302,128' },
  { id: 'c03', d: 'M168,118 Q280,40 358,108' },
  { id: 'c04', d: 'M198,158 Q260,90 398,138' },
  { id: 'c05', d: 'M118,198 Q240,120 288,198' },
  { id: 'c06', d: 'M158,288 Q250,170 312,248' },
  { id: 'c07', d: 'M178,328 Q270,210 278,288' },
  { id: 'c08', d: 'M148,368 Q280,250 298,318' },
  { id: 'c09', d: 'M168,398 Q300,280 418,318' },
  { id: 'c10', d: 'M88,128 Q70,220 158,288' },
  { id: 'c11', d: 'M128,148 Q180,250 178,328' },
  { id: 'c12', d: 'M168,118 Q200,240 148,368' },
  { id: 'c13', d: 'M198,158 Q240,280 168,398' },
  { id: 'c14', d: 'M278,108 Q340,70 398,138' },
  { id: 'c15', d: 'M302,128 Q370,90 428,168' },
  { id: 'c16', d: 'M288,148 Q340,120 378,188' },
  { id: 'c17', d: 'M288,198 Q350,150 418,208' },
  { id: 'c18', d: 'M312,248 Q380,200 448,148' },
  { id: 'c19', d: 'M278,288 Q360,250 418,318' },
  { id: 'c20', d: 'M298,318 Q380,280 438,348' },
  { id: 'c21', d: 'M358,108 Q410,90 448,148' },
  { id: 'c22', d: 'M398,138 Q440,180 452,328' },
  { id: 'c23', d: 'M428,168 Q450,240 438,348' },
  { id: 'c24', d: 'M378,188 Q420,260 418,318' },
  { id: 'c25', d: 'M88,128 Q220,200 288,148' },
  { id: 'c26', d: 'M128,148 Q240,220 312,248' },
  { id: 'c27', d: 'M168,118 Q250,200 288,198' },
  { id: 'c28', d: 'M118,198 Q220,260 278,288' },
  { id: 'c29', d: 'M158,288 Q280,300 378,188' },
  { id: 'c30', d: 'M178,328 Q300,320 418,208' },
  { id: 'c31', d: 'M148,368 Q290,340 438,348' },
  { id: 'c32', d: 'M302,128 Q280,220 168,398' },
  { id: 'c33', d: 'M398,138 Q320,240 178,328' },
  { id: 'c34', d: 'M448,148 Q340,260 158,288' },
  { id: 'c35', d: 'M278,108 Q200,180 118,198' },
  { id: 'c36', d: 'M428,168 Q300,280 198,158' },
];

/*
 * Labels exteriores: funciones + comunidad/ops + 4 deportes.
 * priority: visibles en móvil; secondary: ocultos visualmente en móvil (siguen en DOM/aria).
 */
const ORBIT_LABELS = [
  { key: 'player', spot: 'lt', priority: true },
  { key: 'community', spot: 'ls1', priority: true },
  { key: 'ranking', spot: 'lm', priority: false },
  { key: 'padcoins', spot: 'ls2', priority: false },
  { key: 'tournaments', spot: 'lb', priority: false },
  { key: 'venue', spot: 'rt', priority: true },
  { key: 'scoreboard', spot: 'rm', priority: true },
  { key: 'bookings', spot: 'rs1', priority: false },
  { key: 'memberships', spot: 'rs2', priority: false },
];

const ORBIT_SPORTS = [
  { key: 'padbol', spot: 'sb1', priority: true },
  { key: 'padel', spot: 'sb2', priority: false },
  { key: 'pickleball', spot: 'sb3', priority: false },
  { key: 'tenis', spot: 'sb4', priority: false },
];

/** Un panel del mapa mundi (continentes + red). Se renderiza dos veces. */
function GlobeMapPanel({ offsetX = 0 }) {
  return (
    <g transform={offsetX ? `translate(${offsetX},0)` : undefined}>
      <g className="public-site-hero__globe-land">
        {CONTINENT_PATHS.map(({ id, d }) => (
          <path key={id} data-continent={id} d={d} />
        ))}
      </g>

      <g className="public-site-hero__globe-arcs">
        {GLOBE_ARCS.map(({ id, d }, index) => (
          <g key={id} className={`is-${id}`}>
            <path className="is-base" d={d} pathLength={1} />
            <path
              className={`is-pulse${index % 3 === 0 ? ' is-pulse--red' : index % 3 === 1 ? ' is-pulse--blue' : ' is-pulse--white'}`}
              d={d}
              pathLength={1}
              style={{
                animationDuration: `${(4.2 + (index % 5) * 0.55).toFixed(2)}s`,
                animationDelay: `${(-index * 0.42).toFixed(2)}s`,
              }}
            />
          </g>
        ))}
      </g>

      <g className="public-site-hero__globe-hubs">
        {GLOBE_HUBS.map(([cx, cy], index) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={index % 5 === 0 ? 3.2 : 2.1}
            className={index % 5 === 0 ? 'is-major' : undefined}
            style={{ animationDelay: `${(-index * 0.35).toFixed(2)}s` }}
          />
        ))}
      </g>
    </g>
  );
}

export default function HeroSection() {
  const { t } = useSafeTranslation();
  const text = (key) => t(key, ES_FALLBACKS[key] || '');
  const sportLabel = (key) =>
    DEPORTES_CANCHA_SEDE_OPTIONS.find((item) => item.key === key)?.label || key;

  return (
    <section className="public-site-hero" aria-labelledby="public-site-hero-title">
      <div className="public-site-hero__backdrop" aria-hidden="true">
        <span className="public-site-hero__grid-lines" />
        <span className="public-site-hero__glow public-site-hero__glow--red" />
        <span className="public-site-hero__glow public-site-hero__glow--blue" />
        <span className="public-site-hero__court-line" />
      </div>

      <div className="public-site__shell public-site-hero__grid">
        <div className="public-site-hero__copy" data-ps-reveal>
          <p className="public-site-hero__eyebrow">{text('publicSite.hero.eyebrow')}</p>

          <p className="public-site-hero__brand" aria-label={text('publicSite.hero.title')}>
            <span className="public-site-hero__brand-padbol">Padbol</span>
            {' '}
            <span className="public-site-hero__brand-match">Match</span>
          </p>

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

        <div
          className="public-site-hero__ecosystem"
          role="img"
          aria-label={text('publicSite.hero.ecosystemAria')}
          data-ps-reveal
          data-ps-reveal-order="2"
        >
          <div className="public-site-hero__globe-stage">
            <svg
              className="public-site-hero__globe"
              viewBox="0 0 480 480"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <radialGradient id="ps-globe-sphere" cx="36%" cy="28%" r="78%">
                  <stop offset="0%" stopColor="#1a2740" />
                  <stop offset="52%" stopColor="#0b1326" />
                  <stop offset="100%" stopColor="#050914" />
                </radialGradient>
                <radialGradient id="ps-globe-shade" cx="32%" cy="28%" r="72%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
                  <stop offset="45%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
                </radialGradient>
                <clipPath id="ps-globe-clip">
                  <circle cx="240" cy="240" r="210" />
                </clipPath>
              </defs>

              <circle className="public-site-hero__globe-halo" cx="240" cy="240" r="222" />
              <circle
                cx="240"
                cy="240"
                r="210"
                fill="url(#ps-globe-sphere)"
                stroke="rgba(148, 163, 184, 0.32)"
                strokeWidth="1.4"
              />

              <g clipPath="url(#ps-globe-clip)">
                <g className="public-site-hero__globe-grid">
                  <ellipse cx="240" cy="240" rx="70" ry="208" />
                  <ellipse cx="240" cy="240" rx="140" ry="208" />
                  <ellipse cx="240" cy="120" rx="168" ry="18" />
                  <ellipse cx="240" cy="180" rx="200" ry="20" />
                  <ellipse cx="240" cy="240" rx="210" ry="22" />
                  <ellipse cx="240" cy="300" rx="200" ry="20" />
                  <ellipse cx="240" cy="360" rx="168" ry="18" />
                </g>

                <g className="public-site-hero__globe-spin">
                  <GlobeMapPanel />
                  <GlobeMapPanel offsetX={MAP_W} />
                </g>

                <circle cx="240" cy="240" r="210" fill="url(#ps-globe-shade)" />
              </g>

              <circle className="public-site-hero__globe-core-dot" cx="240" cy="228" r="6.5" />
            </svg>

            <div className="public-site-hero__eco-core">
              <strong>{text('publicSite.hero.ecosystemCore')}</strong>
              <span>{text('publicSite.hero.ecosystemCoreSub')}</span>
            </div>
          </div>

          {ORBIT_LABELS.map(({ key, spot, priority }) => (
            <div
              key={key}
              className={`public-site-hero__eco-node is-${spot} is-${key}${priority ? ' is-priority' : ' is-secondary-orbit'}`}
            >
              <span className="public-site-hero__eco-dot" aria-hidden="true" />
              {text(`publicSite.hero.ecosystem.${key}`)}
            </div>
          ))}

          {ORBIT_SPORTS.map(({ key, spot, priority }) => (
            <div
              key={key}
              className={`public-site-hero__eco-node is-sport is-${spot} is-${key}${priority ? ' is-priority' : ' is-secondary-orbit'}`}
            >
              <SportIcon deporte={key} size={14} color="currentColor" />
              <span>{sportLabel(key)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
