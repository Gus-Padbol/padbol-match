const DEFAULT_RULES = Object.freeze({
  torneos_minimos: 1,
  jugadores_registrados_minimos: 8,
  partidos_marcador_minimos: 3,
  reservas_minimas: 10,
  jugadores_activos_minimos: 10,
  movimientos_padcoins_minimos: 5,
});

export function normalizeIncentiveRules(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const [key, fallback] of Object.entries(DEFAULT_RULES)) {
    const value = Number.parseInt(String(source[key] ?? fallback), 10);
    out[key] = Number.isFinite(value) && value > 0 ? value : fallback;
  }
  return out;
}

export function evaluateIncentiveMetrics(metrics = {}, rulesRaw = {}) {
  const rules = normalizeIncentiveRules(rulesRaw);
  const metric = (key) => Math.max(0, Number(metrics[key]) || 0);
  const criteria = {
    torneos_integrales: metric('torneos_validos') >= rules.torneos_minimos,
    jugadores_registrados: metric('jugadores_registrados_torneos') >= rules.jugadores_registrados_minimos,
    marcador: metric('partidos_marcador_finalizados') >= rules.partidos_marcador_minimos,
    reservas: metric('reservas_validas') >= rules.reservas_minimas,
    jugadores_activos: metric('jugadores_activos') >= rules.jugadores_activos_minimos,
    padcoins: metric('movimientos_padcoins') >= rules.movimientos_padcoins_minimos,
  };
  const criteriosCumplidos = Object.values(criteria).filter(Boolean).length;
  return {
    cumplido: criteriosCumplidos === Object.keys(criteria).length,
    criterios: criteria,
    criterios_cumplidos: criteriosCumplidos,
    criterios_requeridos: Object.keys(criteria).length,
    rules,
  };
}

