import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { PUBLIC_SITE_CTA } from '../../../constants/publicSiteLinks';
import { usePublicSiteText } from '../publicSiteI18n';

export { usePublicSiteText };

const ASSET_ROOT = '/media/public-site/jero';

const PLAYER_ICONS = {
  find: 'search.svg',
  create: 'add.svg',
  join: 'ball.svg',
  book: 'calendar.svg',
  compete: 'trophy.svg',
  evolve: 'progress.svg',
  community: 'community.svg',
};

const VENUE_MEDIA = {
  occupy: 'real-occupancy.jpg',
  activate: 'active-players.jpg',
  scoreboard: 'active-scoreboard.jpg',
  continuity: 'continuity.jpg',
};

const CONTINUITY_ICONS = {
  openMatches: 'community-small.svg',
  tournaments: 'trophy.svg',
  results: 'results.svg',
  ranking: 'ranking.svg',
  padcoins: 'padcoins.svg',
  memberships: 'memberships.svg',
  community: 'community-small.svg',
};

const EXPANSION_ICONS = {
  sponsor: 'sponsor.svg',
  ads: 'advertising.svg',
  eshop: 'eshop.svg',
};

const OPEN_MATCH_DEMO_STATES = [
  { filled: 2, revenue: '$12.000', status: 'Buscando 2 jugadores', note: '50% de ocupación' },
  { filled: 3, revenue: '$18.000', status: 'Un jugador confirmó', note: '75% de ocupación' },
  { filled: 4, revenue: '$24.000', status: 'Partido confirmado', note: '100% de ocupación' },
];

const CONTINUITY_DETAILS = {
  openMatches: {
    lead: 'Convertí una intención de jugar en un encuentro concreto, sin depender de grupos externos ni cadenas de mensajes.',
    points: ['Publicás sede, horario, nivel y cupos.', 'Los jugadores cercanos piden lugar desde la app.', 'La sede ve actividad real antes de que empiece el partido.'],
  },
  tournaments: {
    lead: 'Organizá competencias con un calendario claro y una experiencia que acompaña al jugador desde la inscripción hasta el cierre.',
    points: ['Inscripciones, cupos y categorías en un solo lugar.', 'Llaves, zonas o formatos según el torneo.', 'Cada fecha sostiene participación y movimiento en la sede.'],
  },
  results: {
    lead: 'El juego no termina al salir de la cancha: el resultado queda asociado al encuentro y alimenta el recorrido deportivo.',
    points: ['Registro simple de marcadores y asistencia.', 'Historial consultable por jugador y competencia.', 'Base confiable para ranking, estadísticas y logros.'],
  },
  ranking: {
    lead: 'Una evolución entendible, ligada a los partidos que realmente se juegan y a la categoría o alcance de cada competencia.',
    points: ['Posiciones por club, categoría, nacional o FIPA.', 'Subís o bajás a partir de resultados validados.', 'Podés reconocer una clasificación externa como punto de partida.'],
  },
  padcoins: {
    lead: 'La participación activa puede transformarse en reconocimiento dentro del ecosistema, con reglas visibles para todos.',
    points: ['Se acreditan por acciones y dinámicas definidas.', 'Sirven para beneficios, canjes o experiencias.', 'La sede puede premiar constancia y comunidad.'],
  },
  memberships: {
    lead: 'Un vínculo directo entre cada jugador y su sede, pensado para volver más simple la relación cotidiana.',
    points: ['Beneficios y propuestas pensadas para cada comunidad.', 'Acceso ordenado a actividades y novedades.', 'Más recurrencia sin perder el control de la sede.'],
  },
  community: {
    lead: 'Un espacio propio para que el juego siga conversándose: publicaciones, comentarios, videos y conexiones entre jugadores.',
    points: ['Compartí jugadas, fotos y novedades de la comunidad.', 'Seguís jugadores, sedes y conversaciones relevantes.', 'El contenido ayuda a que cada experiencia tenga continuidad.'],
  },
};

export function SectionShell({ id, className = '', titleId, children }) {
  return (
    <section id={id} className={`ps-section ${className}`.trim()} aria-labelledby={titleId} data-ps-reveal>
      <div className="public-site__shell">{children}</div>
    </section>
  );
}

