import { getApiBaseUrl, getPublicApiBaseUrl } from './apiPublicBaseUrl';

const DEFAULT_API_BASE = getApiBaseUrl();

export const FIPA_DOCUMENTS_PATH = '/fipa/documentos';
export const FIPA_NOT_FOUND_VENUE_VALUE = 'no_encuentro_mi_cancha';

export const FIPA_INTEREST_PURPOSES = Object.freeze([
  'aprender_jugar',
  'jugador',
  'entrenador_arbitro',
  'club_sede',
  'organizar_competencia',
  'investigacion_prensa',
  'evaluar_proyecto',
  'otro',
]);

export const FIPA_INTEREST_ANSWER_OPTIONS = Object.freeze(['yes', 'no', 'prefer_not']);

export function normalizeFipaDocumentSlug(value) {
  const slug = String(value || '').trim();
  return slug === 'codigo-de-conducta' ? 'codigo-conducta' : slug;
}

export const FIPA_DOCUMENT_CATALOG = Object.freeze([
  Object.freeze({
    id: 'reglamento-oficial',
    slug: 'reglamento-oficial',
    titleKey: 'fipaLibrary.documents.officialRules',
    fallbackTitle: 'Reglamento Oficial de Padbol',
    accessLevel: 'authenticated',
  }),
  Object.freeze({
    id: 'codigo-conducta',
    slug: 'codigo-conducta',
    titleKey: 'fipaLibrary.documents.codeOfConduct',
    fallbackTitle: 'Código de Conducta para Competiciones Oficiales',
    accessLevel: 'authenticated',
  }),
  Object.freeze({
    id: 'reglamento-competiciones-internacionales',
    slug: 'reglamento-competiciones-internacionales',
    titleKey: 'fipaLibrary.documents.internationalCompetitions',
    fallbackTitle: 'Reglamento de Competiciones Internacionales FIPA 2026',
    accessLevel: 'member',
  }),
  Object.freeze({
    id: 'manual-arbitros',
    slug: 'manual-arbitros',
    titleKey: 'fipaLibrary.documents.refereeManual',
    fallbackTitle: 'Reglamento y Manual de Árbitros FIPA 2026',
    accessLevel: 'member',
  }),
  Object.freeze({
    id: 'protocolo-contingencia-planilla',
    slug: 'protocolo-contingencia-planilla',
    titleKey: 'fipaLibrary.documents.contingencyProtocol',
    fallbackTitle: 'Protocolo de Contingencia y Planilla Oficial Padbol Match FIPA 2026',
    accessLevel: 'member',
  }),
  Object.freeze({
    id: 'criterios-ranking-desempate',
    slug: 'criterios-ranking-desempate',
    titleKey: 'fipaLibrary.documents.rankingCriteria',
    fallbackTitle: 'Criterios de Ranking y Desempate FIPA 2026',
    accessLevel: 'member',
  }),
  Object.freeze({
    id: 'manual-organizador',
    slug: 'manual-organizador',
    titleKey: 'fipaLibrary.documents.organizerManual',
    fallbackTitle: 'Manual del Organizador FIPA 2026',
    accessLevel: 'member',
  }),
  Object.freeze({
    id: 'patrocinio-marca-transmision',
    slug: 'patrocinio-marca-transmision',
    titleKey: 'fipaLibrary.documents.brandBroadcast',
    fallbackTitle: 'Especificaciones de Patrocinio, Marca y Transmisión FIPA 2026',
    accessLevel: 'member',
  }),
  Object.freeze({
    id: 'inscripcion-autorizacion-imagen',
    slug: 'inscripcion-autorizacion-imagen',
    titleKey: 'fipaLibrary.documents.registrationForms',
    fallbackTitle: 'Formularios de Inscripción y Autorización de Imagen FIPA 2026',
    accessLevel: 'member',
  }),
]);

