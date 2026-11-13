import React from 'react';
import '../pages/NationsInscripcion.css';
import './NationsRegistrationShell.css';
export default function NationsRegistrationShell({children}) {
 return <main className="nations-page nations-essential"><div className="nations-shell"><header className="nations-topbar"><div className="nations-brand-rail" aria-label="Padbol, FIPA and Padbol Match"><img src="/brand/oficial-2026/padbol-internacional-light.svg" alt="Padbol"/><img src="/brand/oficial-2026/fipa-color.png" alt="FIPA"/><img src="/brand/padbol-match-logo-oficial.svg" alt="Padbol Match"/></div><span className="nations-event-chip">Nations Cup</span></header>{children}</div></main>;
}
