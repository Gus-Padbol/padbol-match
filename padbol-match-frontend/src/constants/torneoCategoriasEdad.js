/**
 * Categorías por edad / programa de Padbol Match — fuente única de UI.
 *
 * Modelo (dos ejes independientes):
 *
 * 1) EJE EDAD / PROGRAMA (`torneos.categoria_edad`):
 *    - `u13` | `u15` | `u17` → programa **FIPA Next Generation** (exclusivo del circuito juvenil).
 *    - `open`                → **Adultos / Open** (Padbol).
 *    - `master_50`           → división especial **+50**, opcional. NO reemplaza el nivel deportivo.
 *    - `sub_18`, `master_40` → legado histórico: válidos para lectura/edición, no se ofrecen en altas nuevas.
 *
 * 2) EJE NIVEL DEPORTIVO (`jugadores_perfil.nivel`, `torneos.categoria`):
 *    Principiante · 6ta · 5ta · 4ta · 3ra · 2da · 1ra · Elite
 *    (ver `src/constants/jugadorCategoria.js` y `src/constants/torneoCategoria.js`).
 *
 * Next Generation NO es una marca nueva para adultos: es solo U13/U15/U17.
 * Espejo backend: `padbol-backend/lib/torneoCategoriasEdad.js` (mantener en sincronía).
 */

export const CATEGORIA_EDAD_KIND = Object.freeze({
  JUVENIL: 'juvenil',
  ADULTA: 'adulta',
  DIVISION_ESPECIAL: 'division_especial',
  LEGADO: 'legado',
});

export const PROGRAMA_NEXT_GENERATION = 'next_generation';
export const PROGRAMA_PADBOL = 'padbol';

/** @typedef {Object} CategoriaEdadDef */
export const TORNEO_CATEGORIAS_EDAD = Object.freeze([
  { value: 'u13', kind: CATEGORIA_EDAD_KIND.JUVENIL, programa: PROGRAMA_NEXT_GENERATION, nextGeneration: true, minAge: null, maxAge: 13, ofrecida: true, opcional: false, labelEs: 'U13', labelEn: 'U13' },
  { value: 'u15', kind: CATEGORIA_EDAD_KIND.JUVENIL, programa: PROGRAMA_NEXT_GENERATION, nextGeneration: true, minAge: null, maxAge: 15, ofrecida: true, opcional: false, labelEs: 'U15', labelEn: 'U15' },
  { value: 'u17', kind: CATEGORIA_EDAD_KIND.JUVENIL, programa: PROGRAMA_NEXT_GENERATION, nextGeneration: true, minAge: null, maxAge: 17, ofrecida: true, opcional: false, labelEs: 'U17', labelEn: 'U17' },
  { value: 'open', kind: CATEGORIA_EDAD_KIND.ADULTA, programa: PROGRAMA_PADBOL, nextGeneration: false, minAge: null, maxAge: null, ofrecida: true, opcional: false, labelEs: 'Adultos / Open', labelEn: 'Adults / Open' },
  { value: 'master_50', kind: CATEGORIA_EDAD_KIND.DIVISION_ESPECIAL, programa: PROGRAMA_PADBOL, nextGeneration: false, minAge: 50, maxAge: null, ofrecida: true, opcional: true, labelEs: '+50 (división especial)', labelEn: '50+ (special division)' },
  // Legado: compatibilidad con torneos históricos.
  { value: 'sub_18', kind: CATEGORIA_EDAD_KIND.LEGADO, programa: PROGRAMA_PADBOL, nextGeneration: false, minAge: null, maxAge: 18, ofrecida: false, opcional: false, labelEs: 'Sub 18 (legado)', labelEn: 'Under 18 (legacy)' },
  { value: 'master_40', kind: CATEGORIA_EDAD_KIND.LEGADO, programa: PROGRAMA_PADBOL, nextGeneration: false, minAge: 40, maxAge: null, ofrecida: false, opcional: false, labelEs: 'Máster +40 (legado)', labelEn: 'Masters 40+ (legacy)' },
]);

export const TORNEO_CATEGORIA_EDAD_VALORES = Object.freeze(TORNEO_CATEGORIAS_EDAD.map((c) => c.value));

export const TORNEO_CATEGORIA_EDAD_JUVENIL = Object.freeze(
  TORNEO_CATEGORIAS_EDAD.filter((c) => c.kind === CATEGORIA_EDAD_KIND.JUVENIL).map((c) => c.value),
);

/** Categorías adultas principales del programa Padbol (sin divisiones especiales). */
export const TORNEO_CATEGORIA_EDAD_ADULTA = Object.freeze(
  TORNEO_CATEGORIAS_EDAD.filter((c) => c.kind === CATEGORIA_EDAD_KIND.ADULTA).map((c) => c.value),
);

/** Divisiones especiales opcionales (no sustituyen el nivel deportivo). */
export const TORNEO_CATEGORIA_EDAD_DIVISION_ESPECIAL = Object.freeze(
  TORNEO_CATEGORIAS_EDAD.filter((c) => c.kind === CATEGORIA_EDAD_KIND.DIVISION_ESPECIAL).map((c) => c.value),
);

