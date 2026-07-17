/**
 * Cliente Admin para Membresías por sede (/api/admin/membresias/*).
 * Distinto del plan comercial (plan-pricing) y de PadCoins.
 */

const DEFAULT_API =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

export const MEMBRESIA_DURACION_TIPOS = [
  { id: 'mensual', label: 'Mensual', dias: 30 },
  { id: 'trimestral', label: 'Trimestral', dias: 90 },
  { id: 'semestral', label: 'Semestral', dias: 180 },
  { id: 'anual', label: 'Anual', dias: 365 },
  { id: 'dias', label: 'Personalizada (días)', dias: null },
];

export const MEMBRESIA_ESTADOS = [
  { id: '', label: 'Todos' },
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'activa', label: 'Activa' },
  { id: 'suspendida', label: 'Suspendida' },
  { id: 'vencida', label: 'Vencida' },
  { id: 'cancelada', label: 'Cancelada' },
];

export const MEMBRESIA_ORIGENES = [
  { id: 'manual', label: 'Manual' },
  { id: 'promocion', label: 'Promoción' },
  { id: 'pago', label: 'Pago' },
];

export const MEMBRESIA_MONEDAS = ['ARS', 'USD', 'EUR'];

export const MEMBRESIAS_PAGE_SIZE = 15;
export const MEMBRESIAS_Q_MIN = 2;
export const MEMBRESIAS_SORT_OPTIONS = Object.freeze(['created_at', 'inicio', 'vencimiento', 'estado']);
export const MEMBRESIAS_DIRECTION_OPTIONS = Object.freeze(['asc', 'desc']);

export function resolveMembresiasApiBase(apiBaseUrl) {
  return String(apiBaseUrl || DEFAULT_API).replace(/\/$/, '');
}

export function parseMembresiasApiError(status, data) {
  const msg = data?.error || data?.message || null;
  if (status === 403) return msg || 'No tenés permiso para esta sede (403).';
  if (status === 401) return msg || 'Sesión expirada. Volvé a iniciar sesión.';
  if (status === 503) return msg || 'Membresías aún no disponibles (migración pendiente).';
  return msg || `Error ${status || ''}`.trim();
}

