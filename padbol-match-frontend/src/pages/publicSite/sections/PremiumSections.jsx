import React from 'react';
import { Link } from 'react-router-dom';
import PadbolBrandLogo from '../../../components/PadbolBrandLogo';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { PUBLIC_SITE_CTA } from '../../../constants/publicSiteLinks';
import { usePublicSiteText } from '../publicSiteI18n';

export { usePublicSiteText };

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
      <p className="ps-kicker">Padbol Match</p>
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
            <strong>{text(`publicSite.playerPath.items.${key}.title`)}</strong>
            <span>{text(`publicSite.playerPath.items.${key}.text`)}</span>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function OpenMatchMockup({ text }) {
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
            <li className="is-filled" />
            <li className="is-filled" />
            <li className="is-open" />
            <li className="is-open" />
          </ul>
          <p className="ps-match__slots-label">{text('publicSite.communityMatches.mockSlots')}</p>
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
      <ul className="ps-paths__list">
        {config.items.map(({ key }) => (
          <li key={key}>
            <strong>{text(`publicSite.venuePath.items.${key}.title`)}</strong>
            <span>{text(`publicSite.venuePath.items.${key}.text`)}</span>
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
  return (
    <SectionShell id={config.id} className="ps-section--continuity" titleId="ps-continuity-title">
      <h2 id="ps-continuity-title">{text('publicSite.continuity.title')}</h2>
      <p className="ps-statement">{text('publicSite.continuity.text')}</p>
      <ul className="ps-chip-row">
        {config.items.map(({ key }) => (
          <li key={key} className="ps-chip">
            <strong>{text(`publicSite.continuity.items.${key}.title`)}</strong>
            <span>{text(`publicSite.continuity.items.${key}.text`)}</span>
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
            <h3>{text(`publicSite.expansion.items.${key}.title`)}</h3>
            <p>{text(`publicSite.expansion.items.${key}.text`)}</p>
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
          <span className="ps-about__placeholder" />
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
      <PadbolBrandLogo variant="on-dark-tight" className="ps-download__logo" alt={text('publicSite.brandAlt')} />
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
