import React from 'react';
import { IconGeroJugarNav, IconGeroNotificacionesNav, IconGeroUserNav } from './icons/GeroIcons';

const active = 'var(--accent)';
const idle = 'var(--text-secondary)';

export function HubIconPerfil({ active: isActive }) {
  const c = isActive ? active : idle;
  return (
    <span style={{ color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconGeroUserNav size={22} />
    </span>
  );
}

export function HubIconCorrer({ active: isActive }) {
  const c = isActive ? active : idle;
  return (
    <span style={{ color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconGeroJugarNav size={22} />
    </span>
  );
}

export function HubIconCampana({ active: isActive }) {
  const c = isActive ? active : idle;
  return (
    <span style={{ color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconGeroNotificacionesNav size={22} />
    </span>
  );
}

export function HubIconTrofeo({ active: isActive }) {
  const c = isActive ? active : idle;
  const stroke = {
    stroke: c,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" {...stroke} />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" {...stroke} />
      <path d="M4 22h16" {...stroke} />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" {...stroke} />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" {...stroke} />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" {...stroke} />
    </svg>
  );
}
