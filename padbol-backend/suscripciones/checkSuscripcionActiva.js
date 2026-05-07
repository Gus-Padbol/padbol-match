/**
 * Bloquea operaciones si la sede tiene suscripcion_estado suspendido o cancelado (mora).
 * Super admin no es bloqueado.
 */

const BLOQUEADOS = new Set(['suspendido', 'cancelado']);

function pathSinQuery(url) {
  return String(url || '').split('?')[0];
}

export function createCheckSuscripcionActiva({ supabase, authUserFromBearer, fetchUserRoleRow, isSuperAdminApi }) {
  return async function checkSuscripcionActiva(req, res, next) {
    try {
      const user = await authUserFromBearer(req);
      const rowRole = user?.email ? await fetchUserRoleRow(user.email) : null;
      if (isSuperAdminApi(user?.email, rowRole?.role)) {
        return next();
      }

      const p = pathSinQuery(req.originalUrl || req.url);
      let sedeId = null;

      if (p === '/api/reservas' && req.method === 'POST') {
        const nombre = String(req.body?.sede || '').trim();
        if (!nombre) return next();
        const { data, error } = await supabase.from('sedes').select('id, suscripcion_estado').eq('nombre', nombre).maybeSingle();
        if (error) throw error;
        sedeId = data?.id ?? null;
      } else if (p === '/api/torneos' && req.method === 'POST') {
        const sid = req.body?.sede_id;
        const n = parseInt(String(sid), 10);
        if (!Number.isFinite(n)) return next();
        sedeId = n;
      } else if (p === '/api/inscripciones' && req.method === 'POST') {
        const sid = parseInt(String(req.body?.sede_id ?? ''), 10);
        sedeId = Number.isFinite(sid) ? sid : null;
      }

      if (!sedeId) return next();

      const { data: sedeRow, error: sErr } = await supabase
        .from('sedes')
        .select('id, suscripcion_estado')
        .eq('id', sedeId)
        .maybeSingle();
      if (sErr) throw sErr;
      const est = String(sedeRow?.suscripcion_estado || '').trim().toLowerCase();
      if (BLOQUEADOS.has(est)) {
        return res.status(403).json({
          error:
            est === 'cancelado'
              ? 'La sede tiene la suscripción cancelada. No se pueden crear reservas ni torneos hasta regularizar con soporte.'
              : 'La sede tiene la cuenta suspendida por falta de pago. No se pueden crear reservas ni torneos.',
          suscripcion_estado: est,
        });
      }
      return next();
    } catch (err) {
      console.error('checkSuscripcionActiva:', err?.message || err);
      return res.status(500).json({ error: err.message || 'Error al verificar suscripción' });
    }
  };
}
