import {
  hubAccionExigePerfilJugadorMinimo,
  intentarNavegarConPerfilJugadorMinimo,
  intentarNavegarHubConPerfilJugadorMinimo,
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

test('el gate contextual conserva la acción original completa para retomarla', () => {
  const navigate = jest.fn();
  const destination = '/jugar/armar?deporte=tenis#configuracion';
  expect(intentarNavegarConPerfilJugadorMinimo(navigate, null, destination)).toBe(false);
  expect(navigate).toHaveBeenCalledWith('/completar-perfil', { state: { from: destination } });

  navigate.mockClear();
  expect(intentarNavegarHubConPerfilJugadorMinimo(navigate, null, 'armar_partido', destination)).toBe(false);
  expect(navigate).toHaveBeenCalledWith('/completar-perfil', { state: { from: destination } });
});
