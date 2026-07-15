/**
 * MEJ-07 Frontend: deporte personalizado en canchas (`deporte = "custom"`).
 * Alineado al contrato Backend (`lib/canchaDeporteCustom.js`).
 * No usar este slug en torneos, rankings, marcador ni preferencias globales.
 */

export const DEPORTE_CUSTOM = 'custom';

export const CANCHA_DEPORTE_OFICIAL_ADMIN = Object.freeze([
  'padbol',
  'padel',
  'tenis',
  'pickleball',
]);

/** Selector admin Mi Sede → Canchas (oficiales + custom). */
export const CANCHA_DEPORTE_ADMIN_VALUES = Object.freeze([
  ...CANCHA_DEPORTE_OFICIAL_ADMIN,
  DEPORTE_CUSTOM,
]);

export const MODALIDAD_CUSTOM_VALUES = Object.freeze(['individual', 'parejas', 'equipos']);

export const DEPORTE_OFICIAL_LABELS = Object.freeze({
  padbol: 'Padbol',
  padel: 'Pádel',
  pickleball: 'Pickleball',
  tenis: 'Tenis',
  squash: 'Squash',
  futbol_5: 'Fútbol 5',
  futbol_7: 'Fútbol 7',
});

const DEPORTE_PERSONALIZADO_MAX = 80;
const OBSERVACION_MAX = 500;

export function isDeporteCustom(raw) {
  return String(raw ?? '').trim().toLowerCase() === DEPORTE_CUSTOM;
}

export function emptyCanchaModalDraft() {
  return {
    nombre: '',
    estado: 'activa',
    descripcion: '',
    deporte: 'padbol',
    deporte_personalizado: '',
    cantidad_jugadores: '',
    modalidad_custom: 'parejas',
    duracion_sugerida_min: '',
    observacion_custom: '',
  };
}

export function canchaToModalDraft(cancha) {
  const c = cancha || {};
  const deporteRaw = String(c.deporte || '').trim().toLowerCase();
  const deporte = CANCHA_DEPORTE_ADMIN_VALUES.includes(deporteRaw)
    ? deporteRaw
    : (isDeporteCustom(deporteRaw) ? DEPORTE_CUSTOM : 'padbol');
  const esCustom = isDeporteCustom(deporte);
  return {
    nombre: String(c.nombre || ''),
    estado: c.estado === 'inactiva' ? 'inactiva' : 'activa',
    descripcion: String(c.descripcion || ''),
    deporte,
    deporte_personalizado: esCustom ? String(c.deporte_personalizado || '') : '',
    cantidad_jugadores: esCustom && c.cantidad_jugadores != null ? String(c.cantidad_jugadores) : '',
    modalidad_custom: esCustom && MODALIDAD_CUSTOM_VALUES.includes(String(c.modalidad_custom || '').toLowerCase())
      ? String(c.modalidad_custom).toLowerCase()
      : 'parejas',
    duracion_sugerida_min: esCustom && c.duracion_sugerida_min != null
      ? String(c.duracion_sugerida_min)
      : '',
    observacion_custom: esCustom ? String(c.observacion_custom || '') : '',
  };
}

/**
 * Label visible: prioriza deporte_label del API; nunca “Padbol” para custom.
 */
export function resolveCanchaDeporteLabel(cancha, { customFallback = 'Deporte personalizado' } = {}) {
  const c = cancha || {};
  if (c.deporte_label != null && String(c.deporte_label).trim() !== '') {
    return String(c.deporte_label).trim();
  }
  if (isDeporteCustom(c.deporte)) {
    const custom = String(c.deporte_personalizado || '').trim();
    return custom || customFallback;
  }
  const key = String(c.deporte || '').trim().toLowerCase();
  if (!key) return DEPORTE_OFICIAL_LABELS.padbol;
  return DEPORTE_OFICIAL_LABELS[key] || key.replace(/_/g, ' ');
}

export function formatCanchaManualOptionLabel(cancha) {
  const nombre = String(cancha?.nombre || '').trim();
  const numero = cancha?.numero_reserva ?? cancha?.orden;
  const base = nombre || (numero != null ? `Cancha ${numero}` : 'Cancha');
  const dep = resolveCanchaDeporteLabel(cancha);
  if (!dep) return base;
  if (isDeporteCustom(cancha?.deporte)) {
    return `${base} · ${dep}`;
  }
  return `${base} · ${dep}`;
}

function trimOrNull(raw, maxLen) {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  return t.slice(0, maxLen);
}

