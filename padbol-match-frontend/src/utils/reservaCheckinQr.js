export const CHECKIN_QR_BASE_URL = 'https://padbolmatch.com/checkin/validar';

export function buildCheckinQrUrl(qrToken) {
  const token = String(qrToken || '').trim();
  if (!token) return '';
  return `${CHECKIN_QR_BASE_URL}/${encodeURIComponent(token)}`;
}

export async function resolveReservaQrToken({ reservaId, existingToken, accessToken, apiBaseUrl }) {
  const existing = String(existingToken || '').trim();
  if (existing) return existing;

  const rid = parseInt(String(reservaId), 10);
  if (!Number.isFinite(rid)) {
    throw new Error('Reserva inválida');
  }
  if (!accessToken) {
    throw new Error('Inicia sesión para ver el QR');
  }

  const res = await fetch(`${apiBaseUrl}/api/reservas/${encodeURIComponent(rid)}/generar-qr`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'No se pudo generar el QR');
  }
  const token = String(body.qr_token || '').trim();
  if (!token) throw new Error('No se pudo generar el QR');
  return token;
}
