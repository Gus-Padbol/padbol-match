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
 * Siluetas reconocibles (simplificadas) en proyección plana del panel.
 * data-continent se usa en tests y como ancla semántica del SVG.
 */
const CONTINENT_PATHS = [
  {
    id: 'north-america',
    d: 'M58 118 C78 92 118 78 158 88 C188 96 208 118 202 148 C196 178 178 198 152 208 C138 228 118 232 98 218 C78 228 62 208 58 178 C52 152 48 132 58 118 Z M168 198 C178 208 172 228 158 232 C148 228 150 212 158 204 Z',
  },
  {
    id: 'south-america',
    d: 'M142 242 C168 236 186 258 182 292 C178 328 164 358 148 378 C132 368 122 338 126 302 C128 272 132 248 142 242 Z',
  },
  {
    id: 'europe',
    d: 'M268 98 C292 88 318 96 326 118 C320 138 298 146 278 140 C266 128 260 108 268 98 Z M302 128 C312 132 318 148 308 156 C298 152 296 136 302 128 Z',
  },
  {
    id: 'africa',
    d: 'M274 158 C308 150 328 178 324 222 C320 268 302 304 278 318 C256 306 248 268 252 224 C254 190 262 164 274 158 Z',
  },
  {
    id: 'asia',
    d: 'M330 88 C372 72 422 88 448 122 C460 158 448 198 418 218 C392 232 362 220 346 188 C332 158 322 118 330 88 Z M400 210 C422 218 438 242 428 262 C408 268 392 248 400 210 Z',
  },
  {
    id: 'oceania',
    d: 'M402 292 C428 284 452 302 448 326 C432 342 408 338 396 318 C396 304 400 296 402 292 Z M428 338 C440 342 448 356 438 364 C426 362 422 348 428 338 Z',
  },
];

/* Hubs de actividad sobre continentes (nodos de la red). */
const GLOBE_HUBS = [
  [110, 140], [150, 160], [175, 125], [130, 190],
  [155, 280], [148, 330], [160, 360],
  [290, 115], [310, 135], [280, 145],
  [290, 200], [300, 250], [275, 290],
  [360, 120], [400, 150], [380, 185], [420, 200], [350, 170],
  [420, 310], [435, 340],
];

/*
 * 24 arcos internacionales (curvas). Base continua + pulso luminoso
 * que recorre el trazo (stroke-dashoffset).
 */
const GLOBE_ARCS = [
  { id: 'c01', d: 'M110,140 Q200,60 290,115' },
  { id: 'c02', d: 'M150,160 Q240,100 310,135' },
  { id: 'c03', d: 'M175,125 Q280,40 360,120' },
  { id: 'c04', d: 'M130,190 Q250,140 290,200' },
  { id: 'c05', d: 'M155,280 Q250,180 300,250' },
  { id: 'c06', d: 'M148,330 Q260,220 275,290' },
  { id: 'c07', d: 'M160,360 Q300,280 420,310' },
  { id: 'c08', d: 'M110,140 Q80,240 155,280' },
  { id: 'c09', d: 'M150,160 Q200,260 148,330' },
  { id: 'c10', d: 'M290,115 Q340,80 400,150' },
  { id: 'c11', d: 'M310,135 Q360,100 420,200' },
  { id: 'c12', d: 'M280,145 Q320,160 350,170' },
  { id: 'c13', d: 'M290,200 Q340,160 380,185' },
  { id: 'c14', d: 'M300,250 Q360,220 420,200' },
  { id: 'c15', d: 'M275,290 Q350,260 420,310' },
  { id: 'c16', d: 'M360,120 Q400,90 448,122' },
  { id: 'c17', d: 'M400,150 Q430,180 435,340' },
  { id: 'c18', d: 'M175,125 Q240,200 300,250' },
  { id: 'c19', d: 'M130,190 Q220,250 290,200' },
  { id: 'c20', d: 'M155,280 Q260,300 350,170' },
  { id: 'c21', d: 'M148,330 Q280,340 400,310' },
  { id: 'c22', d: 'M110,140 Q200,200 280,145' },
  { id: 'c23', d: 'M310,135 Q280,220 160,360' },
  { id: 'c24', d: 'M420,200 Q340,280 275,290' },
];

/* Labels funcionales fuera de la esfera (izquierda / derecha). */
const ORBIT_FUNCTIONAL = [
  { key: 'player', spot: 'lt' },
  { key: 'ranking', spot: 'lm' },
  { key: 'padcoins', spot: 'lb' },
  { key: 'venue', spot: 'rt' },
  { key: 'scoreboard', spot: 'rm' },
];

const ORBIT_SPORTS = [
  { key: 'padbol', spot: 'ls1' },
  { key: 'padel', spot: 'ls2' },
  { key: 'pickleball', spot: 'rs1' },
  { key: 'tenis', spot: 'rs2' },
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
            <path className="is-base" d={d} />
            <path
              className={`is-pulse${index % 3 === 0 ? ' is-pulse--red' : index % 3 === 1 ? ' is-pulse--blue' : ' is-pulse--white'}`}
              d={d}
              style={{ animationDelay: `${(-index * 0.55).toFixed(2)}s` }}
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
      {/* Composición abstracta CSS: trama, luces y líneas (solo decorativa) */}
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

          <p className="public-site-hero__eyebrow">{text('publicSite.hero.eyebrow')}</p>

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

        {/* Globo: mapa en bucle bajo máscara esférica + labels exteriores fijos */}
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
                {/* Paralelos/meridianos fijos (profundidad); el mapa gira debajo. */}
                <g className="public-site-hero__globe-grid">
                  <ellipse cx="240" cy="240" rx="70" ry="208" />
                  <ellipse cx="240" cy="240" rx="140" ry="208" />
                  <ellipse cx="240" cy="120" rx="168" ry="18" />
                  <ellipse cx="240" cy="180" rx="200" ry="20" />
                  <ellipse cx="240" cy="240" rx="210" ry="22" />
                  <ellipse cx="240" cy="300" rx="200" ry="20" />
                  <ellipse cx="240" cy="360" rx="168" ry="18" />
                </g>

                {/* Mapa duplicado: traslación horizontal = rotación del globo. */}
                <g className="public-site-hero__globe-spin">
                  <GlobeMapPanel />
                  <GlobeMapPanel offsetX={MAP_W} />
                </g>

                <circle cx="240" cy="240" r="210" fill="url(#ps-globe-shade)" />
              </g>

              {/* Núcleo Partido (fijo, no gira con el mapa). */}
              <circle className="public-site-hero__globe-core-dot" cx="240" cy="228" r="8" />
            </svg>

            <div className="public-site-hero__eco-core">
              <strong>{text('publicSite.hero.ecosystemCore')}</strong>
              <span>{text('publicSite.hero.ecosystemCoreSub')}</span>
            </div>
          </div>

          {/* Labels fuera de la esfera: funciones + 4 deportes soportados. */}
          {ORBIT_FUNCTIONAL.map(({ key, spot }) => (
            <div key={key} className={`public-site-hero__eco-node is-${spot} is-${key}`}>
              <span className="public-site-hero__eco-dot" aria-hidden="true" />
              {text(`publicSite.hero.ecosystem.${key}`)}
            </div>
          ))}

          {ORBIT_SPORTS.map(({ key, spot }) => (
            <div key={key} className={`public-site-hero__eco-node is-sport is-${spot} is-${key}`}>
              <SportIcon deporte={key} size={14} color="currentColor" />
              <span>{sportLabel(key)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
