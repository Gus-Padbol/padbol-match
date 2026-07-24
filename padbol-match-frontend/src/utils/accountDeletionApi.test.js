import {
  ACCOUNT_DELETION_CONFIRMATION,
  accountDeletionErrorMessage,
  requestAccountDeletion,
} from './accountDeletionApi';

describe('accountDeletionApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('no envía la solicitud sin una sesión autenticada', async () => {
    await expect(requestAccountDeletion()).rejects.toThrow(/iniciar sesión/i);
  });

  it('envía confirmación explícita y no reintenta la operación destructiva', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ ok: true, status: 'pending' }),
    });

    await expect(requestAccountDeletion({ accessToken: 'token', source: 'web' })).resolves.toEqual({
      ok: true,
      status: 'pending',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/usuarios\/eliminacion-cuenta$/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        body: JSON.stringify({ confirmation: ACCOUNT_DELETION_CONFIRMATION, source: 'web' }),
      }),
    );
  });

  it('prioriza el error seguro informado por el backend', () => {
    expect(accountDeletionErrorMessage({ error: 'Solicitud no disponible.' }, 503)).toBe(
      'Solicitud no disponible.',
    );
  });
});
