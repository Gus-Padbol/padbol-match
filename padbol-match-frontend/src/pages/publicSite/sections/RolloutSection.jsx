import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { Closing, SectionIntro, usePublicSiteText } from './SectionElements';

/** Implementación por fases con línea de progreso. */
export default function RolloutSection() {
  const config = PUBLIC_SITE_SECTIONS.rollout;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--rollout" aria-labelledby="ps-rollout-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="rollout" titleId="ps-rollout-title" />

        <ol className="ps-rollout">
          <span className="ps-rollout__track" aria-hidden="true" />
          {config.items.map(({ key }, index) => (
            <li key={key} className="ps-rollout__phase" data-ps-reveal data-ps-reveal-order={index}>
              <span className="ps-rollout__node" aria-hidden="true">{index + 1}</span>
              <h3>{text(`publicSite.rollout.items.${key}.title`)}</h3>
              <p>{text(`publicSite.rollout.items.${key}.text`)}</p>
            </li>
          ))}
        </ol>

        <Closing>{text('publicSite.rollout.closing')}</Closing>
        <p className="ps-section__final">{text('publicSite.rollout.final')}</p>
      </div>
    </section>
  );
}
