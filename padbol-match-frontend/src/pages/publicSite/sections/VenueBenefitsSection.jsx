import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, Closing, SectionIntro, usePublicSiteText } from './SectionElements';

export default function VenueBenefitsSection() {
  const config = PUBLIC_SITE_SECTIONS.venueBenefits;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section ps-section--muted" aria-labelledby="ps-benefits-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="venueBenefits" titleId="ps-benefits-title" />
        <CardGrid sectionKey="venueBenefits" items={config.items} />
        <Closing>{text('publicSite.venueBenefits.closing')}</Closing>
      </div>
    </section>
  );
}
