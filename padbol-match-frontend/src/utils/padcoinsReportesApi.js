/**
 * Cliente FE para GET /api/admin/padcoins-reportes/*
 * Descarga CSV con Authorization (nunca URL pública sin token).
 */

const DEFAULT_API =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

export const PADCOINS_REPORTES_PAGE_SIZE = 50;

export const PADCOINS_REPORTES_MOV_TIPOS = [
  { id: '', label: 'Todos' },
  { id: 'earn', label: 'Acreditación' },
  { id: 'spend', label: 'Canje / gasto' },
  { id: 'adjust', label: 'Ajuste' },
  { id: 'reverse', label: 'Reversa' },
];

export const PADCOINS_REPORTES_CANJE_ESTADOS = [
  { id: '', label: 'Todos' },
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'aprobado', label: 'Aprobado' },
  { id: 'entregado', label: 'Entregado' },
  { id: 'cancelado', label: 'Cancelado' },
  { id: 'vencido', label: 'Vencido' },
];

export const PADCOINS_LOYALTY_LEVEL_OPTIONS = [
  { id: '', label: 'Todos' },
  { id: 'starter', label: 'Starter' },
  { id: 'bronze', label: 'Bronze' },
  { id: 'silver', label: 'Silver' },
  { id: 'gold', label: 'Gold' },
  { id: 'platinum', label: 'Platinum' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'elite', label: 'Elite' },
  { id: 'legend', label: 'Legend' },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolvePadcoinsReportesApiBase(apiBaseUrl) {
  return String(apiBaseUrl || DEFAULT_API).replace(/\/$/, '');
}

export function isUuidLike(raw) {
  return UUID_RE.test(String(raw || '').trim());
}

/** Date input YYYY-MM-DD → ISO start/end of day UTC for BE. */
export function padcoinsReporteFechaDesdeIso(yyyyMmDd) {
  const d = String(yyyyMmDd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return `${d}T00:00:00.000Z`;
}

export function padcoinsReporteFechaHastaIso(yyyyMmDd) {
  const d = String(yyyyMmDd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return `${d}T23:59:59.999Z`;
}

export function buildPadcoinsReportesQuery(filters = {}) {
  const q = new URLSearchParams();
  const set = (key, value) => {
    if (value == null || value === '') return;
    q.set(key, String(value));
  };

  set('sede_id', filters.sede_id);
  set('fecha_desde', filters.fecha_desde
    ? (String(filters.fecha_desde).includes('T')
      ? filters.fecha_desde
      : padcoinsReporteFechaDesdeIso(filters.fecha_desde))
    : null);
  set('fecha_hasta', filters.fecha_hasta
    ? (String(filters.fecha_hasta).includes('T')
      ? filters.fecha_hasta
      : padcoinsReporteFechaHastaIso(filters.fecha_hasta))
    : null);
  set('tipo', filters.tipo);
  set('campana_id', filters.campana_id);
  set('estado', filters.estado);
  set('beneficio_id', filters.beneficio_id);
  set('nivel', filters.nivel);

  const search = String(filters.search || filters.q || '').trim();
  if (search && isUuidLike(search)) {
    set('user_id', search);
  }

  if (filters.limit != null) set('limit', filters.limit);
  if (filters.offset != null) set('offset', filters.offset);

  return q;
}

export function parsePadcoinsReportesError(status, data) {
  const msg = data?.error || data?.message || data?.detail || null;
  if (status === 403) {
    return msg || 'No tenés permiso para ver este reporte (403).';
  }
  if (status === 401) {
    return msg || 'Sesión expirada. Volvé a iniciar sesión.';
  }
  if (data?.code === 'PADCOINS_EXPORT_LIMIT_EXCEEDED' || /límite de \d+ filas/i.test(String(msg || ''))) {
    return msg || 'La exportación supera el límite. Acotá filtros de sede o fecha.';
  }
  return msg || `Error ${status || ''}`.trim();
}

export function parseContentDispositionFilename(header) {
  const raw = String(header || '');
  if (!raw) return null;
  const star = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(raw);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return star[1].trim().replace(/^"|"$/g, '');
    }
  }
  const plain = /filename="([^"]+)"/i.exec(raw) || /filename=([^;]+)/i.exec(raw);
  if (!plain) return null;
  return plain[1].trim().replace(/^"|"$/g, '');
}

