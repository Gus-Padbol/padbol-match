function timeToMinutes(hhmm) {
  const parts = String(hhmm || '').trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function normalizeDiaSemana(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function franjasPrecioShareDay(a, b) {
  const da = normalizeDiaSemana(a.dia_semana);
  const db = normalizeDiaSemana(b.dia_semana);
  if (da == null || db == null) return true;
  return da === db;
}

function sameDeporte(a, b) {
  return String(a.deporte || '').trim().toLowerCase() === String(b.deporte || '').trim().toLowerCase();
}

function franjaPrecioTimeInvalid(row) {
  const start = timeToMinutes(row.hora_inicio);
  const end = timeToMinutes(row.hora_fin);
  if (start == null || end == null) return 'Completá hora de inicio y fin.';
  if (end <= start) return 'La hora de fin debe ser posterior al inicio.';
  return null;
}

function rowsForOverlapCheck(existingRows, draft) {
  const active = (existingRows || []).filter((r) => r && r.activo !== false);
  if (!draft?.hora_inicio || !draft?.hora_fin) return active;
  return [
    ...active,
    {
      deporte: draft.deporte,
      dia_semana: draft.dia_semana === '' ? null : Number(draft.dia_semana),
      hora_inicio: draft.hora_inicio,
      hora_fin: draft.hora_fin,
    },
  ];
}

/**
 * Detecta superposición entre filas de `franjas_precio` (y opcionalmente un borrador nuevo).
 * @returns {{ hasOverlap: boolean, message: string }}
 */
export function detectFranjasPrecioOverlap(existingRows, draft = null) {
  const rows = rowsForOverlapCheck(existingRows, draft);

  for (let i = 0; i < rows.length; i += 1) {
    const invalid = franjaPrecioTimeInvalid(rows[i]);
    if (invalid) {
      const label = i < (existingRows || []).filter((r) => r && r.activo !== false).length ? `Franja ${i + 1}` : 'Nueva franja';
      return { hasOverlap: true, message: `${label}: ${invalid}` };
    }
  }

  const pairs = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (!sameDeporte(a, b)) continue;
      if (!franjasPrecioShareDay(a, b)) continue;
      const aStart = timeToMinutes(a.hora_inicio);
      const aEnd = timeToMinutes(a.hora_fin);
      const bStart = timeToMinutes(b.hora_inicio);
      const bEnd = timeToMinutes(b.hora_fin);
      if (aStart < bEnd && bStart < aEnd) {
        pairs.push({ a: i + 1, b: j + 1 });
      }
    }
  }

  if (pairs.length) {
    const detail = pairs.map((p) => `${p.a} y ${p.b}`).join(', ');
    return {
      hasOverlap: true,
      message: `Hay franjas de precio superpuestas (franjas ${detail}). Revisá deporte, día y horarios.`,
    };
  }

  return { hasOverlap: false, message: '' };
}

export function validateFranjaPrecioDraft(existingRows, draft) {
  if (!draft?.hora_inicio || !draft?.hora_fin) {
    return { ok: false, message: 'Hora inicio y fin son obligatorias.' };
  }
  if (draft.hora_fin <= draft.hora_inicio) {
    return { ok: false, message: 'Hora fin debe ser mayor que hora inicio.' };
  }
  const overlap = detectFranjasPrecioOverlap(existingRows, draft);
  if (overlap.hasOverlap) {
    return { ok: false, message: overlap.message };
  }
  return { ok: true, message: '' };
}
