/** Normaliza texto de país (sin emoji, sin tildes, minúsculas). */
export function normalizePaisText(raw) {
  return String(raw || '')
    .replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug i18n (`paises.<slug>`) a partir del valor guardado en sede / selector. */
export function paisRawToSlug(paisRaw) {
  const base = normalizePaisText(paisRaw);
  if (!base) return null;
  const compact = base.replace(/\s+/g, '');

  const aliases = {
    argentina: 'argentina',
    espana: 'espana',
    spain: 'espana',
    italia: 'italia',
    italy: 'italia',
    francia: 'francia',
    france: 'francia',
    alemania: 'alemania',
    germany: 'alemania',
    rumania: 'rumania',
    romania: 'rumania',
    austria: 'austria',
    estadosunidos: 'estados_unidos',
    usa: 'estados_unidos',
    eeuu: 'estados_unidos',
    'ee.uu.': 'estados_unidos',
    unitedstates: 'estados_unidos',
    brasil: 'brasil',
    brazil: 'brasil',
    uruguay: 'uruguay',
    chile: 'chile',
    colombia: 'colombia',
    mexico: 'mexico',
    australia: 'australia',
    belgica: 'belgica',
    belgium: 'belgica',
    bolivia: 'bolivia',
    canada: 'canada',
    china: 'china',
    croacia: 'croacia',
    croatia: 'croacia',
    ecuador: 'ecuador',
    grecia: 'grecia',
    greece: 'grecia',
    honduras: 'honduras',
    hungria: 'hungria',
    hungary: 'hungria',
    israel: 'israel',
    japon: 'japon',
    japan: 'japon',
    marruecos: 'marruecos',
    morocco: 'marruecos',
    noruega: 'noruega',
    norway: 'noruega',
    paisesbajos: 'paises_bajos',
    netherlands: 'paises_bajos',
    holanda: 'paises_bajos',
    paraguay: 'paraguay',
    peru: 'peru',
    polonia: 'polonia',
    poland: 'polonia',
    portugal: 'portugal',
    reinounido: 'reino_unido',
    unitedkingdom: 'reino_unido',
    uk: 'reino_unido',
    rusia: 'rusia',
    russia: 'rusia',
    serbia: 'serbia',
    suecia: 'suecia',
    sweden: 'suecia',
    suiza: 'suiza',
    switzerland: 'suiza',
    turquia: 'turquia',
    turkey: 'turquia',
    ucrania: 'ucrania',
    ukraine: 'ucrania',
    venezuela: 'venezuela',
  };

  if (aliases[compact]) return aliases[compact];
  if (aliases[base]) return aliases[base];

  if (base.startsWith('argentina')) return 'argentina';
  if (base.startsWith('espana') || base.startsWith('spain')) return 'espana';
  if (
    compact.includes('estadosunidos') ||
    base.includes('estados unidos') ||
    base === 'usa' ||
    compact === 'eeuu'
  ) {
    return 'estados_unidos';
  }

  return null;
}

export function extractPaisFlag(paisRaw) {
  const p = String(paisRaw || '').trim();
  const m = /^([\p{Extended_Pictographic}\uFE0F]+)\s*/u.exec(p);
  return m ? m[1] : '';
}

const DEFAULT_FLAG_BY_SLUG = {
  argentina: '🇦🇷',
  espana: '🇪🇸',
  estados_unidos: '🇺🇸',
  italia: '🇮🇹',
  francia: '🇫🇷',
  alemania: '🇩🇪',
  rumania: '🇷🇴',
  austria: '🇦🇹',
  brasil: '🇧🇷',
  uruguay: '🇺🇾',
  chile: '🇨🇱',
  colombia: '🇨🇴',
  mexico: '🇲🇽',
  australia: '🇦🇺',
  belgica: '🇧🇪',
  bolivia: '🇧🇴',
  canada: '🇨🇦',
  china: '🇨🇳',
  croacia: '🇭🇷',
  ecuador: '🇪🇨',
  grecia: '🇬🇷',
  honduras: '🇭🇳',
  hungria: '🇭🇺',
  israel: '🇮🇱',
  japon: '🇯🇵',
  marruecos: '🇲🇦',
  noruega: '🇳🇴',
  paises_bajos: '🇳🇱',
  paraguay: '🇵🇾',
  peru: '🇵🇪',
  polonia: '🇵🇱',
  portugal: '🇵🇹',
  reino_unido: '🇬🇧',
  rusia: '🇷🇺',
  serbia: '🇷🇸',
  suecia: '🇸🇪',
  suiza: '🇨🇭',
  turquia: '🇹🇷',
  ucrania: '🇺🇦',
  venezuela: '🇻🇪',
};

function paisNombreSinBandera(paisRaw) {
  const p = String(paisRaw || '').trim();
  if (!p) return '';
  const sinEmoji = p.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();
  return sinEmoji || p;
}

/**
 * Etiqueta para selector de país en reserva (value sigue siendo el string de la sede).
 * @param {string} paisRaw
 * @param {(key: string, opts?: object) => string} t
 */
export function formatPaisReservaLabel(paisRaw, t) {
  const p = String(paisRaw || '').trim();
  if (!p) return '';
  const slug = paisRawToSlug(p);
  if (slug && typeof t === 'function') {
    const translated = t(`paises.${slug}`);
    if (translated && translated !== `paises.${slug}`) {
      const flag = extractPaisFlag(p) || DEFAULT_FLAG_BY_SLUG[slug] || '';
      return flag ? `${flag} ${translated}` : translated;
    }
  }
  const base = paisNombreSinBandera(p);
  const lc = normalizePaisText(base);
  const compact = lc.replace(/\s+/g, '');
  if (lc === 'argentina' || lc.startsWith('argentina ')) return /^🇦🇷/.test(p) ? p : `🇦🇷 ${base}`;
  if (lc === 'espana' || lc.startsWith('espana ')) return /^🇪🇸/.test(p) ? p : `🇪🇸 ${base}`;
  if (
    compact.includes('estadosunidos') ||
    lc.includes('estados unidos') ||
    lc === 'usa' ||
    compact === 'eeuu'
  ) {
    return /^🇺🇸/.test(p) ? p : `🇺🇸 ${base}`;
  }
  return p;
}

/**
 * Ciudad · país traducido para cards de sede en reserva.
 * @param {{ ciudad?: string, pais?: string }} sede
 * @param {(key: string, opts?: object) => string} t
 */
/**
 * Empareja un nombre de país de geo/IP con un valor `sede.pais` del catálogo.
 * @param {string} geoHint Nombre devuelto por ipwho u otro proveedor
 * @param {string[]} paisesCatalogo Países presentes en sedes activas
 * @returns {string|null}
 */
export function matchPaisReservaEnCatalogo(geoHint, paisesCatalogo) {
  const hint = normalizePaisText(geoHint);
  if (!hint || !Array.isArray(paisesCatalogo) || paisesCatalogo.length === 0) return null;
  const hintSlug = paisRawToSlug(geoHint) || paisRawToSlug(hint);

  for (const p of paisesCatalogo) {
    const raw = String(p || '').trim();
    if (!raw) continue;
    const pNorm = normalizePaisText(raw);
    if (pNorm === hint) return raw;
    const pSlug = paisRawToSlug(raw);
    if (hintSlug && pSlug && hintSlug === pSlug) return raw;
    if (pNorm.includes(hint) || hint.includes(pNorm)) return raw;
  }
  return null;
}

/**
 * País de la sede activa más cercana a las coordenadas del usuario.
 * @param {{ lat: number, lon: number }} pos
 * @param {Array<{ pais?: string, latitud?: number, longitud?: number }>} sedesList
 * @param {(lat1: number, lon1: number, lat2: number, lon2: number) => number|null} distanceKm
 * @returns {string|null}
 */
export function inferPaisReservaDesdeCoordenadas(pos, sedesList, distanceKm) {
  if (!pos || !Array.isArray(sedesList) || typeof distanceKm !== 'function') return null;
  const { lat, lon } = pos;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  let bestPais = null;
  let bestKm = Infinity;
  for (const s of sedesList) {
    const pais = String(s?.pais || '').trim();
    if (!pais) continue;
    const d = distanceKm(lat, lon, s.latitud, s.longitud);
    if (!Number.isFinite(d) || d >= bestKm) continue;
    bestKm = d;
    bestPais = pais;
  }
  return bestPais;
}

export function formatSedeCiudadPaisLinea(sede, t) {
  const ciudad = String(sede?.ciudad || '').trim();
  const raw = String(sede?.pais || '').trim();
  if (!raw) return { linea: ciudad || '—', flag: '' };
  const flag = extractPaisFlag(raw) || DEFAULT_FLAG_BY_SLUG[paisRawToSlug(raw)] || '';
  const paisLabel = formatPaisReservaLabel(raw, t).replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();
  const linea = [ciudad, paisLabel].filter(Boolean).join(' · ') || paisLabel || ciudad || '—';
  return { flag, linea };
}

/** Subtítulo sede sin bandera; opcional sufijo Surge si la sede lo tiene activo. */
export function formatSedeUbicacionSubtitulo(sede, t) {
  const { linea } = formatSedeCiudadPaisLinea(sede, t);
  if (sede?.surge_activo === true) {
    return `${linea} · ⚡ Precios dinámicos`;
  }
  return linea;
}