async function fetchJson(url, { accessToken, signal } = {}) {
  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(parsePadcoinsReportesError(res.status, data));
    err.status = res.status;
    err.code = data?.code || null;
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchPadcoinsReportesResumen({
  apiBaseUrl,
  accessToken,
  filters = {},
  signal,
} = {}) {
  const base = resolvePadcoinsReportesApiBase(apiBaseUrl);
  const q = buildPadcoinsReportesQuery(filters);
  const data = await fetchJson(`${base}/api/admin/padcoins-reportes/resumen?${q}`, {
    accessToken,
    signal,
  });
  return {
    resumen: data.resumen || data,
    filtros_aplicados: data.filtros_aplicados || null,
  };
}

export async function fetchPadcoinsReportesMovimientos({
  apiBaseUrl,
  accessToken,
  filters = {},
  page = 0,
  pageSize = PADCOINS_REPORTES_PAGE_SIZE,
  signal,
} = {}) {
  const base = resolvePadcoinsReportesApiBase(apiBaseUrl);
  const q = buildPadcoinsReportesQuery({
    ...filters,
    limit: pageSize,
    offset: Math.max(0, page) * pageSize,
  });
  const data = await fetchJson(`${base}/api/admin/padcoins-reportes/movimientos?${q}`, {
    accessToken,
    signal,
  });
  return {
    movimientos: Array.isArray(data.movimientos) ? data.movimientos : [],
    total: Number(data.total ?? data.paginacion?.total) || 0,
    paginacion: data.paginacion || null,
    filtros_aplicados: data.filtros_aplicados || null,
  };
}

export async function fetchPadcoinsReportesCanjes({
  apiBaseUrl,
  accessToken,
  filters = {},
  page = 0,
  pageSize = PADCOINS_REPORTES_PAGE_SIZE,
  signal,
} = {}) {
  const base = resolvePadcoinsReportesApiBase(apiBaseUrl);
  const q = buildPadcoinsReportesQuery({
    ...filters,
    limit: pageSize,
    offset: Math.max(0, page) * pageSize,
  });
  const data = await fetchJson(`${base}/api/admin/padcoins-reportes/canjes?${q}`, {
    accessToken,
    signal,
  });
  return {
    canjes: Array.isArray(data.canjes) ? data.canjes : [],
    total: Number(data.total ?? data.paginacion?.total) || 0,
    paginacion: data.paginacion || null,
    filtros_aplicados: data.filtros_aplicados || null,
  };
}

export async function fetchPadcoinsReportesJugadores({
  apiBaseUrl,
  accessToken,
  filters = {},
  page = 0,
  pageSize = PADCOINS_REPORTES_PAGE_SIZE,
  signal,
} = {}) {
  const base = resolvePadcoinsReportesApiBase(apiBaseUrl);
  const q = buildPadcoinsReportesQuery({
    ...filters,
    limit: pageSize,
    offset: Math.max(0, page) * pageSize,
  });
  const data = await fetchJson(`${base}/api/admin/padcoins-reportes/jugadores?${q}`, {
    accessToken,
    signal,
  });
  let jugadores = Array.isArray(data.jugadores) ? data.jugadores : [];
  const search = String(filters.search || '').trim();
  if (search && !isUuidLike(search)) {
    const needle = search.toLowerCase();
    jugadores = jugadores.filter((j) => {
      const nombre = String(j.jugador_nombre || '').toLowerCase();
      const email = String(j.jugador_email || '').toLowerCase();
      const uid = String(j.user_id || '').toLowerCase();
      return nombre.includes(needle) || email.includes(needle) || uid.includes(needle);
    });
  }
  return {
    jugadores,
    total: Number(data.total ?? data.paginacion?.total) || 0,
    paginacion: data.paginacion || null,
    filtros_aplicados: data.filtros_aplicados || null,
    searchFilteredLocal: Boolean(search && !isUuidLike(search)),
  };
}

/**
 * Descarga CSV con Bearer token vía blob (sin pestaña en blanco).
 * @param {'movimientos'|'canjes'|'jugadores'} kind
 */
export async function downloadPadcoinsReporteCsv({
  apiBaseUrl,
  accessToken,
  kind,
  filters = {},
} = {}) {
  if (!accessToken) {
    const err = new Error('Sesión requerida para exportar.');
    err.status = 401;
    throw err;
  }
  const allowed = new Set(['movimientos', 'canjes', 'jugadores']);
  if (!allowed.has(kind)) {
    throw new Error(`Tipo de exportación inválido: ${kind}`);
  }
  const base = resolvePadcoinsReportesApiBase(apiBaseUrl);
  const q = buildPadcoinsReportesQuery(filters);
  const res = await fetch(`${base}/api/admin/padcoins-reportes/${kind}.csv?${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(parsePadcoinsReportesError(res.status, data));
    err.status = res.status;
    err.code = data?.code || null;
    throw err;
  }

  const blob = await res.blob();
  const fromHeader = parseContentDispositionFilename(res.headers.get('Content-Disposition'));
  const filename = fromHeader || `padcoins-${kind}.csv`;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return { filename, size: blob.size };
}

export function formatPadcoinsReporteFecha(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPadcoinsNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('es-AR');
}
