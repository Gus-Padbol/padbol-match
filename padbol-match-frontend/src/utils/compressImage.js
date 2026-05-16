import { createImage } from './cropImage';

/**
 * Redimensiona y comprime una imagen en el cliente (máx. lado en px, JPEG).
 * @param {File|Blob} file
 * @param {{ maxDimension?: number; quality?: number }} [opts]
 * @returns {Promise<Blob>}
 */
export async function compressImageFile(file, { maxDimension = 800, quality = 0.85 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const image = await createImage(url);
    let { width, height } = image;
    const maxSide = Math.max(width, height);
    if (maxSide > maxDimension) {
      const scale = maxDimension / maxSide;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    ctx.drawImage(image, 0, 0, width, height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error('No se pudo comprimir la imagen'));
          else resolve(blob);
        },
        'image/jpeg',
        quality,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