export function resolveFipaApiBase(apiBaseUrl) {
  return String(apiBaseUrl || getPublicApiBaseUrl() || DEFAULT_API_BASE).replace(/\/$/, '');
}

function normalizeStatus(raw) {
  const value = String(raw || '').trim().toLowerCase();
  const statuses = {
    pending: 'pending',
    pendiente: 'pending',
    approved: 'approved',
    aprobada: 'approved',
    aprobado: 'approved',
    active: 'approved',
    activa: 'approved',
    rejected: 'rejected',
    rechazada: 'rejected',
    rechazado: 'rejected',
    revoked: 'revoked',
    revocada: 'revoked',
    revocado: 'revoked',
    expired: 'expired',
    vencida: 'expired',
    vencido: 'expired',
  };
  return statuses[value] || 'none';
}

export function normalizeFipaLibraryState(data) {
  const request = data?.solicitud || data?.request || null;
  const grant = data?.habilitacion || data?.grant || null;
  const grantStatus = normalizeStatus(grant?.status ?? grant?.estado);
  const requestStatus = normalizeStatus(request?.status ?? request?.estado ?? data?.status ?? data?.estado);
  const grantActive = data?.member_access === true
    || data?.grant_active === true
    || data?.habilitado === true
    || grantStatus === 'approved';
  const interest = data?.profile || data?.interes || data?.interest || data?.interest_profile || null;
  const interestCompleted = data?.authenticated_access === true
    || data?.profile_complete === true
    || data?.interes_completo === true
    || data?.interest_completed === true
    || Boolean(interest?.completed_at || interest?.completado_at || interest?.id);
  return {
    status: grantActive ? 'approved' : requestStatus,
    grantActive,
    request,
    grant,
    expiresAt: grant?.expires_at || grant?.vence_at || data?.expires_at || null,
    interest,
    interestCompleted,
  };
}

