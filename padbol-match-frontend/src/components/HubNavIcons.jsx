import React from 'react';

const active = 'var(--accent)';
const idle = 'var(--text-secondary)';

export function HubIconPerfil({ active: isActive }) {
  const c = isActive ? active : idle;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="7" r="4" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HubIconCorrer({ active: isActive }) {
  const c = isActive ? active : idle;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="14" cy="4" r="2" stroke={c} strokeWidth="2" />
      <path
        d="M6 21l3-7 2 2 3-5 4 2-2 5h6"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 14l-3 7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HubIconCampana({ active: isActive }) {
  const c = isActive ? active : idle;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 7h18s-3 0-3-7M13.73 21a2 2 0 0 1-3.46 0"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
