import { resolveSedePublicaBackToPath } from '../constants/hubLayout';

test('Volver regresa al origen seguro validado', () => {
  expect(resolveSedePublicaBackToPath({ sedeBackPath: '/sedes' })).toBe('/sedes');
  expect(resolveSedePublicaBackToPath({ sedeBackPath: '/reservar?x=1#y' })).toBe('/reservar');
  expect(resolveSedePublicaBackToPath({ sedeBackPath: '/hub' })).toBe('/hub');
});

test('Volver usa fallback seguro al inicio cuando no hay origen o no es válido', () => {
  expect(resolveSedePublicaBackToPath({})).toBe('/hub');
  expect(resolveSedePublicaBackToPath(null)).toBe('/hub');
  expect(resolveSedePublicaBackToPath({ sedeBackPath: 'https://evil.example.com' })).toBe('/hub');
  expect(resolveSedePublicaBackToPath({ sedeBackPath: '/ruta-no-permitida' })).toBe('/hub');
});
