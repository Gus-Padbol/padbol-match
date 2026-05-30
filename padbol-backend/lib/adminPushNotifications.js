/**
 * Notificaciones push enviadas por admins (Expo Push API + log en notificaciones_admin_log).
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH = 100;

const ADMIN_PUSH_ROLES = new Set(['super_admin', 'admin_nacional', 'admin_club']);

const WEEKLY_LIMITS = {
  admin_club: 3,
  admin_nacional: 2,
  super_admin: 1,
};

function normalizeGeo(raw) {
  return String(raw || '')
    .replace(/^[\p{Emoji_Presentation}\s]*/u, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function geoMatches(adminRaw, targetRaw) {
  const a = normalizeGeo(adminRaw);
  const b = normalizeGeo(targetRaw);
  if (!a || !b) return false;
  return b.includes(a) || a.includes(b);
}

export function isAdminPushTargetedSegment(segment) {
  return String(segment?.type || '').trim().toLowerCase() === 'jugador';
}

function effectiveAdminRole(scope) {
  if (scope?.superA) return 'super_admin';
  return String(scope?.rol || '').trim().toLowerCase();
}

function weekAgoIso() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export async function countAdminPushSendsThisWeek(supabase, adminUserId, { onlyBroadcast = false } = {}) {
  const uid = String(adminUserId || '').trim();
  if (!uid) return 0;
  const { data, error } = await supabase
    .from('notificaciones_admin_log')
    .select('id, segmento')
    .eq('admin_user_id', uid)
    .gte('created_at', weekAgoIso());
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  if (!onlyBroadcast) return rows.length;
  return rows.filter((r) => {
    try {
      const seg = typeof r.segmento === 'string' ? JSON.parse(r.segmento) : r.segmento;
      return !isAdminPushTargetedSegment(seg);
    } catch {
      return true;
    }
  }).length;
}

export async function getAdminPushQuota(supabase, scope) {
  const role = effectiveAdminRole(scope);
  const limit = WEEKLY_LIMITS[role] ?? 0;
  const adminUserId = scope?.authUserId;
  const usedBroadcast = await countAdminPushSendsThisWeek(supabase, adminUserId, { onlyBroadcast: role === 'super_admin' });
  const usedAll = role === 'super_admin' ? usedBroadcast : await countAdminPushSendsThisWeek(supabase, adminUserId);
  const used = role === 'super_admin' ? usedBroadcast : usedAll;
  const remaining = Math.max(0, limit - used);
  return {
    role,
    limit,
    used,
    remaining,
    unlimitedTargeted: role === 'super_admin',
    weekStartsAt: weekAgoIso(),
  };
}

export function parseAdminPushSegment(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw);
    } catch {
      return { type: String(raw).trim() };
    }
  }
  return {};
}

