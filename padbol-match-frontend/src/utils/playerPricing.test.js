import { calculatePlayerPricing } from './playerPricing';
import fs from 'fs';
import path from 'path';

describe('player commission', () => {
  test.each([
    [100, 20, 120], ['100', '20', 120], [0, 0, 0],
    [null, undefined, 0], [34.5, 2.25, 36.75], [250000, 45000, 295000],
  ])('preserves venue price %s and extras %s without adding commission', (base, extras, total) => {
    expect(calculatePlayerPricing(base, extras)).toEqual({
      base: Number(base ?? 0), extrasSubtotal: Number(extras ?? 0), fee: 0, total,
    });
  });

  test('create match and class detail use the tested player pricing policy', () => {
    ['pages/ArmarPartido.jsx', 'components/Clases/ClaseDetalle.jsx'].forEach((file) => {
      const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      expect(source).toMatch(/fee: cargoPlataforma, total: precioTotal.*calculatePlayerPricing|fee: cargoPlataforma, total: precioTotal[\s\S]*?calculatePlayerPricing/);
      expect(source).not.toContain('* 0.03');
    });
  });
});
