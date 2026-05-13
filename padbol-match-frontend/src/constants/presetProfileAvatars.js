/** URLs data:image/svg+xml para avatares predeterminados en Mi perfil (sin assets externos). */
function svgAvatarDataUrl(innerShapes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${innerShapes}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const PRESET_PROFILE_AVATAR_URLS = [
  svgAvatarDataUrl(
    '<defs><linearGradient id="g0" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E11B22"/><stop offset="100%" stop-color="#b91c1c"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="url(#g0)"/><text x="50" y="62" text-anchor="middle" font-size="44" dominant-baseline="middle">🎾</text>'
  ),
  svgAvatarDataUrl(
    '<circle cx="50" cy="50" r="48" fill="#0d9488"/><text x="50" y="62" text-anchor="middle" font-size="44" dominant-baseline="middle">🏃</text>'
  ),
  svgAvatarDataUrl(
    '<circle cx="50" cy="50" r="48" fill="#ea580c"/><text x="50" y="62" text-anchor="middle" font-size="44" dominant-baseline="middle">🔥</text>'
  ),
  svgAvatarDataUrl(
    '<circle cx="50" cy="50" r="48" fill="#dc2626"/><text x="50" y="62" text-anchor="middle" font-size="40" dominant-baseline="middle">⭐</text>'
  ),
  svgAvatarDataUrl(
    '<circle cx="50" cy="50" r="48" fill="#2563eb"/><text x="50" y="62" text-anchor="middle" font-size="44" dominant-baseline="middle">🎯</text>'
  ),
  svgAvatarDataUrl(
    '<circle cx="50" cy="50" r="48" fill="#db2777"/><text x="50" y="62" text-anchor="middle" font-size="44" dominant-baseline="middle">💪</text>'
  ),
  svgAvatarDataUrl(
    '<circle cx="50" cy="50" r="48" fill="#ca8a04"/><text x="50" y="62" text-anchor="middle" font-size="44" dominant-baseline="middle">🏆</text>'
  ),
  svgAvatarDataUrl(
    '<circle cx="50" cy="50" r="48" fill="#4b5563"/><circle cx="50" cy="38" r="16" fill="#f9fafb"/><path d="M22 88c8-22 48-22 56 0" fill="#f9fafb"/>'
  ),
  svgAvatarDataUrl(
    '<defs><linearGradient id="g1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0369a1"/></linearGradient></defs><rect x="4" y="4" width="92" height="92" rx="20" fill="url(#g1)"/><text x="50" y="62" text-anchor="middle" font-size="40" dominant-baseline="middle">🌊</text>'
  ),
  svgAvatarDataUrl(
    '<circle cx="50" cy="50" r="48" fill="#16a34a"/><text x="50" y="62" text-anchor="middle" font-size="44" dominant-baseline="middle">🌿</text>'
  ),
];
