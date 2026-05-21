/** Clave estable para IDs de equipo (evita fallos string vs number en stats). */
export function equipoIdKey(id) {
  if (id == null || id === '') return '';
  const n = Number(id);
  return Number.isFinite(n) ? String(n) : String(id).trim();
}

/** Games a/b desde "6-4", "6 4", "6  0". */
export function parseSetGames(setStr) {
  const parts = String(setStr || '')
    .trim()
    .split(/[\s-–—:]+/)
    .filter(Boolean);
  if (parts.length < 2) return null;
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { a, b };
}

/** Normaliza un set del JSONB a string "n-m" (string, array [a,b], objeto games_a/b, etc.). */
export function normalizeSetMarcadorEntry(raw) {
  if (raw == null || raw === '') return '';
  if (Array.isArray(raw)) {
    if (raw.length < 2) return '';
    const a = Number(raw[0]);
    const b = Number(raw[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) return `${a}-${b}`;
    return '';
  }
  if (typeof raw === 'object') {
    const a = raw.a ?? raw.games_a ?? raw.gamesA ?? raw.local ?? raw.score_a ?? raw.home;
    const b = raw.b ?? raw.games_b ?? raw.gamesB ?? raw.visitante ?? raw.away ?? raw.score_b;
    if (a != null && b != null) {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return `${na}-${nb}`;
    }
    return '';
  }
  const s = String(raw).trim();
  if (!s) return '';
  const parsed = parseSetGames(s);
  if (parsed) return `${parsed.a}-${parsed.b}`;
  return '';
}

function unwrapResultadoJson(val, depth = 0) {
  if (val == null || depth > 4) return null;
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t) return null;
    try {
      return unwrapResultadoJson(JSON.parse(t), depth + 1);
    } catch {
      return null;
    }
  }
  if (typeof val === 'object') return val;
  return null;
}

function setsDesdeResultadoObj(res) {
  if (!res || typeof res !== 'object' || Array.isArray(res)) return [];

  if (Array.isArray(res.sets)) {
    return res.sets.map((s) => normalizeSetMarcadorEntry(s)).filter((s) => s && parseSetGames(s));
  }

  const porClaves = [
    res.set1,
    res.set2,
    res.set3,
    res.set_1,
    res.set_2,
    res.set_3,
    res.Set1,
    res.Set2,
    res.Set3,
  ]
    .map((s) => normalizeSetMarcadorEntry(s))
    .filter((s) => s && parseSetGames(s));

  if (porClaves.length) return porClaves;

  const numericKeys = Object.keys(res)
    .filter((k) => /^set\d+$/i.test(k))
    .sort((a, b) => {
      const na = Number(String(a).replace(/\D/g, ''));
      const nb = Number(String(b).replace(/\D/g, ''));
      return na - nb;
    })
    .map((k) => normalizeSetMarcadorEntry(res[k]))
    .filter((s) => s && parseSetGames(s));

  return numericKeys;
}

/** Objeto `resultado` parseado (JSONB, string JSON o sets sueltos en el partido). */
export function parseResultadoObject(partido) {
  if (!partido) return null;

  let res = partido.resultado ?? partido.marcador ?? partido.score ?? null;
  if (res == null && (partido.set1 != null || partido.set2 != null || partido.set3 != null)) {
    return {
      set1: partido.set1,
      set2: partido.set2,
      set3: partido.set3,
    };
  }
  if (res == null) return null;

  res = unwrapResultadoJson(res);
  if (!res) return null;

  if (Array.isArray(res)) {
    return { sets: res };
  }

  return res && typeof res === 'object' ? res : null;
}

/** Parsea `partido.resultado` a lista de sets "n-m". */
export function parseResultadoPartido(partido) {
  const res = parseResultadoObject(partido);
  if (!res) return [];
  return setsDesdeResultadoObj(res);
}

export function partidoEstaFinalizado(partido) {
  return String(partido?.estado || '').trim().toLowerCase() === 'finalizado';
}

/** Partido con marcador cargado (JSONB), aunque el estado no sea aún `finalizado`. */
export function partidoTieneResultadoCargado(partido) {
  if (parseResultadoPartido(partido).length > 0) return true;
  const res = parseResultadoObject(partido);
  if (!res) return false;
  const gid = res.ganador_id ?? res.ganadorId;
  return gid != null && String(gid).trim() !== '';
}

/** UI: `pendiente` | `en_juego` | `finalizado` (resultado JSONB o estado DB). */
export function resolvePartidoEstadoUi(partido) {
  const e = String(partido?.estado || '').trim().toLowerCase();
  if (e === 'finalizado' || partidoTieneResultadoCargado(partido)) return 'finalizado';
  if (['en_juego', 'en_curso', 'activo', 'en juego'].includes(e)) return 'en_juego';
  return 'pendiente';
}

/** Sets en línea neutra: «6-4 / 3-6 / 7-5». */
export function formatSetsLineaNeutral(partido) {
  const sets = parseResultadoPartido(partido);
  return sets
    .map((set) => {
      const parsed = parseSetGames(set);
      if (!parsed) return null;
      return `${parsed.a}-${parsed.b}`;
    })
    .filter(Boolean)
    .join(' / ');
}

/** Ganador del partido: `resultado.ganador_id` o sets ganados (equipo A/B). */
export function resolveGanadorEquipoId(partido) {
  const res = parseResultadoObject(partido);
  if (res) {
    const raw = res.ganador_id ?? res.ganadorId;
    if (raw != null && raw !== '') return equipoIdKey(raw);
  }
  const { sgA, sgB } = contarSetsGanadosPartido(partido);
  const idA = equipoIdKey(partido?.equipo_a_id);
  const idB = equipoIdKey(partido?.equipo_b_id);
  if (sgA > sgB) return idA;
  if (sgB > sgA) return idB;
  return '';
}

