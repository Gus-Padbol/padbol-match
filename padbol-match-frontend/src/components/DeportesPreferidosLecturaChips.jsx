import React from 'react';
import { DEPORTES_PREFERIDOS_OPCIONES, normalizeDeportesPreferidosArray } from '../constants/deportesPreferidos';

/** Chips solo lectura para `deportes_preferidos` en perfiles. */
export default function DeportesPreferidosLecturaChips({ keys }) {
  const list = normalizeDeportesPreferidosArray(keys);
  if (!list.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {list.map((key) => {
        const lab = DEPORTES_PREFERIDOS_OPCIONES.find((o) => o.key === key)?.label || key;
        return (
          <span
            key={key}
            style={{
              display: 'inline-block',
              padding: '8px 14px',
              borderRadius: 9999,
              border: '2px solid #4f46e5',
              background: '#eef2ff',
              color: '#312e81',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {lab}
          </span>
        );
      })}
    </div>
  );
}
