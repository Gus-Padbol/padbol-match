/**
 * Categorías por edad / programa de Padbol Match — fuente única backend.
 *
 * 1) EJE EDAD / PROGRAMA (`torneos.categoria_edad`):
 *    - `u13` | `u15` | `u17` → programa **FIPA Next Generation** (exclusivo del circuito juvenil).
 *    - `open`                → **Adultos / Open** (Padbol).
 *    - `master_50`           → división especial **+50**, opcional. No reemplaza el nivel deportivo.
 *    - `sub_18`, `master_40` → legado histórico (válidos para lectura/edición, no se ofrecen en altas nuevas).
 *
 * 2) EJE NIVEL DEPORTIVO (`jugadores_perfil.nivel`, `torneos.categoria`):
 *    Principiante · 6ta · 5ta · 4ta · 3ra · 2da · 1ra · Elite
 *    (frontend: `src/constants/jugadorCategoria.js`, `src/constants/torneoCategoria.js`)
 *
 * Las edades se calculan por fecha de nacimiento contra `torneos.fecha_corte_edad`
 * (si es NULL, se usa `fecha_inicio` y, en su defecto, la fecha actual).
 *
 * Convención juvenil: U13 => edad <= 13 | U15 => 14..15 | U17 => 16..17
 * Espejo UI: `padbol-match-frontend/src/constants/torneoCategoriasEdad.js` (mantener en sincronía).
 */

export const TORNEO_CATEGORIA_EDAD_JUVENIL = Object.freeze(['u13', 'u15', 'u17']);
export const TORNEO_CATEGORIA_EDAD_ADULTA = Object.freeze(['open']);
export const TORNEO_CATEGORIA_EDAD_DIVISION_ESPECIAL = Object.freeze(['master_50']);
export const TORNEO_CATEGORIA_EDAD_LEGADO = Object.freeze(['sub_18', 'master_40']);

export const TORNEO_CATEGORIA_EDAD_VALORES = Object.freeze([
  ...TORNEO_CATEGORIA_EDAD_JUVENIL,
  ...TORNEO_CATEGORIA_EDAD_ADULTA,
  ...TORNEO_CATEGORIA_EDAD_DIVISION_ESPECIAL,
  ...TORNEO_CATEGORIA_EDAD_LEGADO,
]);

/** Valores ofrecidos en altas nuevas (excluye legado histórico). */
export const TORNEO_CATEGORIA_EDAD_OFRECIDAS = Object.freeze([
  ...TORNEO_CATEGORIA_EDAD_JUVENIL,
  ...TORNEO_CATEGORIA_EDAD_ADULTA,
  ...TORNEO_CATEGORIA_EDAD_DIVISION_ESPECIAL,
]);

/** Valor de `torneos.programa` que marca una competencia del programa juvenil. */
export const TORNEO_PROGRAMA_NEXT_GENERATION = 'next_generation';
export const TORNEO_PROGRAMA_PADBOL = 'padbol';

/** Niveles deportivos válidos (eje independiente de la edad). */
export const NIVELES_DEPORTIVOS = Object.freeze([
  'Principiante',
  '6ta',
  '5ta',
  '4ta',
  '3ra',
  '2da',
  '1ra',
  'Elite',
]);

const VALID = new Set(TORNEO_CATEGORIA_EDAD_VALORES);
const VALID_NIVELES = new Set(NIVELES_DEPORTIVOS);

export function isTorneoCategoriaEdadValida(value) {
  return VALID.has(String(value ?? '').trim().toLowerCase());
}

/** Normaliza a un valor canónico; `null` si el valor no es válido. */
export function normalizeTorneoCategoriaEdad(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  return VALID.has(s) ? s : null;
}

export function esCategoriaJuvenilNextGeneration(value) {
  return TORNEO_CATEGORIA_EDAD_JUVENIL.includes(normalizeTorneoCategoriaEdad(value));
}

export function esCategoriaAdultaPadbol(value) {
  return TORNEO_CATEGORIA_EDAD_ADULTA.includes(normalizeTorneoCategoriaEdad(value));
}

export function esDivisionEspecial(value) {
  return TORNEO_CATEGORIA_EDAD_DIVISION_ESPECIAL.includes(normalizeTorneoCategoriaEdad(value));
}

export function esCategoriaLegado(value) {
  return TORNEO_CATEGORIA_EDAD_LEGADO.includes(normalizeTorneoCategoriaEdad(value));
}

/** Programa al que pertenece una competencia: `next_generation` | `padbol`. */
export function programaDeCategoria(value) {
  return esCategoriaJuvenilNextGeneration(value) ? TORNEO_PROGRAMA_NEXT_GENERATION : TORNEO_PROGRAMA_PADBOL;
}

/** ¿El nivel deportivo es válido? (incluye `6ta`, históricamente ausente en perfiles). */
export function isNivelDeportivoValido(value) {
  return VALID_NIVELES.has(String(value ?? '').trim());
}

/**
 * Normaliza `torneos.fecha_corte_edad` (ISO `YYYY-MM-DD`).
 * Vacío / inválido → null, que significa "usar fecha_inicio o la fecha actual".
 */
export function normalizeTorneoFechaCorteEdad(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return parseIsoDateUtc(s) ? s : null;
}

/**
 * Identifica una competencia Next Generation: por marca explícita (`programa`)
 * o, en su defecto, por ser una categoría juvenil oficial.
 */
export function torneoEsNextGeneration(torneo) {
  if (!torneo || typeof torneo !== 'object') return false;
  if (String(torneo.programa ?? '').trim().toLowerCase() === TORNEO_PROGRAMA_NEXT_GENERATION) return true;
  return esCategoriaJuvenilNextGeneration(torneo.categoria_edad);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Fecha ISO `YYYY-MM-DD` a Date UTC; `null` si es inválida. */
export function parseIsoDateUtc(value) {
  const m = ISO_DATE.exec(String(value ?? '').trim());
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/**
 * Edad cumplida en la fecha de corte. `null` si la fecha de nacimiento es inválida.
 * @param {string} birthDate fecha ISO de nacimiento
 * @param {string|Date} cutoffDate fecha de corte de la competencia (default: hoy)
 */
export function edadEnFechaCorte(birthDate, cutoffDate) {
  const b = parseIsoDateUtc(birthDate);
  if (!b) return null;
  const c = cutoffDate instanceof Date ? cutoffDate : parseIsoDateUtc(cutoffDate) || new Date();
  let age = c.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    c.getUTCMonth() < b.getUTCMonth() ||
    (c.getUTCMonth() === b.getUTCMonth() && c.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Categoría juvenil que corresponde a una edad (o `null` si supera U17). */
export function categoriaJuvenilParaEdad(age) {
  if (age == null || !Number.isFinite(age)) return null;
  if (age <= 13) return 'u13';
  if (age <= 15) return 'u15';
  if (age <= 17) return 'u17';
  return null;
}

/** ¿La fecha de nacimiento es elegible para la categoría en esa fecha de corte? */
export function esNacimientoElegibleParaCategoria(categoria, birthDate, cutoffDate) {
  const value = normalizeTorneoCategoriaEdad(categoria);
  if (!value) return false;
  const age = edadEnFechaCorte(birthDate, cutoffDate);
  if (age == null) return false;
  if (TORNEO_CATEGORIA_EDAD_JUVENIL.includes(value)) return categoriaJuvenilParaEdad(age) === value;
  if (value === 'open') return true;
  if (value === 'master_50') return age >= 50;
  if (value === 'master_40') return age >= 40;
  if (value === 'sub_18') return age < 18;
  return false;
}
