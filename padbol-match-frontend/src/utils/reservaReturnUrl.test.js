import {
  getPostLoginReservaPath,
  resolvePostLoginNavigatePath,
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
});
