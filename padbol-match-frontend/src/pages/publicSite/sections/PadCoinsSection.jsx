import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, Closing, SectionIntro, usePublicSiteText } from './SectionElements';

export default function PadCoinsSection() {
  const config = PUBLIC_SITE_SECTIONS.padCoins;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section" aria-labelledby="ps-padcoins-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="padCoins" titleId="ps-padcoins-title" />
        <p className="ps-highlight">{text('publicSite.padCoins.highlight')}</p>
        <CardGrid sectionKey="padCoins" items={config.items} className="ps-card-grid--three" />
        <Closing>{text('publicSite.padCoins.closing')}</Closing>
      </div>
    </section>
  );
}
