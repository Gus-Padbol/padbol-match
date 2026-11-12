import React from 'react';
import '../pages/NationsInscripcion.css';
import './NationsRegistrationShell.css';
export default function NationsRegistrationShell({children}) {
 return <main className="nations-page nations-essential"><div className="nations-shell"><header className="nations-topbar"><div className="nations-brand"><img className="nations-brand__logo nations-brand__logo--light" src="/brand/oficial-2026/padbol-internacional-light.svg" alt="Padbol"/><img className="nations-brand__logo nations-brand__logo--dark" src="/brand/oficial-2026/padbol-internacional-dark.svg" alt="Padbol"/></div><span className="nations-event-chip">Nations Cup</span></header>{children}</div></main>;
}
