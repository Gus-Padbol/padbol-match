import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { CardGrid, Closing, SectionIntro, usePublicSiteText } from './SectionElements';

export default function CommunitySection() {
  const config = PUBLIC_SITE_SECTIONS.community;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section" aria-labelledby="ps-community-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="community" titleId="ps-community-title" />
        <div className="ps-community-layout">
          <CardGrid sectionKey="community" items={config.items} numbered />
          <div className="ps-player-status" aria-label={text('publicSite.community.example')}>
            <strong>{text('publicSite.community.example')}</strong>
            <div className="ps-player-status__slots" aria-hidden>
              <span className="is-confirmed" /><span className="is-confirmed" /><span /><span />
            </div>
          </div>
        </div>
        <Closing>{text('publicSite.community.closing')}</Closing>
      </div>
    </section>
  );
}
