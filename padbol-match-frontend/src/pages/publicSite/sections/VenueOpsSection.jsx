import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { Closing, SectionIntro, usePublicSiteText } from './SectionElements';

/** Dashboard conceptual (bloques y gráficos abstractos en CSS, sin datos reales). */
function VenueDashboardConcept() {
  return (
    <div className="ps-venue-dash" aria-hidden="true">
      <div className="ps-venue-dash__topbar">
        <span className="ps-venue-dash__dot" />
        <span className="ps-venue-dash__dot" />
        <span className="ps-venue-dash__dot" />
      </div>
      <div className="ps-venue-dash__body">
        <div className="ps-venue-dash__col">
          <div className="ps-venue-dash__panel ps-venue-dash__panel--agenda">
            <span className="ps-venue-dash__title-line" />
            <span className="ps-venue-dash__slot is-busy" />
            <span className="ps-venue-dash__slot" />
            <span className="ps-venue-dash__slot is-busy" />
            <span className="ps-venue-dash__slot is-busy" />
            <span className="ps-venue-dash__slot" />
          </div>
          <div className="ps-venue-dash__panel ps-venue-dash__panel--bars">
            <span style={{ '--h': '38%' }} />
            <span style={{ '--h': '62%' }} />
            <span style={{ '--h': '48%' }} />
            <span style={{ '--h': '84%' }} />
            <span style={{ '--h': '70%' }} />
            <span style={{ '--h': '92%' }} />
          </div>
        </div>
        <div className="ps-venue-dash__col">
          <div className="ps-venue-dash__panel ps-venue-dash__panel--ring">
            <span className="ps-venue-dash__ring" />
            <span className="ps-venue-dash__title-line" />
          </div>
          <div className="ps-venue-dash__panel ps-venue-dash__panel--list">
            <span className="ps-venue-dash__row" />
            <span className="ps-venue-dash__row" />
            <span className="ps-venue-dash__row is-accent" />
            <span className="ps-venue-dash__row" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VenueOpsSection() {
  const config = PUBLIC_SITE_SECTIONS.venueOps;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--venue" aria-labelledby="ps-venue-ops-title">
      <div className="public-site__shell ps-venue-layout">
        <div className="ps-venue-layout__copy">
          <SectionIntro sectionKey="venueOps" titleId="ps-venue-ops-title" />
          <dl className="ps-venue-list">
            {config.items.map(({ key }, index) => (
              <div className="ps-venue-list__item" key={key} data-ps-reveal data-ps-reveal-order={index}>
                <dt>{text(`publicSite.venueOps.items.${key}.title`)}</dt>
                <dd>{text(`publicSite.venueOps.items.${key}.text`)}</dd>
              </div>
            ))}
          </dl>
          <Closing>{text('publicSite.venueOps.closing')}</Closing>
        </div>

        <div className="ps-venue-layout__visual" data-ps-reveal data-ps-reveal-order="2">
          <VenueDashboardConcept />
        </div>
      </div>
    </section>
  );
}
