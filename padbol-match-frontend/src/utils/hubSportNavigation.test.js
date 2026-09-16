import { hubSportActionPath } from './hubSportNavigation';

describe('deporte elegido en acciones del hub', () => {
  test.each([
    ['/reservar', '/reservar?deporte=tenis'],
    ['/jugar/buscar', '/jugar/buscar?deporte=tenis'],
    ['/jugar/armar', '/jugar/armar?deporte=tenis'],
  ])('conserva el deporte desde %s', (basePath, expected) => {
    expect(hubSportActionPath(basePath, ' Tenis ')).toBe(expected);
  });

  test.each([undefined, '', 'deporte-inexistente'])('sin deporte válido conserva la URL base (%s)', (sport) => {
    expect(hubSportActionPath('/reservar', sport)).toBe('/reservar');
    expect(hubSportActionPath('/jugar/buscar', sport)).toBe('/jugar/buscar');
    expect(hubSportActionPath('/jugar/armar', sport)).toBe('/jugar/armar');
  });

  test('agrega el contexto sin borrar parámetros existentes', () => {
    expect(hubSportActionPath('/reservar?sedeId=12', 'padbol'))
      .toBe('/reservar?sedeId=12&deporte=padbol');
  });
});
