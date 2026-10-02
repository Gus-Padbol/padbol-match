import {
  getPostLoginReservaPath,
  resolvePostLoginNavigatePath,
  safePasswordRecoveryPathFromLoginRedirect,
} from './reservaReturnUrl';

describe('post-login default destination', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('lleva un ingreso normal al hub y no a la landing pública', () => {
    expect(getPostLoginReservaPath()).toBe('/hub');
    expect(resolvePostLoginNavigatePath('')).toBe('/hub');
  });

  it('conserva el callback interno de recuperación con destino admin', () => {
    const search = '?redirect=%2Fauth%2Frecovery%3Fredirect%3D%252Fadmin';
    expect(safePasswordRecoveryPathFromLoginRedirect(search)).toBe('/auth/recovery?redirect=/admin');
    expect(resolvePostLoginNavigatePath(search)).toBe('/auth/recovery?redirect=/admin');
  });

  it('rechaza un callback de recuperación externo', () => {
    expect(safePasswordRecoveryPathFromLoginRedirect('?redirect=https%3A%2F%2Fevil.test')).toBeNull();
  });
});
