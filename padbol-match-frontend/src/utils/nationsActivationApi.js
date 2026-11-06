// Cliente de la API nationsActivation desplegada.
// Contrato real (routes/nationsActivation.js):
//   POST /api/admin/nations-activation/events/:slug/configure
//   POST /api/admin/nations-activation/events/:slug/imports/preview
//   POST /api/admin/nations-activation/events/:slug/imports/confirm
const base = (apiBaseUrl) => String(apiBaseUrl || '').replace(/\/+$/, '');
const slugPattern = /^[a-z0-9][a-z0-9-]{2,79}$/;
const PAIS = /^[A-Z]{2}$/;

export const MAX_ROWS = 500;

export function validSlug(slug) {
  return slugPattern.test(String(slug || '').trim());
}

/**
 * "Nombre, PAÍS" o "Nombre, PAÍS, menor".
 * Valida nombre, país ISO de dos letras y tope de filas. Las líneas inválidas
 * no se envían: vuelven como errores visibles para el operador.
 */
export function parseRows(text) {
  const errores = [];
  const validas = [];
  const LINE = String.fromCharCode(10);
  const PROHIBIDOS = /[<>]/;
  String(text || '')
    .split(LINE)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const partes = line.split(',').map((part) => part.trim());
      if (partes.length > 3) {
        errores.push({linea: index + 1, motivo: 'Hay una coma de más: usa "Nombre, PAÍS" o "Nombre, PAÍS, menor".'});
        return;
      }
      const name = partes[0] || '';
      const country = String(partes[1] || '').toUpperCase();
      const marca = String(partes[2] || '').toLowerCase();
      if (name.length < 2 || name.length > 100) {
        errores.push({linea: index + 1, motivo: 'El nombre debe tener entre 2 y 100 caracteres.'});
        return;
      }
      if (PROHIBIDOS.test(name) || tieneControl(name)) {
        errores.push({linea: index + 1, motivo: 'El nombre no puede tener "<" ni ">".'});
        return;
      }
      if (!PAIS.test(country)) {
        errores.push({linea: index + 1, motivo: 'El país debe ser un código de dos letras, por ejemplo XX.'});
        return;
      }
      if (marca !== '' && marca !== 'menor') {
        errores.push({linea: index + 1, motivo: 'La tercera columna solo admite "menor" (o dejarla vacía).'});
        return;
      }
      validas.push({name, country, minor: marca === 'menor'});
    });

  if (validas.length > MAX_ROWS) {
    errores.push({linea: 0, motivo: `El máximo es de ${MAX_ROWS} filas por importación.`});
  }

  // rowKey opaca y estable: hash corto de nombre+país, sin PII. Si colisiona dentro
  // del mismo lote, se agrega un sufijo determinista.
  const usadas = new Set();
  const rows = validas.slice(0, MAX_ROWS).map((fila) => {
    let clave = hashClave(`${fila.name}|${fila.country}`);
    if (usadas.has(clave)) {
      let n = 2;
      while (usadas.has(`${clave}-${n}`)) n += 1;
      clave = `${clave}-${n}`;
    }
    usadas.add(clave);
    return {rowKey: clave, ...fila};
  });
  return Object.assign(rows, {errores});
}

/** Caracteres de control sin usar expresiones regulares (evita no-control-regex). */
function tieneControl(valor) {
  for (let i = 0; i < valor.length; i += 1) {
    const c = valor.charCodeAt(i);
    if (c < 32) return true;
  }
  return false;
}

/** Hash corto determinista (FNV-1a 32 bits) en base36: sin nombres dentro de la clave. */
function hashClave(valor) {
  let h = 0x811c9dc5;
  for (let i = 0; i < valor.length; i += 1) {
    h ^= valor.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `r${h.toString(36)}`;
}

/** Huella estable de las filas: si cambia, el preview anterior deja de valer. */
export function rowsFingerprint(rows) {
  return JSON.stringify((rows || []).map((row) => [row.rowKey, row.name, row.country, row.minor === true]));
}

export function newBatchId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const rand = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  const tail = (String(Date.now()).slice(-6) + rand()).slice(0, 12).padStart(12, '0');
  return `00000000-0000-4000-8000-${tail}`;
}

/**
 * torneo_participantes.sede_id es NOT NULL: un torneo con sede pendiente no puede
 * recibir nómina. Se consulta el torneo antes de importar.
 */
export async function readTournamentVenue({apiBaseUrl, getAuthHeaders}, torneoId) {
  const id = Number(torneoId);
  if (!Number.isSafeInteger(id) || id < 1) return {known: false, hasVenue: false};
  const headers = await getAuthHeaders();
  let response;
  try {
    response = await fetch(`${base(apiBaseUrl)}/api/torneos/${id}`, {headers});
  } catch {
    return {known: false, hasVenue: false};
  }
  if (!response.ok) return {known: false, hasVenue: false};
  const data = await response.json().catch(() => null);
  const torneo = Array.isArray(data) ? data[0] : data;
  if (!torneo || torneo.id == null) return {known: false, hasVenue: false};
  return {known: true, hasVenue: torneo.sede_id != null};
}

/** Compatibilidad: true solo con certeza de sede. */
export async function tournamentHasVenue(context, torneoId) {
  const {known, hasVenue} = await readTournamentVenue(context, torneoId);
  return known && hasVenue;
}

