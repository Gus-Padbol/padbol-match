import {
  hubAccionExigePerfilJugadorMinimo,
  rutaExigePerfilJugadorMinimo,
} from './perfilJugadorMinimo';

test('el hub, registro y reservar/buscar NO exigen ficha mínima', () => {
  expect(rutaExigePerfilJugadorMinimo('/')).toBe(false);
  expect(rutaExigePerfilJugadorMinimo('/hub')).toBe(false);
  expect(rutaExigePerfilJugadorMinimo('/inicio')).toBe(false);
  expect(rutaExigePerfilJugadorMinimo('/registro')).toBe(false);
  expect(rutaExigePerfilJugadorMinimo('/reservar')).toBe(false);
  expect(rutaExigePerfilJugadorMinimo('/jugar/buscar')).toBe(false);
  expect(rutaExigePerfilJugadorMinimo('/competir')).toBe(false);
});

test('crear partido exige ficha mínima', () => {
  expect(rutaExigePerfilJugadorMinimo('/jugar/armar')).toBe(true);
  expect(rutaExigePerfilJugadorMinimo('/jugar/armar/')).toBe(true);
  expect(hubAccionExigePerfilJugadorMinimo('armar_partido')).toBe(true);
  expect(hubAccionExigePerfilJugadorMinimo('reservar')).toBe(false);
});
