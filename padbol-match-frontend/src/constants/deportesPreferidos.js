/** Claves alineadas con `canchas.deporte` / chat IA (`TORNEO_DEPORTE_VALID` en server). */
export const DEPORTES_PREFERIDOS_OPCIONES = [
  { key: 'padbol', label: 'Padbol' },
  { key: 'padel', label: 'Pádel' },
  { key: 'tenis', label: 'Tenis' },
  { key: 'pickleball', label: 'Pickleball' },
];

const KEYS = new Set(DEPORTES_PREFERIDOS_OPCIONES.map((o) => o.key));

/** @param {unknown} raw */
export function normalizeDeportesPreferidosArray(raw) {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const k = String(x || '')
      .trim()
      .toLowerCase();
    if (!KEYS.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** True si el jugador tiene al menos un deporte preferido (trata null, undefined, [] y arrays con solo valores inválidos). */
export function hasDeportesPreferidosCargados(raw) {
  return normalizeDeportesPreferidosArray(raw).length > 0;
}
