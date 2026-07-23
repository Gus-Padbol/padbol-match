/**
 * Topología de malla + visibilidad de red conceptual.
 */

import {
  countFrontNodes,
  getMeshTopologyStats,
  GLOBE_HEMISPHERE_MIN,
  GLOBE_LABEL_MAX,
  GLOBE_LINK_COUNTS,
  GLOBE_LINK_KIND_COUNTS,
  GLOBE_LINKS,
  GLOBE_MESH_SEED,
  GLOBE_NODE_COUNTS,
  GLOBE_NODES,
  GLOBE_PULSES,
  GLOBE_REGIONAL_HUBS,
  GLOBE_SPORT_LABELS,
  selectLinksForViewport,
  selectNodesForViewport,
} from './globeNetworkData';
import {
  GLOBE_ATMOSPHERIC_ROUTES,
  GLOBE_ATM_VISIBLE_MIN,
  GLOBE_PACKET_MAX,
} from './globeAtomRoutes';
import {
  buildDeterministicMesh,
  haversineKm,
  isRadialTopology,
  linkDegreeStats,
  segmentCrossesDiskCenter,
} from './globeMeshTopology';
import { countVisibleAtmosphericFrontSpans, elevatedArcSamples, projectLonLat } from './globeProjection';
import { rotationSpeedMultiplier } from './PremiumGlobalGlobe';

describe('mesh topology generator', () => {
  it('es determinista con seed estable', () => {
    const a = buildDeterministicMesh(GLOBE_NODES, { seed: GLOBE_MESH_SEED });
    const b = buildDeterministicMesh(GLOBE_NODES, { seed: GLOBE_MESH_SEED });
    expect(a.links.map((l) => `${l.from}-${l.to}-${l.kind}`)).toEqual(
      b.links.map((l) => `${l.from}-${l.to}-${l.kind}`),
    );
  });

  it('prioriza malla local sobre internacionales', () => {
    const total = GLOBE_LINKS.length || 1;
    expect(GLOBE_LINK_KIND_COUNTS.local / total).toBeGreaterThan(0.4);
    expect(GLOBE_LINK_KIND_COUNTS.international / total).toBeLessThan(0.25);
    expect(GLOBE_LINKS.length).toBeGreaterThanOrEqual(GLOBE_LINK_COUNTS.desktop.min);
    expect(GLOBE_LINKS.length).toBeLessThanOrEqual(GLOBE_LINK_COUNTS.desktop.max);
  });

  it('limita grado y evita topología radial', () => {
    const stats = getMeshTopologyStats();
    expect(stats.min).toBeGreaterThanOrEqual(2);
    expect(stats.max).toBeLessThanOrEqual(8);
    expect(stats.maxFrac).toBeLessThanOrEqual(0.06 + 1e-6);
    expect(GLOBE_REGIONAL_HUBS.length).toBeGreaterThanOrEqual(10);
    expect(GLOBE_REGIONAL_HUBS.length).toBeLessThanOrEqual(16);
    expect(isRadialTopology(GLOBE_LINKS, GLOBE_REGIONAL_HUBS, 0.35)).toBe(false);
  });

  it('sin nodos aislados y categorías en rango', () => {
    expect(GLOBE_LINK_KIND_COUNTS.local).toBeGreaterThanOrEqual(105);
    expect(GLOBE_LINK_KIND_COUNTS.local).toBeLessThanOrEqual(125);
    expect(GLOBE_LINK_KIND_COUNTS.regional).toBeGreaterThanOrEqual(45);
    expect(GLOBE_LINK_KIND_COUNTS.international).toBeGreaterThanOrEqual(25);
  });

  it('conecta vecinos locales por región', () => {
    const byRegion = {};
    GLOBE_NODES.forEach((n) => {
      byRegion[n.region] = byRegion[n.region] || [];
      byRegion[n.region].push(n);
    });
    let localPairs = 0;
    GLOBE_LINKS.filter((l) => l.kind === 'local').forEach((l) => {
      const a = GLOBE_NODES.find((n) => n.id === l.from);
      const b = GLOBE_NODES.find((n) => n.id === l.to);
      expect(a.region).toBe(b.region);
      expect(haversineKm(a, b)).toBeLessThan(1800);
      localPairs += 1;
    });
    expect(localPairs).toBeGreaterThanOrEqual(50);
  });
});

