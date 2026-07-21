import React from 'react';
import { Link } from 'react-router-dom';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { SectionIntro, usePublicSiteText } from './SectionElements';

export default function ContactSection() {
  const config = PUBLIC_SITE_SECTIONS.contact;
  const text = usePublicSiteText();
  return (
    <section id={config.id} className="ps-section ps-section--contact" aria-labelledby="ps-contact-title">
      <div className="public-site__shell ps-contact">
        <SectionIntro sectionKey="contact" titleId="ps-contact-title" />
        <p className="ps-contact__secondary">{text('publicSite.contact.secondary')}</p>
        <div className="ps-contact__ctas">
          {config.ctas.map(({ key, to }, index) => (
            <Link
              className={`ps-button ${index === 0 ? 'ps-button--primary' : 'ps-button--secondary'}`}
              to={to}
              key={key}
            >
              {text(`publicSite.contact.${key}`)}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
