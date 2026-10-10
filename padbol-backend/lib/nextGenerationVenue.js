const CATEGORIES = new Set(['U14', 'U16', 'U18']);
const SESSION_STATES = new Set(['borrador', 'publicada', 'cerrada']);
const ATTENDANCE_STATES = new Set(['pendiente', 'presente', 'ausente']);
const GROUP_STATES = new Set(['activo', 'cerrado']);

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function positiveInt(value, field, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw httpError(`${field} inválido`);
  return parsed;
}

export function parseJornadaInput(body = {}, { partial = false } = {}) {
  const out = {};
  const required = (key) => !partial || Object.prototype.hasOwnProperty.call(body, key);
  if (required('nombre')) {
    out.nombre = String(body.nombre || '').trim();
    if (out.nombre.length < 3 || out.nombre.length > 120) throw httpError('Nombre inválido');
  }
  if (required('fecha_hora')) {
    const date = new Date(body.fecha_hora);
    if (!Number.isFinite(date.getTime())) throw httpError('Fecha y hora inválidas');
    out.fecha_hora = date.toISOString();
  }
  if (required('coach')) {
    out.coach = String(body.coach || '').trim();
    if (out.coach.length < 2 || out.coach.length > 120) throw httpError('Coach inválido');
  }
  if (required('categoria')) {
    out.categoria = String(body.categoria || '').trim().toUpperCase();
    if (!CATEGORIES.has(out.categoria)) throw httpError('Categoría inválida');
  }
  if (required('cupo')) out.cupo = positiveInt(body.cupo, 'Cupo', 500);
  if (required('canchas')) out.canchas = positiveInt(body.canchas, 'Cantidad de canchas', 50);
  if (Object.prototype.hasOwnProperty.call(body, 'estado')) {
    out.estado = String(body.estado || '').trim().toLowerCase();
    if (!SESSION_STATES.has(out.estado)) throw httpError('Estado de jornada inválido');
  }
  return out;
}

export function parseGroupInput(body = {}, { partial = false } = {}) {
  const out = {};
  const required = (key) => !partial || Object.prototype.hasOwnProperty.call(body, key);
  if (required('nombre')) {
    out.nombre = String(body.nombre || '').trim();
    if (out.nombre.length < 3 || out.nombre.length > 120) throw httpError('Nombre de grupo inválido');
  }
  if (required('categoria')) {
    out.categoria = String(body.categoria || '').trim().toUpperCase();
    if (!CATEGORIES.has(out.categoria)) throw httpError('Categoría inválida');
  }
  if (required('coach')) {
    out.coach = String(body.coach || '').trim();
    if (out.coach.length < 2 || out.coach.length > 120) throw httpError('Coach inválido');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'estado')) {
    out.estado = String(body.estado || '').trim().toLowerCase();
    if (!GROUP_STATES.has(out.estado)) throw httpError('Estado de grupo inválido');
  }
  return out;
}

export function summarizeRegistrations(rows = []) {
  return rows.reduce((summary, row) => {
    if (Object.prototype.hasOwnProperty.call(summary, row.estado)) summary[row.estado] += 1;
    return summary;
  }, { confirmado: 0, espera: 0, cancelado: 0 });
}

export function hashCancellationToken(token) {
  const normalized = String(token || '').trim();
  return normalized ? crypto.createHash('sha256').update(normalized).digest('hex') : null;
}

