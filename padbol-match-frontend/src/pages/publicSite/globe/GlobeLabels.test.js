import {
  GLOBE_ALL_LABEL_KEYS,
  GLOBE_CENTER_ROUTE_LABELS,
  GLOBE_LABEL_CATEGORIES,
  GLOBE_LABEL_CATALOG,
  GLOBE_PACKET_MAX,
  GLOBE_PACKET_MIN,
  GLOBE_SPORT_LABELS,
  GLOBE_STATIC_LABELS,
  countLabelAppearances,
  sportAppearanceBalance,
} from './globeLabelCatalog';
import { GLOBE_PACKET_ROUTES } from './globeAtomRoutes';
import { schedulePacketLabels } from './GlobeLabels';
import fs from 'fs';
import path from 'path';

describe('globeLabelCatalog', () => {
  it('centraliza categorías y los cuatro deportes sin emphasize', () => {
    expect(GLOBE_SPORT_LABELS).toEqual(['padbol', 'padel', 'pickleball', 'tennis']);
    GLOBE_SPORT_LABELS.forEach((k) => {
      expect(GLOBE_LABEL_CATALOG[k].sport).toBe(true);
      expect(GLOBE_LABEL_CATALOG[k].emphasize).toBeUndefined();
      expect(GLOBE_LABEL_CATEGORIES.sports).toContain(k);
    });
    expect(GLOBE_LABEL_CATEGORIES.management).toContain('associations');
    expect(GLOBE_LABEL_CATEGORIES.management).toContain('federations');
    expect(GLOBE_LABEL_CATEGORIES.community).toContain('community');
    expect(GLOBE_ALL_LABEL_KEYS).toContain('associations');
    expect(GLOBE_ALL_LABEL_KEYS).toContain('federations');
    expect(GLOBE_ALL_LABEL_KEYS.length).toBeGreaterThanOrEqual(36);
  });

  it('define mínimos/máximos por viewport', () => {
    expect(GLOBE_PACKET_MIN.desktop).toBe(4);
    expect(GLOBE_PACKET_MAX.desktop).toBe(8);
    expect(GLOBE_PACKET_MIN.tablet).toBe(3);
    expect(GLOBE_PACKET_MAX.tablet).toBe(6);
    expect(GLOBE_PACKET_MIN.mobile).toBe(2);
    expect(GLOBE_PACKET_MAX.mobile).toBe(4);
  });
});

describe('sport equality in packet routes', () => {
  it('trata los cuatro deportes con la misma prioridad y rutas equivalentes', () => {
    GLOBE_SPORT_LABELS.forEach((sport) => {
      const routes = GLOBE_PACKET_ROUTES.filter((r) => r.labelKey === sport);
      expect(routes.length).toBeGreaterThanOrEqual(2);
      routes.forEach((r) => {
        expect(r.priority).toBe(3);
        expect(r.emphasize).toBeFalsy();
      });
    });
    const avgDur = (sport) => {
      const rs = GLOBE_PACKET_ROUTES.filter((r) => r.labelKey === sport);
      return rs.reduce((s, r) => s + r.durationMs, 0) / rs.length;
    };
    const durs = GLOBE_SPORT_LABELS.map(avgDur);
    const max = Math.max(...durs);
    const min = Math.min(...durs);
    expect(max / min).toBeLessThanOrEqual(1.35);
  });

  it('incluye Asociaciones, Federaciones y rutas centrales', () => {
    expect(GLOBE_PACKET_ROUTES.some((r) => r.labelKey === 'associations')).toBe(true);
    expect(GLOBE_PACKET_ROUTES.some((r) => r.labelKey === 'federations')).toBe(true);
    GLOBE_CENTER_ROUTE_LABELS.forEach((key) => {
      expect(GLOBE_PACKET_ROUTES.some((r) => r.labelKey === key && r.crossesCenter)).toBe(true);
    });
  });
});

describe('schedulePacketLabels continuity', () => {
  const base = {
    yawDeg: -18,
    cx: 280,
    cy: 280,
    radius: 210,
    compact: false,
    tablet: false,
    reducedMotion: false,
    layoutW: 1100,
  };

  it('mantiene mínimo visible en desktop sin intervalos vacíos', () => {
    let empty = 0;
    let belowMin = 0;
    for (let t = 0; t < 90000; t += 400) {
      const items = schedulePacketLabels({ ...base, elapsedMs: t });
      if (items.length === 0) empty += 1;
      if (items.length < GLOBE_PACKET_MIN.desktop) belowMin += 1;
      expect(items.length).toBeLessThanOrEqual(GLOBE_PACKET_MAX.desktop);
    }
    expect(empty).toBe(0);
    expect(belowMin).toBeLessThan(8);
  });

  it('equilibra apariciones de los cuatro deportes', () => {
    const counts = countLabelAppearances({
      scheduleFn: schedulePacketLabels,
      durationMs: 180000,
      stepMs: 500,
    });
    GLOBE_SPORT_LABELS.forEach((k) => {
      expect(counts[k] || 0).toBeGreaterThan(15);
    });
    const { ratio } = sportAppearanceBalance(counts);
    expect(ratio).toBeLessThanOrEqual(4.5);
  });

  it('reduced motion incluye los cuatro deportes en desktop', () => {
    const items = schedulePacketLabels({ ...base, reducedMotion: true, elapsedMs: 0 });
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.length).toBeLessThanOrEqual(GLOBE_PACKET_MAX.desktop);
    const keys = items.map((i) => i.key);
    GLOBE_SPORT_LABELS.forEach((s) => expect(keys).toContain(s));
    expect(GLOBE_STATIC_LABELS.desktop.slice(0, 4)).toEqual(GLOBE_SPORT_LABELS);
  });

  it('no usa clase emphasize ni isotipo en CSS residual', () => {
    const css = fs.readFileSync(path.join(__dirname, '../publicSite.css'), 'utf8');
    expect(css).not.toMatch(/is-emphasize/);
    expect(css).not.toMatch(/ps-globe__core/);
    expect(css).not.toMatch(/isologo/i);
  });
});
