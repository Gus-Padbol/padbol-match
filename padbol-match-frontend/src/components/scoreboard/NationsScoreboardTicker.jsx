import React from 'react';

const WHITE_LOGO = '/brand/padbol-match-logo-white.svg';
function publicLogo(value) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

/** Existing active, public scoreboard sponsors only; no invented advertisements. */
export default function NationsScoreboardTicker({sponsors = []}) {
  const approved = (Array.isArray(sponsors) ? sponsors : [])
    .filter(sponsor => sponsor && sponsor.activo !== false && typeof sponsor.nombre === 'string' && sponsor.nombre.trim())
    .filter(sponsor => !Array.isArray(sponsor.scoreboard_placements) || sponsor.scoreboard_placements.includes('ticker'))
    .slice(0, 10);
  const group = repeat => <div key={repeat} className="sb-nations-marquee__group" aria-hidden={repeat === 1 ? true : undefined}>
    {approved.length ? <img src={WHITE_LOGO} alt="Padbol Match" className="sb-nations-marquee__logo" /> : null}
    {approved.length ? approved.map((sponsor, index) => <span className="sb-nations-marquee__sponsor" key={sponsor.id || index}>
      {publicLogo(sponsor.logo_url) ? <img src={publicLogo(sponsor.logo_url)} alt="" className="sb-nations-marquee__logo" /> : null}
      <span>{sponsor.nombre.trim().slice(0, 120)}</span>
    </span>) : [0, 1, 2, 3].map(index => <img key={index} src={WHITE_LOGO} alt={index === 0 ? 'Padbol Match' : ''} className="sb-nations-marquee__logo" />)}
  </div>;
  return <div className="sb-nations-marquee" tabIndex={0} aria-label={approved.length ? 'Sponsors' : 'Padbol Match branding'} title="Keyboard focus pauses the strip">
      <div className="sb-nations-marquee__content">{[0, 1].map(group)}</div>
    </div>;
}
