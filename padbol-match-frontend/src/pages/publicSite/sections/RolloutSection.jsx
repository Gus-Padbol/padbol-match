import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, Closing, SectionIntro, usePublicSiteText } from './SectionElements';

export default function RolloutSection() {
  const config = PUBLIC_SITE_SECTIONS.rollout;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section" aria-labelledby="ps-rollout-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="rollout" titleId="ps-rollout-title" />
        <CardGrid sectionKey="rollout" items={config.items} numbered />
        <Closing>{text('publicSite.rollout.closing')}</Closing>
        <p className="ps-section__final">{text('publicSite.rollout.final')}</p>
      </div>
    </section>
  );
}