export function canReadRegistrationStatus(registration, { userId, cancellationToken } = {}) {
  if (userId && registration?.user_id && String(userId) === String(registration.user_id)) return true;
  const expected = String(registration?.cancel_token_hash || '');
  const received = hashCancellationToken(cancellationToken);
  if (!expected || !received || expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

export function registerNextGenerationVenueRoutes(app, deps) {
  const { supabaseAdmin, adminListScopeFromRequest, assertUsuarioPuedeAdministrarSede, authUserFromBearer } = deps;

  async function scope(req) {
    const value = await adminListScopeFromRequest(req);
    if (!value) throw httpError('No autorizado', 401);
    if (!value.superA && !['admin_club', 'empleado'].includes(String(value.rol || ''))) {
      throw httpError('Rol no autorizado para operar Next Generation', 403);
    }
    return value;
  }

  async function assertSede(req, sedeId) {
    await scope(req);
    return assertUsuarioPuedeAdministrarSede(req, positiveInt(sedeId, 'Sede'));
  }

  async function rowOr404(table, id, columns = '*') {
    const result = await supabaseAdmin.from(table).select(columns).eq('id', id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw httpError('Registro no encontrado', 404);
    return result.data;
  }

  function handler(fn) {
    return async (req, res) => {
      try { await fn(req, res); } catch (error) {
        res.status(error.status || 500).json({ error: error.message || 'Error interno' });
      }
    };
  }

  async function registrationStatus(req, res, { registrationId, sessionId } = {}) {
    const safeRegistrationId = String(registrationId || '').trim();
    const safeSessionId = String(sessionId || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeRegistrationId)) {
      throw httpError('registration_id inválido');
    }
    if (safeSessionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeSessionId)) {
      throw httpError('session_id inválido');
    }
    const registration = await rowOr404(
      'ng_jornada_inscripciones',
      safeRegistrationId,
      'id, jornada_id, user_id, estado, asistencia, posicion_espera, cancel_token_hash, updated_at',
    );
    if (safeSessionId && String(registration.jornada_id) !== safeSessionId) {
      throw httpError('Inscripción no encontrada para la jornada indicada', 404);
    }
    const user = await authUserFromBearer(req);
    const cancellationToken = req.get('x-ng-cancellation-token');
    if (!canReadRegistrationStatus(registration, { userId: user?.id, cancellationToken })) {
      throw httpError('No autorizado para consultar esta inscripción', 403);
    }
    res.set('cache-control', 'private, no-store');
    res.json({
      inscripcion: {
        id: registration.id,
        jornada_id: registration.jornada_id,
        estado: registration.estado,
        asistencia: registration.asistencia,
        posicion_espera: registration.posicion_espera,
        updated_at: registration.updated_at,
      },
    });
  }

  app.get('/api/next-generation/registrations/status', handler((req, res) => registrationStatus(req, res, {
    registrationId: req.query.registration_id,
    sessionId: req.query.session_id,
  })));

  // Alias transitorio para clientes web anteriores. Conserva la misma política:
  // Bearer del titular o X-NG-Cancellation-Token; nunca acepta secretos en query string.
  app.get('/api/next-generation/inscripciones/:id/estado', handler((req, res) => registrationStatus(req, res, {
    registrationId: req.params.id,
    sessionId: req.query.session_id,
  })));

  app.get('/api/admin/next-generation/jornadas', handler(async (req, res) => {
    const auth = await scope(req);
    const sedeId = auth.superA ? positiveInt(req.query.sede_id, 'Sede') : positiveInt(auth.sedeId, 'Sede');
    await assertUsuarioPuedeAdministrarSede(req, sedeId);
    const { data, error } = await supabaseAdmin.from('ng_jornadas').select('*').eq('sede_id', sedeId).order('fecha_hora', { ascending: false });
    if (error) throw error;
    res.json({ jornadas: data || [] });
  }));

  app.post('/api/admin/next-generation/jornadas', handler(async (req, res) => {
    const sedeId = positiveInt(req.body?.sede_id, 'Sede');
    const auth = await assertSede(req, sedeId);
    const payload = { ...parseJornadaInput(req.body), sede_id: sedeId, created_by: auth.authUserId };
    const { data, error } = await supabaseAdmin.from('ng_jornadas').insert(payload).select('*').single();
    if (error) throw error;
    res.status(201).json({ jornada: data });
  }));

  app.patch('/api/admin/next-generation/jornadas/:id', handler(async (req, res) => {
    const current = await rowOr404('ng_jornadas', req.params.id, 'id, sede_id, estado');
    await assertSede(req, current.sede_id);
    const payload = { ...parseJornadaInput(req.body, { partial: true }), updated_at: new Date().toISOString() };
    if (!Object.keys(payload).length) throw httpError('No hay cambios válidos');
    const { data, error } = await supabaseAdmin.from('ng_jornadas').update(payload).eq('id', current.id).eq('sede_id', current.sede_id).select('*').single();
    if (error) throw error;
    res.json({ jornada: data });
  }));

  app.get('/api/admin/next-generation/jornadas/:id/inscripciones', handler(async (req, res) => {
    const jornada = await rowOr404('ng_jornadas', req.params.id, 'id, sede_id');
    await assertSede(req, jornada.sede_id);
    const { data, error } = await supabaseAdmin.from('ng_jornada_inscripciones').select('*').eq('jornada_id', jornada.id).order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ inscripciones: data || [], resumen: summarizeRegistrations(data || []) });
  }));

  app.patch('/api/admin/next-generation/inscripciones/:id/asistencia', handler(async (req, res) => {
    const attendance = String(req.body?.asistencia || '').trim().toLowerCase();
    if (!ATTENDANCE_STATES.has(attendance)) throw httpError('Asistencia inválida');
    const registration = await rowOr404('ng_jornada_inscripciones', req.params.id, 'id, jornada_id');
    const jornada = await rowOr404('ng_jornadas', registration.jornada_id, 'id, sede_id');
    await assertSede(req, jornada.sede_id);
    const { data, error } = await supabaseAdmin.from('ng_jornada_inscripciones').update({ asistencia: attendance, updated_at: new Date().toISOString() }).eq('id', registration.id).select('*').single();
    if (error) throw error;
    res.json({ inscripcion: data });
  }));

  app.get('/api/admin/next-generation/grupos', handler(async (req, res) => {
    const auth = await scope(req);
    const sedeId = auth.superA ? positiveInt(req.query.sede_id, 'Sede') : positiveInt(auth.sedeId, 'Sede');
    await assertUsuarioPuedeAdministrarSede(req, sedeId);
    const { data, error } = await supabaseAdmin.from('ng_grupos_continuidad').select('*, ng_grupo_miembros(inscripcion_id)').eq('sede_id', sedeId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ grupos: data || [] });
  }));

  app.post('/api/admin/next-generation/grupos', handler(async (req, res) => {
    const sedeId = positiveInt(req.body?.sede_id, 'Sede');
    const auth = await assertSede(req, sedeId);
    const payload = { ...parseGroupInput(req.body), sede_id: sedeId, created_by: auth.authUserId };
    const { data, error } = await supabaseAdmin.from('ng_grupos_continuidad').insert(payload).select('*').single();
    if (error) throw error;
    res.status(201).json({ grupo: data });
  }));

  app.patch('/api/admin/next-generation/grupos/:id', handler(async (req, res) => {
    const current = await rowOr404('ng_grupos_continuidad', req.params.id, 'id, sede_id');
    await assertSede(req, current.sede_id);
    const { data, error } = await supabaseAdmin.from('ng_grupos_continuidad').update({ ...parseGroupInput(req.body, { partial: true }), updated_at: new Date().toISOString() }).eq('id', current.id).eq('sede_id', current.sede_id).select('*').single();
    if (error) throw error;
    res.json({ grupo: data });
  }));

  app.put('/api/admin/next-generation/grupos/:id/miembros/:inscripcionId', handler(async (req, res) => {
    const group = await rowOr404('ng_grupos_continuidad', req.params.id, 'id, sede_id, categoria');
    await assertSede(req, group.sede_id);
    const registration = await rowOr404('ng_jornada_inscripciones', req.params.inscripcionId, 'id, jornada_id, estado');
    const jornada = await rowOr404('ng_jornadas', registration.jornada_id, 'id, sede_id, categoria');
    if (Number(jornada.sede_id) !== Number(group.sede_id) || jornada.categoria !== group.categoria || registration.estado !== 'confirmado') {
      throw httpError('La inscripción no pertenece a la misma sede/categoría o no está confirmada', 409);
    }
    const { error } = await supabaseAdmin.from('ng_grupo_miembros').upsert({ grupo_id: group.id, inscripcion_id: registration.id }, { onConflict: 'grupo_id,inscripcion_id' });
    if (error) throw error;
    res.status(204).end();
  }));

  app.delete('/api/admin/next-generation/grupos/:id/miembros/:inscripcionId', handler(async (req, res) => {
    const group = await rowOr404('ng_grupos_continuidad', req.params.id, 'id, sede_id');
    await assertSede(req, group.sede_id);
    const { error } = await supabaseAdmin.from('ng_grupo_miembros').delete().eq('grupo_id', group.id).eq('inscripcion_id', req.params.inscripcionId);
    if (error) throw error;
    res.status(204).end();
  }));
}
import crypto from 'node:crypto';
