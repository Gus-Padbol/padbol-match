import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, MediaPlaceholder, SectionIntro, usePublicSiteText } from './SectionElements';

export default function SmartScoreboardSection() {
  const config = PUBLIC_SITE_SECTIONS.scoreboard;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section ps-section--muted" aria-labelledby="ps-scoreboard-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="scoreboard" titleId="ps-scoreboard-title" />
        <CardGrid sectionKey="scoreboard" items={config.items} numbered />
        <div className="ps-feature-split">
          <MediaPlaceholder>{text('publicSite.scoreboard.placeholder')}</MediaPlaceholder>
          <div className="ps-feature-split__copy">
            <h3>{text('publicSite.scoreboard.secondTitle')}</h3>
            <p>{text('publicSite.scoreboard.secondText')}</p>
            <div className="ps-mini-flow">
              {config.flow.map(({ key }) => (
                <div key={key}>
                  <strong>{text(`publicSite.scoreboard.flow.${key}.title`)}</strong>
                  <span>{text(`publicSite.scoreboard.flow.${key}.text`)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