export async function validateAdminPushSegment(scope, segment, { supabase, sedesPermitidasPorScopeFn }) {
  const role = effectiveAdminRole(scope);
  if (!ADMIN_PUSH_ROLES.has(role)) {
    const e = new Error('No tienes permiso para enviar notificaciones push');
    e.status = 403;
    throw e;
  }
  const type = String(segment?.type || '').trim().toLowerCase();
  if (!type) {
    const e = new Error('Segmento inválido');
    e.status = 400;
    throw e;
  }

  if (type === 'jugador') {
    const userId = String(segment.userId || segment.user_id || '').trim();
    const email = String(segment.email || '').trim().toLowerCase();
    if (!userId && !email) {
      const e = new Error('Indica el jugador destinatario');
      e.status = 400;
      throw e;
    }
    return { type: 'jugador', userId: userId || null, email: email || null };
  }

  if (role === 'super_admin') {
    if (type === 'todos_usuarios') return { type: 'todos_usuarios' };
    if (type === 'pais') {
      const pais = String(segment.pais || '').trim();
      if (!pais) {
        const e = new Error('Selecciona un país');
        e.status = 400;
        throw e;
      }
      return { type: 'pais', pais };
    }
    if (type === 'sede') {
      const sedeId = parseInt(String(segment.sedeId ?? segment.sede_id ?? ''), 10);
      if (!Number.isFinite(sedeId) || sedeId <= 0) {
        const e = new Error('Selecciona una sede');
        e.status = 400;
        throw e;
      }
      return { type: 'sede', sedeId };
    }
    if (type === 'deporte') {
      const deporte = String(segment.deporte || '').trim().toLowerCase();
      if (!deporte) {
        const e = new Error('Selecciona un deporte');
        e.status = 400;
        throw e;
      }
      return { type: 'deporte', deporte };
    }
  }

  if (role === 'admin_nacional') {
    if (type === 'todos_pais') return { type: 'todos_pais', pais: scope.pais || scope.paisNorm };
    if (type === 'sede') {
      const sedeId = parseInt(String(segment.sedeId ?? segment.sede_id ?? ''), 10);
      if (!Number.isFinite(sedeId) || sedeId <= 0) {
        const e = new Error('Selecciona una sede');
        e.status = 400;
        throw e;
      }
      const allowed = await sedesPermitidasPorScopeFn(scope);
      const ok = (allowed.sedes || []).some((s) => Number(s.id) === sedeId);
      if (!ok) {
        const e = new Error('La sede no pertenece a tu país');
        e.status = 403;
        throw e;
      }
      return { type: 'sede', sedeId };
    }
  }

  if (role === 'admin_club') {
    if (type === 'sede_mia') {
      const sedeId = scope.sedeId;
      if (sedeId == null) {
        const e = new Error('Sin sede asignada');
        e.status = 403;
        throw e;
      }
      return { type: 'sede', sedeId: Number(sedeId) };
    }
  }

  const e = new Error('Segmento no permitido para tu rol');
  e.status = 403;
  throw e;
}

async function distinctUserIdsFromProfilesQuery(rows) {
  const set = new Set();
  for (const r of rows || []) {
    const uid = String(r?.user_id || '').trim();
    if (uid) set.add(uid);
  }
  return [...set];
}

async function userIdsFromSedeActivity(supabase, sedeId) {
  const sid = Number(sedeId);
  const set = new Set();
  const { data: reservas } = await supabase
    .from('reservas')
    .select('user_id')
    .eq('sede_id', sid)
    .not('user_id', 'is', null);
  for (const r of reservas || []) {
    const uid = String(r.user_id || '').trim();
    if (uid) set.add(uid);
  }
  const { data: perfiles } = await supabase
    .from('jugadores_perfil')
    .select('user_id')
    .eq('sede_id', sid)
    .not('user_id', 'is', null);
  for (const r of perfiles || []) {
    const uid = String(r.user_id || '').trim();
    if (uid) set.add(uid);
  }
  return [...set];
}

function profileMatchesDeporte(row, deporte) {
  const dep = String(deporte || '').trim().toLowerCase();
  if (!dep) return false;
  let raw = row?.deportes_preferidos;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  const arr = Array.isArray(raw) ? raw : [];
  return arr.some((d) => String(d || '').trim().toLowerCase() === dep);
}

export async function resolveAdminPushRecipientUserIds(supabase, scope, segment) {
  const type = segment.type;

  if (type === 'jugador') {
    if (segment.userId) return [String(segment.userId).trim()];
    const email = String(segment.email || '').trim().toLowerCase();
    const { data } = await supabase
      .from('jugadores_perfil')
      .select('user_id')
      .ilike('email', email)
      .limit(5);
    const ids = await distinctUserIdsFromProfilesQuery(data);
    if (ids.length) return ids.slice(0, 1);
    return [];
  }

  if (type === 'todos_usuarios') {
    const { data: tokens } = await supabase.from('push_tokens').select('user_id');
    const fromTokens = await distinctUserIdsFromProfilesQuery(tokens);
    if (fromTokens.length) return fromTokens;
    const { data: perfiles } = await supabase.from('jugadores_perfil').select('user_id').not('user_id', 'is', null);
    return distinctUserIdsFromProfilesQuery(perfiles);
  }

  if (type === 'todos_pais') {
    const paisTarget = segment.pais || scope.pais;
    const { data: perfiles } = await supabase.from('jugadores_perfil').select('user_id, pais').not('user_id', 'is', null);
    return (perfiles || [])
      .filter((p) => geoMatches(paisTarget, p.pais))
      .map((p) => String(p.user_id).trim())
      .filter(Boolean);
  }

  if (type === 'pais') {
    const { data: perfiles } = await supabase.from('jugadores_perfil').select('user_id, pais').not('user_id', 'is', null);
    return (perfiles || [])
      .filter((p) => geoMatches(segment.pais, p.pais))
      .map((p) => String(p.user_id).trim())
      .filter(Boolean);
  }

  if (type === 'sede') {
    return userIdsFromSedeActivity(supabase, segment.sedeId);
  }

  if (type === 'deporte') {
    const { data: perfiles } = await supabase
      .from('jugadores_perfil')
      .select('user_id, deportes_preferidos')
      .not('user_id', 'is', null);
    return (perfiles || [])
      .filter((p) => profileMatchesDeporte(p, segment.deporte))
      .map((p) => String(p.user_id).trim())
      .filter(Boolean);
  }

  return [];
}

