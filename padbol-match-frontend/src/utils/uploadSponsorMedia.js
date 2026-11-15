import { getApiBaseUrl } from './apiPublicBaseUrl';

// Super Admin uses the existing authenticated editorial uploader. Direct Storage
// writes are intentionally denied by RLS; never broaden those policies to upload.
export async function uploadSponsorMedia(file, token) {
  if (!token) throw new Error('Iniciá sesión para subir la imagen.');
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${getApiBaseUrl()}/api/admin/content/media`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo subir la imagen.');
  if (!/^https:\/\//.test(data.url || '')) throw new Error('La imagen no tiene una dirección pública válida.');
  return data.url;
}
