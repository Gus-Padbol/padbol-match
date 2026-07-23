/**
 * Proyección ortográfica y arcos geodésicos para el globo del Hero.
 * Clipping de hemisferio + antimeridiano correctos (sin bandas invertidas).
 */

import {
  densifyRing,
  isSpuriousChord,
  normalizeLon,
  splitRingAtAntimeridian,
} from './globeAntimeridian';

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

/** Umbral frontal (z ≥ eps). */
export const FRONT_EPS = 0.02;

export function lonLatToVec3(lon, lat, yawDeg) {
  const λ = (normalizeLon(lon) + yawDeg) * DEG;
  const φ = lat * DEG;
  const cosφ = Math.cos(φ);
  return {
    x: cosφ * Math.sin(λ),
    y: Math.sin(φ),
    z: cosφ * Math.cos(λ),
  };
}

export function projectVec(v, cx, cy, radius, eps = FRONT_EPS) {
  if (v.z < eps) return null;
  return {
    x: cx + radius * v.x,
    y: cy - radius * v.y,
    z: v.z,
  };
}

export function projectLonLat(lon, lat, yawDeg, cx, cy, radius, eps = FRONT_EPS) {
  return projectVec(lonLatToVec3(lon, lat, yawDeg), cx, cy, radius, eps);
}

export function limbFade(z, soft = 0.22) {
  if (z <= 0) return 0;
  if (z >= soft) return 1;
  return z / soft;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function slerpLonLat(a, b, t) {
  const av = lonLatToVec3(a[0], a[1], 0);
  const bv = lonLatToVec3(b[0], b[1], 0);
  const dot = Math.max(-1, Math.min(1, av.x * bv.x + av.y * bv.y + av.z * bv.z));
  const omega = Math.acos(dot);
  if (omega < 1e-5) return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
  const s2 = Math.sin(t * omega) / Math.sin(omega);
  const x = s1 * av.x + s2 * bv.x;
  const y = s1 * av.y + s2 * bv.y;
  const z = s1 * av.z + s2 * bv.z;
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * RAD;
  const lon = Math.atan2(x, z) * RAD;
  return [normalizeLon(lon), lat];
}

export function greatCircleSamples(a, b, steps = 28) {
  const out = [];
  for (let i = 0; i <= steps; i += 1) out.push(slerpLonLat(a, b, i / steps));
  return out;
}

export function clipToHorizon(from, to, yawDeg, fromFront, eps = FRONT_EPS) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 12; i += 1) {
    const mid = (lo + hi) / 2;
    const [lon, lat] = slerpLonLat(from, to, mid);
    const vz = lonLatToVec3(lon, lat, yawDeg).z;
    if ((fromFront && vz >= eps) || (!fromFront && vz < eps)) lo = mid;
    else hi = mid;
  }
  return slerpLonLat(from, to, (lo + hi) / 2);
}

/**
 * Proyecta polilínea en cadenas frontales (sin cruzar limbo ni antimeridiano).
 */
