import React from 'react';
import { Link } from 'react-router-dom';
import PadbolBrandLogo from '../../../components/PadbolBrandLogo';
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
 * Siluetas continentales reconocibles (proyección plana del panel).
 * Contornos físicos únicamente — sin países ni fronteras.
 */
const CONTINENT_PATHS = [
  {
    id: 'north-america',
    d:
      'M28 95 C48 55 95 42 145 48 C185 52 225 72 245 105 C262 138 255 175 238 198 ' +
      'C225 218 200 228 175 232 C162 265 135 285 108 272 C85 282 62 255 55 220 ' +
      'C42 185 30 145 28 115 C26 105 28 98 28 95 Z ' +
      'M195 228 C215 242 210 275 188 282 C168 272 172 245 188 235 Z ' +
      'M72 275 C92 288 88 315 65 320 C48 308 52 282 72 275 Z ' +
      'M248 118 C268 108 285 122 278 142 C262 148 248 135 248 118 Z',
  },
  {
    id: 'south-america',
    d:
      'M155 278 C192 265 225 285 232 325 C238 370 218 415 192 448 C170 468 148 458 138 435 ' +
      'C122 400 115 355 122 318 C128 295 140 280 155 278 Z ' +
      'M175 448 C188 468 172 488 155 478 C148 462 162 452 175 448 Z',
  },
  {
    id: 'europe',
    d:
      'M268 78 C295 58 328 62 348 82 C365 98 362 122 348 138 C335 152 312 148 295 138 ' +
      'C278 125 265 102 268 78 Z ' +
      'M318 138 C338 145 348 168 335 182 C318 180 308 155 318 138 Z ' +
      'M278 148 C292 155 290 175 275 178 C265 165 268 152 278 148 Z ' +
      'M348 95 C365 88 378 98 372 115 C358 118 348 105 348 95 Z',
  },
  {
    id: 'africa',
    d:
      'M275 175 C315 158 355 175 368 210 C382 250 375 305 355 345 C335 385 300 398 272 382 ' +
      'C248 368 235 325 240 275 C244 225 255 185 275 175 Z ' +
      'M318 365 C338 380 332 408 308 408 C295 392 302 372 318 365 Z',
  },
  {
    id: 'asia',
    d:
      'M348 58 C395 38 440 48 468 85 C485 118 488 158 472 195 C452 232 418 245 388 232 ' +
      'C368 248 342 242 330 218 C312 180 308 130 322 95 C328 75 338 60 348 58 Z ' +
      'M400 232 C432 245 455 275 442 300 C412 308 388 272 400 232 Z ' +
      'M458 188 C478 200 485 228 468 245 C448 242 440 208 458 188 Z ' +
      'M372 92 C392 80 412 92 405 112 C388 115 370 105 372 92 Z',
  },
  {
    id: 'oceania',
    d:
      'M405 312 C442 298 472 318 475 348 C462 372 432 375 408 360 C392 342 392 322 405 312 Z ' +
      'M438 368 C462 375 472 398 455 410 C432 408 420 382 438 368 Z ' +
      'M470 335 C488 342 492 362 478 368 C465 360 460 340 470 335 Z ' +
      'M422 382 C435 388 432 402 420 398 C414 390 416 384 422 382 Z',
  },
];

/* Hubs de actividad sobre continentes (nodos de la red). */
const GLOBE_HUBS = [
  [70, 120], [120, 140], [170, 110], [210, 150], [100, 190], [150, 210],
  [170, 300], [195, 350], [160, 400], [185, 440],
  [290, 100], [320, 125], [300, 145], [340, 155],
  [295, 210], [325, 265], [285, 310], [310, 350],
  [380, 100], [420, 130], [455, 160], [400, 185], [445, 210], [468, 140],
  [450, 340], [465, 365], [470, 350], [430, 360],
];

/*
 * 42 arcos internacionales permanentes (rango 35–50).
 * Línea base siempre visible + pulso luminoso independiente.
 */
