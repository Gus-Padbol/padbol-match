import React from 'react';
import { ES_FALLBACKS, useSafeTranslation } from '../../../i18n/tSafe';

export function usePublicSiteText() {
  const { t } = useSafeTranslation();
  return (key) => t(key, ES_FALLBACKS[key] || '');
}

export function SectionIntro({ sectionKey, eyebrow, titleId }) {
  const text = usePublicSiteText();
  return (
    <header className="ps-section__intro">
      {eyebrow ? <p className="ps-section__eyebrow">{eyebrow}</p> : null}
      <h2 id={titleId}>{text(`publicSite.${sectionKey}.title`)}</h2>
      <p>{text(`publicSite.${sectionKey}.text`)}</p>
    </header>
  );
}

export function CardGrid({ sectionKey, items, numbered = false, className = '' }) {
  const text = usePublicSiteText();
  return (
    <div className={`ps-card-grid ${className}`.trim()}>
      {items.map(({ key }, index) => (
        <article className="ps-card" key={key}>
          {numbered ? <span className="ps-card__number" aria-hidden>{String(index + 1).padStart(2, '0')}</span> : null}
          <h3>{text(`publicSite.${sectionKey}.items.${key}.title`)}</h3>
          <p>{text(`publicSite.${sectionKey}.items.${key}.text`)}</p>
        </article>
      ))}
    </div>
  );
}

export function Flow({ labels, ariaLabel }) {
  return (
    <ol className="ps-flow" aria-label={ariaLabel}>
      {labels.map((label, index) => (
        <li key={`${label}-${index}`}>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function Closing({ children }) {
  return <p className="ps-section__closing">{children}</p>;
}

export function MediaPlaceholder({ children, className = '' }) {
  return (
    <div className={`ps-media-placeholder ${className}`.trim()} aria-label={children}>
      <span aria-hidden>＋</span>
      <p>{children}</p>
    </div>
  );
}
