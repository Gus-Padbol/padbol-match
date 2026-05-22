/** Campos de profesor visibles para jugadores (nunca incluir whatsapp ni datos admin). */
const PROFESOR_PUBLIC_KEYS = ['id', 'nombre', 'foto_url', 'bio', 'deportes', 'certificado_fipa'];

/**
 * Devuelve solo la forma pública de un profesor (descarta whatsapp y cualquier campo extra del API).
 * @param {Record<string, unknown>|null|undefined} row
 */
export function stripProfesorPublic(row) {
  if (!row || typeof row !== 'object') return null;
  const nombre =
    [String(row.nombre || '').trim(), String(row.apellido || '').trim()].filter(Boolean).join(' ').trim() ||
    String(row.nombre || '').trim() ||
    '';
  const out = {
    id: row.id,
    nombre,
    foto_url: row.foto_url ?? null,
    bio: row.bio ?? null,
    deportes: Array.isArray(row.deportes) ? row.deportes : [],
    certificado_fipa: Boolean(row.certificado_fipa),
  };
  return Object.fromEntries(PROFESOR_PUBLIC_KEYS.map((k) => [k, out[k]]));
}

/**
 * Sanitiza una clase del API público: profesor sin whatsapp y sin join crudo `profesores`.
 * @param {Record<string, unknown>|null|undefined} clase
 */
export function stripClasePublic(clase) {
  if (!clase || typeof clase !== 'object') return clase;
  const { profesores, profesor, whatsapp: _wa, ...rest } = clase;
  const prof = stripProfesorPublic(profesor || profesores);
  return { ...rest, ...(prof ? { profesor: prof } : {}) };
}
