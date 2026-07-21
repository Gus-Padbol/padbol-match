import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, Closing, MediaPlaceholder, SectionIntro, usePublicSiteText } from './SectionElements';

export default function RankingSection() {
  const config = PUBLIC_SITE_SECTIONS.ranking;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section ps-section--muted" aria-labelledby="ps-ranking-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="ranking" titleId="ps-ranking-title" />
        <CardGrid sectionKey="ranking" items={config.items} />
        <div className="ps-media-grid">
          <MediaPlaceholder>{text('publicSite.ranking.scoreboardPlaceholder')}</MediaPlaceholder>
          <MediaPlaceholder>{text('publicSite.ranking.profilePlaceholder')}</MediaPlaceholder>
        </div>
        <Closing>{text('publicSite.ranking.closing')}</Closing>
      </div>
    </section>
  );
}
