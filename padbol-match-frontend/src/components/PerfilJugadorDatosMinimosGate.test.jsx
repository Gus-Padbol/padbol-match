import { gateSkipsPerfilMinimo } from './PerfilJugadorDatosMinimosGate';

describe('gate de perfil deportivo', () => {
  it('no bloquea la Biblioteca FIPA ni sus futuras subrutas', () => {
    expect(gateSkipsPerfilMinimo('/fipa/documentos')).toBe(true);
    expect(gateSkipsPerfilMinimo('/fipa/documentos/reglamento')).toBe(true);
  });

  it('mantiene el gate en pantallas deportivas normales', () => {
    expect(gateSkipsPerfilMinimo('/hub')).toBe(false);
  });
});