export function projectFrontPolyline(samples, yawDeg, cx, cy, radius, eps = FRONT_EPS) {
  const segments = [];
  let current = [];

  const pushPoint = (ll) => {
    const v = lonLatToVec3(ll[0], ll[1], yawDeg);
    if (v.z < eps) return false;
    const p = projectVec(v, cx, cy, radius, eps);
    if (!p) return false;
    current.push({ x: p.x, y: p.y, z: p.z, fade: limbFade(p.z) });
    return true;
  };

  for (let i = 0; i < samples.length; i += 1) {
    const ll = samples[i];
    const v = lonLatToVec3(ll[0], ll[1], yawDeg);
    const front = v.z >= eps;
    if (front) {
      if (i > 0) {
        const prev = samples[i - 1];
        const pv = lonLatToVec3(prev[0], prev[1], yawDeg);
        if (pv.z < eps) {
          const edge = clipToHorizon(prev, ll, yawDeg, false, eps);
          if (current.length) {
            segments.push(current);
            current = [];
          }
          pushPoint(edge);
        }
      }
      pushPoint(ll);
    } else if (current.length) {
      if (i > 0) {
        const prev = samples[i - 1];
        const pv = lonLatToVec3(prev[0], prev[1], yawDeg);
        if (pv.z >= eps) {
          const edge = clipToHorizon(prev, ll, yawDeg, true, eps);
          pushPoint(edge);
        }
      }
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/** Cierra una cadena visible a lo largo del limbo (nunca con cuerda a través del disco). */
export function appendLimbArc(ctx, from, to, cx, cy, radius) {
  const a0 = Math.atan2(from.y - cy, from.x - cx);
  const a1 = Math.atan2(to.y - cy, to.x - cx);
  let delta = a1 - a0;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const steps = Math.max(6, Math.ceil(Math.abs(delta) / 0.12));
  for (let i = 1; i <= steps; i += 1) {
    const a = a0 + (delta * i) / steps;
    ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
  }
}

/**
 * Extrae cadenas frontales de un ring ya libre de antimeridiano.
 * Cada punto: {x,y,z}. Cadenas listas para relleno con cierre en limbo.
 */
export function extractFrontLandChains(ring, yawDeg, cx, cy, radius, eps = FRONT_EPS) {
  const dense = densifyRing(ring, 3.5);
  if (dense.length < 2) return [];
  const chains = [];
  let current = [];

  const projectFront = (ll) => {
    const v = lonLatToVec3(ll[0], ll[1], yawDeg);
    if (v.z < eps) return null;
    return projectVec(v, cx, cy, radius, eps);
  };

  for (let i = 0; i < dense.length - 1; i += 1) {
    const from = dense[i];
    const to = dense[i + 1];
    const va = lonLatToVec3(from[0], from[1], yawDeg);
    const vb = lonLatToVec3(to[0], to[1], yawDeg);
    const fa = va.z >= eps;
    const fb = vb.z >= eps;

    if (fa && fb) {
      const pa = projectFront(from);
      const pb = projectFront(to);
      if (!pa || !pb) {
        if (current.length >= 2) chains.push(current);
        current = [];
        continue;
      }
      if (isSpuriousChord(pa, pb, radius, 1.05)) {
        if (current.length >= 2) chains.push(current);
        current = [];
        continue;
      }
      if (!current.length) current.push(pa);
      else if (
        Math.hypot(current[current.length - 1].x - pa.x, current[current.length - 1].y - pa.y) > 0.5
      ) {
        current.push(pa);
      }
      current.push(pb);
      continue;
    }

    if (!fa && !fb) {
      if (current.length >= 2) chains.push(current);
      current = [];
      continue;
    }

    const edgeLl = clipToHorizon(from, to, yawDeg, fa, eps);
    const ve = lonLatToVec3(edgeLl[0], edgeLl[1], yawDeg);
    const pe = projectVec({ ...ve, z: Math.max(ve.z, eps) }, cx, cy, radius, eps * 0.5);
    if (!pe) {
      if (current.length >= 2) chains.push(current);
      current = [];
      continue;
    }

    if (fa) {
      const pa = projectFront(from);
      if (pa) {
        if (!current.length) current.push(pa);
        current.push(pe);
      }
      if (current.length >= 2) chains.push(current);
      current = [];
    } else {
      if (current.length >= 2) chains.push(current);
      current = [pe];
      const pb = projectFront(to);
      if (pb) current.push(pb);
    }
  }

  if (current.length >= 2) chains.push(current);
  return chains;
}

/**
 * True si cerrar first→last con closePath sería una banda a través del disco.
 */
export function isDiskSpanningClosure(first, last, radius) {
  if (!first || !last) return true;
  return isSpuriousChord(first, last, radius, 0.95);
}

/**
 * Rellena tierra: MultiPolygon → split antimeridiano → cadenas frontales →
 * cierre por arco de limbo (nunca closePath a través del océano).
 */
export function drawLand(ctx, multiPolygon, yawDeg, cx, cy, radius) {
  if (!multiPolygon) return;
  const polys =
    multiPolygon.type === 'Polygon' ? [multiPolygon.coordinates] : multiPolygon.coordinates;

  ctx.fillStyle = ctx.fillStyle || 'rgba(88, 116, 140, 0.76)';
  polys.forEach((polygon) => {
    if (!polygon || !polygon[0]) return;
    const outer = polygon[0];
    const parts = splitRingAtAntimeridian(outer);
    parts.forEach((part) => {
      const chains = extractFrontLandChains(part, yawDeg, cx, cy, radius);
      chains.forEach((chain) => {
        if (chain.length < 2) return;
        const first = chain[0];
        const last = chain[chain.length - 1];
        const firstOnLimb = first.z < FRONT_EPS + 0.1;
        const lastOnLimb = last.z < FRONT_EPS + 0.1;
        const endsNear = Math.hypot(first.x - last.x, first.y - last.y) < radius * 0.04;

        /* No pintar rings rotos como disco completo */
        if (!endsNear && !firstOnLimb && !lastOnLimb && isDiskSpanningClosure(first, last, radius)) {
          return;
        }

        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < chain.length; i += 1) {
          ctx.lineTo(chain[i].x, chain[i].y);
        }
        if (firstOnLimb && lastOnLimb && !endsNear) {
          appendLimbArc(ctx, last, first, cx, cy, radius);
        } else if (!isDiskSpanningClosure(first, last, radius) || endsNear) {
          ctx.closePath();
        } else if (firstOnLimb || lastOnLimb) {
          /* Un extremo en limbo: cerrar por arco hacia el otro extremo proyectado en limbo */
          appendLimbArc(ctx, last, first, cx, cy, radius);
        } else {
          return;
        }
        ctx.fill();
      });
    });
  });
}

/**
 * Detecta segmentos proyectados que cruzan casi todo el disco (bandas invertidas).
 */
export function findSpuriousProjectedChords(multiPolygon, yawDeg, cx, cy, radius) {
  const bad = [];
  if (!multiPolygon) return bad;
  const polys =
    multiPolygon.type === 'Polygon' ? [multiPolygon.coordinates] : multiPolygon.coordinates;
  polys.forEach((polygon) => {
    const outer = polygon?.[0];
    if (!outer) return;
    splitRingAtAntimeridian(outer).forEach((part) => {
      const chains = extractFrontLandChains(part, yawDeg, cx, cy, radius);
      chains.forEach((chain) => {
        for (let i = 0; i < chain.length - 1; i += 1) {
          if (isSpuriousChord(chain[i], chain[i + 1], radius, 1.05)) {
            bad.push({ i, a: chain[i], b: chain[i + 1] });
          }
        }
        const first = chain[0];
        const last = chain[chain.length - 1];
        const firstOnLimb = first.z < FRONT_EPS + 0.1;
        const lastOnLimb = last.z < FRONT_EPS + 0.1;
        const endsNear = Math.hypot(first.x - last.x, first.y - last.y) < radius * 0.04;
        /* Solo es banda si drawLand cerraría con closePath a través del disco */
        if (
          chain.length >= 2 &&
          isDiskSpanningClosure(first, last, radius) &&
          !endsNear &&
          !firstOnLimb &&
          !lastOnLimb
        ) {
          bad.push({ type: 'closure', a: first, b: last });
        }
      });
    });
  });
  return bad;
}

/**
 * Contorno cyan de costas visibles: halo + línea principal + doble contorno selectivo.
 * No altera geometría ni proyección — solo stroke de cadenas frontales.
 */
export function strokeLandCoasts(ctx, multiPolygon, yawDeg, cx, cy, radius, theme, options = {}) {
  if (!multiPolygon || !theme) return;
  const compact = Boolean(options.compact);
  const tablet = Boolean(options.tablet);
  const vp = compact ? 'mobile' : tablet ? 'tablet' : 'desktop';
  const mainW = theme.width?.[vp] ?? 1.2;
  const haloW = theme.haloWidth?.[vp] ?? 2.8;
  const secW = theme.secondaryWidth?.[vp] ?? 0.8;
  const doubleW = theme.doubleWidth?.[vp] ?? 0;
  const ratio = theme.doubleContourRatio ?? 0.32;
  const minZ = theme.doubleMinZ ?? 0.42;
  const allowDouble = doubleW > 0 && !compact;

  const polys =
    multiPolygon.type === 'Polygon' ? [multiPolygon.coordinates] : multiPolygon.coordinates;

  let chainIndex = 0;
  const visit = (paint) => {
    polys.forEach((polygon) => {
      if (!polygon || !polygon[0]) return;
      splitRingAtAntimeridian(polygon[0]).forEach((part) => {
        extractFrontLandChains(part, yawDeg, cx, cy, radius).forEach((chain) => {
          if (chain.length < 2) return;
          paint(chain, chainIndex);
          chainIndex += 1;
        });
      });
    });
  };

  const strokeChain = (chain, color, width, alphaScale = 1) => {
    for (let i = 0; i < chain.length - 1; i += 1) {
      const a = chain[i];
      const b = chain[i + 1];
      const fade = Math.min(limbFade(a.z), limbFade(b.z));
      if (fade < 0.08) continue;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.globalAlpha = Math.max(0.2, fade * alphaScale);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  /* Halo exterior (profundidad) */
  chainIndex = 0;
  visit((chain) => {
    strokeChain(chain, theme.halo || 'rgba(36, 200, 255, 0.32)', haloW, compact ? 0.55 : 0.9);
  });

  /* Segunda línea cyan más oscura, levemente desplazada */
  chainIndex = 0;
  visit((chain) => {
    const offset = compact ? 0.7 : 1.05;
    const shifted = chain.map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return {
        x: p.x - (dx / len) * offset,
        y: p.y - (dy / len) * offset,
        z: p.z,
      };
    });
    strokeChain(shifted, theme.secondary || 'rgba(18, 120, 160, 0.55)', secW, 0.75);
  });

  /* Línea principal cyan brillante */
  chainIndex = 0;
  visit((chain) => {
    strokeChain(chain, theme.strokeRgba || theme.stroke || '#24D8FF', mainW, compact ? 0.88 : 1);
  });

  /* Doble contorno selectivo (~25–40% cadenas frontales con z alto) */
  if (allowDouble) {
    chainIndex = 0;
    visit((chain, idx) => {
      let zSum = 0;
      chain.forEach((p) => {
        zSum += p.z;
      });
      const avgZ = zSum / chain.length;
      if (avgZ < minZ) return;
      if ((idx * 17 + 3) % 100 >= Math.round(ratio * 100)) return;
      const offset = 1.35;
      const shifted = chain.map((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        return {
          x: p.x + (dx / len) * offset,
          y: p.y + (dy / len) * offset,
          z: p.z,
        };
      });
      strokeChain(shifted, theme.double || 'rgba(80, 210, 245, 0.28)', doubleW, 0.75);
    });
  }
}

/** @deprecated prefer drawLand; kept for stroke tests */
export function strokeOrFillRing(ctx, ring, yawDeg, cx, cy, radius, mode) {
  if (mode === 'fill') {
    const parts = splitRingAtAntimeridian(ring);
    parts.forEach((part) => {
      const chains = extractFrontLandChains(part, yawDeg, cx, cy, radius);
      chains.forEach((chain) => {
        if (chain.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(chain[0].x, chain[0].y);
        for (let i = 1; i < chain.length; i += 1) ctx.lineTo(chain[i].x, chain[i].y);
        appendLimbArc(ctx, chain[chain.length - 1], chain[0], cx, cy, radius);
        ctx.fill();
      });
    });
    return;
  }
  const parts = splitRingAtAntimeridian(ring);
  parts.forEach((part) => {
    const segs = projectFrontPolyline(part, yawDeg, cx, cy, radius);
    segs.forEach((seg) => {
      if (seg.length < 2) return;
      ctx.moveTo(seg[0].x, seg[0].y);
      for (let i = 1; i < seg.length; i += 1) ctx.lineTo(seg[i].x, seg[i].y);
    });
  });
}

export function projectLandPoint(v, cx, cy, radius, eps = FRONT_EPS) {
  if (v.z < eps) return null;
  return { x: cx + radius * v.x, y: cy - radius * v.y, front: true, z: v.z };
}

export function drawGraticule(ctx, yawDeg, cx, cy, radius, theme = null) {
  const gapChance = theme?.gapChance ?? 0;
  const shouldGap = (seed) => {
    if (!gapChance) return false;
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x) < gapChance;
  };

  const strokeSegs = (points, color, width, alphaScale = 1) => {
    for (let i = 0; i < points.length - 1; i += 1) {
      if (shouldGap(points[i][0] * 17 + points[i][1] * 31 + i)) continue;
      const segs = projectFrontPolyline(
        [points[i], points[i + 1]],
        yawDeg,
        cx,
        cy,
        radius,
      );
      segs.forEach((seg) => {
        if (seg.length < 2) return;
        const fade = Math.min(seg[0].fade ?? 1, seg[seg.length - 1].fade ?? 1);
        if (fade < 0.08) return;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = Math.max(0.35, fade) * alphaScale;
        ctx.moveTo(seg[0].x, seg[0].y);
        for (let j = 1; j < seg.length; j += 1) ctx.lineTo(seg[j].x, seg[j].y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }
  };

  const style = theme || {
    base: ctx.strokeStyle || 'rgba(148, 163, 184, 0.18)',
    baseWidth: ctx.lineWidth || 0.9,
    parallel: 'rgba(190, 210, 235, 0.26)',
    parallelWidth: 1.0,
    equator: 'rgba(230, 240, 255, 0.42)',
    equatorWidth: 1.3,
    meridian: 'rgba(210, 225, 245, 0.32)',
    meridianWidth: 1.1,
    highlightParallels: [-30, 30],
  };

  /* Base con cortes — no cuadrícula completa */
  for (let lat = -60; lat <= 60; lat += 30) {
    if (lat === 0) continue;
    if ((style.highlightParallels || []).includes(lat)) continue;
    for (let lon = -180; lon < 180; lon += 6) {
      if (shouldGap(lat * 13 + lon * 7)) continue;
      const segs = projectFrontPolyline(
        [
          [lon, lat],
          [lon + 6, lat],
        ],
        yawDeg,
        cx,
        cy,
        radius,
      );
      segs.forEach((seg) => {
        if (seg.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = style.base;
        ctx.lineWidth = style.baseWidth;
        ctx.globalAlpha = 0.85;
        ctx.moveTo(seg[0].x, seg[0].y);
        for (let i = 1; i < seg.length; i += 1) ctx.lineTo(seg[i].x, seg[i].y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }
  }
  for (let lon = -180; lon < 180; lon += 30) {
    if (lon === 0) continue;
    for (let lat = -80; lat < 80; lat += 6) {
      if (shouldGap(lon * 11 + lat * 19)) continue;
      const segs = projectFrontPolyline(
        [
          [lon, lat],
          [lon, lat + 6],
        ],
        yawDeg,
        cx,
        cy,
        radius,
      );
      segs.forEach((seg) => {
        if (seg.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = style.base;
        ctx.lineWidth = style.baseWidth;
        ctx.globalAlpha = 0.8;
        ctx.moveTo(seg[0].x, seg[0].y);
        for (let i = 1; i < seg.length; i += 1) ctx.lineTo(seg[i].x, seg[i].y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }
  }

  /* Anillos secundarios (±45, ±60) — tenue */
  (style.secondaryRings || []).forEach((lat) => {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 8) pts.push([lon, lat]);
    strokeSegs(pts, style.base, style.baseWidth * 0.9, 0.7);
  });

  /* Paralelos destacados (±30) */
  (style.highlightParallels || []).forEach((lat) => {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 6) pts.push([lon, lat]);
    strokeSegs(pts, style.parallel, style.parallelWidth, 1);
  });

  /* Meridiano central */
  {
    const pts = [];
    for (let lat = -80; lat <= 80; lat += 6) pts.push([0, lat]);
    strokeSegs(pts, style.meridian, style.meridianWidth, 1);
  }

  /* Ecuador */
  {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 6) pts.push([lon, 0]);
    strokeSegs(pts, style.equator, style.equatorWidth, 1);
  }
}

export function strokeGreatCircle(ctx, samples, yawDeg, cx, cy, radius, style) {
  const segments = projectFrontPolyline(samples, yawDeg, cx, cy, radius);
  const color = style.color || 'rgba(226, 236, 248, 1)';
  const baseAlpha = style.alpha == null ? 0.22 : style.alpha;
  const width = style.width || 1;
  segments.forEach((seg) => {
    if (seg.length < 2) return;
    for (let i = 0; i < seg.length - 1; i += 1) {
      const a = seg[i];
      const b = seg[i + 1];
      if (isSpuriousChord(a, b, radius, 1.1)) continue;
      const fade = Math.min(a.fade, b.fade);
      if (fade < 0.05) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = color;
      ctx.globalAlpha = baseAlpha * fade;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  });
}

export function isInsideGlobeDisk(x, y, cx, cy, radius) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius * 1.002;
}

/**
 * Proyección elevada. side: 'front' | 'back' | 'auto'
 * - auto/front (default): solo hemisferio frontal (etiquetas / arcos front).
 * - back: solo posterior (arcos atmosféricos, dibujados bajo el disco).
 */
export function projectElevated(
  lon,
  lat,
  yawDeg,
  cx,
  cy,
  radius,
  altitude = 0,
  options = {},
) {
  const { side = 'front', eps = FRONT_EPS } = options;
  const v = lonLatToVec3(lon, lat, yawDeg);
  const alt = Math.max(0, altitude);
  if (side === 'back') {
    if (v.z >= -eps) return null;
  } else if (v.z < eps) {
    return null;
  }
  const r = radius * (1 + alt);
  const fade =
    side === 'back'
      ? Math.min(1, 0.55 + alt * 1.4) * Math.min(1, Math.abs(v.z) / 0.3 + 0.3)
      : limbFade(Math.max(v.z, 0.02), 0.2);
  return {
    x: cx + r * v.x,
    y: cy - r * v.y,
    z: v.z,
    altitude: alt,
    fade,
    front: v.z >= eps,
    outside: Math.hypot(r * v.x, r * v.y) > radius * 0.98,
  };
}

export function elevatedArcSamples(a, b, peakAltitude, steps = 40) {
  const out = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const [lon, lat] = slerpLonLat(a, b, t);
    /* Piso de altura más alto → continuidad en limbo; pico en el centro */
    const altitude = peakAltitude * (0.22 + 0.78 * Math.sin(Math.PI * t));
    out.push({ lon, lat, t, altitude });
  }
  return out;
}

function strokeElevatedSide(ctx, samples, yawDeg, cx, cy, radius, style, side) {
  const color = style.color || 'rgba(226, 236, 248, 1)';
  const glow = style.glow || 'rgba(186, 214, 245, 0.3)';
  const baseAlpha = style.alpha == null ? 0.4 : style.alpha;
  const width = style.width || 1.3;
  let prev = null;
  samples.forEach((s) => {
    const p = projectElevated(s.lon, s.lat, yawDeg, cx, cy, radius, s.altitude, { side });
    if (!p || p.fade < 0.04) {
      prev = null;
      return;
    }
    if (prev) {
      const fade = Math.min(prev.fade, p.fade);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = glow;
      ctx.globalAlpha = baseAlpha * 0.5 * fade;
      ctx.lineWidth = width + (side === 'front' ? 2.6 : 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = color;
      ctx.globalAlpha = baseAlpha * fade;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    prev = p;
  });
}

/** Dibuja tramo posterior (llamar antes del disco opaco). */
export function strokeElevatedArcBack(ctx, samples, yawDeg, cx, cy, radius, style) {
  strokeElevatedSide(ctx, samples, yawDeg, cx, cy, radius, {
    ...style,
    alpha: (style.alpha == null ? 0.4 : style.alpha) * 0.38,
    width: (style.width || 1.3) * 0.9,
  }, 'back');
}

/** Dibuja tramo frontal (llamar después del planeta). */
export function strokeElevatedArcFront(ctx, samples, yawDeg, cx, cy, radius, style) {
  strokeElevatedSide(ctx, samples, yawDeg, cx, cy, radius, style, 'front');
}

/** Compat: dibuja solo frente. */
export function strokeElevatedArc(ctx, samples, yawDeg, cx, cy, radius, style) {
  strokeElevatedArcFront(ctx, samples, yawDeg, cx, cy, radius, style);
}

/**
 * Cuenta tramos atmosféricos visibles (front exterior + back exterior).
 * Un "span" es una secuencia contigua de muestras con presencia fuera/sobre el limbo.
 */
export function countVisibleAtmosphericFrontSpans(routes, yawDeg, cx, cy, radius) {
  let spans = 0;
  routes.forEach((route) => {
    let active = false;
    route.samples.forEach((s) => {
      const front = projectElevated(s.lon, s.lat, yawDeg, cx, cy, radius, s.altitude, {
        side: 'front',
      });
      const back = projectElevated(s.lon, s.lat, yawDeg, cx, cy, radius, s.altitude, {
        side: 'back',
      });
      const visible =
        (front && front.fade > 0.1 && (front.outside || front.z < 0.35)) ||
        (back && back.fade > 0.08 && back.outside);
      if (visible) {
        if (!active) {
          spans += 1;
          active = true;
        }
      } else {
        active = false;
      }
    });
  });
  return spans;
}

/** Sectores angulares (N, E, S, W) con al menos un tramo atmosférico exterior. */
export function atmosphericSectorPresence(routes, yawDeg, cx, cy, radius) {
  const sectors = { n: false, e: false, s: false, w: false };
  routes.forEach((route) => {
    route.samples.forEach((s) => {
      ['front', 'back'].forEach((side) => {
        const p = projectElevated(s.lon, s.lat, yawDeg, cx, cy, radius, s.altitude, { side });
        if (!p || p.fade < 0.1) return;
        if (side === 'back' && !p.outside) return;
        const ang = Math.atan2(p.y - cy, p.x - cx);
        if (ang > -Math.PI * 0.75 && ang <= -Math.PI * 0.25) sectors.n = true;
        else if (ang > -Math.PI * 0.25 && ang <= Math.PI * 0.25) sectors.e = true;
        else if (ang > Math.PI * 0.25 && ang <= Math.PI * 0.75) sectors.s = true;
        else sectors.w = true;
      });
    });
  });
  return sectors;
}

/** Muestrea puntos de tierra frontales en un yaw (tests de continentes). */
export function sampleLandPresence(probes, yawDeg) {
  const hits = {};
  probes.forEach((probe) => {
    const v = lonLatToVec3(probe.lon, probe.lat, yawDeg);
    hits[probe.id] = v.z >= FRONT_EPS;
  });
  return hits;
}
