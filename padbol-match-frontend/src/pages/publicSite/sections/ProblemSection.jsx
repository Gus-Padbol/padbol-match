import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, Closing, Flow, SectionIntro, usePublicSiteText } from './SectionElements';

export default function ProblemSection() {
  const config = PUBLIC_SITE_SECTIONS.problem;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section ps-section--muted" aria-labelledby="ps-problem-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="problem" titleId="ps-problem-title" />
        <CardGrid sectionKey="problem" items={config.items} />
        <Flow
          ariaLabel={text('publicSite.problem.closing')}
          labels={config.journey.map((key) => text(`publicSite.problem.journey.${key}`))}
        />
        <Closing>{text('publicSite.problem.closing')}</Closing>
      </div>
    </section>
  );
}
