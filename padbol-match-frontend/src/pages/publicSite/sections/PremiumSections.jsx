import React, { useEffect, useRef, useState } from 'react';
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
  // Padbol usa material real; las otras disciplinas tienen fotografía editorial
  // propia con el mismo encuadre para que el bloque se lea como multideporte.
  occupy: 'real-occupancy.jpg',
  activate: 'sport-padel-premium.jpg',
  scoreboard: 'sport-pickleball-premium.jpg',
  continuity: 'sport-tennis-premium.jpg',
};

const VENUE_SPORTS = {
  occupy: 'padbol',
  activate: 'padel',
  scoreboard: 'pickleball',
  continuity: 'tennis',
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
  { filled: 2, status: 'looking', players: ['player-01.jpg', 'player-02.jpg'] },
  { filled: 3, status: 'playerConfirmed', players: ['player-01.jpg', 'player-02.jpg', 'player-03.jpg'] },
  { filled: 4, status: 'matchConfirmed', players: ['player-01.jpg', 'player-02.jpg', 'player-03.jpg', 'player-04.jpg'] },
];

const OPEN_MATCH_AVATAR_ROOT = '/media/public-site/players';

const CONTINUITY_DETAILS = {
  openMatches: {
    lead: 'Convierte una intención de jugar en un encuentro concreto, sin depender de grupos externos ni cadenas de mensajes.',
    points: ['Publicas sede, horario, nivel y cupos.', 'Los jugadores cercanos piden lugar desde la app.', 'La sede ve actividad real antes de que empiece el partido.'],
  },
  tournaments: {
    lead: 'Organiza competencias con un calendario claro y una experiencia que acompaña al jugador desde la inscripción hasta el cierre.',
    points: ['Inscripciones, cupos y categorías en un solo lugar.', 'Llaves, zonas o formatos según la disciplina y el torneo.', 'Cada fecha sostiene participación y movimiento en la sede.'],
  },
  results: {
    lead: 'El juego no termina al salir de la cancha: el resultado queda asociado al encuentro y alimenta el recorrido deportivo.',
    points: ['Registro simple de marcadores y asistencia.', 'Historial consultable por jugador y competencia.', 'Base confiable para ranking, estadísticas y logros.'],
  },
  ranking: {
    lead: 'Una evolución entendible, ligada a los partidos que realmente se juegan y a la categoría o alcance de cada competencia.',
    points: ['Posiciones por club, categoría o alcance de cada circuito.', 'Subes o bajas a partir de resultados validados.', 'Puedes reconocer una clasificación externa como punto de partida.'],
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
    points: ['Comparte jugadas, fotos y novedades de la comunidad.', 'Sigue jugadores, sedes y conversaciones relevantes.', 'El contenido ayuda a que cada experiencia tenga continuidad.'],
  },
};

const EXPANSION_DETAILS = {
  sponsor: {
    lead: 'Sponsor es un vínculo de marca sostenido: una sede puede asociar una marca a su comunidad, su deporte o una propuesta estable.',
    points: ['La sede define qué espacios ofrece y para qué público.', 'La marca gana presencia contextual y continuidad, no una interrupción invasiva.', 'La gestión se organiza desde el área administrativa de la sede.'],
  },
  ads: {
    lead: 'Publicidad es una campaña puntual: la sede decide qué anuncio mostrar, en qué espacio cedido y a qué usuarios de su zona.',
    points: ['Puede aparecer antes de reservar, al confirmar un partido, durante un torneo o en contenidos seleccionados.', 'Cada sede controla sus espacios, campañas, beneficios y eventos.', 'La prioridad es acompañar la experiencia, sin interrumpir el juego.'],
  },
  eshop: {
    lead: 'La visión es que cada club tenga su propio e-shop dentro de Padbol Match, con productos, promociones y beneficios para su comunidad.',
    points: ['La sede cargará sus productos y administrará su catálogo.', 'Los jugadores comprarán desde el entorno del club que conocen.', 'La misma estructura sirve a sedes de Padbol, Pádel, Pickleball y Tenis.'],
  },
};

