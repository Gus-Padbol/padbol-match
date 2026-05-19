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

function setsDesdeResultadoObj(res) {
  if (!res || typeof res !== 'object') return [];
  if (Array.isArray(res.sets)) {
    return res.sets
      .map((s) => {
        if (typeof s === 'string') return s.trim();
        if (s && typeof s === 'object') {
          const a = s.a ?? s.games_a ?? s.local;
          const b = s.b ?? s.games_b ?? s.visitante;
          if (a != null && b != null) return `${a}-${b}`;
        }
        return '';
      })
      .filter(Boolean);
  }
  return [res.set1, res.set2, res.set3].filter((s) => s && String(s).trim());
}

/** Parsea `partido.resultado` (JSONB o string) a lista de sets "n-m". */
export function parseResultadoPartido(partido) {
  if (!partido?.resultado) return [];
  let res = partido.resultado;
  if (typeof res === 'string') {
    try {
      res = JSON.parse(res);
    } catch {
      return [];
    }
  }
  return setsDesdeResultadoObj(res);
}

function partidoCuentaParaStats(partido) {
  const st = String(partido?.estado || '').trim().toLowerCase();
  if (st === 'finalizado') return true;
  if (parseResultadoPartido(partido).length > 0) return true;
  return false;
}

function calcularStatsDesdePartidos(equiposList, partidosList) {
  const stats = {};
  (equiposList || []).forEach((eq) => {
    const k = equipoIdKey(eq.id);
    if (k) stats[k] = { jj: 0, g: 0, p: 0, pts: 0, sg: 0, sp: 0, gg: 0, gp: 0 };
  });

  (partidosList || []).forEach((partido) => {
    if (!partidoCuentaParaStats(partido)) return;
    const sets = parseResultadoPartido(partido);
    if (!sets.length) return;

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

    const idA = equipoIdKey(partido.equipo_a_id);
    const idB = equipoIdKey(partido.equipo_b_id);
    const eqA = stats[idA];
    const eqB = stats[idB];
    if (!eqA || !eqB) return;

    eqA.jj += 1;
    eqB.jj += 1;
    eqA.sg += sgA;
    eqA.sp += sgB;
    eqA.gg += ggA;
    eqA.gp += ggB;
    eqB.sg += sgB;
    eqB.sp += sgA;
    eqB.gg += ggB;
    eqB.gp += ggA;

    if (sgA > sgB) {
      eqA.g += 1;
      eqB.p += 1;
      eqA.pts += 3;
    } else if (sgB > sgA) {
      eqB.g += 1;
      eqA.p += 1;
      eqB.pts += 3;
    }
  });

  return stats;
}

/** Tabla de posiciones desde partidos finalizados (no usa `equipos.puntos_totales`). */
export function buildTablaPosiciones(equiposList, partidosList) {
  const stats = calcularStatsDesdePartidos(equiposList, partidosList);
  return (equiposList || [])
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
      if (b.sg - b.sp !== a.sg - a.sp) return b.sg - b.sp - (a.sg - a.sp);
      if (b.gg - b.gp !== a.gg - a.gp) return b.gg - b.gp - (a.gg - a.gp);
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
 * @param {object} partido
 * @param {string} nombreA
 * @param {string} nombreB
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
