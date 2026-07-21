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

/*
 * Globo conceptual del Hero (SVG inline + CSS, sin librerías ni imágenes).
 * Nodos de la red global sobre la esfera (coordenadas en el viewBox 480x480,
 * esfera centrada en 240,240 con radio 210). Cada nodo tiene su chip HTML
 * con el label real (mismas claves i18n de siempre).
 */
const GLOBE_NODES = [
  { key: 'player', className: 'is-player', cx: 152, cy: 148 },
  { key: 'venue', className: 'is-venue', cx: 322, cy: 128 },
  { key: 'scoreboard', className: 'is-scoreboard', cx: 352, cy: 262 },
  { key: 'ranking', className: 'is-ranking', cx: 168, cy: 318 },
  { key: 'padcoins', className: 'is-padcoins', cx: 262, cy: 348 },
];

/* Arcos de conexión: del núcleo (Partido, centro del globo) a cada nodo,
   más dos arcos norte/sur entre regiones para sensación de red. */
const GLOBE_ARCS = [
  { id: 'a1', d: 'M240,232 Q206,152 152,148' },
  { id: 'a2', d: 'M240,232 Q298,152 322,128' },
  { id: 'a3', d: 'M240,232 Q318,238 352,262' },
  { id: 'a4', d: 'M240,232 Q192,296 168,318' },
  { id: 'a5', d: 'M240,232 Q258,298 262,348' },
  { id: 'a6', d: 'M152,148 Q240,58 322,128' },
  { id: 'a7', d: 'M168,318 Q262,398 352,262' },
];

/* Masas continentales sugeridas (puntos abstractos, sin cartografía real). */
const GLOBE_LAND_DOTS = [
  /* América del Norte */
  [128, 132, 5], [148, 118, 4], [170, 128, 5], [188, 142, 4], [152, 150, 6],
  [132, 162, 4], [168, 168, 5], [190, 170, 3], [148, 184, 4],
  /* América del Sur */
  [172, 268, 4], [186, 288, 5], [172, 310, 5], [186, 330, 4], [166, 344, 3],
  /* Europa */
  [300, 118, 4], [318, 108, 3], [332, 122, 4], [312, 136, 5], [296, 142, 3],
  /* África */
  [292, 190, 4], [308, 210, 5], [296, 236, 5], [282, 262, 5], [292, 288, 4],
  [278, 310, 3],
  /* Asia */
  [346, 148, 5], [366, 162, 4], [382, 186, 4], [358, 196, 5], [340, 214, 4],
  [372, 226, 3], [352, 246, 4],
  /* Oceanía */
  [376, 296, 4], [392, 312, 3], [368, 322, 3],
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

        {/* Globo terráqueo conceptual: red global de la plataforma
            (SVG inline + CSS, decorativo, sin imágenes ni librerías) */}
        <div
          className="public-site-hero__ecosystem"
          role="img"
          aria-label={text('publicSite.hero.ecosystemAria')}
          data-ps-reveal
          data-ps-reveal-order="2"
        >
          <svg
            className="public-site-hero__globe"
            viewBox="0 0 480 480"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <radialGradient id="ps-globe-sphere" cx="38%" cy="30%" r="78%">
                <stop offset="0%" stopColor="#182741" />
                <stop offset="55%" stopColor="#0b1226" />
                <stop offset="100%" stopColor="#060a16" />
              </radialGradient>
              <clipPath id="ps-globe-clip">
                <circle cx="240" cy="240" r="210" />
              </clipPath>
            </defs>

            {/* halo exterior + esfera */}
            <circle className="public-site-hero__globe-halo" cx="240" cy="240" r="220" />
            <circle
              cx="240"
              cy="240"
              r="210"
              fill="url(#ps-globe-sphere)"
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth="1.5"
            />

            <g clipPath="url(#ps-globe-clip)">
              {/* grilla: meridianos y paralelos con rotación lentísima */}
              <g className="public-site-hero__globe-grid">
                <ellipse cx="240" cy="240" rx="205" ry="210" />
                <ellipse cx="240" cy="240" rx="150" ry="210" />
                <ellipse cx="240" cy="240" rx="92" ry="210" />
                <ellipse cx="240" cy="240" rx="30" ry="210" />
                <ellipse cx="240" cy="100" rx="156" ry="16" />
                <ellipse cx="240" cy="170" rx="198" ry="18" />
                <ellipse cx="240" cy="240" rx="210" ry="20" />
                <ellipse cx="240" cy="310" rx="198" ry="18" />
                <ellipse cx="240" cy="380" rx="156" ry="16" />
              </g>

              {/* continentes sugeridos (masas abstractas de puntos) */}
              <g className="public-site-hero__globe-land">
                {GLOBE_LAND_DOTS.map(([x, y, r]) => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
                ))}
              </g>
            </g>

            {/* arcos de conexión que se iluminan por turnos */}
            <g className="public-site-hero__globe-arcs">
              {GLOBE_ARCS.map(({ id, d }) => (
                <path key={id} className={`is-${id}`} d={d} />
              ))}
            </g>

            {/* nodos luminosos que respiran */}
            <g className="public-site-hero__globe-nodes">
              <circle className="is-core" cx="240" cy="232" r="9" />
              {GLOBE_NODES.map(({ key, cx, cy }) => (
                <circle key={key} cx={cx} cy={cy} r="6" />
              ))}
            </g>
          </svg>

          {/* núcleo: Partido, integrado al globo como nodo central */}
          <div className="public-site-hero__eco-core">
            <strong>{text('publicSite.hero.ecosystemCore')}</strong>
            <span>{text('publicSite.hero.ecosystemCoreSub')}</span>
          </div>

          {/* chips flotantes anclados a sus nodos del globo */}
          {GLOBE_NODES.map(({ key, className }) => (
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