export function normalizeOfficialFipaVenues(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.id != null && String(row?.nombre || '').trim())
    .map((row) => ({
      id: String(row.id),
      nombre: String(row.nombre || '').trim(),
      pais: String(row.pais || '').trim(),
      ciudad: String(row.ciudad || row.localidad || '').trim(),
      direccion: String(row.direccion || '').trim(),
      ubicacion: String(row.google_maps_url || row.maps_url || '').trim(),
      numeroLicencia: String(row.numero_licencia || '').trim(),
    }))
    .filter((row) => row.id && row.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

export function mergeFipaDocumentCatalog(serverRows) {
  const rows = Array.isArray(serverRows) ? serverRows : [];
  const preferredLocale = typeof navigator !== 'undefined'
    && String(navigator.language || '').toLowerCase().startsWith('en')
    ? 'en'
    : 'es';
  const bySlug = new Map();
  rows.forEach((row) => {
    const slug = String(row?.slug || row?.id || '');
    if (!slug) return;
    const candidates = bySlug.get(slug) || [];
    candidates.push(row);
    bySlug.set(slug, candidates);
  });
  return FIPA_DOCUMENT_CATALOG.map((document) => {
    const candidates = bySlug.get(document.slug) || [];
    const server = candidates.find((row) => String(row?.locale || '').toLowerCase() === preferredLocale)
      || candidates.find((row) => String(row?.locale || '').toLowerCase().includes(preferredLocale))
      || candidates[0]
      || {};
    return {
      ...document,
      serverId: server.id || server.document_id || document.id,
      version: server.version || server.version_label || null,
      filename: server.original_filename || server.filename || null,
      published: Boolean(server.id || server.document_id)
        && (server.status == null || String(server.status).toLowerCase() === 'published'),
    };
  });
}

function buildHeaders(accessToken, withJson = false) {
  const token = String(accessToken || '').trim();
  if (!token) {
    const error = new Error('Sesión requerida.');
    error.status = 401;
    throw error;
  }
  return {
    Accept: 'application/json, application/pdf',
    Authorization: `Bearer ${token}`,
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function parseApiError(response) {
  const data = await response.json().catch(() => ({}));
  const error = new Error(data?.error || data?.message || `No se pudo completar la operación (${response.status}).`);
  error.status = response.status;
  error.code = data?.code || null;
  error.data = data;
  throw error;
}

export async function fetchFipaAccountEligibility({ apiBaseUrl, accessToken, signal } = {}) {
  const response = await fetch(`${resolveFipaApiBase(apiBaseUrl)}/api/legal/elegibilidad`, {
    headers: buildHeaders(accessToken),
    signal,
  });
  if (!response.ok) return parseApiError(response);
  const data = await response.json();
  return {
    allowed: data?.allowed === true,
    ageBand: data?.age_band || null,
    enhancedPrivacy: data?.enhanced_privacy === true,
  };
}

export async function fetchFipaLibraryState({ apiBaseUrl, accessToken, signal } = {}) {
  const response = await fetch(`${resolveFipaApiBase(apiBaseUrl)}/api/fipa/biblioteca/estado`, {
    headers: buildHeaders(accessToken),
    signal,
  });
  if (!response.ok) return parseApiError(response);
  return normalizeFipaLibraryState(await response.json());
}

export async function fetchFipaDocuments({ apiBaseUrl, accessToken, signal } = {}) {
  const response = await fetch(`${resolveFipaApiBase(apiBaseUrl)}/api/fipa/biblioteca/documentos`, {
    headers: buildHeaders(accessToken),
    signal,
  });
  if (!response.ok) return parseApiError(response);
  const data = await response.json();
  return mergeFipaDocumentCatalog(data?.documentos || data?.documents || data);
}

export async function fetchOfficialFipaVenues({ apiBaseUrl, accessToken, signal } = {}) {
  const response = await fetch(`${resolveFipaApiBase(apiBaseUrl)}/api/fipa/biblioteca/sedes-oficiales`, {
    headers: buildHeaders(accessToken),
    signal,
  });
  if (!response.ok) return parseApiError(response);
  const data = await response.json();
  return normalizeOfficialFipaVenues(data?.venues || data?.sedes || data);
}

export function buildFipaAccessRequestPayload(form, officialVenues = []) {
  const venueId = String(form?.venueId || '').trim();
  const linkedToVenue = form?.clubLink === 'yes';
  const notFound = linkedToVenue && venueId === FIPA_NOT_FOUND_VENUE_VALUE;
  const venue = !linkedToVenue || notFound
    ? null
    : officialVenues.find((item) => String(item.id) === venueId) || null;
  return {
    purpose: String(form?.purpose || '').trim(),
    purpose_other: form?.purpose === 'otro' ? String(form?.purposeOther || '').trim() : null,
    plays_padbol: String(form?.playsPadbol || '').trim(),
    linked_to_club: String(form?.clubLink || '').trim(),
    sede_id: venue?.id || null,
    cancha_no_encontrada: notFound,
    pais: linkedToVenue ? venue?.pais || String(form?.country || '').trim() : null,
    ciudad: linkedToVenue ? venue?.ciudad || String(form?.city || '').trim() : null,
    nombre_cancha: linkedToVenue ? venue?.nombre || String(form?.venueName || '').trim() : null,
    direccion_ubicacion: linkedToVenue
      ? venue?.direccion || venue?.ubicacion || String(form?.location || '').trim()
      : null,
    whatsapp: form?.whatsappOptIn ? String(form?.whatsapp || '').trim() || null : null,
    whatsapp_consent: form?.whatsappOptIn === true,
  };
}

export function validateFipaAccessRequestForm(form, officialVenues = []) {
  if (!FIPA_INTEREST_PURPOSES.includes(String(form?.purpose || '').trim())) return 'purposeCategoryRequired';
  if (form?.purpose === 'otro' && !String(form?.purposeOther || '').trim()) return 'purposeOtherRequired';
  if (!FIPA_INTEREST_ANSWER_OPTIONS.includes(String(form?.playsPadbol || '').trim())) return 'playsPadbolRequired';
  if (!FIPA_INTEREST_ANSWER_OPTIONS.includes(String(form?.clubLink || '').trim())) return 'clubLinkRequired';
  const venueId = String(form?.venueId || '').trim();
  if (form?.clubLink === 'yes') {
    if (!venueId) return 'venueRequired';
    const notFound = venueId === FIPA_NOT_FOUND_VENUE_VALUE;
    if (!notFound && !officialVenues.some((item) => String(item.id) === venueId)) {
      return 'venueRequired';
    }
    if (notFound) {
      if (!String(form?.country || '').trim()) return 'countryRequired';
      if (!String(form?.city || '').trim()) return 'cityRequired';
      if (!String(form?.venueName || '').trim()) return 'venueNameRequired';
      if (!String(form?.location || '').trim()) return 'locationRequired';
    }
  }
  if (form?.purposeAcknowledged !== true) return 'purposeRequired';
  if (form?.whatsappOptIn && String(form?.whatsapp || '').replace(/\D/g, '').length < 8) {
    return 'whatsappInvalid';
  }
  return null;
}

export async function submitFipaInterestProfile({ apiBaseUrl, accessToken, body, signal } = {}) {
  const response = await fetch(`${resolveFipaApiBase(apiBaseUrl)}/api/fipa/biblioteca/perfil`, {
    method: 'PUT',
    headers: buildHeaders(accessToken, true),
    body: JSON.stringify(body || {}),
    signal,
  });
  if (!response.ok) return parseApiError(response);
  return response.json();
}

export async function submitFipaAccessRequest({ apiBaseUrl, accessToken, body, signal } = {}) {
  const response = await fetch(`${resolveFipaApiBase(apiBaseUrl)}/api/fipa/biblioteca/solicitudes`, {
    method: 'POST',
    headers: buildHeaders(accessToken, true),
    body: JSON.stringify(body || {}),
    signal,
  });
  if (!response.ok) return parseApiError(response);
  return response.json();
}

function filenameFromDisposition(header, fallback) {
  const raw = String(header || '');
  const utf = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(raw);
  if (utf) {
    try {
      return decodeURIComponent(utf[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return utf[1].trim().replace(/^"|"$/g, '');
    }
  }
  const plain = /filename="([^"]+)"/i.exec(raw) || /filename=([^;]+)/i.exec(raw);
  return plain?.[1]?.trim().replace(/^"|"$/g, '') || fallback;
}

function triggerBlobDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function downloadFipaDocument({ apiBaseUrl, accessToken, document: fipaDocument, signal } = {}) {
  const documentId = String(fipaDocument?.serverId || fipaDocument?.id || fipaDocument?.slug || '').trim();
  if (!documentId) throw new Error('Documento inválido.');
  const response = await fetch(
    `${resolveFipaApiBase(apiBaseUrl)}/api/fipa/biblioteca/documentos/${encodeURIComponent(documentId)}/descarga`,
    {
      method: 'POST',
      headers: buildHeaders(accessToken, true),
      body: '{}',
      signal,
    },
  );
  if (!response.ok) return parseApiError(response);

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    const blob = await response.blob();
    const filename = filenameFromDisposition(
      response.headers.get('content-disposition'),
      fipaDocument?.filename || `${fipaDocument?.slug || documentId}.pdf`,
    );
    triggerBlobDownload(blob, filename);
    return { mode: 'blob', filename };
  }

  const data = await response.json().catch(() => ({}));
  const signedUrl = String(
    data?.download_url || data?.url || data?.signed_url || data?.signedUrl || '',
  ).trim();
  if (!/^https:\/\//i.test(signedUrl)) {
    const error = new Error('El servidor no devolvió un enlace de descarga válido.');
    error.status = 502;
    throw error;
  }
  const anchor = document.createElement('a');
  anchor.href = signedUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.referrerPolicy = 'no-referrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return { mode: 'signed-url', url: signedUrl };
}
