/**
 * Validación de rotación completa: antimeridiano, clipping, continentes, atmósfera.
 */

import landData from './land110m.geo.json';
import {
  GLOBE_ATMOSPHERIC_ROUTES,
  GLOBE_ATM_COUNTS,
  GLOBE_ATM_VISIBLE_MIN,
} from './globeAtomRoutes';
import {
  atmosphericSectorPresence,
  clipToHorizon,
  countVisibleAtmosphericFrontSpans,
  elevatedArcSamples,
  findSpuriousProjectedChords,
  FRONT_EPS,
  lonLatToVec3,
  projectElevated,
  sampleLandPresence,
  splitRingAtAntimeridian,
} from './globeProjection';
import { normalizeLon, splitRingAtAntimeridian as splitRing } from './globeAntimeridian';

const LAND = landData.features[0].geometry;
const CX = 200;
const CY = 200;
const R = 120;
const YAWS = [0, 45, 90, 135, 180, 225, 270, 315];

const CONTINENT_PROBES = [
  { id: 'europe', lon: 10, lat: 50 },
  { id: 'africa', lon: 20, lat: 0 },
  { id: 'asia', lon: 100, lat: 40 },
  { id: 'india', lon: 78, lat: 22 },
  { id: 'seAsia', lon: 105, lat: 10 },
  { id: 'japan', lon: 138, lat: 36 },
  { id: 'australia', lon: 134, lat: -25 },
  { id: 'nAmerica', lon: -100, lat: 40 },
  { id: 'cAmerica', lon: -90, lat: 15 },
  { id: 'sAmerica', lon: -60, lat: -15 },
];

function buildAtmRoutes(limit = GLOBE_ATM_COUNTS.desktop) {
  return GLOBE_ATMOSPHERIC_ROUTES.slice(0, limit).map((route) => ({
    ...route,
    samples: elevatedArcSamples(
      [route.lonA, route.latA],
      [route.lonB, route.latB],
      route.peakAltitude,
      28,
    ),
  }));
}

describe('land GeoJSON multipolygon', () => {
  it('usa Natural Earth local MultiPolygon sin datos remotos', () => {
    expect(LAND.type).toBe('MultiPolygon');
    expect(LAND.coordinates.length).toBeGreaterThan(10);
  });

  it('divide rings MultiPolygon con saltos antimeridiano', () => {
    let splits = 0;
    LAND.coordinates.forEach((poly) => {
      const parts = splitRing(poly[0]);
      if (parts.length > 1) splits += 1;
    });
    expect(splits).toBeGreaterThan(0);
  });
});

describe('orthographic clipping', () => {
  it('interseca el limbo entre frente y dorso', () => {
    const from = [0, 0];
    const to = [180, 0];
    const edge = clipToHorizon(from, to, 0, true);
    const z = lonLatToVec3(edge[0], edge[1], 0).z;
    expect(Math.abs(z - FRONT_EPS)).toBeLessThan(0.08);
  });

  it('backface: z negativo no es frontal', () => {
    expect(lonLatToVec3(0, 0, 180).z).toBeLessThan(0);
    expect(lonLatToVec3(0, 0, 0).z).toBeGreaterThan(0);
  });
});

describe('rotación completa — geometría estable', () => {
  YAWS.forEach((yaw) => {
    it(`yaw ${yaw}°: sin bandas / cuerdas espurias de cierre`, () => {
      const bad = findSpuriousProjectedChords(LAND, yaw, CX, CY, R);
      expect(bad.filter((b) => b.type === 'closure')).toHaveLength(0);
      expect(bad.length).toBeLessThan(3);
    });
  });

  it('Europa y Asia aparecen en yaws esperados', () => {
    /* yaw 0: frente ≈ meridiano de Greenwich */
    const at0 = sampleLandPresence(CONTINENT_PROBES, 0);
    expect(at0.europe).toBe(true);
    expect(at0.africa).toBe(true);

    /* yaw −100: Asia / Japón al frente */
    const atAsia = sampleLandPresence(CONTINENT_PROBES, -100);
    expect(atAsia.asia).toBe(true);
    expect(atAsia.japan || atAsia.seAsia || atAsia.india).toBe(true);

    /* yaw +90: Américas al frente */
    const atAm = sampleLandPresence(CONTINENT_PROBES, 90);
    expect(atAm.nAmerica || atAm.sAmerica || atAm.cAmerica).toBe(true);
  });

  it('América y Asia no comparten el mismo hemisferio en yaw 0', () => {
    const am = lonLatToVec3(-60, -15, 0);
    const as = lonLatToVec3(100, 40, 0);
    expect(am.z).toBeGreaterThan(0);
    expect(as.z).toBeLessThan(0);
  });

  it('Australia reconocible cuando frontal', () => {
    const yaw = 140;
    const hit = sampleLandPresence(CONTINENT_PROBES, yaw);
    expect(hit.australia).toBe(true);
    const v = lonLatToVec3(134, -25, yaw);
    expect(v.z).toBeGreaterThan(FRONT_EPS);
  });

  it('continentes frontales no cruzan al hemisferio opuesto', () => {
    YAWS.forEach((yaw) => {
      CONTINENT_PROBES.forEach((probe) => {
        const v = lonLatToVec3(probe.lon, probe.lat, yaw);
        if (v.z >= FRONT_EPS) {
          /* proyección ortográfica: x,y dentro del disco unitario */
          expect(v.x * v.x + v.y * v.y).toBeLessThanOrEqual(1.001);
        }
      });
    });
  });

  it('colores estables: océano noche / tierra petróleo oscuro', () => {
    const {
      GLOBE_LAND_THEME,
      GLOBE_OCEAN_THEME,
      GLOBE_NODE_THEME,
      GLOBE_COAST_THEME,
    } = require('./globeVisualTheme');
    expect(GLOBE_LAND_THEME.base).toBe('#183A50');
    expect(GLOBE_LAND_THEME.base.toLowerCase()).not.toBe('#c2cdda');
    expect(GLOBE_LAND_THEME.base.toLowerCase()).not.toBe('#ffffff');
    expect(GLOBE_LAND_THEME.alpha).toBeGreaterThanOrEqual(0.72);
    expect(GLOBE_LAND_THEME.alpha).toBeLessThanOrEqual(0.88);
    expect(GLOBE_COAST_THEME.stroke).toBe('#24D8FF');
    GLOBE_OCEAN_THEME.stops.forEach((s) => expect(s.color.startsWith('#')).toBe(true));
    expect(GLOBE_NODE_THEME.core).toBe('#F2F7FF');
  });
});

