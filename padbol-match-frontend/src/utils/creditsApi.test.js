import {
  CREDITS_REQUEST_ERROR,
  CreditsRequestError,
  fetchAccountCredits,
} from './creditsApi';

describe('creditsApi', () => {
  it('consulta los créditos con el Bearer de la sesión autenticada', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ total: '1250', creditos: [{ id: 7 }] }),
    });

    await expect(fetchAccountCredits({
      apiBaseUrl: 'https://api.example.test/',
      email: 'jugador+prueba@example.com',
      accessToken: 'session-token',
      fetchImpl,
    })).resolves.toEqual({ total: 1250, creditos: [{ id: 7 }] });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.test/api/creditos/jugador%2Bprueba%40example.com',
      {
        headers: { Authorization: 'Bearer session-token' },
        signal: undefined,
      },
    );
  });

  it('convierte un 401 en un error explícito, no en un saldo vacío', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'No autorizado' }),
    });

    const promise = fetchAccountCredits({
      apiBaseUrl: 'https://api.example.test',
      email: 'privado@example.com',
      accessToken: 'expired-token',
      fetchImpl,
    });

    await expect(promise).rejects.toMatchObject({
      name: 'CreditsRequestError',
      code: CREDITS_REQUEST_ERROR.UNAUTHORIZED,
      status: 401,
    });
    await expect(promise).rejects.toBeInstanceOf(CreditsRequestError);
  });

  it('no hace la consulta sin token y no registra el correo en consola', async () => {
    const fetchImpl = jest.fn();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(fetchAccountCredits({
      apiBaseUrl: 'https://api.example.test',
      email: 'privado@example.com',
      fetchImpl,
    })).rejects.toMatchObject({ code: CREDITS_REQUEST_ERROR.UNAUTHORIZED });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
