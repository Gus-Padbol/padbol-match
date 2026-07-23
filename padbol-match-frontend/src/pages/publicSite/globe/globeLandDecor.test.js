import { LAND_DECOR_ANCHORS, buildLandDecor } from './globeLandDecor';
import { buildAtmosphereFx } from './globeAtmosphereFx';
import {
  GLOBE_ATMOSPHERE_FX,
  GLOBE_COAST_THEME,
  GLOBE_INLAND_THEME,
  GLOBE_LAND_THEME,
  GLOBE_NODE_THEME,
  GLOBE_PULSE_THEME,
} from './globeVisualTheme';
import { strokeLandCoasts } from './globeProjection';

describe('globeLandDecor', () => {
  it('cubre continentes con microtramas densas sin fronteras', () => {
    const continents = new Set(LAND_DECOR_ANCHORS.map((a) => a.continent));
    expect(continents.has('north-america')).toBe(true);
    expect(continents.has('south-america')).toBe(true);
    expect(continents.has('europe')).toBe(true);
    expect(continents.has('africa')).toBe(true);
    expect(continents.has('asia')).toBe(true);
    expect(continents.has('australia')).toBe(true);
    const desktop = buildLandDecor({});
    expect(desktop.politicalBorders).toBe(false);
    expect(desktop.groups.length).toBeGreaterThanOrEqual(25);
    expect(desktop.groups.length).toBeLessThanOrEqual(40);
    expect(desktop.dots.length).toBeGreaterThan(20);
    expect(buildLandDecor({})).toEqual(desktop);
  });

  it('reduce densidad en tablet y móvil', () => {
    const desktop = buildLandDecor({});
    const tablet = buildLandDecor({ tablet: true });
    const mobile = buildLandDecor({ compact: true });
    expect(tablet.groups.length).toBeLessThan(desktop.groups.length);
    expect(tablet.groups.length).toBeGreaterThanOrEqual(14);
    expect(mobile.groups.length).toBeLessThanOrEqual(12);
    expect(mobile.groups.length).toBeGreaterThanOrEqual(6);
    expect(GLOBE_INLAND_THEME.dotRadius.desktop).toBeLessThan(GLOBE_INLAND_THEME.nodeMinCore);
  });
});

describe('globeAtmosphereFx', () => {
  it('genera nube de puntos, líneas de datos y sparkles deterministas', () => {
    const a = buildAtmosphereFx({});
    const b = buildAtmosphereFx({});
    expect(a).toEqual(b);
    expect(a.points.length).toBe(GLOBE_ATMOSPHERE_FX.points.desktop);
    expect(a.dataLines.length).toBeGreaterThanOrEqual(6);
    expect(a.orbitArcs.length).toBeGreaterThanOrEqual(4);
    expect(a.sparkles.length).toBeGreaterThan(5);
    const mobile = buildAtmosphereFx({ compact: true });
    expect(mobile.points.length).toBeLessThan(a.points.length);
    expect(mobile.dataLines.length).toBeLessThanOrEqual(4);
  });
});

describe('strokeLandCoasts API', () => {
  it('es callable sin lanzar sobre geom vacía', () => {
    const ctx = {
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      lineJoin: '',
      lineCap: '',
    };
    expect(() =>
      strokeLandCoasts(ctx, null, 0, 100, 100, 80, GLOBE_COAST_THEME),
    ).not.toThrow();
  });
});

describe('jerarquía visual intacta', () => {
  it('nodos hielo, costas rojos, costas cyan brillantes', () => {
    expect(GLOBE_NODE_THEME.core).toBe('#F2F7FF');
    expect(GLOBE_NODE_THEME.rim).toMatch(/36,\s*200,\s*240/);
    expect(GLOBE_PULSE_THEME.red).toMatch(/225,\s*27,\s*34/);
    expect(GLOBE_LAND_THEME.tone).toBe('dark-petroleum-cyan');
    expect(GLOBE_COAST_THEME.stroke).toBe('#24D8FF');
  });
});
