/**
 * Public response contracts for legacy endpoints.
 * Keep these allowlists deliberately small: rows may contain identity/contact data.
 */

export const LEGACY_PLAYER_PUBLIC_SELECT = [
  'id',
  'nombre',
  'foto_url',
  'nacionalidad',
  'pierna_habil',
  'bio',
  'estado',
].join(',');

export const PUBLIC_RESERVA_OCCUPANCY_SELECT = [
  'id',
  'hora',
  'hora_inicio',
  'hora_fin',
  'cancha',
  'cancha_id',
  'estado',
  'created_at',
  'sede',
  'sede_id',
  'duracion_minutos',
].join(',');

export const PUBLIC_TOURNAMENT_PLAYER_SELECT = [
  'id',
  'torneo_id',
  'nombre',
  'numero_camiseta',
  'es_capitan',
  'pais',
].join(',');

export const PUBLIC_TOURNAMENT_TEAM_SELECT = [
  'id',
  'torneo_id',
  'nombre',
  'sede_id',
  'jugadores',
  'puntos_totales',
  'puntos_ranking',
  'tipo_equipo',
  'inscripcion_estado',
].join(',');

const ADMIN_CREDIT_ROLES = new Set(['admin_club', 'admin_cadena', 'admin_nacional']);

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function cleanPublicName(value, fallback = null) {
  const text = cleanText(value);
  if (!text || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return fallback;
  return text;
}

function cleanPublicAlias(value) {
  const text = cleanText(value);
  if (!text || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return null;
  return text;
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeEmailAddress(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function buildPrivacyFeatureDisabledPayload(feature) {
  return {
    error: 'Esta función está temporalmente deshabilitada mientras completamos sus controles de privacidad.',
    code: 'FEATURE_DISABLED_PRIVACY_REVIEW',
    feature,
  };
}

export function privacyFeatureDisabledHandler(feature) {
  return (_req, res) => res.status(410).json(buildPrivacyFeatureDisabledPayload(feature));
}

export function mapLegacyPlayerPublic(row) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    nombre: cleanPublicName(row.nombre, 'Jugador'),
    foto_url: cleanText(row.foto_url),
    nacionalidad: cleanText(row.nacionalidad),
    pierna_habil: cleanText(row.pierna_habil),
    bio: cleanText(row.bio),
    estado: cleanText(row.estado),
  };
}

export function mapPublicReservaOccupancy(row) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    hora: cleanText(row.hora),
    hora_inicio: cleanText(row.hora_inicio),
    hora_fin: cleanText(row.hora_fin),
    cancha: row.cancha ?? null,
    cancha_id: row.cancha_id ?? null,
    estado: cleanText(row.estado),
    created_at: cleanText(row.created_at),
    sede: cleanText(row.sede),
    sede_id: row.sede_id ?? null,
    duracion_minutos: row.duracion_minutos ?? null,
  };
}

export function mapTournamentPlayerPublic(row) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    torneo_id: row.torneo_id ?? null,
    nombre: cleanPublicName(row.nombre, 'Jugador'),
    numero_camiseta: row.numero_camiseta ?? null,
    es_capitan: row.es_capitan === true,
    pais: cleanText(row.pais),
  };
}

export function mapTournamentTeamMemberPublic(row) {
  if (!row || typeof row !== 'object') return null;
  const nombre = cleanPublicName(
    row.nombre ?? row.display_name ?? row.apodo ?? row.alias,
    'Jugador',
  );
  return {
    nombre,
    alias: cleanPublicAlias(row.alias ?? row.apodo),
    foto_url: cleanText(row.foto_url ?? row.avatar_url),
    pais: cleanText(row.pais),
    es_capitan: row.es_capitan === true || String(row.rol || '').trim().toLowerCase() === 'capitan',
    estado: cleanText(row.estado),
  };
}

export function mapTournamentTeamPublic(row, { grupo = null } = {}) {
  if (!row) return null;
  const jugadores = parseArray(row.jugadores)
    .map(mapTournamentTeamMemberPublic)
    .filter(Boolean);
  const capitan = jugadores.find((jugador) => jugador.es_capitan) ?? jugadores[0] ?? null;
  return {
    id: row.id ?? null,
    torneo_id: row.torneo_id ?? null,
    nombre: cleanPublicName(row.nombre, 'Equipo'),
    sede_id: row.sede_id ?? null,
    puntos_totales: row.puntos_totales ?? 0,
    puntos_ranking: row.puntos_ranking ?? null,
    grupo: grupo ?? null,
    jugadores,
    jugadores_count: jugadores.length,
    capitan_nombre: capitan?.nombre ?? null,
    estado: cleanText(row.inscripcion_estado) ?? 'confirmado',
    tipo_equipo: cleanText(row.tipo_equipo),
  };
}

export function resolveCreditAccess({ requesterEmail, requestedEmail, role, isSuperAdmin = false } = {}) {
  const requester = normalizeEmailAddress(requesterEmail);
  const requested = normalizeEmailAddress(requestedEmail);
  if (!requester) return { allowed: false, mode: 'unauthenticated' };
  if (!requested) return { allowed: false, mode: 'invalid_target' };
  if (requester === requested) return { allowed: true, mode: 'owner' };
  if (isSuperAdmin) return { allowed: true, mode: 'admin_global' };
  if (ADMIN_CREDIT_ROLES.has(String(role || '').trim().toLowerCase())) {
    return { allowed: true, mode: 'admin_scoped' };
  }
  return { allowed: false, mode: 'forbidden' };
}