export function monthPeriodBounds(periodRaw = new Date()) {
  const parsed = periodRaw instanceof Date ? new Date(periodRaw) : new Date(`${String(periodRaw).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('Período inválido');
    error.status = 400;
    throw error;
  }
  const start = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  const end = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 1));
  return {
    period: start.toISOString().slice(0, 10),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function addUtcMonthsDate(dateRaw, months) {
  const source = String(dateRaw || '').slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(source) ? new Date(`${source}T12:00:00Z`) : new Date();
  date.setUTCMonth(date.getUTCMonth() + Math.max(0, Number(months) || 0));
  return date.toISOString().slice(0, 10);
}

async function metricsForProgram(supabase, program, bounds) {
  const sedeId = Number(program.sede_id);
  const [tournamentsResult, reservationsResult, activePlayersResult, padcoinsResult] = await Promise.all([
    supabase.from('torneos').select('id').eq('sede_id', sedeId).eq('estado', 'finalizado').gte('fecha_fin', bounds.startDate).lt('fecha_fin', bounds.endDate),
    supabase.from('reservas').select('id, estado, user_id').eq('sede_id', sedeId).gte('created_at', bounds.startIso).lt('created_at', bounds.endIso),
    supabase.from('sede_jugadores').select('user_id').eq('sede_id', sedeId).eq('estado', 'activo'),
    supabase.from('padcoins_movimientos').select('id, user_id').eq('sede_id', sedeId).gte('created_at', bounds.startIso).lt('created_at', bounds.endIso),
  ]);
  for (const result of [tournamentsResult, reservationsResult, activePlayersResult, padcoinsResult]) {
    if (result.error) throw result.error;
  }
  const tournamentIds = (tournamentsResult.data || []).map((row) => row.id);
  let registeredPlayersCount = 0;
  let scoreboardMatchesCount = 0;
  let validTournamentsCount = 0;
  const registeredByTournament = new Map();
  const scoreboardByTournament = new Map();
  if (tournamentIds.length) {
    const [teamsResult, scoreboardResult] = await Promise.all([
      supabase.from('equipos').select('torneo_id, jugadores, inscripcion_estado').in('torneo_id', tournamentIds),
      supabase.from('scoreboard_partidos').select('torneo_id, estado').in('torneo_id', tournamentIds).in('estado', ['finalizado', 'terminado']),
    ]);
    if (teamsResult.error) throw teamsResult.error;
    if (scoreboardResult.error) throw scoreboardResult.error;
    for (const team of teamsResult.data || []) {
      if (String(team.inscripcion_estado || '').toLowerCase() !== 'confirmado') continue;
      if (!registeredByTournament.has(team.torneo_id)) registeredByTournament.set(team.torneo_id, new Set());
      for (const player of Array.isArray(team.jugadores) ? team.jugadores : []) {
        const userId = String(typeof player === 'string' ? player : player?.user_id || '').trim().toLowerCase();
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
          registeredByTournament.get(team.torneo_id).add(userId);
        }
      }
    }
    for (const match of scoreboardResult.data || []) {
      scoreboardByTournament.set(match.torneo_id, (scoreboardByTournament.get(match.torneo_id) || 0) + 1);
    }
    scoreboardMatchesCount = [...scoreboardByTournament.values()].reduce((sum, count) => sum + count, 0);
  }
  const uuid = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized) ? normalized : '';
  };
  const validReservations = (reservationsResult.data || []).filter((row) => (
    !['cancelada', 'cancelado'].includes(String(row.estado || '').toLowerCase()) && uuid(row.user_id)
  ));
  const linkedPlayerIds = new Set((activePlayersResult.data || []).map((row) => uuid(row.user_id)).filter(Boolean));
  const reservationPlayerIds = new Set(validReservations.map((row) => uuid(row.user_id)).filter(Boolean));
  const padcoinPlayerIds = new Set((padcoinsResult.data || []).map((row) => uuid(row.user_id)).filter(Boolean));
  const tournamentPlayerIds = new Set([...registeredByTournament.values()].flatMap((ids) => [...ids]));
  const candidateUserIds = [...new Set([...linkedPlayerIds, ...reservationPlayerIds, ...padcoinPlayerIds, ...tournamentPlayerIds])];
  const verifiedUserIds = new Set();
  for (let index = 0; index < candidateUserIds.length; index += 100) {
    const profileResult = await supabase
      .from('jugadores_perfil')
      .select('user_id')
      .in('user_id', candidateUserIds.slice(index, index + 100));
    if (profileResult.error) throw profileResult.error;
    for (const profile of profileResult.data || []) {
      const userId = uuid(profile.user_id);
      if (userId) verifiedUserIds.add(userId);
    }
  }
  const rules = normalizeIncentiveRules(program.configuracion || {});
  for (const tournamentId of tournamentIds) {
    const players = [...(registeredByTournament.get(tournamentId) || [])]
      .filter((userId) => verifiedUserIds.has(userId)).length;
    const matches = scoreboardByTournament.get(tournamentId) || 0;
    registeredPlayersCount += players;
    if (players >= rules.jugadores_registrados_minimos && matches >= rules.partidos_marcador_minimos) validTournamentsCount += 1;
  }
  const monthlyActiveIds = new Set([...reservationPlayerIds, ...padcoinPlayerIds, ...tournamentPlayerIds]);
  return {
    torneos_finalizados: tournamentIds.length,
    torneos_validos: validTournamentsCount,
    jugadores_registrados_torneos: registeredPlayersCount,
    partidos_marcador_finalizados: scoreboardMatchesCount,
    reservas_validas: validReservations.filter((row) => verifiedUserIds.has(uuid(row.user_id))).length,
    jugadores_activos: [...linkedPlayerIds].filter((userId) => verifiedUserIds.has(userId) && monthlyActiveIds.has(userId)).length,
    movimientos_padcoins: (padcoinsResult.data || []).length,
  };
}

export async function evaluateSedeIncentive(supabase, program, period, evaluatedBy = 'sistema') {
  const bounds = monthPeriodBounds(period);
  const metrics = await metricsForProgram(supabase, program, bounds);
  const evaluation = evaluateIncentiveMetrics(metrics, program.configuracion || {});
  const { data, error } = await supabase.rpc('registrar_evaluacion_beneficio', {
    p_programa_id: program.id,
    p_periodo: bounds.period,
    p_metricas: metrics,
    p_evidencia: evaluation,
    p_cumplido: evaluation.cumplido,
    p_evaluado_por: evaluatedBy,
  });
  if (error) throw error;
  return { period: bounds.period, metrics, evaluation, result: Array.isArray(data) ? data[0] : data };
}

export async function previewSedeIncentive(supabase, program, period = new Date()) {
  const bounds = monthPeriodBounds(period);
  const metrics = await metricsForProgram(supabase, program, bounds);
  return { period: bounds.period, metrics, evaluation: evaluateIncentiveMetrics(metrics, program.configuracion || {}) };
}

export function registerSedeIncentiveRoutes(app, deps) {
  const { supabase, adminListScopeFromRequest, assertUsuarioPuedeAdministrarSede, assertSuperAdminReq } = deps;

  app.get('/api/admin/incentivos', async (req, res) => {
    try {
      const scope = await adminListScopeFromRequest(req);
      if (!scope) return res.status(401).json({ error: 'No autorizado' });
      const requested = Number(req.query?.sede_id);
      let sedeIds = [];
      if (Number.isFinite(requested)) {
        await assertUsuarioPuedeAdministrarSede(req, requested);
        sedeIds = [requested];
      } else if (scope.superA) {
        const { data, error } = await supabase.from('sedes').select('id');
        if (error) throw error;
        sedeIds = (data || []).map((row) => Number(row.id)).filter(Number.isFinite);
      } else {
        return res.status(400).json({ error: 'Selecciona una sede' });
      }
      if (!sedeIds.length) return res.json([]);
      const { data: programs, error } = await supabase.from('sede_programas_beneficios').select('*').in('sede_id', sedeIds).eq('codigo', 'padbol_pro_renovable');
      if (error) throw error;
      const ids = (programs || []).map((row) => row.id);
      let progress = [];
      if (ids.length) {
        const progressResult = await supabase.from('sede_beneficio_progreso').select('*').in('programa_id', ids).order('periodo', { ascending: false }).limit(120);
        if (progressResult.error) throw progressResult.error;
        progress = progressResult.data || [];
      }
      return res.json((programs || []).map((program) => ({ ...program, progreso: progress.filter((row) => row.programa_id === program.id) })));
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/admin/incentivos/:sedeId/activar', async (req, res) => {
    try {
      await assertSuperAdminReq(req);
      const sedeId = Number(req.params.sedeId);
      if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'Sede inválida' });
      const { data: sede, error: sedeError } = await supabase
        .from('sedes')
        .select('id, stripe_subscription_id')
        .eq('id', sedeId)
        .maybeSingle();
      if (sedeError) throw sedeError;
      if (!sede) return res.status(404).json({ error: 'Sede no encontrada' });
      if (String(sede.stripe_subscription_id || '').trim()) {
        return res.status(409).json({
          error: 'La sede tiene una suscripción automática activa. Pausá primero la facturación para evitar un cobro durante el beneficio.',
        });
      }
      const months = Math.min(24, Math.max(1, Number.parseInt(String(req.body?.meses_base || '6'), 10) || 6));
      const start = String(req.body?.fecha_inicio || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const payload = {
        sede_id: sedeId,
        codigo: 'padbol_pro_renovable',
        estado: 'activo',
        meses_base: months,
        fecha_inicio: start,
        fecha_fin_base: addUtcMonthsDate(start, months),
        beneficio_hasta: addUtcMonthsDate(start, months),
        reglas_version: 'v1',
        configuracion: normalizeIncentiveRules(req.body?.configuracion || {}),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('sede_programas_beneficios').upsert(payload, { onConflict: 'sede_id,codigo' }).select('*').single();
      if (error) throw error;
      return res.status(201).json(data);
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.patch('/api/admin/incentivos/:sedeId', async (req, res) => {
    try {
      await assertSuperAdminReq(req);
      const sedeId = Number(req.params.sedeId);
      if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'Sede inválida' });
      const patch = { configuracion: normalizeIncentiveRules(req.body?.configuracion || {}), updated_at: new Date().toISOString() };
      if (req.body?.estado && ['activo', 'pausado', 'finalizado'].includes(req.body.estado)) patch.estado = req.body.estado;
      const { data, error } = await supabase.from('sede_programas_beneficios').update(patch).eq('sede_id', sedeId).eq('codigo', 'padbol_pro_renovable').select('*').maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Programa no encontrado' });
      return res.json(data);
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/admin/incentivos/:sedeId/evaluar', async (req, res) => {
    try {
      const sedeId = Number(req.params.sedeId);
      if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'Sede inválida' });
      const scope = await assertUsuarioPuedeAdministrarSede(req, sedeId);
      const { data: program, error } = await supabase.from('sede_programas_beneficios').select('*').eq('sede_id', sedeId).eq('codigo', 'padbol_pro_renovable').eq('estado', 'activo').maybeSingle();
      if (error) throw error;
      if (!program) return res.status(404).json({ error: 'La sede no tiene un programa activo' });
      const requestedPeriod = req.body?.periodo || new Date();
      const bounds = monthPeriodBounds(requestedPeriod);
      const current = monthPeriodBounds(new Date()).period;
      if (bounds.period >= current) {
        return res.json({ ...(await previewSedeIncentive(supabase, program, requestedPeriod)), preview: true, credito_otorgado: false });
      }
      return res.json(await evaluateSedeIncentive(supabase, program, requestedPeriod, scope.email || 'sistema'));
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });
}

export async function evaluateAllActiveSedeIncentives(supabase, period = new Date()) {
  const { data, error } = await supabase.from('sede_programas_beneficios').select('*').eq('codigo', 'padbol_pro_renovable').eq('estado', 'activo');
  if (error) throw error;
  const results = [];
  for (const program of data || []) {
    try {
      results.push({ programa_id: program.id, ok: true, ...(await evaluateSedeIncentive(supabase, program, period, 'cron')) });
    } catch (evaluationError) {
      results.push({ programa_id: program.id, ok: false, error: evaluationError.message });
    }
  }
  return results;
}

export async function reconcileExpiredSedeIncentives(supabase, today = new Date()) {
  const date = today instanceof Date ? today.toISOString().slice(0, 10) : String(today).slice(0, 10);
  const { data, error } = await supabase.rpc('reconciliar_beneficios_vencidos', { p_hoy: date });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || { programas_finalizados: 0, sedes_en_starter: 0 } : data;
}

export { DEFAULT_RULES };
