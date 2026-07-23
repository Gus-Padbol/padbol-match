/**
 * Microtramas digitales sobre continentes (textura, no fronteras).
 * Deterministas y cacheables por viewport.
 */

import { GLOBE_INLAND_THEME } from './globeVisualTheme';
import { limbFade, lonLatToVec3, projectLonLat } from './globeProjection';

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const LAND_DECOR_ANCHORS = [
  { id: 'na', lon: -100, lat: 42, continent: 'north-america' },
  { id: 'na2', lon: -115, lat: 35, continent: 'north-america' },
  { id: 'sa', lon: -58, lat: -14, continent: 'south-america' },
  { id: 'sa2', lon: -70, lat: -30, continent: 'south-america' },
  { id: 'eu', lon: 12, lat: 50, continent: 'europe' },
  { id: 'af', lon: 18, lat: 6, continent: 'africa' },
  { id: 'af2', lon: 25, lat: -15, continent: 'africa' },
  { id: 'as', lon: 95, lat: 32, continent: 'asia' },
  { id: 'as2', lon: 110, lat: 22, continent: 'asia' },
  { id: 'au', lon: 134, lat: -24, continent: 'australia' },
];

/**
 * @returns {{ groups, details, dots, politicalBorders: false }}
 */
export function buildLandDecor({ compact = false, tablet = false } = {}) {
  const counts = compact
    ? GLOBE_INLAND_THEME.counts.mobile
    : tablet
      ? GLOBE_INLAND_THEME.counts.tablet
      : GLOBE_INLAND_THEME.counts.desktop;
  const rand = mulberry32(compact ? 90210 : tablet ? 71403 : 44117);
  const details = [];
  const dots = [];
  const groups = [];
  const anchors = LAND_DECOR_ANCHORS;
  const kinds = ['circuit', 'segment', 'dashes', 'matrix', 'squares'];

  for (let i = 0; i < counts.groups; i += 1) {
    const a = anchors[i % anchors.length];
    const kind = kinds[i % kinds.length];
    const lon0 = a.lon + (rand() - 0.5) * 16;
    const lat0 = a.lat + (rand() - 0.5) * 12;
    const span = 1.8 + rand() * 5.2;
    const bearing = rand() * Math.PI * 2;
    const dLon = Math.cos(bearing) * span;
    const dLat = Math.sin(bearing) * span * 0.65;
    const group = { id: `g-${i}`, continent: a.continent, kind, phase: rand() * Math.PI * 2 };

    if (kind === 'circuit') {
      const midLon = lon0 + dLon * 0.45;
      const midLat = lat0 + dLat * 0.45;
      const item = {
        id: `d-${i}`,
        type: 'circuit',
        continent: a.continent,
        phase: group.phase,
        points: [
          [lon0, lat0],
          [midLon, lat0],
          [midLon, midLat],
          [lon0 + dLon * 0.2, midLat],
        ],
      };
      details.push(item);
      group.items = [item];
    } else if (kind === 'dashes') {
      const pts = [];
      for (let s = 0; s < 4; s += 1) {
        const t0 = s / 4;
        const t1 = t0 + 0.14;
        pts.push({
          a: [lon0 + dLon * t0, lat0 + dLat * t0],
          b: [lon0 + dLon * t1, lat0 + dLat * t1],
        });
      }
      const item = { id: `d-${i}`, type: 'dashes', continent: a.continent, phase: group.phase, dashes: pts };
      details.push(item);
      group.items = [item];
    } else if (kind === 'matrix') {
      const cells = [];
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          if (rand() > 0.35) {
            cells.push({ lon: lon0 + c * 1.4, lat: lat0 + r * 1.2 });
          }
        }
      }
      const item = { id: `d-${i}`, type: 'matrix', continent: a.continent, phase: group.phase, cells };
      details.push(item);
      group.items = [item];
    } else if (kind === 'squares') {
      const sq = [];
      for (let s = 0; s < 3; s += 1) {
        sq.push({
          lon: lon0 + (rand() - 0.5) * 4,
          lat: lat0 + (rand() - 0.5) * 3,
          size: 0.8 + rand() * 1.2,
        });
      }
      const item = { id: `d-${i}`, type: 'squares', continent: a.continent, phase: group.phase, squares: sq };
      details.push(item);
      group.items = [item];
    } else {
      const item = {
        id: `d-${i}`,
        type: 'segment',
        continent: a.continent,
        phase: group.phase,
        a: [lon0, lat0],
        b: [lon0 + dLon, lat0 + dLat],
      };
      details.push(item);
      group.items = [item];
    }
    groups.push(group);
  }

  const dotsPerAnchor = Math.max(1, Math.floor(counts.dots / anchors.length));
  anchors.forEach((a, ai) => {
    const n = ai < counts.dots % anchors.length ? dotsPerAnchor + 1 : dotsPerAnchor;
    for (let j = 0; j < n; j += 1) {
      const col = j % 4;
      const row = Math.floor(j / 4);
      dots.push({
        id: `p-${a.id}-${j}`,
        continent: a.continent,
        lon: a.lon + (col - 1.5) * 2.1 + (rand() - 0.5) * 1.0,
        lat: a.lat + (row - 1.5) * 1.9 + (rand() - 0.5) * 0.9,
        phase: rand() * Math.PI * 2,
      });
    }
  });

  return {
    groups,
    details,
    dots,
    politicalBorders: false,
    counts,
  };
}

