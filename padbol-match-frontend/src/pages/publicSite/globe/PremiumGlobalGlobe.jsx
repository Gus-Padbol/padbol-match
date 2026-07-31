import React, { useEffect, useMemo, useRef, useState } from 'react';
import landData from './land110m.geo.json';
import {
  GLOBE_CONTINENT_REGIONS,
  GLOBE_LINKS,
  GLOBE_NODES,
  GLOBE_ROTATION_MS,
  selectLinksForViewport,
  selectNodesForViewport,
  selectPulsesForViewport,
} from './globeNetworkData';
import {
  ATM_COLORS,
  GLOBE_ATMOSPHERIC_ROUTES,
  GLOBE_ATM_COUNTS,
  GLOBE_PACKET_MAX,
  GLOBE_PACKET_MIN,
} from './globeAtomRoutes';
import {
  drawGraticule,
  drawLand,
  elevatedArcSamples,
  greatCircleSamples,
  isInsideGlobeDisk,
  limbFade,
  lonLatToVec3,
  projectLonLat,
  projectVec,
  strokeElevatedArcBack,
  strokeElevatedArcFront,
  strokeGreatCircle,
  strokeLandCoasts,
} from './globeProjection';
import {
  GLOBE_COAST_THEME,
  GLOBE_GRID_THEME,
  GLOBE_LAND_THEME,
  GLOBE_LIMB_THEME,
  GLOBE_LINK_THEME,
  GLOBE_LINK_WIDTHS,
  GLOBE_NODE_THEME,
  GLOBE_OCEAN_THEME,
  GLOBE_PULSE_THEME,
} from './globeVisualTheme';
import { buildLandDecor, drawLandDecor } from './globeLandDecor';
import { buildAtmosphereFx, drawAtmosphereFxBack, drawAtmosphereFxFront } from './globeAtmosphereFx';
import GlobeLabels from './GlobeLabels';

export { GLOBE_CONTINENT_REGIONS, GLOBE_ROTATION_MS };

const LAND_GEOM = landData.features[0].geometry;
const PACIFIC_TRANSIT_MAX = 1.45;
/* En teléfono el globo ocupa menos píxeles: una vuelta más rápida hace que
   el movimiento se perciba sin sumar capas ni carga de render. */
const MOBILE_GLOBE_ROTATION_MS = 18000;

function smoothstep(from, to, value) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * Acorta suavemente el tramo de océano abierto sin cambiar de posición
 * ni introducir saltos en la rotación.
 */