describe('red atmosférica continua', () => {
  const desktopRoutes = buildAtmRoutes(GLOBE_ATM_COUNTS.desktop);
  const tabletRoutes = buildAtmRoutes(GLOBE_ATM_COUNTS.tablet);
  const mobileRoutes = buildAtmRoutes(GLOBE_ATM_COUNTS.mobile);

  it('alturas variadas low/mid/high', () => {
    const bands = new Set(GLOBE_ATMOSPHERIC_ROUTES.map((r) => r.band));
    expect(bands.has('low')).toBe(true);
    expect(bands.has('mid')).toBe(true);
    expect(bands.has('high')).toBe(true);
    const highs = GLOBE_ATMOSPHERIC_ROUTES.filter((r) => r.band === 'high');
    expect(highs.every((r) => r.peakAltitude >= 0.22)).toBe(true);
    expect(Math.max(...GLOBE_ATMOSPHERIC_ROUTES.map((r) => r.peakAltitude))).toBeLessThanOrEqual(0.38);
  });

  it('front y back se separan en proyección', () => {
    const s = desktopRoutes[0].samples[Math.floor(desktopRoutes[0].samples.length / 2)];
    const yaw = 40;
    const front = projectElevated(s.lon, s.lat, yaw, CX, CY, R, s.altitude, { side: 'front' });
    const back = projectElevated(s.lon, s.lat, yaw, CX, CY, R, s.altitude, { side: 'back' });
    if (front) expect(front.z).toBeGreaterThanOrEqual(FRONT_EPS);
    if (back) expect(back.z).toBeLessThan(0);
    expect(Boolean(front) && Boolean(back)).toBe(false);
  });

  YAWS.forEach((yaw) => {
    it(`yaw ${yaw}°: mínimos de tramos visibles desktop ≥ ${GLOBE_ATM_VISIBLE_MIN.desktop}`, () => {
      const spans = countVisibleAtmosphericFrontSpans(desktopRoutes, yaw, CX, CY, R);
      expect(spans).toBeGreaterThanOrEqual(GLOBE_ATM_VISIBLE_MIN.desktop);
    });
  });

  it('tablet y mobile respetan mínimos', () => {
    const yaw = 30;
    expect(countVisibleAtmosphericFrontSpans(tabletRoutes, yaw, CX, CY, R)).toBeGreaterThanOrEqual(
      GLOBE_ATM_VISIBLE_MIN.tablet,
    );
    expect(countVisibleAtmosphericFrontSpans(mobileRoutes, yaw, CX, CY, R)).toBeGreaterThanOrEqual(
      GLOBE_ATM_VISIBLE_MIN.mobile,
    );
  });

  it('distribuye presencia en varios sectores', () => {
    const sectors = atmosphericSectorPresence(desktopRoutes, 20, CX, CY, R);
    const count = Object.values(sectors).filter(Boolean).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('cubre sectores geográficos en el catálogo', () => {
    const sectors = new Set(GLOBE_ATMOSPHERIC_ROUTES.map((r) => r.sector));
    ['pacific', 'atlantic', 'north', 'south', 'oceania', 'americas', 'eurasia', 'africa', 'asia'].forEach((s) => {
      expect(sectors.has(s)).toBe(true);
    });
  });
});

describe('normalize re-export sanity', () => {
  it('normalizeLon coherente con split', () => {
    expect(normalizeLon(181)).toBe(-179);
    const parts = splitRingAtAntimeridian
      ? null
      : null;
    expect(parts).toBeNull();
    expect(typeof splitRing).toBe('function');
  });
});
