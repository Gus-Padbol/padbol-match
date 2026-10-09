import React from 'react';
import { deporteLabelMiSedePrecios } from '../utils/sedeDuracionesApi';

export default function SedeDurationSummary({ row, moneda = 'ARS', activeLabel, inactiveLabel }) {
  return <>
    <span style={{ fontWeight: 800, minWidth: '72px' }}>{row.duracion_minutos} min</span>
    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
      {deporteLabelMiSedePrecios(row.deporte)} · {moneda} {Number(row.precio ?? 0).toLocaleString('es-AR')} · {row.activo ? activeLabel : inactiveLabel}
    </span>
  </>;
}