export async function fetchPushTokensForUserIds(supabase, userIds) {
  const ids = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  try {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', ids);
    if (error) throw error;
    const tokens = [];
    const seen = new Set();
    for (const row of data || []) {
      const tok = String(row.expo_push_token || '').trim();
      if (!tok || seen.has(tok)) continue;
      seen.add(tok);
      tokens.push({ userId: row.user_id, token: tok });
    }
    return tokens;
  } catch (err) {
    if (/push_tokens|relation|does not exist/i.test(String(err?.message || ''))) return [];
    throw err;
  }
}

export async function sendExpoPushNotifications({ title, body, tokens }) {
  const titulo = String(title || '').trim().slice(0, 50);
  const mensaje = String(body || '').trim().slice(0, 150);
  if (!titulo || !mensaje) {
    const e = new Error('Título y mensaje son obligatorios');
    e.status = 400;
    throw e;
  }
  const list = (tokens || []).map((t) => String(t.token || t).trim()).filter(Boolean);
  if (!list.length) return { sent: 0, tickets: [] };

  let sent = 0;
  const tickets = [];
  for (let i = 0; i < list.length; i += EXPO_PUSH_BATCH) {
    const chunk = list.slice(i, i + EXPO_PUSH_BATCH);
    const messages = chunk.map((to) => ({
      to,
      title: titulo,
      body: mensaje,
      sound: 'default',
    }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('❌ Expo push error:', json);
      const e = new Error(json?.errors?.[0]?.message || json?.message || 'Error al enviar push');
      e.status = 502;
      throw e;
    }
    const data = Array.isArray(json?.data) ? json.data : [];
    tickets.push(...data);
    sent += chunk.length;
  }
  return { sent, tickets };
}

export async function assertAdminPushRateLimit(supabase, scope, segment) {
  const role = effectiveAdminRole(scope);
  const targeted = isAdminPushTargetedSegment(segment);
  if (role === 'super_admin' && targeted) return;
  const limit = WEEKLY_LIMITS[role] ?? 0;
  const onlyBroadcast = role === 'super_admin';
  const used = await countAdminPushSendsThisWeek(supabase, scope.authUserId, { onlyBroadcast });
  if (used >= limit) {
    const e = new Error('Alcanzaste el límite de envíos esta semana');
    e.status = 429;
    e.quota = { limit, used, remaining: 0 };
    throw e;
  }
}

export async function searchAdminPushPlayers(supabase, scope, query) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const { data: all, error } = await supabase
    .from('jugadores_perfil')
    .select('user_id, nombre, apellido, apodo, alias, email, pais')
    .not('user_id', 'is', null)
    .limit(800);
  if (error) throw error;
  let rows = all || [];
  const role = effectiveAdminRole(scope);
  if (role === 'admin_nacional') {
    rows = rows.filter((p) => geoMatches(scope.pais, p.pais));
  } else if (role === 'admin_club' && scope.sedeId != null) {
    const ids = new Set(await userIdsFromSedeActivity(supabase, scope.sedeId));
    rows = rows.filter((p) => ids.has(String(p.user_id)));
  }
  return rows
    .filter((p) => {
      const blob = [p.nombre, p.apellido, p.apodo, p.alias, p.email].join(' ').toLowerCase();
      return blob.includes(q);
    })
    .slice(0, 20);
}