function parseOptionalIntInRange(raw, { min, max, field }) {
  if (raw == null || raw === '') return { ok: true, value: null };
  const trimmed = String(raw).trim();
  const invalidKey = field === 'duracion_sugerida_min' ? 'customDurationInvalid' : 'customPlayersInvalid';
  const rangeKey = field === 'duracion_sugerida_min' ? 'customDurationRange' : 'customPlayersRange';
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, errorKey: invalidKey, field };
  }
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < min || n > max) {
    return { ok: false, errorKey: rangeKey, field };
  }
  return { ok: true, value: n };
}

/**
 * Validación client-side del draft modal (custom).
 * @returns {{ ok: true } | { ok: false, errorKey: string, errorParams?: object }}
 */
export function validateCanchaModalDraft(draft) {
  const nombre = String(draft?.nombre || '').trim();
  if (!nombre) return { ok: false, errorKey: 'nameRequired' };

  const deporte = String(draft?.deporte || 'padbol').trim().toLowerCase();
  if (!isDeporteCustom(deporte)) return { ok: true };

  const disciplina = String(draft?.deporte_personalizado || '').trim();
  if (!disciplina) return { ok: false, errorKey: 'customDisciplineRequired' };

  const cantidad = parseOptionalIntInRange(draft?.cantidad_jugadores, {
    min: 1,
    max: 40,
    field: 'cantidad_jugadores',
  });
  if (!cantidad.ok) return { ok: false, errorKey: cantidad.errorKey };
  if (cantidad.value == null) return { ok: false, errorKey: 'customPlayersRequired' };

  const modalidad = String(draft?.modalidad_custom || '').trim().toLowerCase();
  if (!modalidad) return { ok: false, errorKey: 'customModalityRequired' };
  if (!MODALIDAD_CUSTOM_VALUES.includes(modalidad)) {
    return { ok: false, errorKey: 'customModalityInvalid' };
  }

  const duracion = parseOptionalIntInRange(draft?.duracion_sugerida_min, {
    min: 15,
    max: 240,
    field: 'duracion_sugerida_min',
  });
  if (!duracion.ok) return { ok: false, errorKey: duracion.errorKey };

  return { ok: true };
}

/**
 * Body deporte + metadatos para POST/PATCH (contrato Backend).
 * Oficiales: custom columns = null (limpia al pasar de custom → oficial).
 */
export function buildCanchaDeporteApiPayload(draft) {
  const deporte = String(draft?.deporte || 'padbol').trim().toLowerCase() || 'padbol';

  if (!isDeporteCustom(deporte)) {
    return {
      deporte,
      deporte_personalizado: null,
      cantidad_jugadores: null,
      modalidad_custom: null,
      duracion_sugerida_min: null,
      observacion_custom: null,
    };
  }

  const cantidad = parseInt(String(draft.cantidad_jugadores).trim(), 10);
  const durRaw = String(draft.duracion_sugerida_min ?? '').trim();
  const duracion = durRaw === '' ? null : parseInt(durRaw, 10);

  return {
    deporte: DEPORTE_CUSTOM,
    deporte_personalizado: trimOrNull(draft.deporte_personalizado, DEPORTE_PERSONALIZADO_MAX),
    cantidad_jugadores: cantidad,
    modalidad_custom: String(draft.modalidad_custom || '').trim().toLowerCase(),
    duracion_sugerida_min: Number.isFinite(duracion) ? duracion : null,
    observacion_custom: trimOrNull(draft.observacion_custom, OBSERVACION_MAX),
  };
}

export function buildCanchaWriteBody(draft) {
  const nombre = String(draft?.nombre || '').trim();
  const estado = draft?.estado === 'inactiva' ? 'inactiva' : 'activa';
  const descripcion = String(draft?.descripcion || '').trim() || null;
  return {
    nombre,
    estado,
    descripcion,
    ...buildCanchaDeporteApiPayload(draft),
  };
}

/** Duración sugerida usable en selector 60/90/120 (reserva manual). */
export function suggestedDurationForManualBooking(cancha) {
  if (!isDeporteCustom(cancha?.deporte)) return null;
  const n = parseInt(String(cancha?.duracion_sugerida_min ?? ''), 10);
  if ([60, 90, 120].includes(n)) return n;
  return null;
}

export function modalityLabelKey(modalidad) {
  const m = String(modalidad || '').trim().toLowerCase();
  if (m === 'individual') return 'customModalityIndividual';
  if (m === 'parejas') return 'customModalityPairs';
  if (m === 'equipos') return 'customModalityTeams';
  return null;
}
