/**
 * Parsea respuesta fetch solo si es JSON válido (evita "Unexpected token <" con HTML de error/SPA).
 * @returns {{ ok: boolean; data: unknown; isJson: boolean }}
 */
export async function parseFetchJsonSafe(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!response.ok || !contentType.includes('application/json')) {
    return { ok: false, data: null, isJson: false };
  }
  try {
    const data = await response.json();
    return { ok: response.ok, data, isJson: true };
  } catch {
    return { ok: false, data: null, isJson: false };
  }
}
