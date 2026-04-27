/**
 * Carga una imagen (URL blob o http) para dibujar en canvas.
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
export function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (err) => reject(err));
    if (String(url).startsWith('http://') || String(url).startsWith('https://')) {
      image.crossOrigin = 'anonymous';
    }
    image.src = url;
  });
}

/**
 * Recorta la región en píxeles (como devuelve react-easy-crop en onCropComplete) y devuelve un Blob.
 * @param {string} imageSrc
 * @param {{ x: number; y: number; width: number; height: number }} pixelCrop
 * @param {string} [mimeType]
 * @param {number} [quality]
 * @returns {Promise<Blob>}
 */
export async function getCroppedImgBlob(imageSrc, pixelCrop, mimeType = 'image/jpeg', quality = 0.92) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');

  const w = Math.max(1, Math.round(pixelCrop.width));
  const h = Math.max(1, Math.round(pixelCrop.height));
  canvas.width = w;
  canvas.height = h;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    w,
    h
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('No se pudo generar la imagen recortada'));
        else resolve(blob);
      },
      mimeType,
      quality
    );
  });
}
