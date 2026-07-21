import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, Closing, SectionIntro, usePublicSiteText } from './SectionElements';

export default function TournamentsSection() {
  const config = PUBLIC_SITE_SECTIONS.tournaments;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section" aria-labelledby="ps-tournaments-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="tournaments" titleId="ps-tournaments-title" />
        <CardGrid sectionKey="tournaments" items={config.items} numbered />
        <Closing>{text('publicSite.tournaments.closing')}</Closing>
      </div>
    </section>
  );
}
