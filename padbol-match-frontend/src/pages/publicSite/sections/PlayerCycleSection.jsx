import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { Closing, SectionIntro, usePublicSiteText } from './SectionElements';

/**
 * Ciclo del jugador: recorrido horizontal en desktop / vertical en móvil.
 * “Volver” se conecta visualmente de nuevo con “Encontrar”.
 */
export default function PlayerCycleSection() {
  const config = PUBLIC_SITE_SECTIONS.playerCycle;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--cycle" aria-labelledby="ps-player-cycle-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="playerCycle" titleId="ps-player-cycle-title" />

        <ol className="ps-cycle">
          {config.items.map(({ key }, index) => (
            <li
              key={key}
              className={`ps-cycle__stage${index === config.items.length - 1 ? ' is-return' : ''}`}
              data-ps-reveal
              data-ps-reveal-order={index}
            >
              <span className="ps-cycle__marker" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{text(`publicSite.playerCycle.items.${key}.title`)}</h3>
              <p>{text(`publicSite.playerCycle.items.${key}.text`)}</p>
            </li>
          ))}
          <span className="ps-cycle__loop" aria-hidden="true" />
        </ol>

        <Closing>{text('publicSite.playerCycle.closing')}</Closing>
      </div>
    </section>
  );
}
