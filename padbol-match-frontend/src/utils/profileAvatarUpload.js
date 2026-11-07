import { profileAvatarPath } from './profileAvatarPath';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Uploads a new avatar object. INSERT-only: no upsert, no SELECT/UPDATE.
 * The caller must pass the authenticated session UUID; a different folder is rejected
 * locally and, if it ever reached storage, the deployed RLS policy would deny it.
 */
export async function uploadProfileAvatar({ storage, bucket = 'avatars', userId, authUserId = userId, file }) {
  if (!authUserId || String(authUserId) !== String(userId)) {
    return { error: { message: 'No autorizado para escribir en la carpeta de otro usuario.' } };
  }
  if (!file || !String(file.type || '').startsWith('image/')) {
    return { error: { message: 'Selecciona un archivo de imagen válido.' } };
  }
  if (Number(file.size) > MAX_AVATAR_BYTES) {
    return { error: { message: 'La imagen supera el límite de 2 MB.' } };
  }
  const path = profileAvatarPath(userId, file.name);
  const { error } = await storage.from(bucket).upload(path, file, {
    contentType: file.type || 'image/jpeg',
  });
  if (error) return { error };
  const { data } = storage.from(bucket).getPublicUrl(path);
  const publicUrl = data?.publicUrl || '';
  if (!publicUrl) return { error: { message: 'No se pudo obtener la URL pública del avatar.' } };
  return { path, publicUrl };
}
