import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { Closing, SectionIntro, usePublicSiteText } from './SectionElements';

/** Perfil conceptual: historial, racha y ranking (elementos de interfaz, sin datos reales). */
function ProfileConcept() {
  return (
    <div className="ps-profile" aria-hidden="true">
      <header className="ps-profile__head">
        <span className="ps-profile__avatar" />
        <div>
          <span className="ps-profile__name-line" />
          <span className="ps-profile__sub-line" />
        </div>
        <span className="ps-profile__rank">#12</span>
      </header>
      <div className="ps-profile__streak">
        <i className="is-win" /><i className="is-win" /><i className="is-loss" /><i className="is-win" /><i className="is-win" />
      </div>
      <div className="ps-profile__spark">
        <span style={{ '--h': '30%' }} />
        <span style={{ '--h': '46%' }} />
        <span style={{ '--h': '42%' }} />
        <span style={{ '--h': '64%' }} />
        <span style={{ '--h': '58%' }} />
        <span style={{ '--h': '78%' }} />
        <span style={{ '--h': '90%' }} />
      </div>
      <div className="ps-profile__badges">
        <span /><span /><span className="is-accent" />
      </div>
    </div>
  );
}

export default function RankingSection() {
  const config = PUBLIC_SITE_SECTIONS.ranking;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--ranking" aria-labelledby="ps-ranking-title">
      <div className="public-site__shell ps-ranking-layout">
        <div className="ps-ranking-visual" data-ps-reveal>
          <ProfileConcept />
        </div>
        <div>
          <SectionIntro sectionKey="ranking" titleId="ps-ranking-title" />
          <dl className="ps-venue-list">
            {config.items.map(({ key }, index) => (
              <div className="ps-venue-list__item" key={key} data-ps-reveal data-ps-reveal-order={index}>
                <dt>{text(`publicSite.ranking.items.${key}.title`)}</dt>
                <dd>{text(`publicSite.ranking.items.${key}.text`)}</dd>
              </div>
            ))}
          </dl>
          <Closing>{text('publicSite.ranking.closing')}</Closing>
        </div>
      </div>
    </section>
  );
}
