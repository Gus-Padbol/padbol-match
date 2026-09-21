export const CREDITS_REQUEST_ERROR = Object.freeze({
  UNAUTHORIZED: 'unauthorized',
  UNAVAILABLE: 'unavailable',
});

export class CreditsRequestError extends Error {
  constructor(message, { code, status = null } = {}) {
    super(message);
    this.name = 'CreditsRequestError';
    this.code = code;
    this.status = status;
  }
}

function creditsError(status) {
  if (status === 401) {
    return new CreditsRequestError('La sesión ya no autoriza la consulta de créditos.', {
      code: CREDITS_REQUEST_ERROR.UNAUTHORIZED,
      status,
    });
  }
  return new CreditsRequestError('No se pudieron consultar los créditos.', {
    code: CREDITS_REQUEST_ERROR.UNAVAILABLE,
    status,
  });
}

export async function fetchAccountCredits({ apiBaseUrl, email, accessToken, signal, fetchImpl } = {}) {
  const ownerEmail = String(email || '').trim();
  const token = String(accessToken || '').trim();
  const baseUrl = String(apiBaseUrl || '').replace(/\/$/, '');

  if (!ownerEmail || !token || !baseUrl) throw creditsError(401);

  const request = fetchImpl || fetch;
  let response;
  try {
    response = await request(`${baseUrl}/api/creditos/${encodeURIComponent(ownerEmail)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw creditsError(null);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw creditsError(response.status);

  const parsedTotal = Number(payload?.total);
  return {
    total: Number.isFinite(parsedTotal) ? parsedTotal : 0,
    creditos: Array.isArray(payload?.creditos) ? payload.creditos : [],
  };
}
