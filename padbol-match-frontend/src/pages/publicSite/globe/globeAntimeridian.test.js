/**
 * Utilidades antimeridiano: normalización, saltos, división de rings.
 */

import {
  antimeridianCrossing,
  densifyRing,
  densifySegment,
  hasAntimeridianJump,
  isSpuriousChord,
  lonDelta,
  normalizeLon,
  splitRingAtAntimeridian,
} from './globeAntimeridian';

describe('globeAntimeridian', () => {
  it('normaliza longitudes conservando ±180', () => {
    expect(normalizeLon(0)).toBe(0);
    expect(normalizeLon(180)).toBe(180);
    expect(normalizeLon(-180)).toBe(-180);
    expect(normalizeLon(190)).toBe(-170);
    expect(normalizeLon(-190)).toBe(170);
    expect(normalizeLon(540)).toBe(180);
  });

  it('calcula delta de longitud más corta', () => {
    expect(lonDelta(170, -170)).toBe(20);
    expect(lonDelta(-170, 170)).toBe(-20);
    expect(Math.abs(lonDelta(10, 20))).toBe(10);
  });

  it('detecta saltos antimeridiano en coordenadas crudas', () => {
    expect(hasAntimeridianJump(179, -179)).toBe(true);
    expect(hasAntimeridianJump(170, 175)).toBe(false);
    expect(hasAntimeridianJump(-179, 179)).toBe(true);
  });

  it('interpola el cruce en ±180', () => {
    const [lon, lat] = antimeridianCrossing([170, 10], [-170, 30]);
    expect(Math.abs(lon)).toBe(180);
    expect(lat).toBeCloseTo(20, 5);
  });

  it('divide rings sin unir puntos separados ~360°', () => {
    const ring = [
      [160, 0],
      [170, 0],
      [179, 0],
      [-179, 0],
      [-170, 0],
      [160, 0],
    ];
    const parts = splitRingAtAntimeridian(ring);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    parts.forEach((part) => {
      for (let i = 1; i < part.length; i += 1) {
        expect(Math.abs(lonDelta(part[i - 1][0], part[i][0]))).toBeLessThan(90);
      }
    });
  });

  it('densifica segmentos sin saltos', () => {
    const seg = densifySegment([0, 0], [20, 10], 5);
    expect(seg.length).toBeGreaterThan(2);
    expect(seg[0]).toEqual([0, 0]);
    expect(seg[seg.length - 1]).toEqual([20, 10]);
  });

  it('densifica rings completos', () => {
    const ring = densifyRing(
      [
        [0, 0],
        [30, 0],
        [30, 20],
        [0, 0],
      ],
      10,
    );
    expect(ring.length).toBeGreaterThan(6);
  });

  it('marca cuerdas espurias en proyección', () => {
    expect(isSpuriousChord({ x: 0, y: 0 }, { x: 200, y: 0 }, 80)).toBe(true);
    expect(isSpuriousChord({ x: 0, y: 0 }, { x: 10, y: 5 }, 80)).toBe(false);
  });
});
