import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { Closing, SectionIntro, usePublicSiteText } from './SectionElements';

/** Escena visual: partido 2/4, solicitudes, confirmación y notificación. */
function CommunityScene({ text }) {
  return (
    <div className="ps-community-scene" aria-label={text('publicSite.community.example')}>
      <div className="ps-community-scene__match" data-ps-reveal>
        <header>
          <strong>{text('publicSite.community.scene.matchTitle')}</strong>
          <span>{text('publicSite.community.scene.matchMeta')}</span>
        </header>
        <div className="ps-community-scene__slots" role="img" aria-label={text('publicSite.community.example')}>
          <span className="is-confirmed" />
          <span className="is-confirmed" />
          <span className="is-open" />
          <span className="is-open" />
        </div>
        <p className="ps-community-scene__count">{text('publicSite.community.example')}</p>
        <p className="ps-community-scene__open">{text('publicSite.community.scene.slotsOpen')}</p>
      </div>

      <ol className="ps-community-scene__feed">
        {['requestOne', 'confirmed', 'requestTwo', 'notification', 'back'].map((key, index) => (
          <li
            key={key}
            className={`is-${key}`}
            data-ps-reveal
            data-ps-reveal-order={index + 1}
          >
            <span className="ps-community-scene__feed-dot" aria-hidden="true" />
            {text(`publicSite.community.scene.${key}`)}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function CommunitySection() {
  const config = PUBLIC_SITE_SECTIONS.community;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--community" aria-labelledby="ps-community-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="community" titleId="ps-community-title" />

        <div className="ps-community-layout">
          <div className="ps-community-steps">
            {config.items.map(({ key }, index) => (
              <article key={key} className="ps-community-step" data-ps-reveal data-ps-reveal-order={index}>
                <span className="ps-community-step__num" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{text(`publicSite.community.items.${key}.title`)}</h3>
                <p>{text(`publicSite.community.items.${key}.text`)}</p>
              </article>
            ))}
          </div>

          <CommunityScene text={text} />
        </div>

        <Closing>{text('publicSite.community.closing')}</Closing>
      </div>
    </section>
  );
}
