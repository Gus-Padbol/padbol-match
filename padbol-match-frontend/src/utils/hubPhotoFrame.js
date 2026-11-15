/** Geometry of the installed 1.0.2 (build 78, source 257a357) Signature cards.
 * The same editorial photo is used in Home AND Jugar. The image viewport
 * excludes the card's border and Home's 14px offset, not just screen padding.
 */
export function hubPhotoFrames({width, height, topInset = 0, bottomInset = 0, isGuest = false}) {
  const w = Number(width), h = Number(height);
  const top = Number(topInset), bottom = Number(bottomInset);
  if (![w, h, top, bottom].every(Number.isFinite) || w <= 48 || h <= 0 || top < 0 || bottom < 0) throw new Error('Tamaño de pantalla inválido');
  const cardHeight = Math.min(210, Math.floor((h - 40 - 36 - 32 - 56 - top - bottom - 40 - (isGuest ? 52 : 0) - 8 - 48) / 5));
  if (cardHeight <= 2) throw new Error('La pantalla no tiene espacio para las tarjetas');
  return [
    {id: 'inicio', label: 'Inicio', width: w - 32 - 14 - 2, height: cardHeight - 2},
    {id: 'jugar', label: 'Jugar', width: w - 32 - 3, height: 160 - 1.5},
  ];
}

/** Rectangle retained by a centered resizeMode=cover; source pixels stay unchanged. */
export function centeredCoverWindow(imageWidth, imageHeight, frame) {
  const target = frame.width / frame.height;
  const source = imageWidth / imageHeight;
  if (source > target) {
    const width = imageHeight * target;
    return {x: (imageWidth - width) / 2, y: 0, width, height: imageHeight};
  }
  const height = imageWidth / target;
  return {x: 0, y: (imageHeight - height) / 2, width: imageWidth, height};
}

/** Intersection visible in every target frame: use it as the editor's safe area. */
export function hubPhotoSafeArea(imageWidth, imageHeight, frames) {
  const windows = frames.map(frame => centeredCoverWindow(imageWidth, imageHeight, frame));
  const x = Math.max(...windows.map(rect => rect.x));
  const y = Math.max(...windows.map(rect => rect.y));
  const right = Math.min(...windows.map(rect => rect.x + rect.width));
  const bottom = Math.min(...windows.map(rect => rect.y + rect.height));
  return {x, y, width: right - x, height: bottom - y};
}