const GLOBE_ARCS = [
  { id: 'c01', d: 'M70,120 Q200,40 290,100' },
  { id: 'c02', d: 'M120,140 Q230,55 320,125' },
  { id: 'c03', d: 'M170,110 Q290,35 380,100' },
  { id: 'c04', d: 'M210,150 Q280,70 420,130' },
  { id: 'c05', d: 'M100,190 Q240,110 295,210' },
  { id: 'c06', d: 'M150,210 Q250,140 325,265' },
  { id: 'c07', d: 'M170,300 Q270,180 285,310' },
  { id: 'c08', d: 'M195,350 Q285,220 310,350' },
  { id: 'c09', d: 'M160,400 Q300,260 450,340' },
  { id: 'c10', d: 'M185,440 Q320,300 465,365' },
  { id: 'c11', d: 'M70,120 Q55,220 170,300' },
  { id: 'c12', d: 'M120,140 Q170,260 195,350' },
  { id: 'c13', d: 'M170,110 Q200,250 160,400' },
  { id: 'c14', d: 'M210,150 Q240,290 185,440' },
  { id: 'c15', d: 'M290,100 Q350,60 420,130' },
  { id: 'c16', d: 'M320,125 Q390,80 460,160' },
  { id: 'c17', d: 'M300,145 Q360,110 400,185' },
  { id: 'c18', d: 'M340,155 Q400,140 445,210' },
  { id: 'c19', d: 'M295,210 Q370,160 468,140' },
  { id: 'c20', d: 'M325,265 Q400,220 450,340' },
  { id: 'c21', d: 'M285,310 Q390,270 465,365' },
  { id: 'c22', d: 'M310,350 Q400,300 470,350' },
  { id: 'c23', d: 'M380,100 Q430,70 468,140' },
  { id: 'c24', d: 'M420,130 Q455,180 470,350' },
  { id: 'c25', d: 'M455,160 Q470,250 465,365' },
  { id: 'c26', d: 'M400,185 Q450,270 430,360' },
  { id: 'c27', d: 'M70,120 Q220,190 300,145' },
  { id: 'c28', d: 'M120,140 Q240,210 325,265' },
  { id: 'c29', d: 'M170,110 Q250,200 295,210' },
  { id: 'c30', d: 'M100,190 Q220,260 285,310' },
  { id: 'c31', d: 'M150,210 Q280,290 400,185' },
  { id: 'c32', d: 'M170,300 Q310,310 445,210' },
  { id: 'c33', d: 'M195,350 Q320,330 468,140' },
  { id: 'c34', d: 'M160,400 Q300,360 450,340' },
  { id: 'c35', d: 'M320,125 Q270,230 185,440' },
  { id: 'c36', d: 'M420,130 Q310,250 195,350' },
  { id: 'c37', d: 'M468,140 Q340,280 170,300' },
  { id: 'c38', d: 'M290,100 Q200,180 100,190' },
  { id: 'c39', d: 'M455,160 Q310,290 210,150' },
  { id: 'c40', d: 'M445,210 Q300,300 150,210' },
  { id: 'c41', d: 'M310,350 Q250,280 120,140' },
  { id: 'c42', d: 'M430,360 Q280,250 170,110' },
];

/*
 * Labels exteriores: funciones activas + capacidades futuras + 4 deportes.
 * priority: visibles en móvil; future: expansión comercial (menor intensidad).
 */
const ORBIT_LABELS = [
  { key: 'player', spot: 'lt', priority: true },
  { key: 'community', spot: 'ls1', priority: true },
  { key: 'ranking', spot: 'lm', priority: false },
  { key: 'padcoins', spot: 'ls2', priority: false },
  { key: 'tournaments', spot: 'lb', priority: false },
  { key: 'sponsor', spot: 'ft1', priority: false, future: true },
  { key: 'venue', spot: 'rt', priority: true },
  { key: 'scoreboard', spot: 'rm', priority: true },
  { key: 'bookings', spot: 'rs1', priority: false },
  { key: 'memberships', spot: 'rs2', priority: false },
  { key: 'ads', spot: 'ft2', priority: false, future: true },
  { key: 'eshop', spot: 'ft3', priority: false, future: true },
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
                animationDuration: `${(4.0 + (index % 6) * 0.5).toFixed(2)}s`,
                animationDelay: `${(-index * 0.38).toFixed(2)}s`,
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
  const comingSoon = text('publicSite.hero.ecosystem.comingSoon');

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
          <PadbolBrandLogo
            variant="on-dark-tight"
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
                <radialGradient id="ps-globe-sphere" cx="34%" cy="26%" r="78%">
                  <stop offset="0%" stopColor="#243552" />
                  <stop offset="42%" stopColor="#121c32" />
                  <stop offset="100%" stopColor="#050914" />
                </radialGradient>
                <radialGradient id="ps-globe-shade" cx="30%" cy="26%" r="74%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
                  <stop offset="40%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="78%" stopColor="rgba(0,0,0,0.35)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.62)" />
                </radialGradient>
                <linearGradient id="ps-globe-atm" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(148, 180, 220, 0.22)" />
                  <stop offset="55%" stopColor="rgba(148, 180, 220, 0)" />
                  <stop offset="100%" stopColor="rgba(0, 0, 0, 0.25)" />
                </linearGradient>
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
                stroke="rgba(148, 163, 184, 0.28)"
                strokeWidth="1.3"
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
                <circle cx="240" cy="240" r="210" fill="url(#ps-globe-atm)" opacity="0.55" />
              </g>

              <circle className="public-site-hero__globe-core-dot" cx="240" cy="228" r="5.5" />
            </svg>

            <div className="public-site-hero__eco-core">
              <strong>{text('publicSite.hero.ecosystemCore')}</strong>
              <span>{text('publicSite.hero.ecosystemCoreSub')}</span>
            </div>
          </div>

          {ORBIT_LABELS.map(({ key, spot, priority, future }) => (
            <div
              key={key}
              className={`public-site-hero__eco-node is-${spot} is-${key}${priority ? ' is-priority' : ' is-secondary-orbit'}${future ? ' is-future' : ''}`}
              title={future ? comingSoon : undefined}
            >
              <span className="public-site-hero__eco-dot" aria-hidden="true" />
              <span className="public-site-hero__eco-label">{text(`publicSite.hero.ecosystem.${key}`)}</span>
              {future ? (
                <span className="public-site-hero__eco-soon">{comingSoon}</span>
              ) : null}
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
