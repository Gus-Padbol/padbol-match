import React, { useState } from 'react';
import { PUBLIC_SITE_SECTIONS } from '../../../content/publicSiteContent';
import { Closing, SectionIntro, usePublicSiteText } from './SectionElements';

/**
 * Tres perspectivas conectadas. Panel activo con más presencia; los otros
 * quedan visibles y accesibles (contenido siempre en el DOM, sin display:none
 * para lectores de pantalla, solo jerarquía visual).
 */
export default function EcosystemSection() {
  const config = PUBLIC_SITE_SECTIONS.ecosystem;
  const text = usePublicSiteText();
  const [activeKey, setActiveKey] = useState(config.items[0].key);

  return (
    <section id={config.id} className="ps-section ps-section--ecosystem" aria-labelledby="ps-ecosystem-title">
      <div className="public-site__shell">
        <SectionIntro sectionKey="ecosystem" titleId="ps-ecosystem-title" />

        <div className="ps-eco-switch" role="group" aria-label={text('publicSite.ecosystem.title')}>
          {config.items.map(({ key }) => (
            <button
              key={key}
              type="button"
              className={`ps-eco-switch__btn${key === activeKey ? ' is-active' : ''}`}
              aria-pressed={key === activeKey}
              onClick={() => setActiveKey(key)}
            >
              {text(`publicSite.ecosystem.items.${key}.title`)}
            </button>
          ))}
        </div>

        <div className="ps-eco-panels">
          {config.items.map(({ key }, index) => (
            <article
              key={key}
              className={`ps-eco-panel is-${key}${key === activeKey ? ' is-active' : ''}`}
              data-ps-reveal
              data-ps-reveal-order={index}
              onClick={() => setActiveKey(key)}
              onFocus={() => setActiveKey(key)}
              tabIndex={0}
            >
              <span className="ps-eco-panel__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{text(`publicSite.ecosystem.items.${key}.title`)}</h3>
              <p>{text(`publicSite.ecosystem.items.${key}.text`)}</p>
              <span className="ps-eco-panel__link" aria-hidden="true" />
            </article>
          ))}
        </div>

        <Closing>{text('publicSite.ecosystem.closing')}</Closing>
      </div>
    </section>
  );
}