/** Qué es Padbol Match */
export function WhatIsSection() {
  const text = usePublicSiteText();
  const id = PUBLIC_SITE_SECTIONS.whatIs.id;
  return (
    <SectionShell id={id} className="ps-section--what" titleId="ps-what-title">
      <div className="ps-what__brand" aria-hidden="true">
        <img src={`${ASSET_ROOT}/match.svg`} alt="" />
      </div>
      <h2 id="ps-what-title">{text('publicSite.whatIs.title')}</h2>
      <p className="ps-lead">{text('publicSite.whatIs.text')}</p>
    </SectionShell>
  );
}

/** Recorrido jugadores */
export function PlayerPathSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.playerPath;
  return (
    <SectionShell id={config.id} className="ps-section--paths ps-section--players" titleId="ps-players-title">
      <h2 id="ps-players-title">{text('publicSite.playerPath.title')}</h2>
      <p className="ps-lead">{text('publicSite.playerPath.text')}</p>
      <ul className="ps-paths__list">
        {config.items.map(({ key }) => (
          <li key={key}>
            <img src={`${ASSET_ROOT}/${PLAYER_ICONS[key]}`} alt="" aria-hidden="true" />
            <div>
              <strong>{text(`publicSite.playerPath.items.${key}.title`)}</strong>
              <span>{text(`publicSite.playerPath.items.${key}.text`)}</span>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function OpenMatchMockup({ text }) {
  const [demoIndex, setDemoIndex] = useState(0);
  const demo = OPEN_MATCH_DEMO_STATES[demoIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDemoIndex((current) => (current + 1) % OPEN_MATCH_DEMO_STATES.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="ps-match" role="img" aria-label={text('publicSite.communityMatches.mockAria')}>
      <div className="ps-match__phone">
        <header className="ps-match__bar">
          <span>{text('publicSite.communityMatches.mockBadge')}</span>
          <strong>{text('publicSite.communityMatches.mockTitle')}</strong>
        </header>
        <div className="ps-match__card">
          <p className="ps-match__meta">{text('publicSite.communityMatches.mockMeta')}</p>
          <p className="ps-match__level">{text('publicSite.communityMatches.mockLevel')}</p>
          <ul className="ps-match__slots" aria-hidden="true">
            {[0, 1, 2, 3].map((slot) => (
              <li key={slot} className={slot < demo.filled ? 'is-filled' : 'is-open'} />
            ))}
          </ul>
          <p className="ps-match__slots-label" aria-live="polite">
            {demo.filled} de 4 lugares confirmados
          </p>
          <div className="ps-match__metrics" aria-label="Simulación de actividad estimada">
            <div>
              <span>Ocupación</span>
              <strong>{demo.note}</strong>
            </div>
            <div>
              <span>Recaudación estimada</span>
              <strong className="ps-match__revenue">{demo.revenue}</strong>
            </div>
          </div>
          <p className="ps-match__status" aria-live="polite"><i />{demo.status}</p>
          <span className="ps-match__cta">{text('publicSite.communityMatches.mockAction')}</span>
        </div>
      </div>
    </div>
  );
}

/** Comunidad y partidos abiertos */
export function CommunityMatchesSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.communityMatches;
  return (
    <SectionShell
      id={config.id}
      className="ps-section--community"
      titleId="ps-community-matches-title"
    >
      <div className="ps-community__grid">
        <div className="ps-community__copy">
          <h2 id="ps-community-matches-title">{text('publicSite.communityMatches.title')}</h2>
          <p className="ps-lead">{text('publicSite.communityMatches.text')}</p>
          <ol className="ps-flow-steps">
            {config.steps.map(({ key }, index) => (
              <li key={key}>
                <span className="ps-flow-steps__num" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <strong>{text(`publicSite.communityMatches.steps.${key}.title`)}</strong>
                  <span>{text(`publicSite.communityMatches.steps.${key}.text`)}</span>
                </div>
              </li>
            ))}
          </ol>
          <Link to={PUBLIC_SITE_CTA.play} className="ps-btn ps-btn--secondary">
            {text('publicSite.communityMatches.ctaPlay')}
          </Link>
        </div>
        <OpenMatchMockup text={text} />
      </div>
    </SectionShell>
  );
}

/** Recorrido sedes */
export function VenuePathSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.venuePath;
  return (
    <SectionShell id={config.id} className="ps-section--paths ps-section--venues" titleId="ps-venues-title">
      <h2 id="ps-venues-title">{text('publicSite.venuePath.title')}</h2>
      <p className="ps-lead">{text('publicSite.venuePath.text')}</p>
      <ul className="ps-venue-cards">
        {config.items.map(({ key }) => (
          <li key={key}>
            <img
              src={`${ASSET_ROOT}/${VENUE_MEDIA[key]}`}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div>
              <strong>{text(`publicSite.venuePath.items.${key}.title`)}</strong>
              <span>{text(`publicSite.venuePath.items.${key}.text`)}</span>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/** Continuidad: conexión entre bloques */
export function ContinuitySection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.continuity;
  const [activeKey, setActiveKey] = useState(null);

  const closeDetail = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setActiveKey(null);
  };

  return (
    <SectionShell id={config.id} className="ps-section--continuity" titleId="ps-continuity-title">
      <h2 id="ps-continuity-title">{text('publicSite.continuity.title')}</h2>
      <ul className="ps-chip-row">
        {config.items.map(({ key }) => (
          <li
            key={key}
            className={`ps-chip-wrap${activeKey === key ? ' is-active' : ''}`}
            onMouseEnter={() => setActiveKey(key)}
            onMouseLeave={closeDetail}
            onFocus={() => setActiveKey(key)}
            onBlur={closeDetail}
          >
            <button
              type="button"
              className="ps-chip"
              aria-expanded={activeKey === key}
              aria-controls={`ps-continuity-detail-${key}`}
              onClick={() => setActiveKey((current) => (current === key ? null : key))}
            >
              <img src={`${ASSET_ROOT}/${CONTINUITY_ICONS[key]}`} alt="" aria-hidden="true" />
              <div>
                <strong>{text(`publicSite.continuity.items.${key}.title`)}</strong>
                <span>{text(`publicSite.continuity.items.${key}.text`)}</span>
              </div>
            </button>
            {activeKey === key && (
              <aside id={`ps-continuity-detail-${key}`} className="ps-chip__detail" role="status">
                <span className="ps-chip__eyebrow">Padbol Match</span>
                <strong>{text(`publicSite.continuity.items.${key}.title`)}</strong>
                <p>{CONTINUITY_DETAILS[key]?.lead || text(`publicSite.continuity.items.${key}.text`)}</p>
                {CONTINUITY_DETAILS[key]?.points && (
                  <ul>
                    {CONTINUITY_DETAILS[key].points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                )}
              </aside>
            )}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function ScoreboardPreview({ text }) {
  return (
    <div className="ps-sb" role="img" aria-label={text('publicSite.smartScoreboard.demoAria')}>
      <div className="ps-sb__frame">
        <header className="ps-sb__header">
          <span className="ps-sb__live" aria-hidden="true" />
          {text('publicSite.smartScoreboard.demoBadge')}
        </header>
        <div className="ps-sb__teams">
          <div className="ps-sb__team is-serving">
            <span className="ps-sb__serve" aria-hidden="true" />
            <span className="ps-sb__team-name">{text('publicSite.smartScoreboard.demoTeamA')}</span>
            <span className="ps-sb__sets" aria-hidden="true">
              <i className="is-won" />
              <i />
            </span>
            <span className="ps-sb__points">30</span>
          </div>
          <div className="ps-sb__team">
            <span className="ps-sb__serve is-idle" aria-hidden="true" />
            <span className="ps-sb__team-name">{text('publicSite.smartScoreboard.demoTeamB')}</span>
            <span className="ps-sb__sets" aria-hidden="true">
              <i />
              <i />
            </span>
            <span className="ps-sb__points">15</span>
          </div>
        </div>
        <footer className="ps-sb__meta">
          <span>{text('publicSite.smartScoreboard.demoSet')}</span>
          <span>{text('publicSite.smartScoreboard.demoPartial')}</span>
        </footer>
      </div>
    </div>
  );
}

/** Marcador inteligente */
export function SmartScoreboardSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.smartScoreboard;
  return (
    <SectionShell
      id={config.id}
      className="ps-section--scoreboard"
      titleId="ps-smart-scoreboard-title"
    >
      <span className="ps-coming-soon">
        {text('publicSite.smartScoreboard.comingSoon')}
      </span>
      <div className="ps-scoreboard__grid">
        <div className="ps-scoreboard__copy">
          <h2 id="ps-smart-scoreboard-title">{text('publicSite.smartScoreboard.title')}</h2>
          <p className="ps-lead">{text('publicSite.smartScoreboard.text')}</p>
          <ol className="ps-flow-steps">
            {config.steps.map(({ key }, index) => (
              <li key={key}>
                <span className="ps-flow-steps__num" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <strong>{text(`publicSite.smartScoreboard.steps.${key}.title`)}</strong>
                  <span>{text(`publicSite.smartScoreboard.steps.${key}.text`)}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <ScoreboardPreview text={text} />
      </div>
    </SectionShell>
  );
}

/** Expansión comercial */
export function ExpansionSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.expansion;
  return (
    <SectionShell id={config.id} className="ps-section--expansion" titleId="ps-expansion-title">
      <h2 id="ps-expansion-title">{text('publicSite.expansion.title')}</h2>
      <p className="ps-lead">{text('publicSite.expansion.text')}</p>
      <div className="ps-expansion__grid">
        {config.items.map(({ key }) => (
          <article key={key} className="ps-expansion__card">
            <img src={`${ASSET_ROOT}/${EXPANSION_ICONS[key]}`} alt="" aria-hidden="true" />
            <div>
              <h3>{text(`publicSite.expansion.items.${key}.title`)}</h3>
              <p>{text(`publicSite.expansion.items.${key}.text`)}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="ps-note">{text('publicSite.expansion.note')}</p>
    </SectionShell>
  );
}

/** Quiénes somos */
export function AboutSection() {
  const text = usePublicSiteText();
  const id = PUBLIC_SITE_SECTIONS.about.id;
  return (
    <SectionShell id={id} className="ps-section--about" titleId="ps-about-title">
      <div className="ps-about__grid">
        <div>
          <h2 id="ps-about-title">{text('publicSite.about.title')}</h2>
          <p className="ps-lead">{text('publicSite.about.text')}</p>
        </div>
        <div className="ps-about__visual" role="img" aria-label={text('publicSite.about.visualAlt')}>
          <img
            src={`${ASSET_ROOT}/real-occupancy.jpg`}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </SectionShell>
  );
}

/** Descarga */
export function DownloadSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.download;
  return (
    <SectionShell id={config.id} className="ps-section--download" titleId="ps-download-title">
      <img
        src={`${ASSET_ROOT}/padbol-match-logo-white.svg`}
        className="ps-download__logo"
        alt={text('publicSite.brandAlt')}
      />
      <h2 id="ps-download-title">{text('publicSite.download.title')}</h2>
      <p className="ps-lead">{text('publicSite.download.text')}</p>
      <div className="ps-download__stores">
        {config.stores.map(({ key, url }) =>
          url ? (
            <a key={key} href={url} className="ps-store" rel="noopener noreferrer" target="_blank">
              <strong>{text(`publicSite.download.${key}`)}</strong>
            </a>
          ) : (
            <div key={key} className="ps-store ps-store--soon">
              <strong>{text(`publicSite.download.${key}`)}</strong>
              <span>{text('publicSite.download.storeSoon')}</span>
            </div>
          ),
        )}
      </div>
      <Link to={config.login} className="ps-btn ps-btn--ghost">
        {text('publicSite.download.login')}
      </Link>
    </SectionShell>
  );
}

/** Contacto */
export function ContactSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.contact;
  return (
    <SectionShell id={config.id} className="ps-section--contact" titleId="ps-contact-title">
      <h2 id="ps-contact-title">{text('publicSite.contact.title')}</h2>
      <p className="ps-lead">{text('publicSite.contact.text')}</p>
      <div className="ps-hero__ctas">
        {config.ctas.map(({ key, to }) => (
          <Link
            key={key}
            to={to}
            className={`ps-btn ${key === 'venue' ? 'ps-btn--primary' : key === 'play' ? 'ps-btn--secondary' : 'ps-btn--ghost'}`}
          >
            {text(`publicSite.contact.${key}`)}
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}
