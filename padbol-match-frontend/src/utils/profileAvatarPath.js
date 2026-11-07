/** The avatars bucket grants writes only beneath the authenticated UUID. */
function randomNonce() {
  try {
    const cryptoApi = typeof window !== 'undefined' ? window.crypto : null;
    if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function profileAvatarPath(userId, filename, timestamp = Date.now(), nonce = randomNonce()) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ''))) {
    throw new Error('Sesión de usuario inválida. Vuelve a ingresar.');
  }
  const candidate = String(filename || '').split('.').pop().toLowerCase();
  const extension = ['jpg','jpeg','png','webp','gif'].includes(candidate) ? candidate : 'jpg';
  return `${userId}/avatar-${timestamp}-${String(nonce).replace(/[^a-zA-Z0-9-]/g, '')}.${extension}`;
}
