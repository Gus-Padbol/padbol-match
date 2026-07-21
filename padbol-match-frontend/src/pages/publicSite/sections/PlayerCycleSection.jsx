import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, Closing, SectionIntro, usePublicSiteText } from './SectionElements';

export default function PlayerCycleSection() {
  const config = PUBLIC_SITE_SECTIONS.playerCycle;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section" aria-labelledby="ps-player-cycle-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="playerCycle" titleId="ps-player-cycle-title" />
        <CardGrid sectionKey="playerCycle" items={config.items} numbered />
        <Closing>{text('publicSite.playerCycle.closing')}</Closing>
      </div>
    </section>
  );
}
