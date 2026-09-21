import {
  resolvePostLoginNavigatePath,
  safeRecorridoExternoPathFromLoginRedirect,
} from './reservaReturnUrl';

describe('retorno seguro al reconocimiento de nivel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('acepta únicamente la ruta interna del recorrido', () => {
    expect(safeRecorridoExternoPathFromLoginRedirect('?redirect=%2Fmi-perfil%2Frecorrido'))
      .toBe('/mi-perfil/recorrido');
    expect(safeRecorridoExternoPathFromLoginRedirect('?redirect=https%3A%2F%2Fejemplo.com'))
      .toBeNull();
    expect(safeRecorridoExternoPathFromLoginRedirect('?redirect=%2Fadmin'))
      .toBeNull();
  });

  it('regresa a la carga después de iniciar sesión', () => {
    expect(resolvePostLoginNavigatePath('?redirect=%2Fmi-perfil%2Frecorrido'))
      .toBe('/mi-perfil/recorrido');
  });
});
