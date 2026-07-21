import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { Closing, SectionIntro, usePublicSiteText } from './SectionElements';

/** Beneficios con números grandes y ritmo editorial (no seis tarjetas iguales). */
export default function VenueBenefitsSection() {
  const config = PUBLIC_SITE_SECTIONS.venueBenefits;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--benefits" aria-labelledby="ps-benefits-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="venueBenefits" titleId="ps-benefits-title" />

        <ol className="ps-benefits">
          {config.items.map(({ key }, index) => (
            <li key={key} className="ps-benefit" data-ps-reveal data-ps-reveal-order={index % 3}>
              <span className="ps-benefit__num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="ps-benefit__body">
                <h3>{text(`publicSite.venueBenefits.items.${key}.title`)}</h3>
                <p>{text(`publicSite.venueBenefits.items.${key}.text`)}</p>
              </div>
            </li>
          ))}
        </ol>

        <Closing>{text('publicSite.venueBenefits.closing')}</Closing>
      </div>
    </section>
  );
}
