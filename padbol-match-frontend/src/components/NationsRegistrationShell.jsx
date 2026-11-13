import React from 'react';
import '../pages/NationsInscripcion.css';
import './NationsRegistrationShell.css';
export default function NationsRegistrationShell({children}) {
 return <main className="nations-page nations-essential"><div className="nations-shell">
  <header className="nations-topbar">
   <img className="nations-event-crest" src="/brand/oficial-2026/nations-cup-napoli-2026-black.png" alt="5th Padbol Nations Cup"/>
   <div className="nations-event-heading">
    <p className="nations-event-title">5th Padbol Nations Cup</p>
    <p className="nations-event-meta">November 20–22, 2026<br/>Mostra d’Oltremare, Naples, Italy</p>
   </div>
  </header>
  <div className="nations-brand-rail" aria-label="Padbol, FIPA and Padbol Match"><img src="/brand/oficial-2026/padbol-internacional-light.svg" alt="Padbol"/><img src="/brand/oficial-2026/fipa-color.png" alt="FIPA"/><img src="/brand/padbol-match-logo-oficial.svg" alt="Padbol Match"/></div>
  {children}
 </div></main>;
}