describe('visibility and hierarchy', () => {
  it('acelera suavemente el Pacífico sin discontinuidades de posición', () => {
    expect(rotationSpeedMultiplier(90)).toBeCloseTo(1, 4);
    expect(rotationSpeedMultiplier(195)).toBeGreaterThanOrEqual(1.4);
    expect(rotationSpeedMultiplier(285)).toBeCloseTo(1, 4);
    expect(Math.abs(rotationSpeedMultiplier(157.9) - rotationSpeedMultiplier(158.1))).toBeLessThan(
      0.01,
    );
  });

  it('mantiene nodos densos y rangos por viewport', () => {
    expect(GLOBE_NODES.length).toBeGreaterThanOrEqual(GLOBE_NODE_COUNTS.desktop.min);
    expect(GLOBE_NODES.length).toBeLessThanOrEqual(GLOBE_NODE_COUNTS.desktop.max);
    expect(selectNodesForViewport(false, true).length).toBeGreaterThanOrEqual(82);
    expect(selectNodesForViewport(true, false).length).toBeGreaterThanOrEqual(48);
  });

  it('mínimo de nodos frontales por orientación', () => {
    [0, 45, 90, 135, 180, 225, 270, 315].forEach((yaw) => {
      expect(countFrontNodes(GLOBE_NODES, yaw)).toBeGreaterThanOrEqual(GLOBE_HEMISPHERE_MIN.nodes);
    });
  });

  it('tiene cruces centrales potenciales en proyecciones', () => {
    const cx = 200;
    const cy = 200;
    const r = 120;
    let best = 0;
    [0, 45, 90, 135, 180, 225, 270, 315].forEach((yaw) => {
      let center = 0;
      GLOBE_LINKS.forEach((l) => {
        const a = GLOBE_NODES.find((n) => n.id === l.from);
        const b = GLOBE_NODES.find((n) => n.id === l.to);
        const pa = projectLonLat(a.lon, a.lat, yaw, cx, cy, r);
        const pb = projectLonLat(b.lon, b.lat, yaw, cx, cy, r);
        if (pa && pb && segmentCrossesDiskCenter(pa.x, pa.y, pb.x, pb.y, cx, cy, r, 0.55)) {
          center += 1;
        }
      });
      best = Math.max(best, center);
    });
    expect(best).toBeGreaterThanOrEqual(8);
  });

  it('actividad regional Asia África América Oceanía', () => {
    const asia = new Set(['southAsia', 'southeastAsia', 'eastAsia', 'centralAsia', 'middleEast']);
    const africa = new Set([
      'northAfrica', 'westAfrica', 'eastAfrica', 'centralAfrica', 'southernAfrica',
    ]);
    expect(GLOBE_NODES.filter((n) => asia.has(n.region)).length).toBeGreaterThanOrEqual(18);
    expect(GLOBE_NODES.filter((n) => africa.has(n.region)).length).toBeGreaterThanOrEqual(10);
    expect(GLOBE_NODES.filter((n) => n.region === 'oceania').length).toBeGreaterThanOrEqual(6);
    expect(GLOBE_LINKS.filter((l) => l.pacific).length).toBeGreaterThanOrEqual(6);
  });
});

