import React, { useMemo } from 'react';
import {
  GLOBE_PACKET_ROUTES,
  altitudeAt,
  packetProgress,
} from './globeAtomRoutes';
import {
  GLOBE_LABEL_CATALOG,
  GLOBE_LONG_LABEL_KEYS,
  GLOBE_MOBILE_PRIORITY_LABELS,
  GLOBE_PACKET_MAX,
  GLOBE_PACKET_MIN,
  GLOBE_SPORT_LABELS,
  GLOBE_STATIC_LABELS,
  labelCategory,
} from './globeLabelCatalog';
import { greatCircleSamples, limbFade, projectElevated, slerpLonLat } from './globeProjection';

const MIN_DIST = {
  desktop: 52,
  tablet: 48,
  mobile: 44,
};

function zoneKey(x, y, cell) {
  return `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
}

function collides(candidate, placed, minDist) {
  return placed.some((p) => {
    const dx = p.x - candidate.x;
    const dy = p.y - candidate.y;
    return dx * dx + dy * dy < minDist * minDist;
  });
}

function samplePacketPosition(route, t, yawDeg, cx, cy, radius) {
  const [lon, lat] = slerpLonLat(
    [route.lonA, route.latA],
    [route.lonB, route.latB],
    t,
  );
  const altitude = altitudeAt(t, route.peakAltitude || 0);
  return projectElevated(lon, lat, yawDeg, cx, cy, radius, altitude);
}

function viewportLimits(compact, tablet) {
  if (compact) {
    return {
      min: GLOBE_PACKET_MIN.mobile,
      max: GLOBE_PACKET_MAX.mobile,
      minDist: MIN_DIST.mobile,
      staticKeys: GLOBE_STATIC_LABELS.mobile,
    };
  }
  if (tablet) {
    return {
      min: GLOBE_PACKET_MIN.tablet,
      max: GLOBE_PACKET_MAX.tablet,
      minDist: MIN_DIST.tablet,
      staticKeys: GLOBE_STATIC_LABELS.tablet,
    };
  }
  return {
    min: GLOBE_PACKET_MIN.desktop,
    max: GLOBE_PACKET_MAX.desktop,
    minDist: MIN_DIST.desktop,
    staticKeys: GLOBE_STATIC_LABELS.desktop,
  };
}

function toLabelItem(c) {
  return {
    key: c.key,
    routeId: c.routeId,
    x: c.x,
    y: c.y,
    z: c.z,
    opacity: c.opacity,
    scale: c.scale,
    mode: c.mode,
    altitude: c.altitude,
    durationMs: c.durationMs,
    crossesCenter: c.crossesCenter,
    category: c.category,
    long: GLOBE_LONG_LABEL_KEYS.includes(c.key),
  };
}

function selectWithAntiCollision(candidates, { max, minDist, relax = 1 }) {
  const placed = [];
  const usedKeys = new Set();
  const usedCategories = {};
  const selected = [];
  const zones = new Set();
  const dist = minDist * relax;

  candidates.forEach((c) => {
    if (selected.length >= max) return;
    if (usedKeys.has(c.key)) return;
    if (collides(c, placed, dist)) return;
    const zk = zoneKey(c.x, c.y, dist * 0.85);
    if (zones.has(zk)) return;
    /* Evitar monopolio de una sola categoría cuando hay opciones */
    const cat = c.category || labelCategory(c.key);
    if (cat && (usedCategories[cat] || 0) >= 3 && selected.length < max - 1) {
      const hasOther = candidates.some(
        (o) =>
          !usedKeys.has(o.key) &&
          (o.category || labelCategory(o.key)) !== cat &&
          !collides(o, placed, dist),
      );
      if (hasOther && (usedCategories[cat] || 0) >= 3) return;
    }
    zones.add(zk);
    placed.push(c);
    usedKeys.add(c.key);
    if (cat) usedCategories[cat] = (usedCategories[cat] || 0) + 1;
    selected.push(c);
  });

  return selected;
}

/**
 * Scheduler de paquetes: rutas ancladas, anti-colisión, mínimo visible,
 * igualdad entre deportes y balance por categoría.
 */
export function schedulePacketLabels({
  elapsedMs,
  yawDeg,
  cx,
  cy,
  radius,
  compact,
  tablet,
  reducedMotion,
  layoutW,
}) {
  const { min, max, minDist, staticKeys } = viewportLimits(compact, tablet);
  const leftSafe = compact ? 0 : layoutW * 0.02;

  if (reducedMotion) {
    const keys = staticKeys.slice(0, max);
    const placed = [];
    const out = [];
    const tryTs = [0.12, 0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76, 0.84, 0.16, 0.88];
    const reducedMin = minDist * 0.55;
    keys.forEach((key) => {
      const routes = GLOBE_PACKET_ROUTES.filter((r) => r.labelKey === key);
      let chosen = null;
      routes.some((route) =>
        tryTs.some((t) => {
          const p = samplePacketPosition(route, t, yawDeg, cx, cy, radius);
          if (!p || p.z < 0.08) return false;
          if (p.x < leftSafe) return false;
          if (collides(p, placed, reducedMin)) return false;
          chosen = { route, p, t };
          return true;
        }),
      );
      if (!chosen && GLOBE_SPORT_LABELS.includes(key) && routes[0]) {
        const idx = GLOBE_SPORT_LABELS.indexOf(key);
        const ang = (idx / GLOBE_SPORT_LABELS.length) * Math.PI * 2 - Math.PI / 2;
        const rr = radius * 0.38;
        const p = {
          x: cx + Math.cos(ang) * rr,
          y: cy + Math.sin(ang) * rr,
          z: 0.75,
          altitude: 0.04,
        };
        if (p.x >= leftSafe && !collides(p, placed, reducedMin * 0.85)) {
          chosen = { route: routes[0], p, t: 0.5 };
        }
      }
      if (!chosen) return;
      placed.push(chosen.p);
      out.push(
        toLabelItem({
          key,
          routeId: chosen.route.id,
          x: chosen.p.x,
          y: chosen.p.y,
          z: chosen.p.z,
          opacity: Math.max(0.62, limbFade(chosen.p.z)),
          scale: 0.92 + limbFade(chosen.p.z) * 0.08,
          mode: chosen.route.route === 'atmospheric' ? 'atmospheric' : 'interior',
          altitude: chosen.p.altitude,
          durationMs: chosen.route.durationMs,
          crossesCenter: Boolean(chosen.route.crossesCenter),
          category: chosen.route.category || labelCategory(key),
        }),
      );
    });
    return out;
  }

  const pool = compact
    ? GLOBE_PACKET_ROUTES.filter((r) => GLOBE_MOBILE_PRIORITY_LABELS.includes(r.labelKey))
    : GLOBE_PACKET_ROUTES;

  const buildCandidates = (opacityFloor) => {
    const candidates = [];
    pool.forEach((route) => {
      const prog = packetProgress(elapsedMs, route);
      if (!prog) return;
      const p = samplePacketPosition(route, prog.t, yawDeg, cx, cy, radius);
      if (!p) return;
      if (p.z < 0.06) return;
      if (p.x < leftSafe - 8) return;
      const depth = limbFade(p.z, 0.18);
      const opacity = prog.edge * depth;
      if (opacity < opacityFloor) return;
      const category = route.category || labelCategory(route.labelKey);
      candidates.push({
        key: route.labelKey,
        routeId: route.id,
        x: p.x,
        y: p.y,
        z: p.z,
        opacity,
        scale: 0.86 + depth * 0.14,
        mode: route.route === 'atmospheric' ? 'atmospheric' : 'interior',
        altitude: p.altitude,
        priority:
          (route.priority || 1) +
          (route.crossesCenter ? 0.25 : 0) +
          (GLOBE_SPORT_LABELS.includes(route.labelKey) ? 0.4 : 0),
        durationMs: route.durationMs,
        peakAltitude: route.peakAltitude,
        crossesCenter: Boolean(route.crossesCenter),
        category,
      });
    });
    candidates.sort((a, b) => b.priority - a.priority || b.z - a.z);
    return candidates;
  };

  let selected = selectWithAntiCollision(buildCandidates(0.14), { max, minDist, relax: 1 });

  /* Relleno: si hay menos del mínimo, relajar distancia/opacidad (no superponer fuerte). */
  if (selected.length < min) {
    selected = selectWithAntiCollision(buildCandidates(0.08), {
      max,
      minDist,
      relax: 0.78,
    });
  }
  if (selected.length < min) {
    selected = selectWithAntiCollision(buildCandidates(0.05), {
      max,
      minDist,
      relax: 0.62,
    });
  }

  /* Garantizar al menos un deporte visible, rotando cuál para equilibrar frecuencia. */
  const sportCandidates = buildCandidates(0.1).filter((c) => GLOBE_SPORT_LABELS.includes(c.key));
  if (sportCandidates.length) {
    const preferred =
      GLOBE_SPORT_LABELS[Math.floor(elapsedMs / 7000) % GLOBE_SPORT_LABELS.length];
    sportCandidates.sort((a, b) => {
      const ap = a.key === preferred ? 1 : 0;
      const bp = b.key === preferred ? 1 : 0;
      return bp - ap || b.priority - a.priority;
    });
    const hasSport = selected.some((s) => GLOBE_SPORT_LABELS.includes(s.key));
    const hasPreferred = selected.some((s) => s.key === preferred);
    if (!hasSport || (!hasPreferred && sportCandidates.some((c) => c.key === preferred))) {
      const placed = selected
        .filter((s) => !(GLOBE_SPORT_LABELS.includes(s.key) && !hasPreferred && s.key !== preferred))
        .map((s) => ({ x: s.x, y: s.y }));
      const inject =
        sportCandidates.find((c) => c.key === preferred && !collides(c, placed, minDist * 0.75)) ||
        sportCandidates.find((c) => !collides(c, placed, minDist * 0.75));
      if (inject && !selected.some((s) => s.key === inject.key)) {
        const withoutExtraSport = selected.filter((s) => !GLOBE_SPORT_LABELS.includes(s.key) || s.key === inject.key);
        let next = withoutExtraSport;
        if (next.length >= max) next = next.slice(0, max - 1);
        next.push(inject);
        selected = next;
      } else if (inject && !hasSport) {
        if (selected.length >= max) selected.pop();
        selected.push(inject);
      }
    }
  }

  return selected.map(toLabelItem);
}

/**
 * Etiquetas como paquetes de datos sobre trayectorias (red tipo átomo).
 * Punto rojo uniforme + tipografía unificada. Sin emphasize.
 */
export default function GlobeLabels({
  text,
  yawDeg,
  cx,
  cy,
  radius,
  compact,
  tablet,
  reducedMotion,
  elapsedMs = 0,
  layoutW = 560,
}) {
  const items = useMemo(
    () =>
      schedulePacketLabels({
        elapsedMs,
        yawDeg,
        cx,
        cy,
        radius,
        compact,
        tablet,
        reducedMotion,
        layoutW,
      }),
    [elapsedMs, yawDeg, cx, cy, radius, compact, tablet, reducedMotion, layoutW],
  );

  const limits = viewportLimits(compact, tablet);

  return (
    <ul
      className={`ps-globe-labels${compact ? ' is-compact' : ''}${tablet ? ' is-tablet' : ''}`}
      aria-hidden="true"
      data-label-count={items.length}
      data-label-min={limits.min}
      data-label-max={limits.max}
      data-label-system="atom-packets"
      data-sports-equal="true"
    >
      {items.map((item) => (
        <li
          key={`${item.routeId}-${item.key}`}
          className={[
            'ps-globe-label',
            `is-${item.mode}`,
            item.long ? 'is-long' : '',
            reducedMotion ? 'is-static' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-route={item.routeId}
          data-label-key={item.key}
          data-category={item.category || GLOBE_LABEL_CATALOG[item.key]?.category || ''}
          data-altitude={Number(item.altitude || 0).toFixed(3)}
          data-duration={item.durationMs}
          data-crosses-center={item.crossesCenter ? 'true' : 'false'}
          style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            opacity: item.opacity,
            transform: `translate(-50%, -50%) scale(${item.scale})`,
          }}
        >
          <span className="ps-globe-label__dot" />
          <span className="ps-globe-label__text">{text(`publicSite.hero.globe.labels.${item.key}`)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Utilidad de test: confirma anclaje a ruta (sin órbita angular). */
export function packetHasRouteAnchor(routeId) {
  return GLOBE_PACKET_ROUTES.some((r) => r.id === routeId);
}

export function buildRoutePreviewSamples(route, steps = 20) {
  return greatCircleSamples([route.lonA, route.latA], [route.lonB, route.latB], steps);
}