/** Dibuja microtramas; shimmer lento opcional (independiente de rotación). */
export function drawLandDecor(
  ctx,
  decor,
  yawDeg,
  cx,
  cy,
  radius,
  { compact = false, tablet = false, tSec = 0, reducedMotion = false } = {},
) {
  if (!decor) return;
  const lineW = compact ? 0.55 : tablet ? 0.65 : 0.8;
  const dotR = compact
    ? GLOBE_INLAND_THEME.dotRadius.mobile
    : tablet
      ? GLOBE_INLAND_THEME.dotRadius.tablet
      : GLOBE_INLAND_THEME.dotRadius.desktop;
  const period = GLOBE_INLAND_THEME.shimmerPeriodSec || 7.5;

  ctx.save();
  decor.details.forEach((d) => {
    const shimmer = reducedMotion
      ? 1
      : 0.72 + 0.28 * (0.5 + 0.5 * Math.sin((tSec * Math.PI * 2) / period + (d.phase || 0)));
    ctx.globalAlpha = shimmer;
    if (d.type === 'segment') {
      strokeGeoSeg(ctx, d.a, d.b, yawDeg, cx, cy, radius, GLOBE_INLAND_THEME.line, lineW);
    } else if (d.type === 'dashes') {
      d.dashes.forEach((seg) => {
        strokeGeoSeg(ctx, seg.a, seg.b, yawDeg, cx, cy, radius, GLOBE_INLAND_THEME.ice, lineW * 0.9);
      });
    } else if (d.type === 'circuit') {
      for (let i = 0; i < d.points.length - 1; i += 1) {
        strokeGeoSeg(
          ctx,
          d.points[i],
          d.points[i + 1],
          yawDeg,
          cx,
          cy,
          radius,
          GLOBE_INLAND_THEME.line,
          lineW,
        );
      }
    } else if (d.type === 'matrix') {
      d.cells.forEach((c) => {
        const pr = projectLonLat(c.lon, c.lat, yawDeg, cx, cy, radius);
        if (!pr || pr.z < 0.18) return;
        ctx.globalAlpha = 0.45 * shimmer * limbFade(pr.z);
        ctx.fillStyle = GLOBE_INLAND_THEME.dot;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 0.75, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (d.type === 'squares') {
      d.squares.forEach((sq) => {
        const pr = projectLonLat(sq.lon, sq.lat, yawDeg, cx, cy, radius);
        if (!pr || pr.z < 0.2) return;
        const s = sq.size;
        ctx.globalAlpha = 0.4 * shimmer * limbFade(pr.z);
        ctx.strokeStyle = GLOBE_INLAND_THEME.square;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(pr.x - s, pr.y - s);
        ctx.lineTo(pr.x + s, pr.y - s);
        ctx.lineTo(pr.x + s, pr.y + s);
        ctx.lineTo(pr.x - s, pr.y + s);
        ctx.closePath();
        ctx.stroke();
      });
    }
  });

  decor.dots.forEach((p) => {
    const v = lonLatToVec3(p.lon, p.lat, yawDeg);
    if (v.z < 0.18) return;
    const pr = projectLonLat(p.lon, p.lat, yawDeg, cx, cy, radius);
    if (!pr) return;
    const fade = limbFade(v.z);
    if (fade < 0.2) return;
    const tw = reducedMotion
      ? 0.55
      : 0.4 + 0.35 * (0.5 + 0.5 * Math.sin((tSec * Math.PI * 2) / period + (p.phase || 0)));
    ctx.globalAlpha = tw * fade;
    ctx.beginPath();
    ctx.fillStyle = GLOBE_INLAND_THEME.dot;
    ctx.arc(pr.x, pr.y, dotR, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function strokeGeoSeg(ctx, a, b, yawDeg, cx, cy, radius, color, width) {
  const pa = projectLonLat(a[0], a[1], yawDeg, cx, cy, radius);
  const pb = projectLonLat(b[0], b[1], yawDeg, cx, cy, radius);
  if (!pa || !pb) return;
  const fade = Math.min(limbFade(pa.z), limbFade(pb.z));
  if (fade < 0.18) return;
  const prev = ctx.globalAlpha;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = Math.max(0.2, fade * 0.9) * prev;
  ctx.lineCap = 'round';
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
  ctx.globalAlpha = prev;
}
