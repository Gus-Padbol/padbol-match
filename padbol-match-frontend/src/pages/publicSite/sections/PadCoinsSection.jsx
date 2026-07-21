import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { Closing, SectionIntro, usePublicSiteText } from './SectionElements';

/** Billetera conceptual: saldo, movimientos y membresía (texto y formas, sin isotipo nuevo). */
function WalletConcept() {
  return (
    <div className="ps-wallet" aria-hidden="true">
      <header className="ps-wallet__balance">
        <span className="ps-wallet__label">PadCoins</span>
        <strong>340</strong>
      </header>
      <ul className="ps-wallet__moves">
        <li><span>Partido completado</span><b>+25</b></li>
        <li><span>Reserva confirmada</span><b>+10</b></li>
        <li><span>Beneficio canjeado</span><b className="is-out">−80</b></li>
      </ul>
      <footer className="ps-wallet__membership">
        <span className="ps-wallet__chip" />
        Membresía activa
      </footer>
    </div>
  );
}

export default function PadCoinsSection() {
  const config = PUBLIC_SITE_SECTIONS.padCoins;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--padcoins" aria-labelledby="ps-padcoins-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="padCoins" titleId="ps-padcoins-title" />
        <p className="ps-highlight" data-ps-reveal>{text('publicSite.padCoins.highlight')}</p>

        <div className="ps-padcoins-layout">
          <div className="ps-padcoins-blocks">
            {config.items.map(({ key }, index) => (
              <article key={key} className={`ps-padcoins-block is-${key}`} data-ps-reveal data-ps-reveal-order={index}>
                <h3>{text(`publicSite.padCoins.items.${key}.title`)}</h3>
                <p>{text(`publicSite.padCoins.items.${key}.text`)}</p>
              </article>
            ))}
          </div>
          <div className="ps-padcoins-visual" data-ps-reveal data-ps-reveal-order="3">
            <WalletConcept />
          </div>
        </div>

        <Closing>{text('publicSite.padCoins.closing')}</Closing>
      </div>
    </section>
  );
}
