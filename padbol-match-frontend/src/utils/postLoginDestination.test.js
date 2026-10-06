import { resolveRoleAwarePostLoginPath } from './postLoginDestination';

describe('resolveRoleAwarePostLoginPath', () => {
  const session = { access_token: 'token' };

  test('envia un admin_club directamente al panel cuando entra sin destino', async () => {
    await expect(
      resolveRoleAwarePostLoginPath('/', session, async () => ({ rol: 'admin_club' })),
    ).resolves.toBe('/admin');
  });

  test('envia un usuario común al sitio público cuando entra sin destino', async () => {
    await expect(
      resolveRoleAwarePostLoginPath('/', session, async () => ({ rol: 'jugador' })),
    ).resolves.toBe('/plataforma');
  });

  test.each(['super_admin', 'admin_nacional', 'admin_cadena', 'admin_club', 'empleado', 'editor_contenido'])(
    'reconoce el rol administrativo %s al entrar desde la web pública',
    async (rol) => {
      await expect(
        resolveRoleAwarePostLoginPath('/', session, async () => ({ rol })),
      ).resolves.toBe('/admin');
    },
  );

  test('normaliza variantes heredadas del rol admin_club', async () => {
    await expect(
      resolveRoleAwarePostLoginPath('/', session, async () => ({ rol: 'Admin Club' })),
    ).resolves.toBe('/admin');
  });

  test('sin sesión utilizable vuelve al sitio público', async () => {
    const fetcher = jest.fn();
    await expect(resolveRoleAwarePostLoginPath('/', null, fetcher)).resolves.toBe('/plataforma');
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('conserva un destino explícito sin consultar el rol', async () => {
    const fetcher = jest.fn();
    await expect(resolveRoleAwarePostLoginPath('/reservar?sedeId=1', session, fetcher))
      .resolves.toBe('/reservar?sedeId=1');
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('si falla la consulta no expone el antiguo hub web', async () => {
    await expect(
      resolveRoleAwarePostLoginPath('/', session, async () => { throw new Error('offline'); }),
    ).resolves.toBe('/plataforma');
  });
});