describe('atmosphere pulses labels', () => {
  it('atm en rango y visible', () => {
    expect(GLOBE_ATMOSPHERIC_ROUTES.length).toBeGreaterThanOrEqual(42);
    expect(GLOBE_ATMOSPHERIC_ROUTES.length).toBeLessThanOrEqual(50);
    expect(GLOBE_ATM_VISIBLE_MIN.desktop).toBeGreaterThanOrEqual(16);
    const bands = new Set(GLOBE_ATMOSPHERIC_ROUTES.map((r) => r.band));
    expect(bands.has('low') && bands.has('mid') && bands.has('high')).toBe(true);
    const routes = GLOBE_ATMOSPHERIC_ROUTES.map((r) => ({
      ...r,
      samples: elevatedArcSamples([r.lonA, r.latA], [r.lonB, r.latB], r.peakAltitude, 24),
    }));
    expect(countVisibleAtmosphericFrontSpans(routes, 30, 200, 200, 120)).toBeGreaterThanOrEqual(16);
  });

  it('pulsos y etiquetas acotadas', () => {
    expect(GLOBE_PULSES.length).toBeGreaterThanOrEqual(22);
    expect(GLOBE_PULSES.length).toBeLessThanOrEqual(28);
    expect(GLOBE_PACKET_MAX.desktop).toBe(8);
    expect(GLOBE_PACKET_MAX.desktop).toBeGreaterThanOrEqual(6);
    expect(GLOBE_LABEL_MAX.mobile).toBeLessThanOrEqual(4);
    expect(GLOBE_SPORT_LABELS).toEqual(['padbol', 'padel', 'pickleball', 'tennis']);
  });

  it('selectLinks prioriza locales', () => {
    const links = selectLinksForViewport(selectNodesForViewport(true, false), true, false);
    const local = links.filter((l) => l.kind === 'local').length;
    const intl = links.filter((l) => l.kind === 'international').length;
    expect(local).toBeGreaterThan(intl);
    expect(local / (links.length || 1)).toBeGreaterThan(0.35);
  });

  it('nodos tienen tamaño mínimo de núcleo en desktop (contrato visual)', () => {
    /* Núcleo B/A/C: 3.5–5 px; halo 8–14 (documentado en PremiumGlobalGlobe) */
    const CORE_MIN = 3.5;
    const CORE_MAX = 5;
    const HALO_MIN = 8;
    const HALO_MAX = 14;
    expect(CORE_MIN).toBeGreaterThanOrEqual(3.5);
    expect(CORE_MAX).toBeLessThanOrEqual(5);
    expect(HALO_MIN).toBeGreaterThanOrEqual(8);
    expect(HALO_MAX).toBeLessThanOrEqual(14);
  });
});