/** Partidos de fase de grupos: por campo `grupo` o ambos equipos en el grupo. */
export function partidosDelGrupo(partidosList, grupoEquipos, grupoLabel) {
  const teamIds = new Set((grupoEquipos || []).map((e) => equipoIdKey(e.id)).filter(Boolean));
  const gLabel = grupoLabel != null && grupoLabel !== '' ? String(grupoLabel) : '';
  return (partidosList || []).filter((p) => {
    if (gLabel && p.grupo != null && String(p.grupo) === gLabel) return true;
    const a = equipoIdKey(p.equipo_a_id);
    const b = equipoIdKey(p.equipo_b_id);
    return teamIds.has(a) && teamIds.has(b);
  });
}

function calcularStatsDesdePartidos(equiposList, partidosList) {
  const stats = {};
  (equiposList || []).forEach((eq) => {
    const k = equipoIdKey(eq.id);
    if (k) stats[k] = { jj: 0, g: 0, p: 0, pts: 0, sg: 0, sp: 0, gg: 0, gp: 0 };
  });

  (partidosList || []).forEach((partido) => {
    if (!partidoEstaFinalizado(partido)) return;

    const idA = equipoIdKey(partido.equipo_a_id);
    const idB = equipoIdKey(partido.equipo_b_id);
    const eqA = stats[idA];
    const eqB = stats[idB];
    if (!eqA || !eqB) return;

    eqA.jj += 1;
    eqB.jj += 1;

    const ganadorKey = resolveGanadorEquipoId(partido);
    if (ganadorKey === idA) {
      eqA.g += 1;
    } else if (ganadorKey === idB) {
      eqB.g += 1;
    }

    const sets = parseResultadoPartido(partido);
    let sgA = 0;
    let sgB = 0;
    let ggA = 0;
    let ggB = 0;
    sets.forEach((set) => {
      const parsed = parseSetGames(set);
      if (!parsed) return;
      const { a, b } = parsed;
      ggA += a;
      ggB += b;
      if (a > b) sgA += 1;
      else if (b > a) sgB += 1;
    });

    eqA.sg += sgA;
    eqA.sp += sgB;
    eqA.gg += ggA;
    eqA.gp += ggB;
    eqB.sg += sgB;
    eqB.sp += sgA;
    eqB.gg += ggB;
    eqB.gp += ggA;
  });

  Object.values(stats).forEach((s) => {
    s.p = s.jj - s.g;
    s.pts = s.g * 3;
  });

  return stats;
}

/**
 * Tabla de posiciones desde partidos finalizados (no usa `equipos.puntos_totales`).
 * Orden: PTS ↓, SW (sg) ↓, GW (gg) ↓.
 */
export function buildTablaPosiciones(equiposList, partidosList) {
  const equipos = (equiposList || []).filter((eq) => eq?.id != null && eq.id !== '');
  const stats = calcularStatsDesdePartidos(equipos, partidosList);
  return equipos
    .map((eq) => {
      const k = equipoIdKey(eq.id);
      const s = stats[k] || { jj: 0, g: 0, p: 0, pts: 0, sg: 0, sp: 0, gg: 0, gp: 0 };
      return {
        id: eq.id,
        nombre: eq.nombre,
        jugadores: eq.jugadores,
        puntos_ranking: eq.puntos_ranking || 0,
        jj: s.jj,
        g: s.g,
        p: s.p,
        pts: s.pts,
        sg: s.sg,
        sp: s.sp,
        gg: s.gg,
        gp: s.gp,
        djuegos: (s.gg - s.gp) || 0,
        dif: (s.sg - s.sp) || 0,
      };
    })
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.sg !== a.sg) return b.sg - a.sg;
      if (b.gg !== a.gg) return b.gg - a.gg;
      return 0;
    });
}

export function contarSetsGanadosPartido(partido) {
  const sets = parseResultadoPartido(partido);
  let a = 0;
  let b = 0;
  sets.forEach((set) => {
    const parsed = parseSetGames(set);
    if (!parsed) return;
    if (parsed.a > parsed.b) a += 1;
    else if (parsed.b > parsed.a) b += 1;
  });
  return { sgA: a, sgB: b };
}

/**
 * Marcador legible: «Los Cóndores 6-3 / 6-4 Los Pumas».
 */
export function formatMarcadorPartidoDetalle(partido, nombreA, nombreB) {
  const na = String(nombreA || 'Equipo A').trim();
  const nb = String(nombreB || 'Equipo B').trim();
  const sets = parseResultadoPartido(partido);
  if (!sets.length) return '';

  const trozos = sets
    .map((set) => {
      const parsed = parseSetGames(set);
      if (!parsed) return null;
      const { a, b } = parsed;
      if (a > b) return `${na} ${a}-${b}`;
      if (b > a) return `${a}-${b} ${nb}`;
      return `${a}-${b}`;
    })
    .filter(Boolean);

  return trozos.join(' / ');
}

/** Persistir `ganador_id` junto a sets al guardar resultado. */
export function resultadoConGanador(partido, setsNorm) {
  const norm = { ...(setsNorm || {}) };
  const fake = {
    equipo_a_id: partido?.equipo_a_id,
    equipo_b_id: partido?.equipo_b_id,
    resultado: norm,
  };
  const { sgA, sgB } = contarSetsGanadosPartido(fake);
  let ganador_id = null;
  if (sgA > sgB) ganador_id = partido?.equipo_a_id ?? null;
  else if (sgB > sgA) ganador_id = partido?.equipo_b_id ?? null;
  return ganador_id != null ? { ...norm, ganador_id } : norm;
}
