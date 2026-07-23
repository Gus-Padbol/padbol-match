/**
 * Generador determinista de topología de red (malla local → hubs → internacional).
 * Seed estable: mismos nodos ⇒ mismas conexiones (tests reproducibles).
 *
 * Visualización conceptual — no implica presencia operativa.
 */

const DEG = Math.PI / 180;

/** Macro-regiones para hubs y mallas continentales. */
export const MACRO_REGIONS = {
  americas: ['northAmerica', 'centralAmerica', 'southAmerica'],
  europe: ['europe'],
  africa: ['northAfrica', 'westAfrica', 'eastAfrica', 'centralAfrica', 'southernAfrica'],
  middleEast: ['middleEast'],
  asia: ['centralAsia', 'southAsia', 'southeastAsia', 'eastAsia'],
  oceania: ['oceania'],
};

const MACRO_OF = {};
Object.entries(MACRO_REGIONS).forEach(([macro, regions]) => {
  regions.forEach((r) => {
    MACRO_OF[r] = macro;
  });
});

export function haversineKm(a, b) {
  const φ1 = a.lat * DEG;
  const φ2 = b.lat * DEG;
  const Δφ = (b.lat - a.lat) * DEG;
  const Δλ = (b.lon - a.lon) * DEG;
  const s =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Construye enlaces superficie: ~110 local, ~52 regional, ~30 international.
 * Cada nodo ≥2 conexiones; hubs ≤7; sin aislamiento.
 */
export function buildDeterministicMesh(nodes, options = {}) {
  const seed = options.seed == null ? 20260722 : options.seed;
  const rand = mulberry32(seed);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const degree = Object.fromEntries(nodes.map((n) => [n.id, 0]));
  const edges = new Map();

  const addEdge = (from, to, kind, weight = 'secondary') => {
    if (!byId[from] || !byId[to] || from === to) return false;
    const key = pairKey(from, to);
    if (edges.has(key)) return false;
    edges.set(key, {
      from,
      to,
      kind,
      weight,
      pacific: Boolean(byId[from].pacific && byId[to].pacific),
      dist: haversineKm(byId[from], byId[to]),
    });
    degree[from] += 1;
    degree[to] += 1;
    return true;
  };

  const byRegion = new Map();
  nodes.forEach((n) => {
    if (!byRegion.has(n.region)) byRegion.set(n.region, []);
    byRegion.get(n.region).push(n);
  });

  /* —— 1. Locales: 2–4 vecinos cercanos —— */
  byRegion.forEach((list) => {
    list.forEach((node) => {
      const others = list
        .filter((o) => o.id !== node.id)
        .map((o) => ({ id: o.id, d: haversineKm(node, o) }))
        .sort((a, b) => a.d - b.d);
      const want = 2 + (rand() > 0.4 ? 1 : 0) + (rand() > 0.75 ? 1 : 0);
      let added = 0;
      others.forEach((o) => {
        if (added >= want) return;
        if (degree[node.id] >= 5) return;
        if (o.d > 1800) return;
        if (addEdge(node.id, o.id, 'local', o.d < 800 ? 'primary' : 'secondary')) {
          added += 1;
        }
      });
    });
  });

  /* —— 2. Regionales —— */
  const macros = new Map();
  nodes.forEach((n) => {
    const m = MACRO_OF[n.region] || 'asia';
    if (!macros.has(m)) macros.set(m, []);
    macros.get(m).push(n);
  });

  macros.forEach((list) => {
    list.forEach((node) => {
      const candidates = list
        .filter((o) => o.id !== node.id)
        .map((o) => ({ id: o.id, d: haversineKm(node, o) }))
        .filter((o) => o.d > 700 && o.d < 6500)
        .sort((a, b) => a.d - b.d)
        .slice(0, 5);
      let added = 0;
      candidates.forEach((o) => {
        if (added >= 2) return;
        if (degree[node.id] >= 6) return;
        if (addEdge(node.id, o.id, 'regional', o.d < 2400 ? 'primary' : 'secondary')) {
          added += 1;
        }
      });
    });
  });

  /* —— 3. Hubs 12–16 —— */
  const hubCandidates = [...nodes]
    .map((n) => ({
      ...n,
      score:
        (n.priority || 0) * 10 +
        (n.major ? 8 : 0) +
        (n.level === 'C' ? 4 : n.level === 'A' ? 3 : 1) +
        degree[n.id] * 0.25,
    }))
    .sort((a, b) => b.score - a.score);

  const hubs = [];
  const hubsPerMacro = {};
  hubCandidates.forEach((n) => {
    if (hubs.length >= 16) return;
    const m = MACRO_OF[n.region] || 'asia';
    hubsPerMacro[m] = hubsPerMacro[m] || 0;
    if (hubsPerMacro[m] >= 4) return;
    hubs.push(n);
    hubsPerMacro[m] += 1;
  });
  hubCandidates.forEach((n) => {
    if (hubs.length >= 14) return;
    if (hubs.some((h) => h.id === n.id)) return;
    hubs.push(n);
  });

  /* —— 4. Internacionales —— */
  const hubIds = hubs.map((h) => h.id);
  const internationalTargets = [];
  for (let i = 0; i < hubIds.length; i += 1) {
    for (let j = i + 1; j < hubIds.length; j += 1) {
      const a = byId[hubIds[i]];
      const b = byId[hubIds[j]];
      if (MACRO_OF[a.region] === MACRO_OF[b.region]) continue;
      internationalTargets.push({
        a: a.id,
        b: b.id,
        d: haversineKm(a, b),
        score: (a.priority || 0) + (b.priority || 0) + rand() * 0.5,
      });
    }
  }
  internationalTargets.sort((x, y) => x.d - y.d || y.score - x.score);
  let intlAdded = 0;
  internationalTargets.forEach((t) => {
    if (intlAdded >= 40) return;
    if (degree[t.a] >= 8 || degree[t.b] >= 8) return;
    if (addEdge(t.a, t.b, 'international', t.d > 9000 ? 'primary' : 'secondary')) {
      intlAdded += 1;
    }
  });
  /* Pares adicionales entre macros distintas */
  const midPriority = nodes.filter((n) => (n.priority || 0) >= 1);
  for (let i = 0; i < midPriority.length && intlAdded < 36; i += 1) {
    for (let j = i + 2; j < midPriority.length && intlAdded < 36; j += 3) {
      const a = midPriority[i];
      const b = midPriority[j];
      if (MACRO_OF[a.region] === MACRO_OF[b.region]) continue;
      const d = haversineKm(a, b);
      if (d < 3000 || d > 18000) continue;
      if (degree[a.id] >= 7 || degree[b.id] >= 7) continue;
      if (addEdge(a.id, b.id, 'international', 'secondary')) intlAdded += 1;
    }
  }

  /* —— 5. Sin aislados: forzar grado mínimo 2 —— */
  const ensureMinDegree = () => {
    nodes.forEach((node) => {
      while (degree[node.id] < 2) {
        const others = nodes
          .filter((o) => o.id !== node.id)
          .map((o) => ({ id: o.id, d: haversineKm(node, o) }))
          .sort((a, b) => a.d - b.d);
        let linked = false;
        others.forEach((o) => {
          if (linked) return;
          if (degree[o.id] >= 7) return;
          const kind =
            byId[o.id].region === node.region
              ? 'local'
              : MACRO_OF[byId[o.id].region] === MACRO_OF[node.region]
                ? 'regional'
                : 'international';
          if (addEdge(node.id, o.id, kind, 'secondary')) linked = true;
        });
        if (!linked) break;
      }
    });
  };
  ensureMinDegree();

  let list = [...edges.values()];
  const recompute = () => {
    Object.keys(degree).forEach((id) => {
      degree[id] = 0;
    });
    list.forEach((e) => {
      degree[e.from] += 1;
      degree[e.to] += 1;
    });
  };
  recompute();

  const maxDegreeFrac = 0.055;
  const trimPass = (kindPref) => {
    recompute();
    const maxAllowed = Math.max(7, Math.floor(list.length * maxDegreeFrac));
    const overloaded = Object.entries(degree)
      .filter(([, d]) => d > maxAllowed)
      .map(([id]) => id);
    overloaded.forEach((id) => {
      const incident = list
        .filter((e) => e.from === id || e.to === id)
        .filter((e) => !kindPref || e.kind === kindPref)
        .sort((a, b) => b.dist - a.dist);
      while (degree[id] > maxAllowed && incident.length) {
        const drop = incident.shift();
        /* no dejar nodos bajo grado 2 */
        const other = drop.from === id ? drop.to : drop.from;
        if (degree[other] <= 2 || degree[id] <= 2) {
          continue;
        }
        const key = pairKey(drop.from, drop.to);
        edges.delete(key);
        list = list.filter((e) => pairKey(e.from, e.to) !== key);
        recompute();
      }
    });
  };
  trimPass('international');
  trimPass('regional');
  trimPass(null);
  list = [...edges.values()];
  recompute();
  ensureMinDegree();
  list = [...edges.values()];
  recompute();

  /* —— 6. Recortar a presupuesto sin bajar de grado 2 —— */
  const budget = { local: 120, regional: 55, international: 32 };
  const dropOne = (kind) => {
    const candidates = list
      .filter((e) => (!kind || e.kind === kind) && degree[e.from] > 2 && degree[e.to] > 2)
      .sort((a, b) => b.dist - a.dist);
    if (!candidates.length) return false;
    const drop = candidates[0];
    const key = pairKey(drop.from, drop.to);
    edges.delete(key);
    list = list.filter((e) => pairKey(e.from, e.to) !== key);
    recompute();
    return true;
  };

  let guard = 0;
  while (guard < 800) {
    guard += 1;
    const countsNow = { local: 0, regional: 0, international: 0 };
    list.forEach((e) => {
      countsNow[e.kind] += 1;
    });
    let trimmed = false;
    if (countsNow.local > budget.local) trimmed = dropOne('local');
    else if (countsNow.regional > budget.regional) trimmed = dropOne('regional');
    else if (countsNow.international > budget.international) trimmed = dropOne('international');
    else if (list.length > 205) trimmed = dropOne('local') || dropOne('regional') || dropOne(null);
    else break;
    if (!trimmed) break;
  }

  const counts = { local: 0, regional: 0, international: 0 };
  list.forEach((e) => {
    counts[e.kind] += 1;
  });

  return {
    links: list.map((e) => ({
      from: e.from,
      to: e.to,
      weight: e.weight,
      kind: e.kind,
      pacific: e.pacific,
    })),
    hubs: hubs.map((h) => h.id),
    hubIdSet: new Set(hubs.map((h) => h.id)),
    degree,
    counts,
    seed,
  };
}

export function linkDegreeStats(links) {
  const deg = {};
  links.forEach((l) => {
    deg[l.from] = (deg[l.from] || 0) + 1;
    deg[l.to] = (deg[l.to] || 0) + 1;
  });
  const values = Object.values(deg);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;
  const total = links.length || 1;
  return {
    degree: deg,
    max,
    min,
    maxFrac: max / total,
    avg: values.reduce((s, v) => s + v, 0) / (values.length || 1),
  };
}

export function isRadialTopology(links, hubs, threshold = 0.35) {
  const stats = linkDegreeStats(links);
  const hubShares = (hubs || []).map((id) => (stats.degree[id] || 0) / (links.length || 1));
  const top = Math.max(0, ...hubShares, stats.maxFrac);
  return top > threshold;
}

export function segmentCrossesDiskCenter(ax, ay, bx, by, cx, cy, radius, frac = 0.42) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const d = Math.hypot(mx - cx, my - cy);
  return d < radius * frac;
}

export function countVisibleSurfaceLinks(links, nodesById, yawDeg, cx, cy, radius, projectFn) {
  let visible = 0;
  let center = 0;
  links.forEach((l) => {
    const a = nodesById[l.from];
    const b = nodesById[l.to];
    if (!a || !b) return;
    const pa = projectFn(a.lon, a.lat, yawDeg, cx, cy, radius);
    const pb = projectFn(b.lon, b.lat, yawDeg, cx, cy, radius);
    if (!pa || !pb) return;
    visible += 1;
    if (segmentCrossesDiskCenter(pa.x, pa.y, pb.x, pb.y, cx, cy, radius)) center += 1;
  });
  return { visible, center };
}
