import React from 'react';
import { Link } from 'react-router-dom';
import PadbolBrandLogo from '../../../components/PadbolBrandLogo';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { SectionIntro, usePublicSiteText } from './SectionElements';

export default function DownloadSection() {
  const config = PUBLIC_SITE_SECTIONS.download;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--download" aria-labelledby="ps-download-title">
      <div className="public-site__shell ps-download">
        <PadbolBrandLogo
          variant="on-dark-tight"
          className="ps-download__logo"
          alt={text('publicSite.brandAlt')}
        />
        <SectionIntro sectionKey="download" titleId="ps-download-title" />
        <div className="ps-store-list" data-ps-reveal>
          {config.stores.map(({ key, url }) => (
            url ? (
              <a className="ps-store" href={url} key={key} rel="noreferrer">
                <strong>{text(`publicSite.download.${key}`)}</strong>
              </a>
            ) : (
              <div className="ps-store is-disabled" key={key} aria-disabled="true">
                <strong>{text(`publicSite.download.${key}`)}</strong>
                <span>{text('publicSite.download.comingSoon')}</span>
              </div>
            )
          ))}
        </div>
        <Link className="ps-button ps-button--primary" to={config.login}>
          {text('publicSite.download.login')}
        </Link>
      </div>
    </section>
  );
}
