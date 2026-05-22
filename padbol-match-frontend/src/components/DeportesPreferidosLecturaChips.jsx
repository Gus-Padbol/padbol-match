import React from 'react';
import { DEPORTES_PREFERIDOS_OPCIONES, normalizeDeportesPreferidosArray } from '../constants/deportesPreferidos';
import { DeporteIcono } from '../utils/deporteIcono';

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
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 9999,
              border: '2px solid #E11B22',
              background: '#eef2ff',
              color: '#312e81',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <DeporteIcono deporte={key} size={18} color="#312e81" />
            {lab}
          </span>
        );
      })}
    </div>
  );
}
