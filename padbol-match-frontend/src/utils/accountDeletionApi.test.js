import {
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_DELETION_RECEIPT_STORAGE_KEY,
  accountDeletionErrorMessage,
  getStoredAccountDeletionReceipt,
  isValidAccountDeletionReceipt,
  normalizeAccountDeletionResponse,
  requestAccountDeletion,
} from './accountDeletionApi';

describe('accountDeletionApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('no envía la solicitud sin una sesión autenticada', async () => {
    await expect(requestAccountDeletion()).rejects.toThrow(/iniciar sesión/i);
  });

  it('envía confirmación explícita y no reintenta la operación destructiva', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        ok: true,
        status: 'pending',
        requested_at: '2026-09-07T12:00:00.000Z',
        request_id: 42,
        next_step: 'pending_retention_review',
      }),
    });

    await expect(requestAccountDeletion({ accessToken: 'token', source: 'web' })).resolves.toEqual({
      ok: true,
      status: 'pending',
      requestedAt: '2026-09-07T12:00:00.000Z',
      requestId: 42,
      nextStep: 'pending_retention_review',
      idempotent: false,
      message: '',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/legal\/eliminacion\/solicitudes$/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        body: expect.stringContaining(`\"confirmation\":\"${ACCOUNT_DELETION_CONFIRMATION}\"`),
      }),
    );
    expect(JSON.parse(localStorage.getItem(ACCOUNT_DELETION_RECEIPT_STORAGE_KEY))).toMatchObject({
      requestId: 42,
      status: 'pending',
    });
    expect(getStoredAccountDeletionReceipt()).toMatchObject({
      requestId: 42,
      requestedAt: '2026-09-07T12:00:00.000Z',
    });
  });

  it('normaliza la respuesta anterior sin afirmar que el borrado terminó', () => {
    expect(normalizeAccountDeletionResponse({
      request: { id: 7, estado: 'solicitada', solicitado_at: '2026-09-07T13:00:00.000Z' },
      next_step: 'pending_retention_review',
    })).toEqual({
      ok: true,
      status: 'pending',
      requestedAt: '2026-09-07T13:00:00.000Z',
      requestId: 7,
      nextStep: 'pending_retention_review',
      idempotent: false,
      message: '',
    });
  });

  it('prioriza el error seguro informado por el backend', () => {
    expect(accountDeletionErrorMessage({ error: 'Solicitud no disponible.' }, 503)).toBe(
      'Solicitud no disponible.',
    );
  });

  it('rechaza respuestas 2xx sin comprobante verificable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ ok: true, status: 'pending' }),
    });

    await expect(requestAccountDeletion({ accessToken: 'token' })).rejects.toThrow(/comprobante válido/i);
    expect(isValidAccountDeletionReceipt(normalizeAccountDeletionResponse({ ok: true }))).toBe(false);
    expect(localStorage.getItem(ACCOUNT_DELETION_RECEIPT_STORAGE_KEY)).toBeNull();
  });

  it('recupera un comprobante guardado en camelCase', () => {
    localStorage.setItem(ACCOUNT_DELETION_RECEIPT_STORAGE_KEY, JSON.stringify({
      ok: true,
      status: 'pending',
      requestedAt: '2026-09-07T12:00:00.000Z',
      requestId: 'req-9',
      nextStep: 'pending_retention_review',
    }));
    expect(getStoredAccountDeletionReceipt()).toMatchObject({
      requestId: 'req-9',
      requestedAt: '2026-09-07T12:00:00.000Z',
    });
  });
});
