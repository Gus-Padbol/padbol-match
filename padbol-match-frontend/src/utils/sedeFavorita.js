import { supabase } from '../supabaseClient';

function normalizeNombre(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Cuenta uso por `sedes.id` a partir de reservas (match por nombre de sede) y torneos (jugadores_torneo + torneos.sede_id).
 * @param {string} userEmail
 * @param {Array<{ id: unknown; nombre?: string }>} sedesList filas de sedes ya cargadas (para mapear nombre → id)
 * @returns {Promise<number|null>} id de sede más usada o null
 */
export async function fetchSedeFavoritaId(userEmail, sedesList) {
  const em = String(userEmail || '').trim().toLowerCase();
  if (!em || !Array.isArray(sedesList)) return null;

  const counts = new Map();
  const bump = (sedeId) => {
    if (sedeId == null || sedeId === '') return;
    const k = Number(sedeId);
    if (!Number.isFinite(k)) return;
    counts.set(k, (counts.get(k) || 0) + 1);
  };

  const nombreToId = new Map();
  for (const s of sedesList) {
    const id = Number(s.id);
    if (!Number.isFinite(id)) continue;
    nombreToId.set(normalizeNombre(s.nombre), id);
  }

  try {
    const { data: reservas } = await supabase
      .from('reservas')
      .select('sede')
      .eq('email', em)
      .limit(300);
    for (const r of reservas || []) {
      const nid = nombreToId.get(normalizeNombre(r.sede));
      if (nid != null) bump(nid);
    }
  } catch {
    /* RLS o tabla: ignorar */
  }

  try {
    const { data: jt } = await supabase
      .from('jugadores_torneo')
      .select('torneo_id')
      .eq('email', em)
      .limit(500);
    const torneoIds = [...new Set((jt || []).map((x) => x.torneo_id).filter((x) => x != null))];
    if (torneoIds.length) {
      const { data: tors } = await supabase.from('torneos').select('id, sede_id').in('id', torneoIds);
      for (const t of tors || []) {
        bump(t.sede_id);
      }
    }
  } catch {
    /* ignorar */
  }

  let bestId = null;
  let bestC = 0;
  for (const [id, c] of counts) {
    if (c > bestC) {
      bestC = c;
      bestId = id;
    } else if (c === bestC && c > 0 && (bestId == null || id < bestId)) {
      bestId = id;
    }
  }
  return bestC > 0 ? bestId : null;
}