export function AccentWords({ value, terms = [] }) {
  if (!value || !terms.length) return value;

  const escapedTerms = terms
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (!escapedTerms.length) return value;

  const matcher = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  return String(value).split(matcher).map((part, index) => (
    terms.some((term) => term.toLocaleLowerCase('es-AR') === part.toLocaleLowerCase('es-AR'))
      ? <span className="ps-title-accent" key={`${part}-${index}`}>{part}</span>
      : part
  ));
}

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
      <div className="ps-what__layout">
        <div className="ps-what__copy">
          <div className="ps-what__brand" aria-hidden="true">
            <img src={`${ASSET_ROOT}/match.svg`} alt="" />
          </div>
          <h2 id="ps-what-title"><AccentWords value={text('publicSite.whatIs.title')} terms={['Padbol Match']} /></h2>
          <p className="ps-lead">{text('publicSite.whatIs.text')}</p>
        </div>
        <figure className="ps-what__visual" aria-hidden="true">
          <img src={`${ASSET_ROOT}/real-occupancy.jpg`} alt="" />
          <span className="ps-what__visual-line" />
        </figure>
      </div>
    </SectionShell>
  );
}

/** La expansión multideporte parte de la base activa de Padbol. */
export function PlatformStatusSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.status;
  return (
    <SectionShell id={config.id} className="ps-section--status" titleId="ps-status-title">
      <h2 id="ps-status-title"><AccentWords value={text('publicSite.status.title')} terms={['Padbol Match', 'nuevos deportes', 'new sports']} /></h2>
      <p className="ps-lead">{text('publicSite.status.text')}</p>
      <ul className="ps-status-grid">
        {config.items.map(({ key }) => (
          <li key={key} className={`ps-status-card ps-status-card--${key}`}>
            <span>{text(`publicSite.status.items.${key}.eyebrow`)}</span>
            <strong>{text(`publicSite.status.items.${key}.title`)}</strong>
            <p>{text(`publicSite.status.items.${key}.text`)}</p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/** Recorrido jugadores */
export function PlayerPathSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.playerPath;
  return (
    <SectionShell id={config.id} className="ps-section--paths ps-section--players" titleId="ps-players-title">
      <h2 id="ps-players-title"><AccentWords value={text('publicSite.playerPath.title')} terms={['jugadores']} /></h2>
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
  const isComplete = demo.filled === 4;

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
              <li key={slot} className={slot < demo.filled ? 'is-filled' : 'is-open'}>
                {slot < demo.filled ? (
                  <span className="ps-match__avatar">
                    <img src={`${OPEN_MATCH_AVATAR_ROOT}/${demo.players[slot]}`} alt="" />
                  </span>
                ) : <i />}
              </li>
            ))}
          </ul>
          <p className="ps-match__slots-label" aria-live="polite">
            {text('publicSite.communityMatches.mockSlots', { filled: demo.filled })}
          </p>
          <div className="ps-match__metrics" aria-label={text('publicSite.communityMatches.mockMetricsAria')}>
            <div>
              <span>{text('publicSite.communityMatches.mockOccupancy')}</span>
              <strong>{text('publicSite.communityMatches.mockOccupancyValue', { percentage: demo.filled * 25 })}</strong>
            </div>
            <div>
              <span>{text('publicSite.communityMatches.mockReservation')}</span>
              <strong className="ps-match__confirmation">
                {isComplete
                  ? text('publicSite.communityMatches.mockConfirmed')
                  : text('publicSite.communityMatches.mockCompleteWhenFull')}
              </strong>
            </div>
          </div>
          <p className="ps-match__status" aria-live="polite"><i />{text(`publicSite.communityMatches.mockStatuses.${demo.status}`, { count: 4 - demo.filled })}</p>
          <p className="ps-match__release-note">
            {isComplete
              ? text('publicSite.communityMatches.mockSlotsComplete')
              : text('publicSite.communityMatches.mockReleaseNote')}
          </p>
          <span
            className={`ps-match__cta${isComplete ? ' ps-match__cta--disabled' : ''}`}
            aria-disabled={isComplete}
          >
            {isComplete ? text('publicSite.communityMatches.mockFull') : text('publicSite.communityMatches.mockAction')}
          </span>
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
          <h2 id="ps-community-matches-title"><AccentWords value={text('publicSite.communityMatches.title')} terms={['Jugar', 'cancha']} /></h2>
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
          <Link to={PUBLIC_SITE_CTA.play} className="ps-btn ps-btn--secondary ps-btn--play">
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
      <h2 id="ps-venues-title"><AccentWords value={text('publicSite.venuePath.title')} terms={['sedes', 'organizaciones']} /></h2>
      <p className="ps-lead">{text('publicSite.venuePath.text')}</p>
      <div className="ps-venue__cta">
        <Link to={PUBLIC_SITE_CTA.venue} className="ps-btn ps-btn--primary">
          {text('publicSite.contact.venue')}
        </Link>
      </div>
      <ul className="ps-venue-cards">
        {config.items.map(({ key }) => (
          <li key={key} className={`ps-venue-card ps-venue-card--${key}`}>
            <img
              className="ps-venue-card__image"
              src={`${ASSET_ROOT}/${VENUE_MEDIA[key]}`}
              alt={`${text(`publicSite.sports.${VENUE_SPORTS[key]}`)}: ${text(`publicSite.venuePath.items.${key}.title`)}`}
              loading="lazy"
              decoding="async"
            />
            <div>
              <span className="ps-venue-card__sport">
                {text(`publicSite.sports.${VENUE_SPORTS[key]}`)}
              </span>
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
  const detailRef = useRef(null);

  useEffect(() => {
    if (!activeKey || !detailRef.current || window.innerWidth >= 768) return;
    // En móvil el detalle forma parte del flujo: lo acercamos a la vista sin
    // desplazarlo a un área que el usuario no puede ver.
    detailRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeKey]);

  const closeDetail = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setActiveKey(null);
  };

  return (
    <SectionShell id={config.id} className="ps-section--continuity" titleId="ps-continuity-title">
      <h2 id="ps-continuity-title"><AccentWords value={text('publicSite.continuity.title')} terms={['durante']} /></h2>
      <ul className="ps-chip-row">
        {config.items.map(({ key }) => (
          <li
            key={key}
            className={`ps-chip-wrap${activeKey === key ? ' is-active' : ''}`}
            onMouseEnter={() => setActiveKey(key)}
            onMouseLeave={closeDetail}
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
              <aside ref={detailRef} id={`ps-continuity-detail-${key}`} className="ps-chip__detail" role="status">
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

function ScoreboardVideo({ text }) {
  return (
    <figure className="ps-scoreboard__video" data-ps-reveal data-ps-reveal-order="1">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster={`${ASSET_ROOT}/marcador-inteligente-poster.jpg`}
        aria-label={text('publicSite.matchIntelligence.videoAria')}
      >
        <source src={`${ASSET_ROOT}/marcador-inteligente.mp4`} type="video/mp4" />
      </video>
    </figure>
  );
}

function ScoreboardSnapshot() {
  return (
    <figure className="ps-scoreboard__snapshot" data-ps-reveal data-ps-reveal-order="1">
      <img
        src={`${ASSET_ROOT}/marcador-inteligente-captura.jpg`}
        alt="Marcador Padbol Match durante un partido"
        loading="lazy"
      />
    </figure>
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
          <h2 id="ps-smart-scoreboard-title"><AccentWords value={text('publicSite.smartScoreboard.title')} terms={['Marcador', 'en vivo']} /></h2>
          <p className="ps-lead">{text('publicSite.smartScoreboard.text')}</p>
          <ol className="ps-flow-steps ps-flow-steps--scoreboard">
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
        <div className="ps-scoreboard__visual">
          <ScoreboardSnapshot />
          <ScoreboardVideo text={text} />
        </div>
      </div>
    </SectionShell>
  );
}

/** Próxima capa de validación del partido */
export function MatchIntelligenceSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.matchIntelligence;

  return (
    <SectionShell id={config.id} className="ps-section--match-intelligence" titleId="ps-match-intelligence-title">
      <div className="ps-match-intelligence__layout">
        <div className="ps-match-intelligence__copy" data-ps-reveal>
          <span className="ps-coming-soon">{text('publicSite.matchIntelligence.kicker')}</span>
          <h2 id="ps-match-intelligence-title">
            <AccentWords
              value={text('publicSite.matchIntelligence.title')}
              terms={['Árbitro', 'inteligente', 'juego']}
            />
          </h2>
          <p className="ps-lead">{text('publicSite.matchIntelligence.text')}</p>
          <ul className="ps-match-intelligence__features">
            {config.features.map(({ key }) => (
              <li key={key}>
                <strong>{text(`publicSite.matchIntelligence.features.${key}.title`)}</strong>
                <span>{text(`publicSite.matchIntelligence.features.${key}.text`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="ps-match-intelligence__signal" data-ps-reveal data-ps-reveal-order="1" aria-hidden="true">
          <img src="/media/public-site/ai/ai-referee-vision.png" alt="" />
          <span>{text('publicSite.matchIntelligence.signal.eyebrow')}</span>
          <strong>{text('publicSite.matchIntelligence.signal.title')}</strong>
          <i />
          <b className="ps-match-intelligence__lens" aria-hidden="true" />
        </aside>
      </div>
    </SectionShell>
  );
}

/** Expansión comercial */
export function ExpansionSection() {
  const text = usePublicSiteText();
  const config = PUBLIC_SITE_SECTIONS.expansion;
  const [activeKey, setActiveKey] = useState(null);
  const detailRef = useRef(null);

  const closeDetail = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setActiveKey(null);
  };

  useEffect(() => {
    if (!activeKey || typeof window === 'undefined' || window.innerWidth >= 768) return;
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeKey]);

  return (
    <SectionShell id={config.id} className="ps-section--expansion" titleId="ps-expansion-title">
      <h2 id="ps-expansion-title"><AccentWords value={text('publicSite.expansion.title')} terms={['oportunidades']} /></h2>
      <p className="ps-lead">{text('publicSite.expansion.text')}</p>
      <div className="ps-expansion__grid">
        {config.items.map(({ key }) => (
          <div
            key={key}
            className={`ps-expansion__item${activeKey === key ? ' is-active' : ''}`}
            onMouseEnter={() => setActiveKey(key)}
            onMouseLeave={closeDetail}
          >
            <button
              type="button"
              className="ps-expansion__card"
              aria-expanded={activeKey === key}
              aria-controls={`ps-expansion-detail-${key}`}
              onClick={() => setActiveKey((current) => (current === key ? null : key))}
            >
              <img src={`${ASSET_ROOT}/${EXPANSION_ICONS[key]}`} alt="" aria-hidden="true" />
              <div>
                <h3>{text(`publicSite.expansion.items.${key}.title`)}</h3>
                <p>{text(`publicSite.expansion.items.${key}.text`)}</p>
                <span className="ps-expansion__hint" aria-hidden="true">+</span>
              </div>
            </button>
            {activeKey === key && (
              <aside ref={detailRef} id={`ps-expansion-detail-${key}`} className="ps-expansion__detail" role="status">
                <span>Padbol Match · {text(`publicSite.expansion.items.${key}.status`)}</span>
                <strong>{text(`publicSite.expansion.items.${key}.title`)}</strong>
                <p>{EXPANSION_DETAILS[key].lead}</p>
                <ul>
                  {EXPANSION_DETAILS[key].points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </aside>
            )}
          </div>
        ))}
      </div>
      <p className="ps-note">{text('publicSite.expansion.note')}</p>
      <div className="ps-expansion__cta">
        <Link to={PUBLIC_SITE_CTA.venue} className="ps-btn ps-btn--primary">
          {text('publicSite.contact.venue')}
        </Link>
      </div>
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
          <span className="ps-about__kicker">{text('publicSite.about.kicker')}</span>
          <h2 id="ps-about-title"><AccentWords value={text('publicSite.about.title')} terms={['Quiénes somos']} /></h2>
          <p className="ps-lead">{text('publicSite.about.text')}</p>
          <p className="ps-about__detail">{text('publicSite.about.detail')}</p>
          <div className="ps-about__sports" aria-label={text('publicSite.about.sportsLabel')}>
            {['padbol', 'padel', 'pickleball', 'tennis'].map((sport) => (
              <span key={sport}>{text(`publicSite.sports.${sport}`)}</span>
            ))}
          </div>
          <p className="ps-about__players-note">{text('publicSite.about.playersNote')}</p>
          <a className="ps-about__cta" href="#jugadores">
            {text('publicSite.about.cta')} <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="ps-about__visual">
          <img
            src="/media/public-site/jero/padbol-match-team.jpg"
            alt={text('publicSite.about.visualAlt')}
            loading="lazy"
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
      <h2 id="ps-download-title"><AccentWords value={text('publicSite.download.title')} terms={['app']} /></h2>
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
      <Link to="/hub" className="ps-download__web-app-link">
        {text('publicSite.download.webApp')} <span aria-hidden="true">→</span>
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
