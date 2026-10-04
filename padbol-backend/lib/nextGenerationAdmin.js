function ngAdminError(message, status = 500, code = 'NG_ADMIN_UNAVAILABLE') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

const REGISTRATION_STATES = new Set(['confirmada', 'en_espera', 'cancelada']);

export function buildNextGenerationOverview({ sessions = [], venues = [], registrations = [], participants = [], events = [] } = {}) {
  const venueById = new Map(venues.map((row) => [String(row.id), row]));
  const sessionById = new Map(sessions.map((row) => [String(row.id), row]));
  const participantByRegistration = new Map();
  for (const row of participants) {
    const key = String(row.inscripcion_id || '');
    if (!key) continue;
    const current = participantByRegistration.get(key) || [];
    if (!current.some((item) => String(item.id) === String(row.id))) current.push(row);
    participantByRegistration.set(key, current);
  }
  const eventByRegistration = new Map();
  const seenEventIds = new Set();
  for (const row of events) {
    const eventId = String(row.id || '');
    const registrationId = String(row.inscripcion_id || '');
    if (!eventId || !registrationId || seenEventIds.has(eventId)) continue;
    seenEventIds.add(eventId);
    const current = eventByRegistration.get(registrationId) || [];
    current.push(row);
    eventByRegistration.set(registrationId, current);
  }

  const seenRegistrations = new Set();
  const rows = [];
  for (const row of registrations) {
    const id = String(row.id || '');
    if (!id || seenRegistrations.has(id)) continue;
    seenRegistrations.add(id);
    const estado = String(row.estado || '').toLowerCase();
    if (!REGISTRATION_STATES.has(estado)) continue;
    const session = sessionById.get(String(row.sesion_id || '')) || null;
    const venue = session ? venueById.get(String(session.sede_id || '')) || null : null;
    rows.push({
      ...row,
      estado,
      jornada: session,
      sede: venue,
      participantes: participantByRegistration.get(id) || [],
      eventos: (eventByRegistration.get(id) || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    });
  }
  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return {
    summary: {
      total: rows.length,
      confirmadas: rows.filter((row) => row.estado === 'confirmada').length,
      en_espera: rows.filter((row) => row.estado === 'en_espera').length,
      canceladas: rows.filter((row) => row.estado === 'cancelada').length,
    },
    inscripciones: rows,
  };
}

export function registerNextGenerationAdminRoutes(app, { supabaseAdmin, adminListScopeFromRequest } = {}) {
  if (!supabaseAdmin?.from || typeof adminListScopeFromRequest !== 'function') return;

  app.get('/api/admin/next-generation/overview', async (req, res) => {
    try {
      const scope = await adminListScopeFromRequest(req);
      if (!scope) throw ngAdminError('No autorizado.', 401, 'NG_ADMIN_UNAUTHENTICATED');
      if (!scope.superA && String(scope.rol || '') !== 'super_admin') {
        throw ngAdminError('Sólo el Super Admin puede consultar Next Generation.', 403, 'NG_ADMIN_FORBIDDEN');
      }
      const queries = await Promise.all([
        supabaseAdmin.from('ng_sesiones').select('id,sede_id,nombre_publico,ciudad,pais,categoria,comienza_at,termina_at,cupo,estado').order('comienza_at', { ascending: false }).limit(500),
        supabaseAdmin.from('ng_solicitudes_sede').select('id,sede_club,ciudad,pais').limit(500),
        supabaseAdmin.from('ng_inscripciones').select('id,sesion_id,contacto_nombre,contacto_email,contacto_whatsapp,estado,posicion_espera,continuidad_estado,created_at,updated_at').order('created_at', { ascending: false }).limit(2000),
        supabaseAdmin.from('ng_inscripcion_participantes').select('id,inscripcion_id,nombre,categoria,created_at').limit(5000),
        supabaseAdmin.from('ng_inscripcion_eventos').select('id,inscripcion_id,sesion_id,tipo,actor,detalle,created_at').order('created_at', { ascending: true }).limit(10000),
      ]);
      const failed = queries.find((result) => result.error);
      if (failed) throw ngAdminError('El esquema canónico Next Generation aún no está disponible en QA.', 503, 'NG_SCHEMA_PENDING');
      res.set('cache-control', 'private, no-store');
      res.json(buildNextGenerationOverview({
        sessions: queries[0].data || [], venues: queries[1].data || [], registrations: queries[2].data || [],
        participants: queries[3].data || [], events: queries[4].data || [],
      }));
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Error interno', code: error.code || 'NG_ADMIN_UNAVAILABLE' });
    }
  });
}
