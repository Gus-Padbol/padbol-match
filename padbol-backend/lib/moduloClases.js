/**
 * Rutas y helpers del módulo clases (registrados desde server.js).
 * Escrituras vía supabaseAdmin (service role).
 */

const ESTADOS_INSCRIPCION_CUENTAN_CUPO = new Set(['pendiente', 'confirmada', 'pagada']);

export function registerModuloClasesRoutes(app, deps) {
  const {
    supabase,
    supabaseAdmin,
    authUserFromBearer,
    adminListScopeFromRequest,
    assertUsuarioPuedeAdministrarSede,
    assertSuperAdminReq,
    canchasConNumeroReserva,
    assertReservaSinSolapeBackend,
  } = deps;

  function normalizeHoraClase(raw) {
    const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const hh = Math.min(23, parseInt(m[1], 10));
    const mm = Math.min(59, parseInt(m[2], 10));
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function normalizeFechaYmd(raw) {
    const s = String(raw || '').trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  function diaSemanaFromFechaYmd(ymd) {
    const [y, mo, d] = ymd.split('-').map((x) => parseInt(x, 10));
    const dt = new Date(y, mo - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.getDay();
  }

  function mapProfesorPublic(row) {
    if (!row) return null;
    const nombre =
      [String(row.nombre || '').trim(), String(row.apellido || '').trim()].filter(Boolean).join(' ').trim() ||
      String(row.nombre || '').trim();
    return {
      id: row.id,
      nombre,
      foto_url: row.foto_url ?? null,
      bio: row.bio ?? null,
      deportes: Array.isArray(row.deportes) ? row.deportes : [],
      certificado_fipa: Boolean(row.certificado_fipa),
    };
  }

  function profesorMatchesDeporte(profesorRow, deporteFilter) {
    const dep = String(deporteFilter || '').trim().toLowerCase();
    if (!dep) return true;
    const list = Array.isArray(profesorRow?.deportes) ? profesorRow.deportes : [];
    return list.some((d) => String(d || '').trim().toLowerCase() === dep);
  }

  async function requireAuthUser(req) {
    const user = await authUserFromBearer(req);
    if (!user?.id) {
      const e = new Error('No autorizado');
      e.status = 401;
      throw e;
    }
    return user;
  }

  async function assertAdminClubOrSuper(req) {
    const scope = await adminListScopeFromRequest(req);
    if (!scope) {
      const e = new Error('No autorizado');
      e.status = 401;
      throw e;
    }
    const rol = String(scope.rol || '').trim().toLowerCase();
    if (scope.superA || ['admin_club', 'admin_nacional', 'empleado'].includes(rol)) return scope;
    const e = new Error('No tienes permiso de administración de club');
    e.status = 403;
    throw e;
  }

  async function countInscripcionesSlot(claseId, fecha, horaInicio) {
    const { data, error } = await supabase
      .from('inscripciones_clases')
      .select('id, estado, hora_inicio')
      .eq('clase_id', claseId)
      .eq('fecha', fecha);
    if (error) throw error;
    return (data || []).filter(
      (r) =>
        ESTADOS_INSCRIPCION_CUENTAN_CUPO.has(String(r.estado || '').toLowerCase()) &&
        normalizeHoraClase(r.hora_inicio) === horaInicio,
    ).length;
  }

  async function fetchHorariosClase(claseId) {
    const { data, error } = await supabase
      .from('clases_horarios')
      .select('id, clase_id, dia_semana, hora_inicio, hora_fin')
      .eq('clase_id', claseId)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function horarioMatchesSlot(horarios, fecha, horaInicio) {
    const dia = diaSemanaFromFechaYmd(fecha);
    if (dia == null) return false;
    return (horarios || []).some(
      (h) => Number(h.dia_semana) === dia && normalizeHoraClase(h.hora_inicio) === horaInicio,
    );
  }

  async function resolveCanchaNumeroReserva(canchaId) {
    const cid = Number(canchaId);
    if (!Number.isFinite(cid)) return null;
    const { data, error } = await supabase.from('canchas').select('*').eq('id', cid).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [enriched] = canchasConNumeroReserva([data]);
    return enriched?.numero_reserva ?? null;
  }

  async function mapClaseListItem(claseRow, horarios) {
    const prof = mapProfesorPublic(claseRow.profesores);
    return {
      ...claseRow,
      profesor: prof,
      profesores: undefined,
      horarios: horarios || [],
    };
  }

  /** GET /api/clases?sede_id=&deporte= */
  app.get('/api/clases', async (req, res) => {
    try {
      const sedeId = Number(req.query.sede_id);
      const deporte = String(req.query.deporte || '').trim().toLowerCase();
      if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'sede_id requerido' });

      let q = supabase
        .from('clases')
        .select(
          'id, sede_id, profesor_id, cancha_id, deporte, titulo, descripcion, tipo, cupo_maximo, duracion_minutos, precio, activo, profesores!inner(id, nombre, apellido, foto_url, bio, deportes, certificado_fipa, aprobado, activo)',
        )
        .eq('sede_id', sedeId)
        .eq('activo', true)
        .eq('profesores.aprobado', true)
        .eq('profesores.activo', true);

      if (deporte) q = q.ilike('deporte', deporte);

      const { data, error } = await q.order('titulo', { ascending: true });
      if (error) throw error;

      const rows = (data || []).filter((c) => profesorMatchesDeporte(c.profesores, deporte));
      const out = await Promise.all(
        rows.map(async (c) => {
          const horarios = await fetchHorariosClase(c.id);
          const { profesores, ...rest } = c;
          return mapClaseListItem({ ...rest, profesores }, horarios);
        }),
      );
      res.json(out);
    } catch (err) {
      console.error('❌ GET /api/clases:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  /** GET /api/clases/:id?fecha=YYYY-MM-DD */
  app.get('/api/clases/:id', async (req, res) => {
    try {
      const claseId = Number(req.params.id);
      if (!Number.isFinite(claseId)) return res.status(400).json({ error: 'ID inválido' });
      const fecha = normalizeFechaYmd(req.query.fecha);

      const { data: clase, error } = await supabase
        .from('clases')
        .select(
          'id, sede_id, profesor_id, cancha_id, deporte, titulo, descripcion, tipo, cupo_maximo, duracion_minutos, precio, activo, profesores!inner(id, nombre, apellido, foto_url, bio, deportes, certificado_fipa, aprobado, activo)',
        )
        .eq('id', claseId)
        .eq('activo', true)
        .eq('profesores.aprobado', true)
        .eq('profesores.activo', true)
        .maybeSingle();
      if (error) throw error;
      if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });

      const horarios = await fetchHorariosClase(claseId);
      const cupoMax = Math.max(1, parseInt(String(clase.cupo_maximo), 10) || 1);
      let inscriptos = null;
      let cuposPorHorario = null;
      if (fecha) {
        const { data: ins, error: insErr } = await supabase
          .from('inscripciones_clases')
          .select('id, estado, hora_inicio')
          .eq('clase_id', claseId)
          .eq('fecha', fecha);
        if (insErr) throw insErr;
        const activas = (ins || []).filter((r) =>
          ESTADOS_INSCRIPCION_CUENTAN_CUPO.has(String(r.estado || '').toLowerCase()),
        );
        inscriptos = activas.length;
        const byHora = {};
        for (const r of activas) {
          const h = normalizeHoraClase(r.hora_inicio);
          if (h) byHora[h] = (byHora[h] || 0) + 1;
        }
        const dia = diaSemanaFromFechaYmd(fecha);
        cuposPorHorario = (horarios || [])
          .filter((h) => Number(h.dia_semana) === dia)
          .map((h) => {
            const hi = normalizeHoraClase(h.hora_inicio);
            const ins = byHora[hi] || 0;
            return {
              hora_inicio: hi,
              hora_fin: normalizeHoraClase(h.hora_fin),
              inscriptos: ins,
              cupos_restantes: Math.max(0, cupoMax - ins),
            };
          });
      }

      const { profesores, ...rest } = clase;
      res.json({
        ...mapClaseListItem({ ...rest, profesores }, horarios),
        inscriptos,
        cupos_por_horario: cuposPorHorario,
        fecha_consultada: fecha,
      });
    } catch (err) {
      console.error('❌ GET /api/clases/:id:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  /** POST /api/clases/inscribir */
  app.post('/api/clases/inscribir', async (req, res) => {
    try {
      const user = await requireAuthUser(req);
      const claseId = Number(req.body?.clase_id);
      const fecha = normalizeFechaYmd(req.body?.fecha);
      const horaInicio = normalizeHoraClase(req.body?.hora_inicio);
      if (!Number.isFinite(claseId) || !fecha || !horaInicio) {
        return res.status(400).json({ error: 'clase_id, fecha (YYYY-MM-DD) y hora_inicio (HH:MM) son requeridos' });
      }

      const { data: clase, error: claseErr } = await supabase
        .from('clases')
        .select(
          'id, sede_id, cancha_id, deporte, titulo, cupo_maximo, duracion_minutos, precio, activo, profesores!inner(id, aprobado, activo)',
        )
        .eq('id', claseId)
        .eq('activo', true)
        .eq('profesores.aprobado', true)
        .eq('profesores.activo', true)
        .maybeSingle();
      if (claseErr) throw claseErr;
      if (!clase) return res.status(404).json({ error: 'Clase no disponible' });

      const horarios = await fetchHorariosClase(claseId);
      if (!horarioMatchesSlot(horarios, fecha, horaInicio)) {
        return res.status(400).json({ error: 'Ese día u horario no está programado para esta clase' });
      }

      const inscriptos = await countInscripcionesSlot(claseId, fecha, horaInicio);
      const cupo = Math.max(1, parseInt(String(clase.cupo_maximo), 10) || 1);
      if (inscriptos >= cupo) {
        return res.status(409).json({ error: 'No hay cupo disponible para este turno' });
      }

      const { data: sedeRow, error: sedeErr } = await supabase
        .from('sedes')
        .select('id, nombre, moneda')
        .eq('id', clase.sede_id)
        .maybeSingle();
      if (sedeErr) throw sedeErr;
      if (!sedeRow) return res.status(404).json({ error: 'Sede no encontrada' });

      const canchaNum = await resolveCanchaNumeroReserva(clase.cancha_id);
      if (canchaNum == null) {
        return res.status(400).json({ error: 'La clase no tiene cancha asignada válida' });
      }

      const sedeNombre = String(sedeRow.nombre || '').trim();
      const duracionMin =
        Number.isFinite(Number(clase.duracion_minutos)) && Number(clase.duracion_minutos) > 0
          ? parseInt(String(clase.duracion_minutos), 10)
          : 60;

      await assertReservaSinSolapeBackend({
        sede: sedeNombre,
        fecha,
        hora: horaInicio,
        cancha: canchaNum,
        duracionMin,
      });

      let nombreJugador = String(user.email || '').split('@')[0] || 'Alumno';
      const { data: perfil } = await supabase
        .from('jugadores_perfil')
        .select('nombre, apellido, apodo, email')
        .eq('email', String(user.email || '').trim().toLowerCase())
        .maybeSingle();
      if (perfil) {
        nombreJugador =
          [perfil.nombre, perfil.apellido].filter(Boolean).join(' ').trim() || perfil.apodo || nombreJugador;
      }

      const precio = Number(clase.precio) || 0;
      const { data: reserva, error: reservaErr } = await supabaseAdmin
        .from('reservas')
        .insert([
          {
            sede: sedeNombre,
            fecha,
            hora: horaInicio,
            cancha: canchaNum,
            nombre: nombreJugador,
            email: String(user.email || '').trim().toLowerCase(),
            telefono: null,
            whatsapp: null,
            nivel: 'Clase',
            precio,
            moneda: String(sedeRow.moneda || 'ARS').trim().toUpperCase() || 'ARS',
            estado: 'confirmada',
            duracion: duracionMin,
            duracion_minutos: duracionMin,
            user_id: user.id,
            tipo: 'clase',
          },
        ])
        .select()
        .single();
      if (reservaErr) throw reservaErr;

      const { data: inscripcion, error: insErr } = await supabaseAdmin
        .from('inscripciones_clases')
        .insert([
          {
            clase_id: claseId,
            user_id: user.id,
            fecha,
            hora_inicio: horaInicio,
            estado: 'pendiente',
            reserva_id: reserva?.id ?? null,
          },
        ])
        .select()
        .single();
      if (insErr) {
        if (reserva?.id != null) {
          await supabaseAdmin.from('reservas').delete().eq('id', reserva.id);
        }
        if (/duplicate|unique/i.test(String(insErr.message || ''))) {
          return res.status(409).json({ error: 'Ya tenés una inscripción para este turno' });
        }
        throw insErr;
      }

      res.status(201).json(inscripcion);
    } catch (err) {
      const st = err.status || 500;
      if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
      console.error('❌ POST /api/clases/inscribir:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  /** GET /api/profesores?sede_id=&deporte= */
  app.get('/api/profesores', async (req, res) => {
    try {
      const sedeId = Number(req.query.sede_id);
      const deporte = String(req.query.deporte || '').trim().toLowerCase();
      if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'sede_id requerido' });

      const { data, error } = await supabase
        .from('profesores')
        .select('id, sede_id, nombre, apellido, foto_url, bio, deportes, certificado_fipa, aprobado, activo')
        .eq('sede_id', sedeId)
        .eq('activo', true)
        .eq('aprobado', true)
        .order('nombre', { ascending: true });
      if (error) throw error;

      const list = (data || [])
        .filter((p) => profesorMatchesDeporte(p, deporte))
        .map((p) => mapProfesorPublic(p));
      res.json(list);
    } catch (err) {
      console.error('❌ GET /api/profesores:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  /** GET /api/admin/profesores?sede_id= — lista admin (incluye pendientes) */
  app.get('/api/admin/profesores', async (req, res) => {
    try {
      await assertAdminClubOrSuper(req);
      const sedeId = Number(req.query.sede_id);
      if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'sede_id requerido' });
      await assertUsuarioPuedeAdministrarSede(req, sedeId);

      const { data, error } = await supabase
        .from('profesores')
        .select('id, sede_id, nombre, apellido, foto_url, bio, deportes, certificado_fipa, aprobado, activo, created_at, updated_at')
        .eq('sede_id', sedeId)
        .order('nombre', { ascending: true });
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      const st = err.status || 500;
      if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
      console.error('❌ GET /api/admin/profesores:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  /** GET /api/admin/profesores-pendientes — super admin */
  app.get('/api/admin/profesores-pendientes', async (req, res) => {
    try {
      await assertSuperAdminReq(req);
      const { data, error } = await supabase
        .from('profesores')
        .select(
          'id, sede_id, nombre, apellido, foto_url, bio, deportes, certificado_fipa, aprobado, activo, created_at, sedes(id, nombre)',
        )
        .eq('aprobado', false)
        .eq('activo', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []).map((p) => {
        const sede = p.sedes;
        const { sedes: _s, ...rest } = p;
        return {
          ...rest,
          sede_nombre: sede?.nombre ?? null,
        };
      });
      res.json(rows);
    } catch (err) {
      const st = err.status || 500;
      if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
      console.error('❌ GET /api/admin/profesores-pendientes:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  /** POST /api/admin/profesores */
  app.post('/api/admin/profesores', async (req, res) => {
    try {
      await assertAdminClubOrSuper(req);
      const b = req.body || {};
      const sedeId = Number(b.sede_id);
      if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'sede_id requerido' });
      await assertUsuarioPuedeAdministrarSede(req, sedeId);

      const nombre = String(b.nombre || '').trim();
      if (!nombre) return res.status(400).json({ error: 'nombre requerido' });

      const deportes = Array.isArray(b.deportes)
        ? b.deportes.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean)
        : [];

      const { data, error } = await supabaseAdmin
        .from('profesores')
        .insert([
          {
            sede_id: sedeId,
            nombre,
            apellido: String(b.apellido || '').trim() || null,
            foto_url: b.foto_url != null ? String(b.foto_url).trim() || null : null,
            bio: b.bio != null ? String(b.bio).trim() || null : null,
            deportes,
            certificado_fipa: Boolean(b.certificado_fipa),
            aprobado: false,
            activo: true,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (err) {
      const st = err.status || 500;
      if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
      console.error('❌ POST /api/admin/profesores:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  /** PATCH /api/admin/profesores/:id/aprobar */
  app.patch('/api/admin/profesores/:id/aprobar', async (req, res) => {
    try {
      const { user } = await assertSuperAdminReq(req);
      const profId = Number(req.params.id);
      if (!Number.isFinite(profId)) return res.status(400).json({ error: 'ID inválido' });

      const { data, error } = await supabaseAdmin
        .from('profesores')
        .update({
          aprobado: true,
          aprobado_por: user.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profId)
        .select()
        .single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Profesor no encontrado' });
      res.json(data);
    } catch (err) {
      const st = err.status || 500;
      if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
      console.error('❌ PATCH /api/admin/profesores/:id/aprobar:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  /** GET /api/admin/clases?sede_id= */
  app.get('/api/admin/clases', async (req, res) => {
    try {
      await assertAdminClubOrSuper(req);
      const sedeId = Number(req.query.sede_id);
      if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'sede_id requerido' });
      await assertUsuarioPuedeAdministrarSede(req, sedeId);

      const { data, error } = await supabase
        .from('clases')
        .select(
          'id, sede_id, profesor_id, cancha_id, deporte, titulo, descripcion, tipo, cupo_maximo, duracion_minutos, precio, activo, created_at, profesores(id, nombre, apellido, aprobado)',
        )
        .eq('sede_id', sedeId)
        .order('titulo', { ascending: true });
      if (error) throw error;

      const out = await Promise.all(
        (data || []).map(async (c) => {
          const horarios = await fetchHorariosClase(c.id);
          const prof = c.profesores;
          const nombreProf =
            [String(prof?.nombre || '').trim(), String(prof?.apellido || '').trim()].filter(Boolean).join(' ').trim() ||
            prof?.nombre ||
            '—';
          const { profesores, ...rest } = c;
          return { ...rest, profesor_nombre: nombreProf, horarios };
        }),
      );
      res.json(out);
    } catch (err) {
      const st = err.status || 500;
      if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
      console.error('❌ GET /api/admin/clases:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  /** PATCH /api/admin/clases/:id — activo */
  app.patch('/api/admin/clases/:id', async (req, res) => {
    try {
      await assertAdminClubOrSuper(req);
      const claseId = Number(req.params.id);
      if (!Number.isFinite(claseId)) return res.status(400).json({ error: 'ID inválido' });

      const { data: existing, error: exErr } = await supabase
        .from('clases')
        .select('id, sede_id')
        .eq('id', claseId)
        .maybeSingle();
      if (exErr) throw exErr;
      if (!existing) return res.status(404).json({ error: 'Clase no encontrada' });
      await assertUsuarioPuedeAdministrarSede(req, existing.sede_id);

      const patch = {};
      if (typeof req.body?.activo === 'boolean') patch.activo = req.body.activo;
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nada que actualizar' });
      patch.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('clases')
        .update(patch)
        .eq('id', claseId)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (err) {
      const st = err.status || 500;
      if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
      console.error('❌ PATCH /api/admin/clases/:id:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  /** POST /api/admin/clases */
  app.post('/api/admin/clases', async (req, res) => {
    try {
      await assertAdminClubOrSuper(req);
      const b = req.body || {};
      const sedeId = Number(b.sede_id);
      const profesorId = Number(b.profesor_id);
      const canchaId = b.cancha_id != null && b.cancha_id !== '' ? Number(b.cancha_id) : null;
      const titulo = String(b.titulo || '').trim();
      const deporte = String(b.deporte || '').trim().toLowerCase();
      const horarios = Array.isArray(b.horarios) ? b.horarios : [];

      if (!Number.isFinite(sedeId) || !Number.isFinite(profesorId) || !titulo || !deporte) {
        return res.status(400).json({ error: 'sede_id, profesor_id, deporte y titulo son requeridos' });
      }
      if (!horarios.length) return res.status(400).json({ error: 'horarios requerido (al menos un turno)' });

      await assertUsuarioPuedeAdministrarSede(req, sedeId);

      const { data: prof, error: profErr } = await supabase
        .from('profesores')
        .select('id, sede_id')
        .eq('id', profesorId)
        .maybeSingle();
      if (profErr) throw profErr;
      if (!prof || Number(prof.sede_id) !== sedeId) {
        return res.status(400).json({ error: 'profesor_id no pertenece a la sede' });
      }

      if (canchaId != null && Number.isFinite(canchaId)) {
        const { data: cancha, error: canchaErr } = await supabase
          .from('canchas')
          .select('id, sede_id')
          .eq('id', canchaId)
          .maybeSingle();
        if (canchaErr) throw canchaErr;
        if (!cancha || Number(cancha.sede_id) !== sedeId) {
          return res.status(400).json({ error: 'cancha_id no pertenece a la sede' });
        }
      }

      const cupo = parseInt(String(b.cupo_maximo), 10);
      const duracion = parseInt(String(b.duracion_minutos), 10);
      const precio = b.precio != null && b.precio !== '' ? Number(b.precio) : 0;

      const { data: clase, error: claseErr } = await supabaseAdmin
        .from('clases')
        .insert([
          {
            sede_id: sedeId,
            profesor_id: profesorId,
            cancha_id: Number.isFinite(canchaId) ? canchaId : null,
            deporte,
            titulo,
            descripcion: b.descripcion != null ? String(b.descripcion).trim() || null : null,
            tipo: String(b.tipo || 'grupal').trim() || 'grupal',
            cupo_maximo: Number.isFinite(cupo) && cupo > 0 ? cupo : 4,
            duracion_minutos: Number.isFinite(duracion) && duracion > 0 ? duracion : 60,
            precio: Number.isFinite(precio) && precio >= 0 ? precio : 0,
            activo: typeof b.activo === 'boolean' ? b.activo : true,
          },
        ])
        .select()
        .single();
      if (claseErr) throw claseErr;

      const horariosRows = [];
      for (const h of horarios) {
        const dia = Number(h.dia_semana);
        const hi = normalizeHoraClase(h.hora_inicio);
        const hf = normalizeHoraClase(h.hora_fin);
        if (!Number.isFinite(dia) || dia < 0 || dia > 6 || !hi || !hf) {
          await supabaseAdmin.from('clases').delete().eq('id', clase.id);
          return res.status(400).json({ error: 'Cada horario requiere dia_semana (0-6), hora_inicio y hora_fin' });
        }
        horariosRows.push({
          clase_id: clase.id,
          dia_semana: dia,
          hora_inicio: hi,
          hora_fin: hf,
        });
      }

      const { data: horariosIns, error: horErr } = await supabaseAdmin
        .from('clases_horarios')
        .insert(horariosRows)
        .select();
      if (horErr) {
        await supabaseAdmin.from('clases').delete().eq('id', clase.id);
        throw horErr;
      }

      res.status(201).json({ ...clase, horarios: horariosIns || [] });
    } catch (err) {
      const st = err.status || 500;
      if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
      console.error('❌ POST /api/admin/clases:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });
}