describe('estética unificada (nodos blancos / rojo solo movimiento)', () => {
  const {
    GLOBE_NODE_THEME,
    GLOBE_LAND_THEME,
    GLOBE_OCEAN_THEME,
    GLOBE_GRID_THEME,
    GLOBE_LINK_THEME,
    GLOBE_PULSE_THEME,
    STARFIELD_THEME,
  } = require('./globeVisualTheme');

  it('nodos permanentes blancos sin verde ni rojo fijo', () => {
    expect(GLOBE_NODE_THEME.core).toBe('#F2F7FF');
    expect(GLOBE_NODE_THEME.halo).toMatch(/140,\s*220,\s*255/);
    expect(GLOBE_NODE_THEME.rim).toMatch(/36,\s*200,\s*240/);
    expect(GLOBE_NODE_THEME.permanentColors).toEqual(['#F2F7FF']);
    expect(GLOBE_NODE_THEME.core).not.toMatch(/168a45|e11b22|1f6b3a/i);
    expect(GLOBE_NODE_THEME.forbiddenPermanent).toEqual(
      expect.arrayContaining(['#168a45', '#e11b22']),
    );
  });

  it('rojo solo en pulsos / actividad', () => {
    expect(GLOBE_PULSE_THEME.red).toMatch(/225,\s*27,\s*34/);
    expect(GLOBE_LINK_THEME.red).toMatch(/225,\s*27,\s*34/);
    expect(GLOBE_LINK_THEME.ice).toMatch(/220,\s*245,\s*255/);
    expect(GLOBE_LINK_THEME.silver).toMatch(/160,\s*210,\s*235/);
    expect(GLOBE_LINK_THEME.cyan).toMatch(/70,\s*210,\s*255/);
  });

  it('conexiones con grosores delicados por jerarquía', () => {
    const { GLOBE_LINK_WIDTHS } = require('./globeVisualTheme');
    const d = GLOBE_LINK_WIDTHS.desktop;
    expect(d.local).toBeLessThanOrEqual(0.75);
    expect(d.local).toBeGreaterThanOrEqual(0.45);
    expect(d.regional).toBeGreaterThan(d.local);
    expect(d.international).toBeGreaterThan(d.regional);
    expect(d.international).toBeLessThanOrEqual(1.15);
    expect(d.atmFrontPrimary).toBeLessThanOrEqual(1.3);
    expect(d.atmBack).toBeLessThanOrEqual(0.8);
    expect(GLOBE_LINK_WIDTHS.tablet.local).toBeLessThan(d.local);
    expect(GLOBE_LINK_WIDTHS.mobile.local).toBeLessThan(GLOBE_LINK_WIDTHS.tablet.local);
  });

  it('continentes azul petróleo oscuro y océano noche', () => {
    expect(GLOBE_LAND_THEME.base).toBe('#183A50');
    expect(GLOBE_LAND_THEME.lit).toBe('#245A73');
    expect(GLOBE_LAND_THEME.side).toBe('#102A3B');
    expect(GLOBE_LAND_THEME.limb).toBe('#081A27');
    expect(GLOBE_LAND_THEME.alpha).toBeGreaterThanOrEqual(0.72);
    expect(GLOBE_LAND_THEME.alpha).toBeLessThanOrEqual(0.88);
    expect(GLOBE_LAND_THEME.base.toLowerCase()).not.toBe('#ffffff');
    expect(GLOBE_LAND_THEME.base.toLowerCase()).not.toBe('#c2cdda');
    expect(GLOBE_LAND_THEME.base.toLowerCase()).not.toBe('#58748c');
    expect(GLOBE_LAND_THEME.politicalBorders).toBe(false);
    expect(GLOBE_OCEAN_THEME.stops[0].color).toMatch(/#0E2A40|#081A2C/i);
    expect(GLOBE_OCEAN_THEME.stops.length).toBeGreaterThanOrEqual(3);
  });

  it('grilla cyan reforzada con ecuador y anillos secundarios', () => {
    expect(GLOBE_GRID_THEME.equatorWidth).toBeGreaterThan(GLOBE_GRID_THEME.baseWidth);
    expect(GLOBE_GRID_THEME.meridianWidth).toBeGreaterThan(GLOBE_GRID_THEME.baseWidth);
    expect(GLOBE_GRID_THEME.highlightParallels).toEqual([-30, 30]);
    expect(GLOBE_GRID_THEME.gapChance).toBeGreaterThan(0);
    expect(GLOBE_GRID_THEME.secondaryRings.length).toBeGreaterThanOrEqual(2);
    expect(GLOBE_GRID_THEME.equator).toMatch(/120,\s*220,\s*245/);
  });

  it('costas cyan brillantes con halo y doble contorno', () => {
    const {
      GLOBE_COAST_THEME,
      GLOBE_LIMB_THEME,
      GLOBE_INLAND_THEME,
      GLOBE_ATMOSPHERE_FX,
    } = require('./globeVisualTheme');
    expect(GLOBE_COAST_THEME.stroke).toBe('#24D8FF');
    expect(GLOBE_COAST_THEME.halo).toMatch(/36,\s*200,\s*255/);
    expect(GLOBE_COAST_THEME.secondary).toMatch(/18,\s*120,\s*160/);
    expect(GLOBE_COAST_THEME.doubleContourRatio).toBeGreaterThanOrEqual(0.25);
    expect(GLOBE_COAST_THEME.doubleContourRatio).toBeLessThanOrEqual(0.4);
    expect(GLOBE_COAST_THEME.width.desktop).toBeGreaterThanOrEqual(1.2);
    expect(GLOBE_COAST_THEME.doubleWidth.mobile).toBe(0);
    expect(GLOBE_LIMB_THEME.rim).toMatch(/36,\s*216,\s*255/);
    expect(GLOBE_INLAND_THEME.counts.desktop.groups).toBeGreaterThanOrEqual(25);
    expect(GLOBE_INLAND_THEME.counts.desktop.groups).toBeLessThanOrEqual(40);
    expect(GLOBE_INLAND_THEME.counts.mobile.groups).toBeLessThanOrEqual(12);
    expect(GLOBE_INLAND_THEME.dotRadius.desktop).toBeLessThan(GLOBE_INLAND_THEME.nodeMinCore);
    expect(GLOBE_ATMOSPHERE_FX.points.desktop).toBeGreaterThanOrEqual(300);
    expect(GLOBE_ATMOSPHERE_FX.dataLines.desktop).toBeGreaterThanOrEqual(6);
  });

  it('starfield con tres capas y tamaños variados', () => {
    expect(STARFIELD_THEME.desktop.far).toBeGreaterThan(STARFIELD_THEME.mobile.far);
    expect(STARFIELD_THEME.sizes.far[0]).toBeGreaterThanOrEqual(0.7);
    expect(STARFIELD_THEME.sizes.near[1]).toBeLessThanOrEqual(3);
    expect(STARFIELD_THEME.tones.length).toBeGreaterThanOrEqual(3);
  });

  it('topología de red densa (nodos + malla)', () => {
    expect(GLOBE_NODES.length).toBeGreaterThanOrEqual(125);
    expect(GLOBE_NODES.length).toBeLessThanOrEqual(145);
    expect(GLOBE_LINKS.length).toBeGreaterThanOrEqual(160);
  });
});
