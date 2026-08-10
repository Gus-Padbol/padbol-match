import React from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { SectionIntro, usePublicSiteText } from './SectionElements';

/**
 * Preview aislada del marcador (inspirada en la identidad del Scoreboard
 * real: dark, LED de saque, sets/tanteador). Datos ficticios; sin API,
 * WebSocket ni lógica productiva. Badge de demostración siempre visible.
 */
function ScoreboardPreview({ text }) {
  return (
    <div className="ps-sb" role="img" aria-label={text('publicSite.scoreboard.demoAria')}>
      <div className="ps-sb__frame">
        <header className="ps-sb__header">
          <span className="ps-sb__live" aria-hidden="true" />
          {text('publicSite.scoreboard.demoBadge')}
        </header>
        <div className="ps-sb__teams">
          <div className="ps-sb__team is-serving">
            <span className="ps-sb__serve" aria-hidden="true" />
            <span className="ps-sb__team-name">Equipo Rojo</span>
            <span className="ps-sb__sets" aria-hidden="true">
              <i className="is-won" />
              <i />
            </span>
            <span className="ps-sb__points">30</span>
          </div>
          <div className="ps-sb__team">
            <span className="ps-sb__serve is-idle" aria-hidden="true" />
            <span className="ps-sb__team-name">Equipo Azul</span>
            <span className="ps-sb__sets" aria-hidden="true">
              <i />
              <i />
            </span>
            <span className="ps-sb__points">15</span>
          </div>
        </div>
        <footer className="ps-sb__meta">
          <span>Set 2</span>
          <span>6-4 · 3-2</span>
        </footer>
      </div>
    </div>
  );
}

export default function SmartScoreboardSection() {
  const config = PUBLIC_SITE_SECTIONS.scoreboard;
  const text = usePublicSiteText();

  return (
    <section id={config.id} className="ps-section ps-section--scoreboard" aria-labelledby="ps-scoreboard-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="scoreboard" titleId="ps-scoreboard-title" />

        <div className="ps-sb-layout">
          <ol className="ps-sb-steps">
            {config.items.map(({ key }, index) => (
              <li key={key} data-ps-reveal data-ps-reveal-order={index}>
                <span className="ps-sb-steps__num" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <h3>{text(`publicSite.scoreboard.items.${key}.title`)}</h3>
                <p>{text(`publicSite.scoreboard.items.${key}.text`)}</p>
              </li>
            ))}
          </ol>

          <div data-ps-reveal data-ps-reveal-order="2">
            <ScoreboardPreview text={text} />
          </div>
        </div>

        <div className="ps-sb-flow-wrap" data-ps-reveal>
          <h3>{text('publicSite.scoreboard.secondTitle')}</h3>
          <p>{text('publicSite.scoreboard.secondText')}</p>
          <ol className="ps-sb-flow" aria-label={text('publicSite.scoreboard.secondTitle')}>
            {config.flow.map(({ key }, index) => (
              <li key={key}>
                <strong>{text(`publicSite.scoreboard.flow.${key}.title`)}</strong>
                <span>{text(`publicSite.scoreboard.flow.${key}.text`)}</span>
                {index < config.flow.length - 1 ? (
                  <span className="ps-sb-flow__arrow" aria-hidden="true" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
