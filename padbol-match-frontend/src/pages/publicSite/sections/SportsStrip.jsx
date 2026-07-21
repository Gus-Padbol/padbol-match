import React from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../../../constants/deportesCanchaSede';
import SportIcon from '../../../components/common/SportIcon';
import { usePublicSiteText } from './SectionElements';

/**
 * Franja multideporte: solo deportes realmente habilitados en el producto
 * (`DEPORTES_CANCHA_SEDE_OPTIONS`) con sus íconos oficiales.
 */
export default function SportsStrip() {
  const text = usePublicSiteText();

  return (
    <aside className="ps-sports" aria-labelledby="ps-sports-title">
      <div className="public-site__shell ps-sports__inner">
        <div className="ps-sports__copy">
          <h2 id="ps-sports-title">{text('publicSite.sports.title')}</h2>
          <p>{text('publicSite.sports.text')}</p>
        </div>
        <ul className="ps-sports__list">
          {DEPORTES_CANCHA_SEDE_OPTIONS.map(({ key, label }) => (
            <li key={key} className={key === 'padbol' ? 'is-primary' : undefined}>
              <SportIcon deporte={key} size={26} color="currentColor" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
