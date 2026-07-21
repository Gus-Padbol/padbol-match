import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { Closing, SectionIntro, usePublicSiteText } from './SectionElements';

/**
 * “De lo aislado a lo conectado”: los cuatro bloques dispersos se conectan
 * visualmente hacia el núcleo Padbol Match y desembocan en el recorrido.
 * Sin hover: la conexión se revela con scroll (o queda visible sin JS).
 */
export default function ProblemSection() {
  const config = PUBLIC_SITE_SECTIONS.problem;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--problem" aria-labelledby="ps-problem-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="problem" titleId="ps-problem-title" />

        <div className="ps-problem-scene">
          <div className="ps-problem-scene__scattered">
            {config.items.map(({ key }, index) => (
              <article
                key={key}
                className={`ps-problem-piece is-${key}`}
                data-ps-reveal
                data-ps-reveal-order={index}
              >
                <h3>{text(`publicSite.problem.items.${key}.title`)}</h3>
                <p>{text(`publicSite.problem.items.${key}.text`)}</p>
                <span className="ps-problem-piece__wire" aria-hidden="true" />
              </article>
            ))}
          </div>

          <div className="ps-problem-scene__core" data-ps-reveal data-ps-reveal-order="4">
            <span className="ps-problem-scene__pulse" aria-hidden="true" />
            <strong>Padbol Match</strong>
          </div>

          <ol
            className="ps-problem-journey"
            aria-label={text('publicSite.problem.closing')}
            data-ps-reveal
            data-ps-reveal-order="5"
          >
            {config.journey.map((key, index) => (
              <li key={key}>
                <span className="ps-problem-journey__step">
                  {text(`publicSite.problem.journey.${key}`)}
                </span>
                {index < config.journey.length - 1 ? (
                  <span className="ps-problem-journey__arrow" aria-hidden="true" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        <Closing>{text('publicSite.problem.closing')}</Closing>
      </div>
    </section>
  );
}
