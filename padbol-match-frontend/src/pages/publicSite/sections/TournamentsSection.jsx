import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { Closing, SectionIntro, usePublicSiteText } from './SectionElements';

/** Bracket conceptual en CSS (equipos genéricos, resultado de demostración). */
function BracketConcept() {
  return (
    <div className="ps-bracket" aria-hidden="true">
      <div className="ps-bracket__round">
        <span className="ps-bracket__team">Equipo A</span>
        <span className="ps-bracket__team is-winner">Equipo B</span>
        <span className="ps-bracket__team is-winner">Equipo C</span>
        <span className="ps-bracket__team">Equipo D</span>
      </div>
      <div className="ps-bracket__round ps-bracket__round--final">
        <span className="ps-bracket__team is-winner">Equipo B</span>
        <span className="ps-bracket__team">Equipo C</span>
      </div>
      <div className="ps-bracket__round ps-bracket__round--champion">
        <span className="ps-bracket__team is-champion">Equipo B</span>
      </div>
    </div>
  );
}

export default function TournamentsSection() {
  const config = PUBLIC_SITE_SECTIONS.tournaments;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--tournaments" aria-labelledby="ps-tournaments-title">
      <div className="public-site__shell ps-tournaments-layout">
        <div>
          <SectionIntro sectionKey="tournaments" titleId="ps-tournaments-title" />
          <ol className="ps-stage-list">
            {config.items.map(({ key }, index) => (
              <li key={key} data-ps-reveal data-ps-reveal-order={index}>
                <span className="ps-stage-list__num" aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{text(`publicSite.tournaments.items.${key}.title`)}</h3>
                  <p>{text(`publicSite.tournaments.items.${key}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
          <Closing>{text('publicSite.tournaments.closing')}</Closing>
        </div>
        <div className="ps-tournaments-visual" data-ps-reveal data-ps-reveal-order="2">
          <BracketConcept />
        </div>
      </div>
    </section>
  );
}
