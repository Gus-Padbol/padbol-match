import React from 'react';

/** M10 mirrored: 10×6 m, red 1 m each side of net, service lines 1.75 m from ends. */
export default function NationsTacticalCourt({teams,disabled,onPlayer,selected}) {
 return <div className="nt-court" aria-label="Padbol court, two players per side">
  <svg viewBox="0 0 1000 600" aria-hidden="true" className="nt-court__floor">
   <defs><pattern id="nt-tiles" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="white" strokeOpacity=".07" strokeWidth="1"/></pattern></defs>
   <rect width="1000" height="600" fill="#123da1"/><rect x="400" width="200" height="600" fill="#ce263d"/>
   <rect width="1000" height="600" fill="url(#nt-tiles)"/>
   <path d="M175 0V600M825 0V600M400 0V600M600 0V600M175 300H825M500 0V600" fill="none" stroke="white" strokeWidth="6"/>
   <path d="M500 0V600" stroke="#10141d" strokeWidth="16" strokeDasharray="6 5"/>
   <path d="M500 0V600" stroke="white" strokeWidth="3"/>
  </svg>
  {['A','B'].map(side=><div key={side} className={`nt-court__half nt-court__half--${side.toLowerCase()}`}>
   {[0,1].map(index=>{const player=teams[side].active[index];return <button key={player?.id||index} type="button" className={`nt-player ${selected?.side===side&&selected?.outId===player?.id?'is-selected':''}`} disabled={disabled||!player} title={player?.name||'Lineup pending'} aria-label={player?`Replace ${player.name} for ${teams[side].name}`:`Player pending for ${teams[side].name}`} aria-pressed={Boolean(player&&selected?.side===side&&selected?.outId===player.id)} onClick={()=>onPlayer(side,player.id)}>
    <span className="nt-player__avatar" aria-hidden="true">{player?.name?.split(/\s+/).slice(0,2).map(n=>n[0]).join('')||'—'}</span><span className="nt-player__name">{player?.name||'Lineup pending'}</span>
   </button>;})}
  </div>)}
 </div>;
}
