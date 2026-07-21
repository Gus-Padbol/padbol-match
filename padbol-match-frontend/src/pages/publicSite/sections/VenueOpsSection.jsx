import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, Closing, SectionIntro, usePublicSiteText } from './SectionElements';

export default function VenueOpsSection() {
  const config = PUBLIC_SITE_SECTIONS.venueOps;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section ps-section--muted" aria-labelledby="ps-venue-ops-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="venueOps" titleId="ps-venue-ops-title" />
        <CardGrid sectionKey="venueOps" items={config.items} />
        <Closing>{text('publicSite.venueOps.closing')}</Closing>
      </div>
    </section>
  );
}