const MENSAJES_CODIGO = {
  VERIFIED_ACCOUNT_REQUIRED: 'Tu cuenta no está verificada. Verifica el correo y ingresa nuevamente.',
  FORBIDDEN: 'Tu cuenta no tiene permiso para esta operación.',
  CENTRAL_ADMIN_REQUIRED: 'Solo un administrador central puede confirmar la importación.',
  EVENT_NOT_AVAILABLE: 'El evento no existe o no está habilitado. Configúralo primero.',
  BATCH_CONFLICT: 'Ese lote ya se usó con otro contenido. Genera una vista previa nueva.',
  IMPORT_REVIEW_REQUIRED: 'La importación necesita revisión: corrige las filas señaladas.',
  ROW_KEY_CONFLICT: 'Una fila choca con una importación anterior. Revisa la vista previa.',
  MATCH_ALREADY_IMPORTED: 'Esa persona ya fue importada en este evento.',
  VENUE_REQUIRED: 'El torneo no tiene sede asignada: la nómina no puede confirmarse sin sede.',
  RATE_LIMITED: 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.',
  NOT_READY: 'El servicio no está disponible en este momento. Reintenta en unos minutos.',
  INVALID_ROW: 'Hay filas con datos inválidos. Revisa la vista previa.',
  OFFICIAL_EVENT_REQUIRED: 'El torneo debe ser oficial, de Padbol y con plantel de selección para activar Nations.',
  EVENT_BINDING_CONFLICT: 'Ese identificador ya está asociado a otro torneo. Usa otro identificador.',
  REGISTRATION_CLOSED: 'La inscripción está cerrada para este evento.',
  INVALID_EVENT_CONFIG: 'La configuración del evento es inválida: revisa el título y el torneo.',
  INVALID_ROWS: 'Las filas del import no son válidas. Revisa la vista previa.',
};

const MENSAJES = {
  401: 'La sesión no está disponible o venció. Ingresa nuevamente.',
  403: 'Tu cuenta no tiene permiso para esta operación (se requiere super administrador verificado).',
  404: 'El evento no existe o no está habilitado. Configúralo primero.',
  409: 'El servidor rechazó la operación por conflicto de datos. Revisa la vista previa antes de reintentar.',
  429: 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.',
  503: 'El servicio no está disponible en este momento. Reintenta en unos minutos.',
};

async function request(apiBaseUrl, getAuthHeaders, path, body) {
  const headers = await getAuthHeaders();
  if (!headers?.Authorization) {
    throw Object.assign(new Error('La sesión no está disponible. Ingresa nuevamente.'), {code: 'NO_SESSION'});
  }
  const response = await fetch(`${base(apiBaseUrl)}${path}`, {
    method: 'POST',
    headers: {...headers, 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const codigo = (data && (data.code || data.error)) || null;
    const error = new Error(MENSAJES_CODIGO[codigo] || MENSAJES[response.status] || 'La operación no se confirmó.');
    error.status = response.status;
    error.code = codigo;
    throw error;
  }
  return data;
}

const slugPath = (slug) => encodeURIComponent(String(slug).trim());

export async function configureEvent({apiBaseUrl, getAuthHeaders}, {slug, torneoId, title}) {
  if (!validSlug(slug)) {
    throw Object.assign(new Error('El identificador debe tener entre 3 y 80 caracteres en minúsculas, números o guiones.'), {code: 'INVALID_SLUG'});
  }
  if (!Number.isSafeInteger(Number(torneoId)) || Number(torneoId) < 1) {
    throw Object.assign(new Error('El torneo no es válido.'), {code: 'INVALID_TORNEO'});
  }
  if (String(title || '').trim().length < 3) {
    throw Object.assign(new Error('El título es demasiado corto.'), {code: 'INVALID_TITLE'});
  }
  return request(apiBaseUrl, getAuthHeaders, `/api/admin/nations-activation/events/${slugPath(slug)}/configure`, {
    torneoId: Number(torneoId),
    title: String(title).trim(),
    confirmed: true,
    // El evento debe quedar habilitado: preview y confirm lo exigen.
    enabled: true,
    // Nunca se aprueba la publicación de la nómina desde esta pantalla.
    rosterPublicationApproved: false,
  });
}

export async function previewImport({apiBaseUrl, getAuthHeaders}, {slug, rows}) {
  if (!validSlug(slug)) throw Object.assign(new Error('Configura el evento antes de importar.'), {code: 'INVALID_SLUG'});
  if (!Array.isArray(rows) || rows.length === 0) throw Object.assign(new Error('Agrega al menos una fila.'), {code: 'EMPTY_ROWS'});
  return request(apiBaseUrl, getAuthHeaders, `/api/admin/nations-activation/events/${slugPath(slug)}/imports/preview`, {rows});
}

export async function confirmImport({apiBaseUrl, getAuthHeaders}, {slug, batchId, rows}) {
  if (!validSlug(slug)) throw Object.assign(new Error('Configura el evento antes de importar.'), {code: 'INVALID_SLUG'});
  if (!batchId) throw Object.assign(new Error('Falta el identificador de lote.'), {code: 'MISSING_BATCH'});
  if (!Array.isArray(rows) || rows.length === 0) throw Object.assign(new Error('Agrega al menos una fila.'), {code: 'EMPTY_ROWS'});
  return request(apiBaseUrl, getAuthHeaders, `/api/admin/nations-activation/events/${slugPath(slug)}/imports/confirm`, {batchId, rows});
}
