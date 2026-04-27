import React from 'react';

/** Medalla de capitán (misma en toda la app; no usar ⚽ en este contexto). */
export const ICONO_CAPITAN = '🎖️';

/**
 * Indica si la fila `p` en `jugadores[]` es el capitán (rol BD `creador` / `creador_id` / `creador_email`).
 * No modifica datos; solo refleja la convención de la API.
 */
export function esCapitanJugadorEnFila(p, equipoRow) {
  if (!equipoRow || !p) return false;
  if (String(p.rol || '').toLowerCase() === 'creador') return true;
  const cid = String(equipoRow.creador_id || '').trim();
  if (cid && p.id != null && String(p.id) === cid) return true;
  const ce = String(equipoRow.creador_email || '').trim().toLowerCase();
  const pe = String(p.email || '').trim().toLowerCase();
  if (ce && pe && ce === pe) return true;
  return false;
}

/** Sufijo dorado "C" junto al nombre del capitán en listas. */
export function CapitanBadgeC() {
  return (
    <span style={{ fontWeight: 800, color: '#F59E0B', marginLeft: '6px' }} title="Capitán" aria-label="Capitán">
      C
    </span>
  );
}