export function rotationSpeedMultiplier(yawDeg) {
  const yaw = ((yawDeg % 360) + 360) % 360;
  const enteringPacific = smoothstep(125, 158, yaw);
  const leavingPacific = 1 - smoothstep(232, 265, yaw);
  return 1 + (PACIFIC_TRANSIT_MAX - 1) * enteringPacific * leavingPacific;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(Boolean(mq.matches));
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

function useViewportMode(rootRef) {
  const [mode, setMode] = useState({ compact: false, tablet: false });
  useEffect(() => {
    const apply = (w) => {
      setMode({
        compact: w < 520,
        tablet: w >= 520 && w < 900,
      });
    };
    if (typeof ResizeObserver === 'undefined') {
      apply(window.innerWidth);
      return undefined;
    }
    const el = rootRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      apply(entries[0]?.contentRect?.width || 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rootRef]);
  return mode;
}

/**
 * Globo global premium (Canvas 2D + proyección ortográfica).
 * Iluminación estable; red tipo átomo; etiquetas como paquetes en rutas.
 */
export default function PremiumGlobalGlobe({ text }) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const { compact, tablet } = useViewportMode(rootRef);
  const [layout, setLayout] = useState({ w: 560, h: 560, cx: 280, cy: 280, radius: 210 });
  const [yawDeg, setYawDeg] = useState(-18);
  const [elapsedMs, setElapsedMs] = useState(0);
  const yawRef = useRef(-18);
  const rotationElapsedRef = useRef(0);
  const lastRotationFrameRef = useRef(null);
  const hoverRef = useRef(false);
  const visibleRef = useRef(true);
  const labelTickRef = useRef(0);

  const debugYaw = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('globeYaw');
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, []);

  const visibleNodes = useMemo(
    () => selectNodesForViewport(compact, tablet),
    [compact, tablet],
  );
  const visibleLinks = useMemo(
    () => selectLinksForViewport(visibleNodes, compact, tablet),
    [visibleNodes, compact, tablet],
  );

  const linkSamples = useMemo(
    () =>
      visibleLinks.map((link) => {
        const a = GLOBE_NODES[link.a];
        const b = GLOBE_NODES[link.b];
        const steps = compact ? 14 : link.pacific || link.weight === 'primary' ? 30 : 22;
        return {
          samples: greatCircleSamples([a.lon, a.lat], [b.lon, b.lat], steps),
          weight: link.weight,
          kind: link.kind,
          pacific: link.pacific,
          from: link.from,
          to: link.to,
          index: GLOBE_LINKS.indexOf(link) >= 0 ? GLOBE_LINKS.indexOf(link) : link.a,
        };
      }),
    [visibleLinks, compact],
  );

  const visiblePulses = useMemo(
    () => selectPulsesForViewport(visibleLinks, compact, tablet),
    [visibleLinks, compact, tablet],
  );

  const atmosphericSamples = useMemo(() => {
    const limit = compact
      ? GLOBE_ATM_COUNTS.mobile
      : tablet
        ? GLOBE_ATM_COUNTS.tablet
        : GLOBE_ATM_COUNTS.desktop;
    /* Round-robin por sector para envolvente en los 4 cuadrantes */
    const bySector = new Map();
    GLOBE_ATMOSPHERIC_ROUTES.forEach((r) => {
      const s = r.sector || 'misc';
      if (!bySector.has(s)) bySector.set(s, []);
      bySector.get(s).push(r);
    });
    const buckets = [...bySector.values()];
    const picked = [];
    let guard = 0;
    while (picked.length < limit && guard < GLOBE_ATMOSPHERIC_ROUTES.length * 2) {
      buckets.forEach((list) => {
        if (picked.length >= limit) return;
        const next = list.shift();
        if (next) picked.push(next);
      });
      guard += 1;
    }
    return picked.map((route) => ({
      ...route,
      samples: elevatedArcSamples(
        [route.lonA, route.latA],
        [route.lonB, route.latB],
        route.peakAltitude,
        compact ? 20 : 36,
      ),
    }));
  }, [compact, tablet]);

  /* Textura inland cacheada por viewport (no se regenera por frame). */
  const landDecor = useMemo(
    () => buildLandDecor({ compact, tablet }),
    [compact, tablet],
  );

  /* Atmósfera digital: puntos, líneas de datos, órbitas (cache). */
  const atmosphereFx = useMemo(
    () => buildAtmosphereFx({ compact, tablet }),
    [compact, tablet],
  );


  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(280, Math.floor(rect.height || w));
      const size = Math.min(w, h);
      const radius = size * (compact ? 0.38 : 0.42);
      setLayout({
        w,
        h,
        cx: w / 2,
        cy: h / 2,
        radius,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [compact]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = Boolean(entry?.isIntersecting);
      },
      { threshold: 0.12 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let raf = 0;
    const start = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxLinks = linkSamples.length;

    const paint = (now) => {
      const { w, h, cx, cy, radius } = layout;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      let yaw = debugYaw == null ? -18 : debugYaw;
      if (!reducedMotion && debugYaw == null) {
        const previousFrame = lastRotationFrameRef.current ?? now;
        const frameDelta = Math.min(Math.max(0, now - previousFrame), 80);
        lastRotationFrameRef.current = now;
        const rotationMs = compact ? MOBILE_GLOBE_ROTATION_MS : GLOBE_ROTATION_MS;
        const currentYaw = -18 + (rotationElapsedRef.current / rotationMs) * 360;
        const interactionSpeed = hoverRef.current ? 0.55 : 1;
        rotationElapsedRef.current +=
          frameDelta * interactionSpeed * rotationSpeedMultiplier(currentYaw);
        yaw = -18 + (rotationElapsedRef.current / rotationMs) * 360;
        yawRef.current = yaw;
        labelTickRef.current += 1;
        if (labelTickRef.current % 3 === 0) {
          setYawDeg(((yaw % 360) + 360) % 360);
          setElapsedMs(rotationElapsedRef.current);
        }
      } else {
        yawRef.current = yaw;
      }

      if (!visibleRef.current && debugYaw == null) {
        return;
      }

      /* Atmósfera exterior constante (no barre el disco). */
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.92, cx, cy, radius * 1.32);
      glow.addColorStop(0, 'rgba(36, 180, 230, 0.08)');
      glow.addColorStop(0.45, 'rgba(20, 80, 120, 0.06)');
      glow.addColorStop(0.7, 'rgba(225, 27, 34, 0.03)');
      glow.addColorStop(1, 'rgba(5, 7, 13, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.32, 0, Math.PI * 2);
      ctx.fill();

      const tSec = (now - start) / 1000;

      const linkW = compact
        ? GLOBE_LINK_WIDTHS.mobile
        : tablet
          ? GLOBE_LINK_WIDTHS.tablet
          : GLOBE_LINK_WIDTHS.desktop;

      /* Nube / órbitas posteriores (fuera del dorso) */
      drawAtmosphereFxBack(ctx, atmosphereFx, yaw, cx, cy, radius, tSec, reducedMotion);

      /*
       * Tramos posteriores de la red atmosférica (bajo el disco):
       * solo se percibe el abultamiento exterior → continuidad alrededor.
       */
      atmosphericSamples.forEach((route) => {
        const palette = ATM_COLORS[route.color] || ATM_COLORS.ice;
        strokeElevatedArcBack(ctx, route.samples, yaw, cx, cy, radius, {
          color: palette.stroke,
          glow: palette.glow,
          alpha: reducedMotion ? palette.alpha * 0.55 : palette.alpha * 0.85,
          width: route.weight === 'primary' ? linkW.atmBackPrimary : linkW.atmBack,
        });
      });

      /* Océano noche + glow frontal */
      const ocean = ctx.createRadialGradient(
        cx - radius * 0.18,
        cy - radius * 0.22,
        radius * 0.08,
        cx,
        cy,
        radius,
      );
      GLOBE_OCEAN_THEME.stops.forEach((stop) => {
        ocean.addColorStop(stop.t, stop.color);
      });
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = ocean;
      ctx.fill();
      const frontGlow = ctx.createRadialGradient(
        cx - radius * 0.08,
        cy - radius * 0.1,
        radius * 0.05,
        cx,
        cy,
        radius * 0.72,
      );
      frontGlow.addColorStop(0, GLOBE_OCEAN_THEME.frontGlow || 'rgba(40, 130, 170, 0.16)');
      frontGlow.addColorStop(1, 'rgba(5, 12, 22, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = frontGlow;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      /* Continentes oscuros azul petróleo */
      ctx.fillStyle = GLOBE_LAND_THEME.fill;
      drawLand(ctx, LAND_GEOM, yaw, cx, cy, radius);

      /* Terminador: lit → side → limb (oscuro) */
      const shade = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
      shade.addColorStop(0, 'rgba(8, 26, 39, 0.48)');
      shade.addColorStop(0.28, 'rgba(16, 42, 59, 0.32)');
      shade.addColorStop(0.48, 'rgba(36, 90, 115, 0.16)');
      shade.addColorStop(0.62, 'rgba(4, 12, 20, 0.04)');
      shade.addColorStop(0.82, 'rgba(16, 42, 59, 0.28)');
      shade.addColorStop(1, 'rgba(8, 26, 39, 0.46)');
      ctx.fillStyle = shade;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      /* Microtramas (shimmer independiente) */
      drawLandDecor(ctx, landDecor, yaw, cx, cy, radius, {
        compact,
        tablet,
        tSec,
        reducedMotion,
      });


      /* Grilla tecnológica reforzada */
      drawGraticule(ctx, yaw, cx, cy, radius, GLOBE_GRID_THEME);

      /* Costas cyan prioritarias */
      strokeLandCoasts(ctx, LAND_GEOM, yaw, cx, cy, radius, GLOBE_COAST_THEME, {
        compact,
        tablet,
      });

      /* Conexiones delicadas: locales muy finas → intl apenas más visibles */
      for (let i = 0; i < maxLinks; i += 1) {
        const entry = linkSamples[i];
        if (!entry) continue;
        const local = entry.kind === 'local';
        const regional = entry.kind === 'regional';
        const intl = entry.kind === 'international';
        const primary = entry.weight === 'primary';
        let color = GLOBE_LINK_THEME.ice;
        let alpha = local ? 0.52 : regional ? 0.44 : 0.34;
        let width = local
          ? linkW.local
          : regional
            ? linkW.regional
            : linkW.international;
        if (i % 3 === 1) color = GLOBE_LINK_THEME.cyan;
        else if (i % 4 === 2 || (regional && !primary)) color = GLOBE_LINK_THEME.silver;
        if (primary && intl && i % 14 === 0) {
          color = GLOBE_LINK_THEME.red;
          alpha = 0.34;
          width = Math.min(1.15, linkW.international + 0.12);
        } else if (primary && regional) {
          color = GLOBE_LINK_THEME.ice;
          alpha = 0.48;
        }
        strokeGreatCircle(ctx, entry.samples, yaw, cx, cy, radius, {
          color: GLOBE_LINK_THEME.understroke,
          alpha: reducedMotion ? 0.16 : primary ? 0.2 : local ? 0.14 : 0.12,
          width: width + (primary ? linkW.understrokeExtra : linkW.understrokeExtra * 0.65),
        });
        strokeGreatCircle(ctx, entry.samples, yaw, cx, cy, radius, {
          color,
          alpha: reducedMotion ? alpha * 0.88 : alpha,
          width,
        });
      }

      /* Pulsos — rojo Padbol Match en movimiento */
      if (!reducedMotion) {
        const sampleByPair = new Map(
          linkSamples.map((s) => [`${s.from}|${s.to}`, s]),
        );
        visiblePulses.forEach((pulse) => {
          const full = GLOBE_LINKS[pulse.link];
          if (!full) return;
          const entry =
            sampleByPair.get(`${full.from}|${full.to}`) ||
            sampleByPair.get(`${full.to}|${full.from}`);
          if (!entry) return;
          const samples = entry.samples;
          const t = ((now / 1000) * pulse.speed + pulse.delay) % 1;
          const idx = Math.min(samples.length - 1, Math.floor(t * (samples.length - 1)));
          const ll = samples[idx];
          const p = projectLonLat(ll[0], ll[1], yaw, cx, cy, radius);
          if (!p || !isInsideGlobeDisk(p.x, p.y, cx, cy, radius)) return;
          const fade = limbFade(p.z);
          if (fade < 0.12) return;
          const color = GLOBE_PULSE_THEME.red;
          ctx.globalAlpha = 0.95 * fade;
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.24 * fade;
          ctx.beginPath();
          ctx.fillStyle = GLOBE_PULSE_THEME.glow;
          ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      }

      /* Nodos blanco hielo + borde cyan tenue */
      const breath = reducedMotion
        ? 0.7
        : 0.55 + 0.2 * (0.5 + 0.5 * Math.sin((now / 1000) * ((2 * Math.PI) / 6.2)));
      visibleNodes.forEach((node) => {
        const v = lonLatToVec3(node.lon, node.lat, yaw);
        const p = projectVec(v, cx, cy, radius);
        if (!p || !isInsideGlobeDisk(p.x, p.y, cx, cy, radius)) return;
        const fade = limbFade(p.z);
        if (fade < 0.08) return;

        const major = Boolean(node.major);
        const core = compact ? (major ? 3.6 : 3.4) : major ? 4.6 : 4.0;
        const halo = compact ? (major ? 7.2 : 6.5) : major ? 11 : 9.5;

        ctx.globalAlpha = 0.35 * fade * breath;
        ctx.beginPath();
        ctx.fillStyle = GLOBE_NODE_THEME.halo;
        ctx.arc(p.x, p.y, halo, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = Math.min(1, 0.98 * fade);
        ctx.beginPath();
        ctx.strokeStyle = GLOBE_NODE_THEME.rim;
        ctx.lineWidth = compact ? 1.2 : 1.45;
        ctx.fillStyle = GLOBE_NODE_THEME.core;
        ctx.arc(p.x, p.y, core, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.globalAlpha = 0.9 * fade;
        ctx.beginPath();
        ctx.fillStyle = GLOBE_NODE_THEME.coreHot;
        ctx.arc(p.x, p.y, core * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      ctx.restore();

      /* Atmósfera digital frontal (líneas de datos + nube) */
      drawAtmosphereFxFront(ctx, atmosphereFx, yaw, cx, cy, radius, tSec, reducedMotion);

      /* Arcos atmosféricos frontales */
      atmosphericSamples.forEach((route) => {
        const palette = ATM_COLORS[route.color] || ATM_COLORS.ice;
        strokeElevatedArcFront(ctx, route.samples, yaw, cx, cy, radius, {
          color: palette.stroke,
          glow: palette.glow,
          alpha: reducedMotion ? palette.alpha * 0.7 : palette.alpha * 0.9,
          width: route.weight === 'primary' ? linkW.atmFrontPrimary : linkW.atmFront,
        });
      });

      /* Limbo cyan */
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = GLOBE_LIMB_THEME.rim;
      ctx.lineWidth = GLOBE_LIMB_THEME.rimWidth;
      ctx.stroke();
      const rim = ctx.createRadialGradient(cx, cy, radius * 0.94, cx, cy, radius * 1.06);
      rim.addColorStop(0, GLOBE_LIMB_THEME.glowInner);
      rim.addColorStop(1, GLOBE_LIMB_THEME.glowOuter);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.02, 0, Math.PI * 2);
      ctx.strokeStyle = rim;
      ctx.lineWidth = GLOBE_LIMB_THEME.glowWidth;
      ctx.stroke();
    };

    const tick = (now) => {
      if (visibleRef.current || debugYaw != null) paint(now);
      if (!reducedMotion && debugYaw == null) raf = requestAnimationFrame(tick);
    };

    if (reducedMotion || debugYaw != null) {
      paint(performance.now());
      if (debugYaw != null) {
        setYawDeg(((debugYaw % 360) + 360) % 360);
        /* Segundo paint tras layout estable (capturas headless). */
        requestAnimationFrame(() => paint(performance.now()));
      }
      return undefined;
    }
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [layout, linkSamples, atmosphericSamples, visibleNodes, visiblePulses, landDecor, atmosphereFx, reducedMotion, compact, tablet, debugYaw]);

  const maxVisible = compact
    ? GLOBE_PACKET_MAX.mobile
    : tablet
      ? GLOBE_PACKET_MAX.tablet
      : GLOBE_PACKET_MAX.desktop;

  return (
    <div
      ref={rootRef}
      className="ps-globe"
      role="img"
      aria-label={text('publicSite.hero.globe.aria')}
      data-continents={GLOBE_CONTINENT_REGIONS.join(',')}
      data-rotation-ms={compact ? MOBILE_GLOBE_ROTATION_MS : GLOBE_ROTATION_MS}
      data-pacific-transit-max={PACIFIC_TRANSIT_MAX}
      data-nodes={visibleNodes.length}
      data-links={visibleLinks.length}
      data-nodes-total={GLOBE_NODES.length}
      data-links-total={GLOBE_LINKS.length}
      data-pulses={visiblePulses.length}
      data-pacific-links={visibleLinks.filter((l) => l.pacific).length}
      data-atmospheric-routes={atmosphericSamples.length}
      data-australia-nodes={visibleNodes.filter((n) => n.australia).length}
      data-active-nodes={visibleNodes.filter((n) => n.level === 'A').length}
      data-network-nodes={visibleNodes.filter((n) => n.level === 'B').length}
      data-activity-nodes={visibleNodes.filter((n) => n.level === 'C').length}
      data-label-max={maxVisible}
      data-label-min={
        compact
          ? GLOBE_PACKET_MIN.mobile
          : tablet
            ? GLOBE_PACKET_MIN.tablet
            : GLOBE_PACKET_MIN.desktop
      }
      data-label-system="atom-packets"
      data-sports-equal="true"
      data-lighting="stable"
      data-atm-colors="ice,silver,blue,red"
      data-network-mode="conceptual"
      data-city-names="off"
      data-node-palette="ice"
      data-land-tone="dark-petroleum-cyan"
      data-coast="cyan-bright"
      data-inland-groups={landDecor.groups?.length || landDecor.details.length}
      data-inland-details={landDecor.details.length}
      data-inland-dots={landDecor.dots.length}
      data-atm-points={atmosphereFx.counts.points}
      data-data-lines={atmosphereFx.counts.dataLines}
      data-political-borders="false"
      data-pulse-color="padbol-red"
      data-fx-layers="atmosphere,data-lines,microtexture"
      data-isologo="false"
      onPointerEnter={() => {
        hoverRef.current = true;
      }}
      onPointerLeave={() => {
        hoverRef.current = false;
      }}
    >
      <canvas ref={canvasRef} className="ps-globe__canvas" aria-hidden="true" />
      <GlobeLabels
        text={text}
        yawDeg={yawDeg}
        cx={layout.cx}
        cy={layout.cy}
        radius={layout.radius}
        compact={compact}
        tablet={tablet}
        reducedMotion={reducedMotion}
        elapsedMs={elapsedMs}
        layoutW={layout.w}
      />
    </div>
  );
}
