/**
 * Efectos atmosféricos digitales del globo (no topología de red).
 * Puntos, líneas de datos, arcos orbitantes y brillos — cacheables.
 */

import { GLOBE_ATMOSPHERE_FX } from './globeVisualTheme';
import { limbFade, lonLatToVec3, projectVec } from './globeProjection';

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const TONES = [
  { rgb: '36, 216, 255', w: 0.42 },
  { rgb: '160, 220, 255', w: 0.32 },
  { rgb: '210, 235, 255', w: 0.2 },
  { rgb: '225, 50, 60', w: 0.06 },
];

function pickTone(rand) {
  let t = rand();
  for (let i = 0; i < TONES.length; i += 1) {
    t -= TONES[i].w;
    if (t <= 0) return TONES[i].rgb;
  }
  return TONES[0].rgb;
}

/** Distribución esférica irregular (clusters + halo). */
function fibonacciDir(i, n, jitter, rand) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / (n - 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i + (rand() - 0.5) * jitter;
  return {
    x: Math.cos(theta) * radius,
    y,
    z: Math.sin(theta) * radius,
  };
}

/**
 * Construye FX atmosférico una vez por viewport.
 */
export function buildAtmosphereFx({ compact = false, tablet = false } = {}) {
  const cfg = GLOBE_ATMOSPHERE_FX;
  const nPts = compact ? cfg.points.mobile : tablet ? cfg.points.tablet : cfg.points.desktop;
  const nLines = compact ? cfg.dataLines.mobile : tablet ? cfg.dataLines.tablet : cfg.dataLines.desktop;
  const nOrbits = compact ? cfg.orbitArcs.mobile : tablet ? cfg.orbitArcs.tablet : cfg.orbitArcs.desktop;
  const nSpark = compact ? cfg.sparkles.mobile : tablet ? cfg.sparkles.tablet : cfg.sparkles.desktop;
  const rand = mulberry32(compact ? 31011 : tablet ? 52033 : 88001);

  /* Clusters de densidad irregular */
  const clusters = Array.from({ length: compact ? 3 : 6 }, () => ({
    lon: (rand() - 0.5) * 360,
    lat: (rand() - 0.5) * 140,
    weight: 0.4 + rand() * 0.8,
  }));

  const points = [];
  for (let i = 0; i < nPts; i += 1) {
    const useCluster = rand() > 0.35;
    let lon;
    let lat;
    let shell;
    if (useCluster) {
      const c = clusters[Math.floor(rand() * clusters.length)];
      lon = c.lon + (rand() - 0.5) * 55 * c.weight;
      lat = Math.max(-80, Math.min(80, c.lat + (rand() - 0.5) * 40 * c.weight));
      shell = cfg.shellMin + rand() * (cfg.shellMax - cfg.shellMin) * (0.7 + c.weight * 0.3);
    } else {
      const d = fibonacciDir(i, nPts, 0.35, rand);
      lon = (Math.atan2(d.x, d.z) * 180) / Math.PI;
      lat = (Math.asin(Math.max(-1, Math.min(1, d.y))) * 180) / Math.PI;
      shell = cfg.shellMin + rand() * (cfg.shellMax - cfg.shellMin);
    }
    points.push({
      lon,
      lat,
      shell,
      r: 0.55 + rand() * 1.35,
      rgb: pickTone(rand),
      phase: rand() * Math.PI * 2,
      speed: 0.12 + rand() * 0.45,
      twinkle: 0.4 + rand() * 1.2,
      driftLon: (rand() - 0.5) * 8,
    });
  }

  const dataLines = [];
  for (let i = 0; i < nLines; i += 1) {
    const lat = -55 + rand() * 110;
    const lonStart = -180 + rand() * 360;
    const span = 40 + rand() * 110;
    const shell = 1.0 + rand() * 0.08;
    dataLines.push({
      id: `dl-${i}`,
      lat,
      lonStart,
      span,
      shell,
      speed: 2.5 + rand() * 5.5,
      phase: rand() * Math.PI * 2,
      width: 0.7 + rand() * 0.7,
      alpha: 0.22 + rand() * 0.28,
      beads: 2 + Math.floor(rand() * 4),
    });
  }

  const orbitArcs = [];
  for (let i = 0; i < nOrbits; i += 1) {
    orbitArcs.push({
      id: `oa-${i}`,
      tilt: (rand() - 0.5) * 55,
      lon0: rand() * 360,
      span: 50 + rand() * 100,
      shell: 1.08 + rand() * 0.16,
      speed: 3 + rand() * 7,
      phase: rand() * Math.PI * 2,
      alpha: 0.18 + rand() * 0.22,
    });
  }

  const sparkles = [];
  for (let i = 0; i < nSpark; i += 1) {
    sparkles.push({
      lon: (rand() - 0.5) * 360,
      lat: (rand() - 0.5) * 140,
      shell: 1.02 + rand() * 0.2,
      phase: rand() * Math.PI * 2,
      period: 4.5 + rand() * 6,
      rgb: rand() > 0.85 ? '225, 50, 60' : '36, 216, 255',
    });
  }

  return {
    points,
    dataLines,
    orbitArcs,
    sparkles,
    counts: { points: nPts, dataLines: nLines, orbitArcs: nOrbits, sparkles: nSpark },
  };
}

function projectShell(lon, lat, yawDeg, cx, cy, radius, shell) {
  const v = lonLatToVec3(lon, lat, yawDeg);
  const p = projectVec(
    { x: v.x, y: v.y, z: v.z },
    cx,
    cy,
    radius * shell,
    -1,
  );
  if (!p) return null;
  return { ...p, vz: v.z };
}