export function registerAdminPushRoutes(app, deps) {
  const {
    supabase,
    authUserFromBearer,
    adminListScopeFromRequest,
    sedesPermitidasPorScope,
  } = deps;

  async function pushScope(req) {
    const scope = await adminListScopeFromRequest(req);
    if (!scope?.authUserId) {
      const user = await authUserFromBearer(req);
      if (!user?.id) {
        const e = new Error('No autorizado');
        e.status = 401;
        throw e;
      }
      scope.authUserId = user.id;
    }
    const role = effectiveAdminRole(scope);
    if (!ADMIN_PUSH_ROLES.has(role)) {
      const e = new Error('No tienes permiso');
      e.status = 403;
      throw e;
    }
    return scope;
  }

  app.get('/api/push/admin-quota', async (req, res) => {
    try {
      const scope = await pushScope(req);
      const quota = await getAdminPushQuota(supabase, scope);
      res.json(quota);
    } catch (err) {
      console.error('❌ GET /api/push/admin-quota:', err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/push/admin-history', async (req, res) => {
    try {
      const scope = await pushScope(req);
      const { data, error } = await supabase
        .from('notificaciones_admin_log')
        .select('id, titulo, mensaje, segmento, cantidad_enviadas, estado, created_at')
        .eq('admin_user_id', scope.authUserId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('❌ GET /api/push/admin-history:', err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/push/admin-segment-preview', async (req, res) => {
    try {
      const scope = await pushScope(req);
      const segment = await validateAdminPushSegment(scope, req.body?.segment || {}, {
        supabase,
        sedesPermitidasPorScopeFn: sedesPermitidasPorScope,
      });
      const userIds = await resolveAdminPushRecipientUserIds(supabase, scope, segment);
      const pushRows = await fetchPushTokensForUserIds(supabase, userIds);
      res.json({
        recipients: userIds.length,
        withPushToken: pushRows.length,
        segment,
      });
    } catch (err) {
      console.error('❌ POST /api/push/admin-segment-preview:', err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/push/admin-search-players', async (req, res) => {
    try {
      const scope = await pushScope(req);
      const rows = await searchAdminPushPlayers(supabase, scope, req.query?.q || '');
      res.json(
        rows.map((p) => ({
          userId: p.user_id,
          nombre: [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || p.apodo || p.alias || 'Jugador',
          email: p.email || '',
          apodo: p.apodo || '',
        })),
      );
    } catch (err) {
      console.error('❌ GET /api/push/admin-search-players:', err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/push/send-admin', async (req, res) => {
    try {
      const scope = await pushScope(req);
      const title = String(req.body?.title || req.body?.titulo || '').trim().slice(0, 50);
      const body = String(req.body?.body || req.body?.mensaje || '').trim().slice(0, 150);
      if (!title || !body) {
        return res.status(400).json({ error: 'Título y mensaje son obligatorios' });
      }

      const segment = await validateAdminPushSegment(scope, req.body?.segment || {}, {
        supabase,
        sedesPermitidasPorScopeFn: sedesPermitidasPorScope,
      });
      await assertAdminPushRateLimit(supabase, scope, segment);

      const userIds = await resolveAdminPushRecipientUserIds(supabase, scope, segment);
      if (!userIds.length) {
        return res.status(400).json({ error: 'No hay destinatarios para este segmento' });
      }

      const pushRows = await fetchPushTokensForUserIds(supabase, userIds);
      let cantidadEnviadas = 0;
      let estado = 'sin_tokens';
      if (pushRows.length) {
        const result = await sendExpoPushNotifications({
          title,
          body,
          tokens: pushRows,
        });
        cantidadEnviadas = result.sent;
        estado = 'enviado';
      }

      const { data: logRow, error: logErr } = await supabase
        .from('notificaciones_admin_log')
        .insert([
          {
            admin_user_id: scope.authUserId,
            titulo: title,
            mensaje: body,
            segmento: segment,
            cantidad_enviadas: cantidadEnviadas,
            estado,
          },
        ])
        .select('*')
        .single();
      if (logErr) throw logErr;

      const quota = await getAdminPushQuota(supabase, scope);
      res.json({
        ok: true,
        log: logRow,
        recipients: userIds.length,
        cantidad_enviadas: cantidadEnviadas,
        estado,
        quota,
      });
    } catch (err) {
      console.error('❌ POST /api/push/send-admin:', err.message);
      res.status(err.status || 500).json({
        error: err.message,
        quota: err.quota || undefined,
      });
    }
  });
}
