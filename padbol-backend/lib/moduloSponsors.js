/**
 * Rutas admin de sponsors (PATCH parcial).
 * @param {import('express').Express} app
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, supabaseAdmin: import('@supabase/supabase-js').SupabaseClient, adminListScopeFromRequest: Function, assertEsEditorContenidoOSuperAdmin: Function, assertUsuarioPuedeAdministrarSede: Function }} deps
 */
export function registerModuloSponsorsRoutes(app, deps) {
  const {
    supabaseAdmin,
    adminListScopeFromRequest,
    assertEsEditorContenidoOSuperAdmin,
    assertUsuarioPuedeAdministrarSede,
  } = deps;

  async function assertCanManageSponsor(req, sponsorRow) {
    try {
      await assertEsEditorContenidoOSuperAdmin(req);
      return;
    } catch {
      /* admin club / nacional */
    }
    const scope = await adminListScopeFromRequest(req);
    if (!scope) {
      const e = new Error('No autorizado');
      e.status = 401;
      throw e;
    }
    if (scope.superA) return;
    const sc = String(sponsorRow?.scope || 'global').trim().toLowerCase();
    if (sc === 'sede' && sponsorRow?.sede_id != null) {
      await assertUsuarioPuedeAdministrarSede(req, Number(sponsorRow.sede_id));
      return;
    }
    const e = new Error('Sin permiso para gestionar este sponsor');
    e.status = 403;
    throw e;
  }

  function buildSponsorPatch(body) {
    const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const patch = {};
    const hop = (k) => Object.prototype.hasOwnProperty.call(b, k);
    const strOrNull = (v, max = 2048) => {
      const s = String(v ?? '').trim();
      return s ? s.slice(0, max) : null;
    };

    if (hop('nombre')) patch.nombre = String(b.nombre ?? '').trim().slice(0, 200) || null;
    if (hop('logo_url')) patch.logo_url = strOrNull(b.logo_url);
    if (hop('banner_url')) patch.banner_url = strOrNull(b.banner_url);
    if (hop('url_destino')) patch.url_destino = strOrNull(b.url_destino);
    if (hop('texto_boton')) patch.texto_boton = strOrNull(b.texto_boton, 120);
    if (hop('descripcion')) patch.descripcion = strOrNull(b.descripcion, 500);
    if (hop('scope')) patch.scope = String(b.scope ?? 'global').trim().toLowerCase().slice(0, 32) || 'global';
    if (hop('formato')) patch.formato = String(b.formato ?? 'ticker').trim().toLowerCase().slice(0, 32) || 'ticker';
    if (hop('sede_id')) {
      const sid = b.sede_id != null && b.sede_id !== '' ? Number(b.sede_id) : null;
      patch.sede_id = Number.isFinite(sid) && sid > 0 ? sid : null;
    }
    if (hop('torneo_id')) {
      const tid = b.torneo_id != null && b.torneo_id !== '' ? Number(b.torneo_id) : null;
      patch.torneo_id = Number.isFinite(tid) && tid > 0 ? tid : null;
    }
    if (hop('pais')) patch.pais = strOrNull(b.pais, 120);
    if (hop('activo')) patch.activo = Boolean(b.activo);
    if (hop('fecha_desde')) patch.fecha_desde = b.fecha_desde ? String(b.fecha_desde).slice(0, 10) : null;
    if (hop('fecha_hasta')) patch.fecha_hasta = b.fecha_hasta ? String(b.fecha_hasta).slice(0, 10) : null;
    if (hop('deportes')) {
      patch.deportes = Array.isArray(b.deportes)
        ? b.deportes.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)
        : null;
    }
    if (hop('video_url')) patch.video_url = strOrNull(b.video_url);
    if (hop('tipo_media')) {
      const tm = String(b.tipo_media ?? 'imagen').trim().toLowerCase();
      patch.tipo_media = tm === 'video' ? 'video' : 'imagen';
    }
    if (hop('aprobado')) patch.aprobado = Boolean(b.aprobado);

    return patch;
  }

  /** PATCH /api/admin/sponsors/:id — actualización parcial (admin / editor contenido). */
  app.patch('/api/admin/sponsors/:id', async (req, res) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'ID de sponsor inválido' });
      }

      const { data: existing, error: exErr } = await supabaseAdmin
        .from('sponsors')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (exErr) throw exErr;
      if (!existing) return res.status(404).json({ error: 'Sponsor no encontrado' });

      await assertCanManageSponsor(req, existing);

      const patch = buildSponsorPatch(req.body);
      if (!Object.keys(patch).length) {
        return res.status(400).json({ error: 'Ningún campo reconocido para actualizar' });
      }

      const { data: updated, error } = await supabaseAdmin
        .from('sponsors')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      res.json(updated);
    } catch (err) {
      const st = err.status || 500;
      if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
      console.error('❌ PATCH /api/admin/sponsors/:id:', err?.message || err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });
}
