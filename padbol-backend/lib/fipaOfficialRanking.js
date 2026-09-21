import crypto from 'crypto';

export const FIPA_OFFICIAL_RANKING_SOURCE_URL =
  'https://docs.google.com/spreadsheets/d/1Bv57k5Izof_nTiojFn7Y1seNf5ofQfJPYB9oBup0zdk/gviz/tq?tqx=out:csv&gid=2147420736';

const CONTINENT_ALIASES = new Map([
  ['america', 'america'],
  ['americas', 'america'],
  ['europe', 'europa'],
  ['europa', 'europa'],
  ['middle east', 'oriente_medio'],
  ['oriente medio', 'oriente_medio'],
  ['africa', 'africa'],
  ['asia', 'asia'],
  ['oceania', 'oceania'],
]);

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeFipaContinent(value) {
  return CONTINENT_ALIASES.get(normalizeText(value)) ?? null;
}

export function parseFipaPoints(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function parseCsvRows(csv) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(csv ?? '');

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function buildPlayerSourceKey({ firstName, lastName, country }) {
  const identity = [firstName, lastName, country].map(normalizeText).join('|');
  return crypto.createHash('sha256').update(identity).digest('hex');
}

export function parseFipaOfficialRankingCsv(csv) {
  const rows = parseCsvRows(csv);
  const headerRows = rows.slice(0, 2);
  const players = rows
    .slice(2)
    .map((cells, index) => ({ cells, sourceRow: index + 3 }))
    // Es exactamente el criterio que usa la Web Padbol: posición, nombre y
    // apellido deben estar completos. Las filas históricas parciales no se
    // convierten en perfiles por aproximación.
    .filter(({ cells }) => /^\d+$/.test(String(cells[0] ?? '').trim()) && Boolean(String(cells[3] ?? '').trim()) && Boolean(String(cells[4] ?? '').trim()))
    .map(({ cells, sourceRow }) => {
      const firstName = String(cells[3]).trim();
      const lastName = String(cells[4]).trim();
      const country = String(cells[5] ?? '').trim();
      const continentSource = String(cells[6] ?? '').trim();
      const pointsSource = String(cells[7] ?? '').trim();
      return {
        source_key: buildPlayerSourceKey({ firstName, lastName, country }),
        nombre: firstName,
        apellido: lastName,
        nombre_completo: `${firstName} ${lastName}`.trim(),
        pais: country || null,
        continente: normalizeFipaContinent(continentSource),
        continente_fuente: continentSource || null,
        posicion: Number(cells[0]),
        posicion_secundaria: /^\d+$/.test(String(cells[1] ?? '').trim()) ? Number(cells[1]) : null,
        destacado: String(cells[2] ?? '').trim() === '*',
        puntos: parseFipaPoints(pointsSource),
        puntos_fuente: pointsSource,
        detalle: {
          fila_fuente: sourceRow,
          celdas_torneos: cells.slice(8),
        },
      };
    })
    .filter((player) => player.puntos != null && player.continente);

  return {
    updatedLabel: String(headerRows[0]?.[6] ?? '').trim() || null,
    headerRows,
    players,
  };
}

export function officialFipaRankingDto(player, linkage = {}) {
  const userId = linkage.user_id ? String(linkage.user_id) : null;
  const status = userId ? 'vinculado' : String(linkage.estado_vinculacion || 'no_reclamado');
  return {
    fipa_jugador_id: linkage.fipa_jugador_id ?? player.fipa_jugador_id ?? null,
    fipa_source_key: player.source_key ?? null,
    user_id: userId,
    nombre: player.nombre ?? player.nombre_completo ?? null,
    apellido: player.apellido ?? null,
    display_name: player.nombre_completo ?? [player.nombre, player.apellido].filter(Boolean).join(' ').trim(),
    pais: player.pais ?? null,
    continente: player.continente ?? null,
    posicion: Number(player.posicion) || 0,
    posicion_mundial: Number(player.posicion_mundial ?? player.posicion) || 0,
    puntos: Number(player.puntos) || 0,
    puntos_total: Number(player.puntos) || 0,
    ranking_origen: 'fipa_oficial',
    ranking_oficial: true,
    estado_vinculacion: status,
    puede_reclamar: status !== 'vinculado',
  };
}

export function filterOfficialFipaRanking(players, { continente } = {}) {
  const continent = continente ? normalizeFipaContinent(continente) : null;
  if (continente && !continent) return [];
  const rows = (continent
    ? players.filter((player) => player.continente === continent)
    : [...players])
    .sort((a, b) => a.posicion - b.posicion
      || (a.detalle?.fila_fuente ?? Number.MAX_SAFE_INTEGER) - (b.detalle?.fila_fuente ?? Number.MAX_SAFE_INTEGER));
  if (!continent) return rows;

  let continentalPosition = 0;
  let previousWorldPosition = null;
  return rows.map((player) => {
    if (player.posicion !== previousWorldPosition) continentalPosition += 1;
    previousWorldPosition = player.posicion;
    return {
      ...player,
      posicion_mundial: player.posicion,
      posicion: continentalPosition,
    };
  });
}

export function fipaRankingSourceHash(csv) {
  return crypto.createHash('sha256').update(String(csv ?? '')).digest('hex');
}

export function isMissingFipaRankingSchemaError(error) {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return /relation .*fipa_|could not find the table|schema cache|does not exist/.test(message);
}
