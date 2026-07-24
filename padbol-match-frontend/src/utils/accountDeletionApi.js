const API_BASE_URL =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

export const ACCOUNT_DELETION_CONFIRMATION = 'ELIMINAR';

export function accountDeletionErrorMessage(payload, status) {
  const serverMessage = String(payload?.error || payload?.message || '').trim();
  if (serverMessage) return serverMessage;
  if (status === 401) return 'Tu sesión venció. Volvé a ingresar antes de solicitar la eliminación.';
  if (status === 503) return 'La eliminación de cuenta todavía no está disponible. Intentá nuevamente más tarde.';
  return 'No pudimos registrar la solicitud. Intentá nuevamente.';
}

export async function requestAccountDeletion({ accessToken, source = 'web', signal } = {}) {
  const token = String(accessToken || '').trim();
  if (!token) throw new Error('Necesitás iniciar sesión para eliminar tu cuenta.');

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/usuarios/eliminacion-cuenta`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
        source,
      }),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error('No pudimos conectarnos para registrar la solicitud. Revisá tu conexión e intentá nuevamente.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(accountDeletionErrorMessage(payload, response.status));
  return payload;
}