async function fetchJson(url, { accessToken, method = 'GET', body, signal } = {}) {
  const headers = {
    Accept: 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(parseMembresiasApiError(res.status, data));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function resolveDuracionDiasPlan({ duracion_tipo, duracion_dias }) {
  const tipo = String(duracion_tipo || 'mensual').toLowerCase();
  if (tipo === 'dias') {
    const d = parseInt(String(duracion_dias ?? ''), 10);
    if (!Number.isFinite(d) || d < 1) return null;
    return d;
  }
  const hit = MEMBRESIA_DURACION_TIPOS.find((t) => t.id === tipo);
  return hit?.dias ?? 30;
}

export function addDaysToIso(fromIso, days) {
  const base = fromIso ? new Date(fromIso) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const ms = base.getTime() + Number(days) * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export function computeVencimientoFromPlan(inicioIso, plan) {
  const dias = resolveDuracionDiasPlan(plan || {});
  if (dias == null) return null;
  return addDaysToIso(inicioIso || new Date().toISOString(), dias);
}

export function emptyPlanForm(sedeId = '') {
  return {
    sede_id: sedeId ? String(sedeId) : '',
    nombre: '',
    descripcion: '',
    precio: '0',
    moneda: 'ARS',
    duracion_tipo: 'mensual',
    duracion_dias: '',
    activo: true,
    cupo: '',
    vigencia_desde: '',
    vigencia_hasta: '',
    renovacion_automatica: false,
    descuento_porcentual: '0',
    reservas_incluidas_por_periodo: '0',
    prioridad_horas: '0',
    cancelacion_horas_extra: '0',
  };
}

export function planToForm(plan, sedeIdFallback = '') {
  const b = plan?.beneficios || {};
  return {
    sede_id: String(plan?.sede_id ?? sedeIdFallback ?? ''),
    nombre: String(plan?.nombre || ''),
    descripcion: String(plan?.descripcion || ''),
    precio: plan?.precio != null ? String(plan.precio) : '0',
    moneda: String(plan?.moneda || 'ARS').toUpperCase(),
    duracion_tipo: String(plan?.duracion_tipo || 'mensual'),
    duracion_dias: plan?.duracion_dias != null ? String(plan.duracion_dias) : '',
    activo: plan?.activo !== false,
    cupo: plan?.cupo != null ? String(plan.cupo) : '',
    vigencia_desde: plan?.vigencia_desde ? String(plan.vigencia_desde).slice(0, 10) : '',
    vigencia_hasta: plan?.vigencia_hasta ? String(plan.vigencia_hasta).slice(0, 10) : '',
    renovacion_automatica: Boolean(plan?.renovacion_automatica),
    descuento_porcentual: String(b.descuento_porcentual ?? 0),
    reservas_incluidas_por_periodo: String(b.reservas_incluidas_por_periodo ?? 0),
    prioridad_horas: String(b.prioridad_horas ?? 0),
    cancelacion_horas_extra: String(b.cancelacion_horas_extra ?? 0),
  };
}

/**
 * @returns {{ ok: true, body: object } | { ok: false, errorKey: string }}
 */
export function validateAndBuildPlanPayload(form, { mode = 'create' } = {}) {
  const nombre = String(form?.nombre || '').trim();
  if (!nombre) return { ok: false, errorKey: 'nameRequired' };

  const sede_id = parseInt(String(form?.sede_id || ''), 10);
  if (mode === 'create' && (!Number.isFinite(sede_id) || sede_id <= 0)) {
    return { ok: false, errorKey: 'sedeRequired' };
  }

  const precio = Number(String(form?.precio ?? '').replace(',', '.'));
  if (!Number.isFinite(precio) || precio < 0) return { ok: false, errorKey: 'precioInvalid' };

  const duracion_tipo = String(form?.duracion_tipo || 'mensual').toLowerCase();
  if (!MEMBRESIA_DURACION_TIPOS.some((t) => t.id === duracion_tipo)) {
    return { ok: false, errorKey: 'duracionInvalid' };
  }

  let duracion_dias = null;
  if (duracion_tipo === 'dias') {
    duracion_dias = parseInt(String(form?.duracion_dias || ''), 10);
    if (!Number.isFinite(duracion_dias) || duracion_dias < 1) {
      return { ok: false, errorKey: 'duracionDiasInvalid' };
    }
  } else {
    duracion_dias = resolveDuracionDiasPlan({ duracion_tipo });
  }

  const descuento = Number(String(form?.descuento_porcentual ?? '0').replace(',', '.'));
  if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
    return { ok: false, errorKey: 'descuentoInvalid' };
  }

  const reservas = parseInt(String(form?.reservas_incluidas_por_periodo ?? '0'), 10);
  if (!Number.isFinite(reservas) || reservas < 0) {
    return { ok: false, errorKey: 'reservasInvalid' };
  }

  const prioridad = Number(String(form?.prioridad_horas ?? '0').replace(',', '.'));
  const cancelExtra = Number(String(form?.cancelacion_horas_extra ?? '0').replace(',', '.'));
  if (!Number.isFinite(prioridad) || prioridad < 0) return { ok: false, errorKey: 'prioridadInvalid' };
  if (!Number.isFinite(cancelExtra) || cancelExtra < 0) return { ok: false, errorKey: 'cancelacionInvalid' };

  let cupo = null;
  if (form?.cupo != null && String(form.cupo).trim() !== '') {
    cupo = parseInt(String(form.cupo), 10);
    if (!Number.isFinite(cupo) || cupo < 1) return { ok: false, errorKey: 'cupoInvalid' };
  }

  const body = {
    nombre,
    descripcion: String(form?.descripcion || '').trim() || null,
    precio,
    moneda: String(form?.moneda || 'ARS').trim().toUpperCase() || 'ARS',
    duracion_tipo,
    duracion_dias,
    activo: form?.activo !== false,
    cupo,
    vigencia_desde: form?.vigencia_desde
      ? `${String(form.vigencia_desde).slice(0, 10)}T00:00:00.000Z`
      : null,
    vigencia_hasta: form?.vigencia_hasta
      ? `${String(form.vigencia_hasta).slice(0, 10)}T23:59:59.999Z`
      : null,
    renovacion_automatica: Boolean(form?.renovacion_automatica),
    beneficios: {
      descuento_porcentual: descuento,
      reservas_incluidas_por_periodo: reservas,
      prioridad_horas: prioridad,
      cancelacion_horas_extra: cancelExtra,
    },
  };
  if (mode === 'create') body.sede_id = sede_id;
  return { ok: true, body };
}

export function countActivosPorPlan(membresias, planId) {
  const pid = Number(planId);
  return (Array.isArray(membresias) ? membresias : []).filter(
    (m) => Number(m.plan_id) === pid && String(m.estado) === 'activa',
  ).length;
}

export function accionesDisponiblesParaEstado(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'activa') return ['renovar', 'suspender', 'cancelar'];
  if (e === 'suspendida') return ['renovar', 'cancelar'];
  if (e === 'vencida') return ['renovar'];
  if (e === 'pendiente') return ['cancelar'];
  return [];
}

export function formatMembresiaFecha(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatMembresiaPrecio(precio, moneda = 'ARS') {
  const n = Number(precio);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: String(moneda || 'ARS'),
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n} ${moneda || ''}`.trim();
  }
}

export async function fetchMembresiaPlanes({
  apiBaseUrl,
  accessToken,
  sedeId,
  includeInactive = true,
  signal,
} = {}) {
  const base = resolveMembresiasApiBase(apiBaseUrl);
  const q = new URLSearchParams();
  if (sedeId != null && sedeId !== '') q.set('sede_id', String(sedeId));
  q.set('include_inactive', includeInactive ? '1' : '0');
  const data = await fetchJson(`${base}/api/admin/membresias/planes?${q}`, {
    accessToken,
    signal,
  });
  return Array.isArray(data.planes) ? data.planes : [];
}

export async function createMembresiaPlan({ apiBaseUrl, accessToken, body } = {}) {
  const base = resolveMembresiasApiBase(apiBaseUrl);
  return fetchJson(`${base}/api/admin/membresias/planes`, {
    accessToken,
    method: 'POST',
    body,
  });
}

export async function updateMembresiaPlan({ apiBaseUrl, accessToken, planId, body } = {}) {
  const base = resolveMembresiasApiBase(apiBaseUrl);
  return fetchJson(`${base}/api/admin/membresias/planes/${encodeURIComponent(planId)}`, {
    accessToken,
    method: 'PATCH',
    body,
  });
}

export async function fetchMembresiasAsignadas({
  apiBaseUrl,
  accessToken,
  sedeId,
  estado = '',
  planId = '',
  q = '',
  page = 1,
  limit = MEMBRESIAS_PAGE_SIZE,
  sort = 'created_at',
  direction = 'desc',
  signal,
} = {}) {
  const result = await fetchAdminMembresias({
    apiBaseUrl,
    accessToken,
    sedeId,
    estado,
    planId,
    q,
    page,
    limit,
    sort,
    direction,
    signal,
  });
  return result.membresias;
}

/**
 * @deprecated Preferir filtros server-side vía fetchAdminMembresias.
 * Conservado solo para tests/compat; el listado admin ya no lo usa.
 */
export function filterMembresiasClient(list, { planId = '', jugadorQ = '' } = {}) {
  let rows = Array.isArray(list) ? [...list] : [];
  if (planId) {
    rows = rows.filter((m) => String(m.plan_id) === String(planId));
  }
  const q = String(jugadorQ || '').trim().toLowerCase().replace(/^@+/, '');
  if (q) {
    rows = rows.filter((m) => {
      const email = String(m.email || m.jugador?.email || '').toLowerCase();
      const uid = String(m.user_id || '').toLowerCase();
      const nombre = String(
        m.jugador_nombre || m.display_name || m.jugador?.nombre || '',
      ).toLowerCase();
      return email.includes(q) || uid.includes(q) || nombre.includes(q);
    });
  }
  return rows;
}

/** Etiqueta de jugador desde fila paginada (objeto jugador del Backend). */
export function resolveMembresiaJugadorLabel(m) {
  const j = m?.jugador && typeof m.jugador === 'object' ? m.jugador : {};
  const name =
    String(m?.jugador_nombre || j.nombre || '').trim()
    || [j.nombre, j.apellido].filter(Boolean).join(' ').trim();
  const userRaw = m?.username || j.username || j.alias || '';
  const user = userRaw ? `@${String(userRaw).replace(/^@+/, '')}` : '';
  const email = String(m?.email || j.email || '').trim();
  if (name || user || email) {
    return [name, user, email].filter(Boolean).join(' · ');
  }
  const uid = String(m?.user_id || j.user_id || '');
  return uid ? `${uid.slice(0, 8)}…` : '—';
}

function toSafePage(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function toSafeLimit(value, fallback = MEMBRESIAS_PAGE_SIZE) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function toSafeTotal(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

function toSafeBool(value) {
  return value === true;
}

export function normalizeMembresiasSort(sort) {
  const s = String(sort || '').trim().toLowerCase();
  return MEMBRESIAS_SORT_OPTIONS.includes(s) ? s : 'created_at';
}

export function normalizeMembresiasDirection(direction) {
  const d = String(direction || '').trim().toLowerCase();
  return d === 'asc' || d === 'desc' ? d : 'desc';
}

/**
 * Normaliza respuesta de listado (con o sin pagination legacy).
 */
export function normalizeMembresiasListResponse(data, { fallbackLimit = MEMBRESIAS_PAGE_SIZE } = {}) {
  const membresias = Array.isArray(data?.membresias) ? data.membresias : [];
  const rawPag = data?.pagination && typeof data.pagination === 'object' ? data.pagination : null;

  if (!rawPag) {
    // Compat temporal: sin pagination → una sola página con las filas recibidas.
    const limit = toSafeLimit(fallbackLimit, MEMBRESIAS_PAGE_SIZE);
    const total = membresias.length;
    const total_pages = total === 0 ? 0 : 1;
    return {
      membresias,
      pagination: {
        page: 1,
        limit,
        total,
        total_pages,
        has_next: false,
        has_previous: false,
      },
    };
  }

  const page = toSafePage(rawPag.page);
  const limit = toSafeLimit(rawPag.limit, fallbackLimit);
  const total = toSafeTotal(rawPag.total);
  let total_pages = toSafeTotal(rawPag.total_pages);
  if (rawPag.total_pages == null || rawPag.total_pages === '') {
    total_pages = total === 0 ? 0 : Math.ceil(total / limit);
  }
  let has_next = toSafeBool(rawPag.has_next);
  let has_previous = toSafeBool(rawPag.has_previous);
  if (rawPag.has_next == null) has_next = total_pages > 0 && page < total_pages;
  if (rawPag.has_previous == null) has_previous = page > 1 && total > 0;

  return {
    membresias,
    pagination: {
      page,
      limit,
      total,
      total_pages,
      has_next,
      has_previous,
    },
  };
}

/** Query params: no envía vacíos; q solo si length >= 2 tras trim. */
export function buildMembresiasListQueryParams({
  sedeId,
  estado = '',
  planId = '',
  q = '',
  page = 1,
  limit = MEMBRESIAS_PAGE_SIZE,
  sort = 'created_at',
  direction = 'desc',
} = {}) {
  const params = new URLSearchParams();
  if (sedeId != null && String(sedeId).trim() !== '') params.set('sede_id', String(sedeId).trim());
  const est = String(estado || '').trim().toLowerCase();
  if (est) params.set('estado', est);
  if (planId != null && String(planId).trim() !== '') params.set('plan_id', String(planId).trim());
  const qTrim = String(q || '').trim().replace(/\s+/g, ' ');
  if (qTrim.length >= MEMBRESIAS_Q_MIN) params.set('q', qTrim);
  params.set('page', String(toSafePage(page)));
  params.set('limit', String(toSafeLimit(limit, MEMBRESIAS_PAGE_SIZE)));
  params.set('sort', normalizeMembresiasSort(sort));
  params.set('direction', normalizeMembresiasDirection(direction));
  return params;
}

/**
 * GET /api/admin/membresias — paginación server-side.
 * @returns {Promise<{ membresias: array, pagination: object }>}
 */
export async function fetchAdminMembresias({
  apiBaseUrl,
  accessToken,
  sedeId,
  estado = '',
  planId = '',
  q = '',
  page = 1,
  limit = MEMBRESIAS_PAGE_SIZE,
  sort = 'created_at',
  direction = 'desc',
  signal,
} = {}) {
  if (!accessToken) {
    const err = new Error(parseMembresiasApiError(401, {}));
    err.status = 401;
    throw err;
  }
  const base = resolveMembresiasApiBase(apiBaseUrl);
  const params = buildMembresiasListQueryParams({
    sedeId,
    estado,
    planId,
    q,
    page,
    limit,
    sort,
    direction,
  });
  const data = await fetchJson(`${base}/api/admin/membresias?${params}`, {
    accessToken,
    signal,
  });
  return normalizeMembresiasListResponse(data, { fallbackLimit: limit });
}

export async function asignarMembresia({ apiBaseUrl, accessToken, body } = {}) {
  const base = resolveMembresiasApiBase(apiBaseUrl);
  const data = await fetchJson(`${base}/api/admin/membresias/asignar`, {
    accessToken,
    method: 'POST',
    body,
  });
  return data.membresia || data;
}

export async function renovarMembresia({ apiBaseUrl, accessToken, id, body = {} } = {}) {
  const base = resolveMembresiasApiBase(apiBaseUrl);
  const data = await fetchJson(`${base}/api/admin/membresias/${encodeURIComponent(id)}/renovar`, {
    accessToken,
    method: 'POST',
    body,
  });
  return data.membresia || data;
}

export async function suspenderMembresia({ apiBaseUrl, accessToken, id } = {}) {
  const base = resolveMembresiasApiBase(apiBaseUrl);
  const data = await fetchJson(`${base}/api/admin/membresias/${encodeURIComponent(id)}/suspender`, {
    accessToken,
    method: 'POST',
    body: {},
  });
  return data.membresia || data;
}

export async function cancelarMembresia({ apiBaseUrl, accessToken, id } = {}) {
  const base = resolveMembresiasApiBase(apiBaseUrl);
  const data = await fetchJson(`${base}/api/admin/membresias/${encodeURIComponent(id)}/cancelar`, {
    accessToken,
    method: 'POST',
    body: {},
  });
  return data.membresia || data;
}