export const TORNEO_CATEGORIA_EDAD_LEGADO = Object.freeze(
  TORNEO_CATEGORIAS_EDAD.filter((c) => c.kind === CATEGORIA_EDAD_KIND.LEGADO).map((c) => c.value),
);

/** Agrupación para selects jerárquicos. */
export const TORNEO_CATEGORIA_EDAD_GROUPS = Object.freeze([
  { key: 'nextGeneration', kind: CATEGORIA_EDAD_KIND.JUVENIL, options: TORNEO_CATEGORIAS_EDAD.filter((c) => c.kind === CATEGORIA_EDAD_KIND.JUVENIL) },
  { key: 'padbol', kind: CATEGORIA_EDAD_KIND.ADULTA, options: TORNEO_CATEGORIAS_EDAD.filter((c) => c.kind === CATEGORIA_EDAD_KIND.ADULTA) },
  { key: 'divisionEspecial', kind: CATEGORIA_EDAD_KIND.DIVISION_ESPECIAL, options: TORNEO_CATEGORIAS_EDAD.filter((c) => c.kind === CATEGORIA_EDAD_KIND.DIVISION_ESPECIAL) },
  { key: 'legado', kind: CATEGORIA_EDAD_KIND.LEGADO, options: TORNEO_CATEGORIAS_EDAD.filter((c) => c.kind === CATEGORIA_EDAD_KIND.LEGADO) },
]);

const BY_VALUE = new Map(TORNEO_CATEGORIAS_EDAD.map((c) => [c.value, c]));

export function normalizeCategoriaEdad(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return BY_VALUE.has(s) ? s : null;
}

export function getCategoriaEdad(value) {
  const s = normalizeCategoriaEdad(value);
  return s ? BY_VALUE.get(s) : null;
}

export function isCategoriaEdadValida(value) {
  return normalizeCategoriaEdad(value) !== null;
}

export function esCategoriaJuvenil(value) {
  return getCategoriaEdad(value)?.kind === CATEGORIA_EDAD_KIND.JUVENIL;
}

export function esCategoriaAdulta(value) {
  return getCategoriaEdad(value)?.kind === CATEGORIA_EDAD_KIND.ADULTA;
}

export function esDivisionEspecial(value) {
  return getCategoriaEdad(value)?.kind === CATEGORIA_EDAD_KIND.DIVISION_ESPECIAL;
}

export function esCategoriaLegado(value) {
  return getCategoriaEdad(value)?.kind === CATEGORIA_EDAD_KIND.LEGADO;
}

/** Categorías que se ofrecen en altas nuevas (excluye legado histórico). */
export function categoriasEdadOfrecidas() {
  return TORNEO_CATEGORIAS_EDAD.filter((c) => c.ofrecida);
}

/** Programa al que pertenece una competencia: `next_generation` | `padbol`. */
export function programaDeCategoria(value) {
  return getCategoriaEdad(value)?.programa ?? PROGRAMA_PADBOL;
}

/** ¿La competencia pertenece al programa FIPA Next Generation? */
export function esTorneoNextGeneration(torneo) {
  if (!torneo || typeof torneo !== 'object') return false;
  if (String(torneo.programa ?? '').trim().toLowerCase() === PROGRAMA_NEXT_GENERATION) return true;
  return esCategoriaJuvenil(torneo.categoria_edad);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDateUtc(value) {
  const m = ISO_DATE.exec(String(value ?? '').trim());
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/**
 * Edad cumplida en la fecha de corte (por defecto hoy).
 * @param {string} birthDate fecha ISO `YYYY-MM-DD`
 * @param {string|Date} [cutoffDate] fecha de corte de la competencia
 * @returns {number|null}
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

/** Categoría juvenil que corresponde a la edad (o null si supera U17). */
export function categoriaJuvenilParaEdad(age) {
  if (age == null || !Number.isFinite(age)) return null;
  if (age <= 13) return 'u13';
  if (age <= 15) return 'u15';
  if (age <= 17) return 'u17';
  return null;
}

/** ¿La fecha de nacimiento es elegible para esa categoría en la fecha de corte? */
export function esNacimientoElegibleParaCategoria(categoria, birthDate, cutoffDate) {
  const v = normalizeCategoriaEdad(categoria);
  if (!v) return false;
  const age = edadEnFechaCorte(birthDate, cutoffDate);
  if (age == null) return false;
  if (TORNEO_CATEGORIA_EDAD_JUVENIL.includes(v)) return categoriaJuvenilParaEdad(age) === v;
  if (v === 'open') return true;
  if (v === 'master_50') return age >= 50;
  if (v === 'master_40') return age >= 40;
  if (v === 'sub_18') return age < 18;
  return false;
}

/**
 * Categorías candidatas para una fecha de nacimiento (juveniles + adultas + especiales aplicables).
 * Un jugador +50 puede además tener cualquier nivel deportivo: la división no lo reemplaza.
 */
export function categoriasElegiblesParaNacimiento(birthDate, cutoffDate) {
  return TORNEO_CATEGORIAS_EDAD.filter(
    (c) => c.ofrecida && esNacimientoElegibleParaCategoria(c.value, birthDate, cutoffDate),
  );
}
