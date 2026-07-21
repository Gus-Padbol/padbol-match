import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { MediaPlaceholder, SectionIntro, usePublicSiteText } from './SectionElements';

export default function ExperiencesSection() {
  const config = PUBLIC_SITE_SECTIONS.experiences;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section ps-section--muted" aria-labelledby="ps-experiences-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="experiences" titleId="ps-experiences-title" />
        <div className="ps-experiences">
          {config.items.map(({ key }, index) => (
            <article className="ps-experience" key={key}>
              <MediaPlaceholder>{text('publicSite.experiences.placeholder')}</MediaPlaceholder>
              <div>
                <span className="ps-card__number" aria-hidden>{String(index + 1).padStart(2, '0')}</span>
                <h3>{text(`publicSite.experiences.items.${key}.title`)}</h3>
                <p>{text(`publicSite.experiences.items.${key}.text`)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
