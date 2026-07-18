import { asAdminDataArray } from './asAdminDataArray';
import fs from 'fs';
import path from 'path';

const dashboardSrc = fs.readFileSync(
  path.join(__dirname, '../pages/AdminDashboard.jsx'),
  'utf8',
);

describe('asAdminDataArray', () => {
  it('devuelve arrays directos sin modificar', () => {
    const a = [{ id: 1 }];
    expect(asAdminDataArray(a)).toBe(a);
  });

  it('normaliza null y undefined a []', () => {
    expect(asAdminDataArray(null)).toEqual([]);
    expect(asAdminDataArray(undefined)).toEqual([]);
  });

  it('extrae arrays de objetos contenedores conocidos', () => {
    expect(asAdminDataArray({ data: [1, 2] })).toEqual([1, 2]);
    expect(asAdminDataArray({ items: ['a'] })).toEqual(['a']);
    expect(asAdminDataArray({ reservas: [{ id: 9 }] })).toEqual([{ id: 9 }]);
    expect(asAdminDataArray({ torneos: [] })).toEqual([]);
    expect(asAdminDataArray({ equipos: [1] })).toEqual([1]);
    expect(asAdminDataArray({ results: [3] })).toEqual([3]);
  });

  it('no inventa datos ante objetos sin contenedor conocido', () => {
    expect(asAdminDataArray({ foo: 1 })).toEqual([]);
    expect(asAdminDataArray(42)).toEqual([]);
    expect(asAdminDataArray('x')).toEqual([]);
  });

  it('AdminDashboard importa y usa asAdminDataArray (sin referencia huérfana)', () => {
    expect(dashboardSrc).toMatch(/import\s*\{\s*asAdminDataArray\s*\}\s*from\s*['"][^'"]*asAdminDataArray['"]/);
    expect(dashboardSrc).toMatch(/asAdminDataArray\(reservas\)/);
    expect(dashboardSrc).not.toMatch(/function asAdminDataArray/);
  });
});
