function normalizedTarget(target) {
  if (target?.kind === 'deporte') {
    const deporte = String(target.deporte || '').trim().toLowerCase();
    const card_key = String(target.card_key || target.cardKey || '').trim();
    if (!deporte || !card_key) throw new Error('Tarjeta de deporte inválida');
    return {kind: 'deporte', deporte, card_key};
  }
  if (['legacy', 'inicio'].includes(target?.kind) && target.id) return {kind: target.kind, id: String(target.id)};
  throw new Error('Tarjeta inválida');
}

async function responseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.code === 'SOURCE_NOT_AVAILABLE'
      ? 'Esta foto no conserva el original. Elige la foto original para poder acomodarla de nuevo.'
      : data.code === 'HUB_IMAGE_CHANGED' ? 'La foto cambió mientras la editabas. Cierra el editor y actualiza la tarjeta antes de continuar.' : data.error || 'No se pudo abrir o guardar el original de la foto.');
    error.code = data.code || `HTTP_${response.status}`;
    throw error;
  }
  return data;
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function authenticated(accessToken) {
  if (!accessToken) throw new Error('Inicia sesión para editar la foto.');
  return {Authorization: `Bearer ${accessToken}`};
}

export async function fetchHubPhotoSource({apiBaseUrl, accessToken, target, expectedImageUrl, fetchImpl = fetch}) {
  const headers = authenticated(accessToken);
  const normalized = normalizedTarget(target);
  const query = new URLSearchParams(normalized);
  const base = String(apiBaseUrl || '').replace(/\/$/, '');
  const data = await responseJson(await fetchImpl(`${base}/api/admin/hub-images/source?${query}`, {headers, cache: 'no-store'}));
  if (!uuid.test(String(data.source_id || '')) || data.original_url !== `/api/admin/hub-images/source/${data.source_id}/original`) throw new Error('El servidor no devolvió un original válido.');
  if (expectedImageUrl && data.image_url !== expectedImageUrl) throw new Error('La foto cambió. Actualiza la tarjeta antes de editarla.');
  const originalResponse = await fetchImpl(`${base}${data.original_url}`, {headers, cache: 'no-store'});
  if (!originalResponse.ok) throw new Error('No se pudo recuperar la foto original. Puedes volver a elegir su archivo.');
  const original = await originalResponse.blob();
  if (!original.size || !String(original.type).startsWith('image/')) throw new Error('El original recibido no es una imagen.');
  return {sourceId: data.source_id, imageUrl: data.image_url, frame: data.frame || null, original, originalInfo: data.original};
}

export async function saveHubPhotoEdit({apiBaseUrl, accessToken, target, photo, original, sourceId, frame, expectedImageUrl = null, fetchImpl = fetch}) {
  const headers = authenticated(accessToken);
  const normalized = normalizedTarget(target);
  const pixels = frame?.pixels;
  if (!pixels || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(pixels[key])) || pixels.width <= 0 || pixels.height <= 0) throw new Error('Acomoda la foto antes de guardar.');
  if (photo?.size > 2 * 1024 * 1024) throw new Error('El encuadre supera 2 MB. Reduce el tamaño de la foto.');
  if (original?.size > 10 * 1024 * 1024) throw new Error('La foto original supera 10 MB.');
  if (!photo || !['image/jpeg', 'image/png', 'image/webp'].includes(String(photo.type))) throw new Error('El encuadre no es una imagen.');
  if (sourceId ? !uuid.test(String(sourceId)) : !original || !String(original.type).startsWith('image/')) throw new Error('Selecciona el original antes de guardar.');
  const body = new FormData();
  body.append('target', JSON.stringify(normalized));
  body.append('frame', JSON.stringify(frame));
  body.append('expected_image_url', JSON.stringify(expectedImageUrl));
  body.append('foto', photo);
  if (sourceId) body.append('source_id', sourceId);
  else body.append('original', original);
  const base = String(apiBaseUrl || '').replace(/\/$/, '');
  const data = await responseJson(await fetchImpl(`${base}/api/admin/hub-images/edit`, {method: 'POST', headers, body}));
  if (!uuid.test(String(data.source_id || '')) || !String(data.image_url || '').startsWith('https://') || !data.row) throw new Error('No se pudo verificar que se conservaron el original y el encuadre.');
  if (normalized.kind === 'deporte'
    ? data.row.deporte !== normalized.deporte || data.row.card_key !== normalized.card_key
    : String(data.row.id) !== normalized.id) throw new Error('El servidor devolvió otra tarjeta. Actualiza antes de continuar.');
  return data;
}