/**
 * Dibuja capa posterior (fuera/detrás del disco) — blur visual vía alpha baja.
 */
export function drawAtmosphereFxBack(ctx, fx, yawDeg, cx, cy, radius, tSec, reducedMotion) {
  if (!fx) return;
  const t = reducedMotion ? 0 : tSec;
  fx.orbitArcs.forEach((arc) => {
    drawOrbitSeg(ctx, arc, yawDeg, cx, cy, radius, t, 'back');
  });
  fx.points.forEach((pt) => {
    const lon = pt.lon + (reducedMotion ? 0 : Math.sin(t * pt.speed + pt.phase) * pt.driftLon * 0.15);
    const p = projectShell(lon, pt.lat, yawDeg, cx, cy, radius, pt.shell);
    if (!p || p.vz >= 0.02) return;
    const fade = Math.min(1, Math.abs(p.vz) * 2);
    const tw = reducedMotion ? 0.7 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * pt.twinkle + pt.phase));
    ctx.globalAlpha = 0.22 * fade * tw;
    ctx.beginPath();
    ctx.fillStyle = `rgba(${pt.rgb}, 1)`;
    ctx.arc(p.x, p.y, pt.r * 0.85, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/**
 * Dibuja capa frontal: líneas de datos, puntos, sparkles.
 */
export function drawAtmosphereFxFront(ctx, fx, yawDeg, cx, cy, radius, tSec, reducedMotion) {
  if (!fx) return;
  const t = reducedMotion ? 0 : tSec;

  fx.dataLines.forEach((line) => {
    drawDataLine(ctx, line, yawDeg, cx, cy, radius, t, reducedMotion);
  });

  fx.orbitArcs.forEach((arc) => {
    drawOrbitSeg(ctx, arc, yawDeg, cx, cy, radius, t, 'front');
  });

  fx.points.forEach((pt) => {
    const lon = pt.lon + (reducedMotion ? 0 : Math.sin(t * pt.speed + pt.phase) * pt.driftLon * 0.15);
    const p = projectShell(lon, pt.lat, yawDeg, cx, cy, radius, pt.shell);
    if (!p || p.vz < 0.02) return;
    const fade = limbFade(p.vz, 0.28);
    if (fade < 0.08) return;
    const tw = reducedMotion ? 0.75 : 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * pt.twinkle + pt.phase));
    const outside = Math.hypot(p.x - cx, p.y - cy) > radius * 0.98;
    ctx.globalAlpha = (outside ? 0.55 : 0.38) * fade * tw;
    ctx.beginPath();
    ctx.fillStyle = `rgba(${pt.rgb}, 1)`;
    ctx.arc(p.x, p.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  });

  fx.sparkles.forEach((s) => {
    const p = projectShell(s.lon, s.lat, yawDeg, cx, cy, radius, s.shell);
    if (!p || p.vz < 0.15) return;
    const pulse = reducedMotion
      ? 0.45
      : Math.max(0, Math.sin((t * Math.PI * 2) / s.period + s.phase));
    if (pulse < 0.15) return;
    const fade = limbFade(p.vz);
    ctx.globalAlpha = 0.55 * pulse * fade;
    ctx.beginPath();
    ctx.fillStyle = `rgba(${s.rgb}, 1)`;
    ctx.arc(p.x, p.y, 1.6 + pulse * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.2 * pulse * fade;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawDataLine(ctx, line, yawDeg, cx, cy, radius, t, reducedMotion) {
  const drift = reducedMotion ? 0 : t * line.speed;
  const lon0 = line.lonStart + drift;
  const steps = Math.max(10, Math.floor(line.span / 4));
  let prev = null;
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(36, 200, 255, 1)';
  ctx.lineWidth = line.width;
  ctx.globalAlpha = line.alpha;
  for (let i = 0; i <= steps; i += 1) {
    const lon = lon0 + (line.span * i) / steps;
    const p = projectShell(lon, line.lat, yawDeg, cx, cy, radius, line.shell);
    if (!p || p.vz < 0.05) {
      prev = null;
      continue;
    }
    const fade = limbFade(p.vz);
    if (fade < 0.12) {
      prev = null;
      continue;
    }
    if (!prev) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
    prev = p;
  }
  ctx.stroke();

  /* Beads luminosos */
  for (let b = 0; b < line.beads; b += 1) {
    const u = ((b / line.beads) + (reducedMotion ? 0.3 : (t * 0.08 + line.phase) % 1)) % 1;
    const lon = lon0 + line.span * u;
    const p = projectShell(lon, line.lat, yawDeg, cx, cy, radius, line.shell);
    if (!p || p.vz < 0.12) continue;
    const fade = limbFade(p.vz);
    ctx.globalAlpha = 0.7 * fade;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(200, 245, 255, 1)';
    ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOrbitSeg(ctx, arc, yawDeg, cx, cy, radius, t, side) {
  const drift = t * arc.speed;
  const lon0 = arc.lon0 + drift;
  const steps = 18;
  let prev = null;
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(80, 190, 230, 1)';
  ctx.lineWidth = 0.85;
  ctx.globalAlpha = arc.alpha;
  for (let i = 0; i <= steps; i += 1) {
    const lon = lon0 + (arc.span * i) / steps;
    const lat = Math.sin((i / steps) * Math.PI) * arc.tilt * 0.35;
    const p = projectShell(lon, lat, yawDeg, cx, cy, radius, arc.shell);
    if (!p) {
      prev = null;
      continue;
    }
    if (side === 'front' && p.vz < 0.04) {
      prev = null;
      continue;
    }
    if (side === 'back' && p.vz >= 0.04) {
      prev = null;
      continue;
    }
    if (!prev) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
    prev = p;
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}
