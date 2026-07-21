import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, Closing, SectionIntro, usePublicSiteText } from './SectionElements';

export default function EcosystemSection() {
  const config = PUBLIC_SITE_SECTIONS.ecosystem;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section" aria-labelledby="ps-ecosystem-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="ecosystem" titleId="ps-ecosystem-title" />
        <CardGrid sectionKey="ecosystem" items={config.items} className="ps-card-grid--three" />
        <Closing>{text('publicSite.ecosystem.closing')}</Closing>
      </div>
    </section>
  );
}
