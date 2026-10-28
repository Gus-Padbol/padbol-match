/** The avatars bucket grants writes only beneath the authenticated UUID. */
export function profileAvatarPath(userId, filename, timestamp = Date.now()) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ''))) {
    throw new Error('Sesión de usuario inválida. Vuelve a ingresar.');
  }
  const candidate = String(filename || '').split('.').pop().toLowerCase();
  const extension = ['jpg','jpeg','png','webp','gif'].includes(candidate) ? candidate : 'jpg';
  return `${userId}/${timestamp}.${extension}`;
}
