export const DIAS_SEMANA_FRANJA = [
  { id: 'lun', label: 'Lun' },
  { id: 'mar', label: 'Mar' },
  { id: 'mie', label: 'Mié' },
  { id: 'jue', label: 'Jue' },
  { id: 'vie', label: 'Vie' },
  { id: 'sab', label: 'Sáb' },
  { id: 'dom', label: 'Dom' },
];

export const DIAS_SEMANA_DEFAULT_FRANJA = DIAS_SEMANA_FRANJA.map((d) => d.id);

export function newFranjaId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fj-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function normalizeFranjasHorarias(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((f) => ({
    id: String(f?.id || '').trim() || newFranjaId(),
    tipo: String(f?.tipo || '').trim() === 'fecha_especial' ? 'fecha_especial' : 'semanal',
    nombre: String(f?.nombre ?? '').trim(),
    fecha: String(f?.fecha ?? '').trim().slice(0, 10),
    dias: Array.isArray(f?.dias)
      ? f.dias.map((d) => String(d).trim()).filter((d) => DIAS_SEMANA_DEFAULT_FRANJA.includes(d))
      : DIAS_SEMANA_DEFAULT_FRANJA,
    hora_inicio: String(f?.hora_inicio ?? '').trim().slice(0, 5),
    hora_fin: String(f?.hora_fin ?? '').trim().slice(0, 5),
    deporte: String(f?.deporte ?? '').trim().toLowerCase() || '',
    cancha_id: f?.cancha_id != null && String(f.cancha_id).trim() !== ''
      ? String(f.cancha_id).trim()
      : '',
    precio:
      f?.precio === '' || f?.precio == null
        ? ''
        : String(f.precio).replace(/\./g, '').replace(/[^\d]/g, ''),
  }));
}

export function franjasHorariasToDbPayload(rows) {
  return rows.map((r) => {
    const digits = String(r.precio ?? '').replace(/\./g, '').replace(/[^\d]/g, '');
    const precio = digits === '' ? 0 : parseInt(digits, 10);
    const tipo = String(r.tipo || '').trim() === 'fecha_especial' ? 'fecha_especial' : 'semanal';
    const payload = {
      id: String(r.id || '').trim() || newFranjaId(),
      tipo,
      nombre: String(r.nombre || '').trim(),
      fecha: String(r.fecha || '').trim().slice(0, 10) || null,
      dias:
        tipo === 'fecha_especial'
          ? []
          : Array.isArray(r.dias) && r.dias.length
            ? r.dias.map((d) => String(d).trim()).filter((d) => DIAS_SEMANA_DEFAULT_FRANJA.includes(d))
            : DIAS_SEMANA_DEFAULT_FRANJA,
      hora_inicio: String(r.hora_inicio || '').trim().slice(0, 5),
      hora_fin: String(r.hora_fin || '').trim().slice(0, 5),
      precio: Number.isFinite(precio) ? precio : 0,
    };
    const deporte = String(r.deporte ?? '').trim().toLowerCase();
    const canchaId = r.cancha_id != null && String(r.cancha_id).trim() !== ''
      ? String(r.cancha_id).trim()
      : '';
    if (deporte) payload.deporte = deporte;
    if (canchaId) payload.cancha_id = canchaId;
    return payload;
  });
}

function timeToMinutes(hhmm) {
  const parts = String(hhmm || '').trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function sameScope(a, b) {
  const depA = String(a.deporte || '').trim().toLowerCase();
  const depB = String(b.deporte || '').trim().toLowerCase();
  if (depA !== depB) return false;
  const canA = String(a.cancha_id || '').trim();
  const canB = String(b.cancha_id || '').trim();
  if (canA !== canB) return false;
  return true;
}

function franjaTimeInvalid(row) {
  const start = timeToMinutes(row.hora_inicio);
  const end = timeToMinutes(row.hora_fin);
  if (start == null || end == null) return 'Completá hora de inicio y fin.';
  if (end <= start) return 'La hora de fin debe ser posterior al inicio.';
  return null;
}

function franjasShareDay(a, b) {
  if (a.tipo === 'fecha_especial' && b.tipo === 'fecha_especial') {
    return a.fecha && b.fecha && a.fecha === b.fecha;
  }
  if (a.tipo === 'semanal' && b.tipo === 'semanal') {
    const diasA = Array.isArray(a.dias) ? a.dias : [];
    const diasB = Array.isArray(b.dias) ? b.dias : [];
    return diasA.some((d) => diasB.includes(d));
  }
  return false;
}

/**
 * @returns {{ hasOverlap: boolean, message: string, pairs: Array<{ a: number, b: number }> }}
 */
export function detectFranjasHorariasOverlap(rows) {
  const normalized = normalizeFranjasHorarias(rows);
  const pairs = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const invalid = franjaTimeInvalid(normalized[i]);
    if (invalid) {
      return {
        hasOverlap: true,
        message: `Franja ${i + 1}: ${invalid}`,
        pairs: [],
      };
    }
  }

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i];
      const b = normalized[j];
      if (!sameScope(a, b)) continue;
      if (!franjasShareDay(a, b)) continue;
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
      message: `Hay franjas horarias superpuestas (franjas ${detail}). Revisá los horarios antes de guardar.`,
      pairs,
    };
  }

  return { hasOverlap: false, message: '', pairs: [] };
}

export function validateFranjasHorariasBeforeSave(rows) {
  const payload = franjasHorariasToDbPayload(rows);
  const invalida = payload.find((f) => {
    if (!f.hora_inicio || !f.hora_fin) return true;
    if (f.tipo === 'fecha_especial') return !f.fecha;
    return !Array.isArray(f.dias) || f.dias.length === 0;
  });
  if (invalida) {
    return { ok: false, message: 'Completá tipo, días/fecha y horarios de cada franja.' };
  }
  const overlap = detectFranjasHorariasOverlap(rows);
  if (overlap.hasOverlap) {
    return { ok: false, message: overlap.message };
  }
  return { ok: true, message: '', payload };
}
