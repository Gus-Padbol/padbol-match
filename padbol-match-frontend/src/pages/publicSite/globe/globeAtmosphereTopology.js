/**
 * Generador determinista de envolvente atmosférica (efecto átomo).
 * Pares reales de nodos + alturas/inclinaciones variadas.
 */

import { haversineKm, MACRO_REGIONS } from './globeMeshTopology';

const MACRO_OF = {};
Object.entries(MACRO_REGIONS).forEach(([macro, regions]) => {
  regions.forEach((r) => {
    MACRO_OF[r] = macro;
  });
});

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function bearingDeg(a, b) {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function inclinationClass(bearing) {
  if (bearing < 20 || bearing > 340) return 'ns';
  if (bearing < 70) return 'ne-sw';
  if (bearing < 110) return 'ew';
  if (bearing < 160) return 'nw-se';
  if (bearing < 200) return 'ns';
  if (bearing < 250) return 'ne-sw';
  if (bearing < 290) return 'ew';
  return 'nw-se';
}

function sectorForPair(a, b) {
  const midLon = (a.lon + b.lon) / 2;
  const midLat = (a.lat + b.lat) / 2;
  if (Math.abs(midLat) > 35 && midLat > 0) return 'north';
  if (Math.abs(midLat) > 35 && midLat < 0) return 'south';
  if (a.pacific && b.pacific) return 'pacific';
  if (MACRO_OF[a.region] === 'oceania' || MACRO_OF[b.region] === 'oceania') return 'oceania';
  if (MACRO_OF[a.region] === 'americas' || MACRO_OF[b.region] === 'americas') {
    if (MACRO_OF[a.region] !== MACRO_OF[b.region]) return midLon < -30 ? 'atlantic' : 'americas';
    return 'americas';
  }
  if (MACRO_OF[a.region] === 'africa' || MACRO_OF[b.region] === 'africa') return 'africa';
  if (MACRO_OF[a.region] === 'asia' || MACRO_OF[b.region] === 'asia') {
    return MACRO_OF[a.region] === 'europe' || MACRO_OF[b.region] === 'europe' ? 'eurasia' : 'asia';
  }
  if (MACRO_OF[a.region] === 'europe' || MACRO_OF[b.region] === 'europe') return 'eurasia';
  return midLon < 0 ? 'atlantic' : 'asia';
}

const COLORS = ['ice', 'silver', 'blue', 'ice', 'silver', 'ice', 'blue', 'red'];

/**
 * Construye 42–50 rutas atmosféricas con bandas low/mid/high e inclinaciones variadas.
 */
export function buildAtmosphericEnvelope(nodes, options = {}) {
  const seed = options.seed == null ? 20260723 : options.seed;
  const target = options.target == null ? 46 : options.target;
  const rand = mulberry32(seed);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const hubs = [...nodes]
    .sort(
      (a, b) =>
        (b.priority || 0) + (b.major ? 3 : 0) - ((a.priority || 0) + (a.major ? 3 : 0)),
    )
    .slice(0, Math.min(28, nodes.length));

  const candidates = [];
  for (let i = 0; i < hubs.length; i += 1) {
    for (let j = i + 1; j < hubs.length; j += 1) {
      const a = hubs[i];
      const b = hubs[j];
      if (MACRO_OF[a.region] === MACRO_OF[b.region] && rand() > 0.35) continue;
      const d = haversineKm(a, b);
      if (d < 1800 || d > 20000) continue;
      const bearing = bearingDeg(a, b);
      candidates.push({
        a: a.id,
        b: b.id,
        d,
        bearing,
        incline: inclinationClass(bearing),
        sector: sectorForPair(a, b),
        score: (a.priority || 0) + (b.priority || 0) + rand() * 2 + (d > 6000 ? 1 : 0),
      });
    }
  }

  /* También pares no-hub para variedad de inclinación */
  const extras = nodes.filter((n) => n.priority >= 1).slice(0, 40);
  for (let i = 0; i < extras.length; i += 1) {
    for (let j = i + 3; j < extras.length; j += 4) {
      const a = extras[i];
      const b = extras[j];
      const d = haversineKm(a, b);
      if (d < 2500 || d > 18000) continue;
      if (MACRO_OF[a.region] === MACRO_OF[b.region]) continue;
      const bearing = bearingDeg(a, b);
      candidates.push({
        a: a.id,
        b: b.id,
        d,
        bearing,
        incline: inclinationClass(bearing),
        sector: sectorForPair(a, b),
        score: rand() + 0.5,
      });
    }
  }

  candidates.sort((x, y) => y.score - x.score);

  const used = new Set();
  const inclineCount = {};
  const sectorCount = {};
  const bearingBuckets = new Array(12).fill(0);
  const picked = [];

  const tryAdd = (c, bandForce) => {
    const key = pairKey(c.a, c.b);
    if (used.has(key)) return false;
    if ((inclineCount[c.incline] || 0) >= Math.ceil(target * 0.35) && !bandForce) return false;
    const bucket = Math.floor(c.bearing / 30);
    if (bearingBuckets[bucket] >= 5) return false; /* evita paralelos dominantes */
    used.add(key);
    inclineCount[c.incline] = (inclineCount[c.incline] || 0) + 1;
    sectorCount[c.sector] = (sectorCount[c.sector] || 0) + 1;
    bearingBuckets[bucket] += 1;
    picked.push(c);
    return true;
  };

  /* Primera pasada: balance por sector */
  const sectorsWanted = [
    'pacific', 'atlantic', 'north', 'south', 'oceania', 'americas', 'eurasia', 'africa', 'asia',
  ];
  sectorsWanted.forEach((sec) => {
    candidates.forEach((c) => {
      if (picked.length >= target) return;
      if (c.sector !== sec) return;
      if ((sectorCount[sec] || 0) >= 6) return;
      tryAdd(c);
    });
  });

  candidates.forEach((c) => {
    if (picked.length >= target) return;
    tryAdd(c);
  });

  /* Altura: 25% low, 40% mid, 35% high */
  const n = picked.length;
  const nLow = Math.round(n * 0.25);
  const nHigh = Math.round(n * 0.35);
  const routes = picked.map((c, i) => {
    let band = 'mid';
    let peakAltitude = 0.18 + rand() * 0.04;
    if (i < nLow) {
      band = 'low';
      peakAltitude = 0.1 + rand() * 0.05;
    } else if (i >= n - nHigh) {
      band = 'high';
      peakAltitude = 0.26 + rand() * 0.1; /* hasta ~0.36 */
    }
    const a = byId[c.a];
    const b = byId[c.b];
    const color = COLORS[i % COLORS.length];
    return {
      id: `atm-${c.a}-${c.b}`,
      from: c.a,
      to: c.b,
      lonA: a.lon,
      latA: a.lat,
      lonB: b.lon,
      latB: b.lat,
      peakAltitude: Math.min(0.38, peakAltitude),
      pacific: Boolean(a.pacific && b.pacific),
      weight: band === 'high' || c.d > 9000 ? 'primary' : 'secondary',
      color,
      band,
      sector: c.sector,
      incline: c.incline,
      bearing: Math.round(c.bearing),
    };
  });

  return { routes, seed, inclineCount, sectorCount };
}

export function atmosphericInclinationVariety(routes) {
  return new Set(routes.map((r) => r.incline)).size;
}

export function countParallelDominant(routes, bucketDeg = 12, maxShare = 0.28) {
  const buckets = {};
  routes.forEach((r) => {
    const b = Math.floor(((r.bearing || 0) % 180) / bucketDeg);
    buckets[b] = (buckets[b] || 0) + 1;
  });
  const max = Math.max(0, ...Object.values(buckets));
  return max / (routes.length || 1) > maxShare;
}
