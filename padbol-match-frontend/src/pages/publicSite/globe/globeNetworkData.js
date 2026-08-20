/**
 * Visualización conceptual de una red deportiva global.
 * Los nodos no representan sedes ni presencia comercial confirmada.
 *
 * Anclas geográficas + nodos intermedios sin nombre visible.
 * Multideporte: Padbol, pádel, pickleball, tenis + comunidad/servicios.
 */

import { buildDeterministicMesh, linkDegreeStats } from './globeMeshTopology';
import {
  GLOBE_ALL_LABEL_KEYS,
  GLOBE_LABEL_CATALOG as LABEL_CATALOG,
  GLOBE_LABEL_CATEGORIES,
  GLOBE_MOBILE_PRIORITY_LABELS,
  GLOBE_PACKET_MAX,
  GLOBE_SPORT_LABELS,
  GLOBE_STATIC_LABELS,
} from './globeLabelCatalog';

/** Regiones geográficas (solo para distribución visual). */
export const GLOBE_CONTINENT_REGIONS = [
  'northAmerica',
  'centralAmerica',
  'southAmerica',
  'europe',
  'northAfrica',
  'westAfrica',
  'eastAfrica',
  'centralAfrica',
  'southernAfrica',
  'middleEast',
  'centralAsia',
  'southAsia',
  'southeastAsia',
  'eastAsia',
  'oceania',
];

export const GLOBE_ROTATION_MS = 48000;

/**
 * Niveles visuales (no operativos):
 * A verde — punto activo / comunidad / conexión disponible
 * B hielo — infraestructura digital / jugadores / clubes
 * C rojo — actividad en movimiento (partidos, torneos, reservas…)
 */
export const NODE_LEVEL = {
  A: 'active',
  B: 'network',
  C: 'activity',
};

/**
 * Nodos visuales globales (~85). Sin nombres en pantalla.
 * `anchor` marca referencias geográficas conocidas (solo datos internos).
 */
export const GLOBAL_VISUAL_NODES = [
  /* América del Norte */
  { id: 'yvr', lon: -123.1, lat: 49.3, region: 'northAmerica', level: 'B', pacific: true, priority: 2, anchor: 'Vancouver' },
  { id: 'sea', lon: -122.3, lat: 47.6, region: 'northAmerica', level: 'B', pacific: true, priority: 1, anchor: 'Seattle' },
  { id: 'sfo', lon: -122.4, lat: 37.8, region: 'northAmerica', level: 'C', pacific: true, priority: 3, anchor: 'San Francisco' },
  { id: 'lax', lon: -118.2, lat: 34.1, region: 'northAmerica', level: 'C', pacific: true, major: true, priority: 3, anchor: 'Los Angeles' },
  { id: 'mex', lon: -99.1, lat: 19.4, region: 'northAmerica', level: 'B', priority: 2, anchor: 'Ciudad de México' },
  { id: 'dal', lon: -96.8, lat: 32.8, region: 'northAmerica', level: 'B', priority: 1, anchor: 'Dallas' },
  { id: 'mia', lon: -80.2, lat: 25.8, region: 'northAmerica', level: 'A', priority: 3, anchor: 'Miami' },
  { id: 'nyc', lon: -74.0, lat: 40.7, region: 'northAmerica', level: 'C', major: true, priority: 3, anchor: 'Nueva York' },
  { id: 'tor', lon: -79.4, lat: 43.7, region: 'northAmerica', level: 'B', priority: 2, anchor: 'Toronto' },
  { id: 'mtl', lon: -73.6, lat: 45.5, region: 'northAmerica', level: 'B', priority: 1, anchor: 'Montreal' },
  { id: 'chi', lon: -87.6, lat: 41.9, region: 'northAmerica', level: 'A', priority: 2 },
  { id: 'den', lon: -104.9, lat: 39.7, region: 'northAmerica', level: 'B', priority: 1 },
  { id: 'na1', lon: -110.0, lat: 32.2, region: 'northAmerica', level: 'B', priority: 0 },
  { id: 'na2', lon: -95.0, lat: 38.5, region: 'northAmerica', level: 'B', priority: 0 },
  /* América Central / Caribe */
  { id: 'gua', lon: -90.5, lat: 14.6, region: 'centralAmerica', level: 'B', priority: 1, anchor: 'Guatemala' },
  { id: 'sjo', lon: -84.1, lat: 9.9, region: 'centralAmerica', level: 'B', pacific: true, priority: 1, anchor: 'San José' },
  { id: 'pan', lon: -79.5, lat: 8.98, region: 'centralAmerica', level: 'A', pacific: true, priority: 2, anchor: 'Panamá' },
  { id: 'hav', lon: -82.4, lat: 23.1, region: 'centralAmerica', level: 'B', priority: 1, anchor: 'La Habana' },
  { id: 'sdq', lon: -69.9, lat: 18.5, region: 'centralAmerica', level: 'B', priority: 1, anchor: 'Santo Domingo' },
  { id: 'sju', lon: -66.1, lat: 18.5, region: 'centralAmerica', level: 'B', priority: 1, anchor: 'San Juan' },
  { id: 'ca1', lon: -88.0, lat: 15.5, region: 'centralAmerica', level: 'B', priority: 0 },
  /* América del Sur */
  { id: 'bog', lon: -74.1, lat: 4.7, region: 'southAmerica', level: 'B', priority: 2, anchor: 'Bogotá' },
  { id: 'uio', lon: -78.5, lat: -0.2, region: 'southAmerica', level: 'B', priority: 1, anchor: 'Quito' },
  { id: 'lim', lon: -77.0, lat: -12.0, region: 'southAmerica', level: 'B', pacific: true, priority: 2, anchor: 'Lima' },
  { id: 'lpb', lon: -68.1, lat: -16.5, region: 'southAmerica', level: 'B', priority: 1, anchor: 'La Paz' },
  { id: 'scl', lon: -70.6, lat: -33.4, region: 'southAmerica', level: 'A', pacific: true, priority: 2, anchor: 'Santiago' },
  { id: 'bue', lon: -58.4, lat: -34.6, region: 'southAmerica', level: 'C', priority: 3, anchor: 'Buenos Aires' },
  { id: 'lpl', lon: -57.95, lat: -34.92, region: 'southAmerica', level: 'B', priority: 1, anchor: 'La Plata' },
  { id: 'mvd', lon: -56.2, lat: -34.9, region: 'southAmerica', level: 'B', priority: 1, anchor: 'Montevideo' },
  { id: 'sao', lon: -46.6, lat: -23.5, region: 'southAmerica', level: 'C', major: true, priority: 3, anchor: 'São Paulo' },
  { id: 'rio', lon: -43.2, lat: -22.9, region: 'southAmerica', level: 'B', priority: 2, anchor: 'Río' },
  { id: 'asu', lon: -57.6, lat: -25.3, region: 'southAmerica', level: 'B', priority: 1, anchor: 'Asunción' },
  { id: 'sa1', lon: -63.0, lat: -17.0, region: 'southAmerica', level: 'B', priority: 0 },
  { id: 'sa2', lon: -55.0, lat: -10.0, region: 'southAmerica', level: 'B', priority: 0 },
  /* Europa */
  { id: 'lis', lon: -9.1, lat: 38.7, region: 'europe', level: 'B', priority: 2, anchor: 'Lisboa' },
  { id: 'mad', lon: -3.7, lat: 40.4, region: 'europe', level: 'C', major: true, priority: 3, anchor: 'Madrid' },
  { id: 'bcn', lon: 2.2, lat: 41.4, region: 'europe', level: 'A', priority: 2, anchor: 'Barcelona' },
  { id: 'par', lon: 2.3, lat: 48.9, region: 'europe', level: 'B', priority: 2, anchor: 'París' },
  { id: 'lon', lon: -0.1, lat: 51.5, region: 'europe', level: 'B', priority: 2, anchor: 'Londres' },
  { id: 'ams', lon: 4.9, lat: 52.4, region: 'europe', level: 'B', priority: 1, anchor: 'Ámsterdam' },
  { id: 'ber', lon: 13.4, lat: 52.5, region: 'europe', level: 'B', priority: 1, anchor: 'Berlín' },
  { id: 'rom', lon: 12.5, lat: 41.9, region: 'europe', level: 'B', priority: 1, anchor: 'Roma' },
  { id: 'mil', lon: 9.2, lat: 45.5, region: 'europe', level: 'B', priority: 2, anchor: 'Milán' },
  { id: 'buh', lon: 26.1, lat: 44.4, region: 'europe', level: 'B', priority: 1, anchor: 'Bucarest' },
  { id: 'bud', lon: 19.0, lat: 47.5, region: 'europe', level: 'B', priority: 1, anchor: 'Budapest' },
  { id: 'ath', lon: 23.7, lat: 37.9, region: 'europe', level: 'B', priority: 1, anchor: 'Atenas' },
  { id: 'ist', lon: 28.9, lat: 41.0, region: 'europe', level: 'A', priority: 2, anchor: 'Estambul' },
  { id: 'war', lon: 21.0, lat: 52.2, region: 'europe', level: 'B', priority: 1, anchor: 'Varsovia' },
  { id: 'sto', lon: 18.1, lat: 59.3, region: 'europe', level: 'B', priority: 1, anchor: 'Estocolmo' },
  { id: 'eu1', lon: 10.0, lat: 56.0, region: 'europe', level: 'B', priority: 0 },
  /* África */
  { id: 'cas', lon: -7.6, lat: 33.6, region: 'northAfrica', level: 'A', priority: 2, anchor: 'Casablanca' },
  { id: 'cai', lon: 31.2, lat: 30.0, region: 'northAfrica', level: 'C', priority: 3, anchor: 'El Cairo' },
  { id: 'dak', lon: -17.4, lat: 14.7, region: 'westAfrica', level: 'B', priority: 1, anchor: 'Dakar' },
  { id: 'lag', lon: 3.4, lat: 6.5, region: 'westAfrica', level: 'C', priority: 3, anchor: 'Lagos' },
  { id: 'nbo', lon: 36.8, lat: -1.3, region: 'eastAfrica', level: 'A', priority: 3, anchor: 'Nairobi' },
  { id: 'add', lon: 38.7, lat: 9.0, region: 'eastAfrica', level: 'B', priority: 2, anchor: 'Adís Abeba' },
  { id: 'kin', lon: 15.3, lat: -4.3, region: 'centralAfrica', level: 'A', priority: 2, anchor: 'Kinshasa' },
  { id: 'jnb', lon: 28.0, lat: -26.2, region: 'southernAfrica', level: 'C', priority: 3, anchor: 'Johannesburgo' },
  { id: 'cpt', lon: 18.4, lat: -33.9, region: 'southernAfrica', level: 'A', priority: 2, anchor: 'Ciudad del Cabo' },
  { id: 'map', lon: 32.6, lat: -25.9, region: 'southernAfrica', level: 'B', priority: 1, anchor: 'Maputo' },
  { id: 'af1', lon: 8.0, lat: 12.0, region: 'westAfrica', level: 'B', priority: 0 },
  { id: 'af2', lon: 25.0, lat: 5.0, region: 'centralAfrica', level: 'B', priority: 0 },
  { id: 'af3', lon: 30.0, lat: -15.0, region: 'southernAfrica', level: 'B', priority: 0 },
  /* Medio Oriente */
  { id: 'dub', lon: 55.3, lat: 25.2, region: 'middleEast', level: 'C', priority: 3, anchor: 'Dubái' },
  { id: 'doh', lon: 51.5, lat: 25.3, region: 'middleEast', level: 'B', priority: 1, anchor: 'Doha' },
  { id: 'riy', lon: 46.7, lat: 24.7, region: 'middleEast', level: 'B', priority: 2, anchor: 'Riad' },
  { id: 'tlv', lon: 34.8, lat: 32.1, region: 'middleEast', level: 'A', priority: 1, anchor: 'Tel Aviv' },
  { id: 'amm', lon: 35.9, lat: 31.9, region: 'middleEast', level: 'B', priority: 1, anchor: 'Amán' },
  { id: 'auh', lon: 54.4, lat: 24.5, region: 'middleEast', level: 'A', priority: 2, anchor: 'Abu Dabi' },
  /* Asia central + sur */
  { id: 'tash', lon: 69.2, lat: 41.3, region: 'centralAsia', level: 'A', priority: 1 },
  { id: 'alu', lon: 76.9, lat: 43.2, region: 'centralAsia', level: 'B', priority: 0 },
  { id: 'del', lon: 77.2, lat: 28.6, region: 'southAsia', level: 'C', priority: 3, anchor: 'Delhi' },
  { id: 'bom', lon: 72.9, lat: 19.1, region: 'southAsia', level: 'B', priority: 2, anchor: 'Mumbai' },
  { id: 'blr', lon: 77.6, lat: 12.97, region: 'southAsia', level: 'A', priority: 2, anchor: 'Bangalore' },
  { id: 'as1', lon: 80.0, lat: 22.0, region: 'southAsia', level: 'B', priority: 0 },
  /* Sudeste / Este Asia */
  { id: 'bkk', lon: 100.5, lat: 13.8, region: 'southeastAsia', level: 'A', priority: 2, anchor: 'Bangkok' },
  { id: 'sgp', lon: 103.8, lat: 1.3, region: 'southeastAsia', level: 'C', pacific: true, priority: 3, anchor: 'Singapur' },
  { id: 'kul', lon: 101.7, lat: 3.1, region: 'southeastAsia', level: 'B', priority: 1, anchor: 'Kuala Lumpur' },
  { id: 'jkt', lon: 106.8, lat: -6.2, region: 'southeastAsia', level: 'B', pacific: true, priority: 2, anchor: 'Yakarta' },
  { id: 'han', lon: 105.8, lat: 21.0, region: 'southeastAsia', level: 'B', priority: 1, anchor: 'Hanói' },
  { id: 'mnl', lon: 121.0, lat: 14.6, region: 'southeastAsia', level: 'A', pacific: true, priority: 2, anchor: 'Manila' },
  { id: 'hkg', lon: 114.2, lat: 22.3, region: 'southeastAsia', level: 'A', pacific: true, priority: 2, anchor: 'Hong Kong' },
  { id: 'sha', lon: 121.5, lat: 31.2, region: 'eastAsia', level: 'B', pacific: true, priority: 2, anchor: 'Shanghái' },
  { id: 'sel', lon: 127.0, lat: 37.6, region: 'eastAsia', level: 'C', pacific: true, priority: 3, anchor: 'Seúl' },
  { id: 'tyo', lon: 139.7, lat: 35.7, region: 'eastAsia', level: 'C', pacific: true, major: true, priority: 3, anchor: 'Tokio' },
  { id: 'osa', lon: 135.5, lat: 34.7, region: 'eastAsia', level: 'A', pacific: true, priority: 2, anchor: 'Osaka' },
  { id: 'se1', lon: 108.0, lat: 8.0, region: 'southeastAsia', level: 'B', priority: 0 },
  { id: 'ea1', lon: 130.0, lat: 32.0, region: 'eastAsia', level: 'B', pacific: true, priority: 0 },
  /* Oceanía */
  { id: 'per', lon: 115.9, lat: -31.9, region: 'oceania', level: 'A', pacific: true, australia: true, priority: 2, anchor: 'Perth' },
  { id: 'adl', lon: 138.6, lat: -34.9, region: 'oceania', level: 'B', pacific: true, australia: true, priority: 1, anchor: 'Adelaida' },
  { id: 'mel', lon: 144.9, lat: -37.8, region: 'oceania', level: 'C', pacific: true, australia: true, priority: 3, anchor: 'Melbourne' },
  { id: 'syd', lon: 151.2, lat: -33.9, region: 'oceania', level: 'C', pacific: true, australia: true, major: true, priority: 3, anchor: 'Sídney' },
  { id: 'bne', lon: 153.0, lat: -27.5, region: 'oceania', level: 'A', pacific: true, australia: true, priority: 2, anchor: 'Brisbane' },
  { id: 'akl', lon: 174.8, lat: -36.8, region: 'oceania', level: 'A', pacific: true, priority: 2, anchor: 'Auckland' },
  { id: 'wlg', lon: 174.8, lat: -41.3, region: 'oceania', level: 'B', pacific: true, priority: 1, anchor: 'Wellington' },
  { id: 'oc1', lon: 147.0, lat: -32.0, region: 'oceania', level: 'B', pacific: true, australia: true, priority: 0 },
  /* Densidad adicional — tierra firme / costas (sin océano abierto) */
  { id: 'phx', lon: -112.1, lat: 33.4, region: 'northAmerica', level: 'B', priority: 1 },
  { id: 'atl', lon: -84.4, lat: 33.7, region: 'northAmerica', level: 'B', priority: 1 },
  { id: 'min', lon: -93.3, lat: 44.9, region: 'northAmerica', level: 'B', priority: 0 },
  { id: 'cal', lon: -114.1, lat: 51.0, region: 'northAmerica', level: 'B', priority: 0 },
  { id: 'win', lon: -97.1, lat: 49.9, region: 'northAmerica', level: 'B', priority: 0 },
  { id: 'na3', lon: -100.5, lat: 25.7, region: 'northAmerica', level: 'B', priority: 0 },
  { id: 'na4', lon: -86.8, lat: 36.2, region: 'northAmerica', level: 'B', priority: 0 },
  { id: 'mga', lon: -86.3, lat: 12.1, region: 'centralAmerica', level: 'B', priority: 0 },
  { id: 'sal', lon: -89.2, lat: 13.7, region: 'centralAmerica', level: 'B', priority: 0 },
  { id: 'ccs', lon: -66.9, lat: 10.5, region: 'southAmerica', level: 'B', priority: 1 },
  { id: 'rec', lon: -34.9, lat: -8.1, region: 'southAmerica', level: 'B', priority: 1 },
  { id: 'bhz', lon: -43.9, lat: -19.9, region: 'southAmerica', level: 'B', priority: 0 },
  { id: 'sa3', lon: -60.0, lat: -3.1, region: 'southAmerica', level: 'B', priority: 0 },
  { id: 'sa4', lon: -49.3, lat: -16.7, region: 'southAmerica', level: 'B', priority: 0 },
  { id: 'por', lon: -8.6, lat: 41.1, region: 'europe', level: 'B', priority: 1 },
  { id: 'vie', lon: 16.4, lat: 48.2, region: 'europe', level: 'B', priority: 1 },
  { id: 'pra', lon: 14.4, lat: 50.1, region: 'europe', level: 'B', priority: 0 },
  { id: 'eu2', lon: 5.5, lat: 43.3, region: 'europe', level: 'B', priority: 0 },
  { id: 'eu3', lon: 30.5, lat: 50.5, region: 'europe', level: 'B', priority: 0 },
  { id: 'alg', lon: 3.1, lat: 36.8, region: 'northAfrica', level: 'B', priority: 1 },
  { id: 'tun', lon: 10.2, lat: 36.8, region: 'northAfrica', level: 'B', priority: 0 },
  { id: 'acc', lon: -0.2, lat: 5.6, region: 'westAfrica', level: 'B', priority: 1 },
  { id: 'dar', lon: 39.2, lat: -6.8, region: 'eastAfrica', level: 'B', priority: 1 },
  { id: 'kam', lon: 32.6, lat: 0.3, region: 'eastAfrica', level: 'B', priority: 0 },
  { id: 'drb', lon: 31.0, lat: -29.9, region: 'southernAfrica', level: 'B', priority: 1 },
  { id: 'af4', lon: 15.0, lat: 12.1, region: 'centralAfrica', level: 'B', priority: 0 },
  { id: 'jed', lon: 39.2, lat: 21.5, region: 'middleEast', level: 'B', priority: 1 },
  { id: 'bah', lon: 50.6, lat: 26.2, region: 'middleEast', level: 'B', priority: 0 },
  { id: 'khi', lon: 67.0, lat: 24.9, region: 'southAsia', level: 'B', priority: 1 },
  { id: 'maa', lon: 80.3, lat: 13.1, region: 'southAsia', level: 'B', priority: 1 },
  { id: 'ccu', lon: 88.4, lat: 22.6, region: 'southAsia', level: 'B', priority: 1 },
  { id: 'hyd', lon: 78.5, lat: 17.4, region: 'southAsia', level: 'B', priority: 0 },
  { id: 'as2', lon: 75.8, lat: 26.9, region: 'southAsia', level: 'B', priority: 0 },
  { id: 'cgy', lon: 104.9, lat: 11.6, region: 'southeastAsia', level: 'B', priority: 0 },
  { id: 'rgm', lon: 98.7, lat: 3.6, region: 'southeastAsia', level: 'B', priority: 0 },
  { id: 'pek', lon: 116.4, lat: 39.9, region: 'eastAsia', level: 'B', priority: 2 },
  { id: 'tpe', lon: 121.5, lat: 25.0, region: 'eastAsia', level: 'B', pacific: true, priority: 1 },
  { id: 'fuk', lon: 130.4, lat: 33.6, region: 'eastAsia', level: 'B', pacific: true, priority: 1 },
  { id: 'ea2', lon: 126.5, lat: 33.5, region: 'eastAsia', level: 'B', pacific: true, priority: 0 },
  { id: 'hob', lon: 147.3, lat: -42.9, region: 'oceania', level: 'B', pacific: true, australia: true, priority: 0 },
  { id: 'cns', lon: 145.8, lat: -16.9, region: 'oceania', level: 'B', pacific: true, australia: true, priority: 0 },
  { id: 'chc', lon: 172.6, lat: -43.5, region: 'oceania', level: 'B', pacific: true, priority: 0 },
  { id: 'oc2', lon: 133.9, lat: -23.7, region: 'oceania', level: 'B', pacific: true, australia: true, priority: 0 },
];

/** Alias. */
export const GLOBE_NODES = GLOBAL_VISUAL_NODES;
export const GLOBAL_NETWORK_NODES = GLOBAL_VISUAL_NODES;

export const GLOBE_NODE_COUNTS = {
  desktop: { min: 125, max: 145 },
  tablet: { min: 82, max: 98 },
  mobile: { min: 48, max: 60 },
};

export const GLOBE_LINK_COUNTS = {
  desktop: { min: 160, max: 230 },
  tablet: { min: 110, max: 170 },
  mobile: { min: 60, max: 95 },
};

export const GLOBE_PULSE_COUNTS = {
  desktop: { min: 22, max: 28 },
  tablet: { min: 12, max: 18 },
  mobile: { min: 6, max: 10 },
};

export const GLOBE_HEMISPHERE_MIN = {
  nodes: 34,
  links: 58,
  pulses: 8,
  labelsDesktop: 6,
  atmospheric: 16,
  centerCrossings: 8,
};

/** Sin nombres de ciudad en esta versión. */
export const GLOBE_SHOW_CITY_NAMES = false;
export const GLOBE_CITY_NAME_MAX = { desktop: 0, tablet: 0, mobile: 0 };

const NI = Object.fromEntries(GLOBE_NODES.map((n, i) => [n.id, i]));

const MESH = buildDeterministicMesh(GLOBE_NODES, { seed: 20260722 });

export const GLOBE_MESH_SEED = MESH.seed;
export const GLOBE_REGIONAL_HUBS = MESH.hubs;
export const GLOBE_NODE_DEGREE = MESH.degree;

export const GLOBE_LINKS = MESH.links.map((l) => ({
  a: NI[l.from],
  b: NI[l.to],
  weight: l.weight || 'secondary',
  kind: l.kind,
  pacific: Boolean(l.pacific),
  from: l.from,
  to: l.to,
}));

export const REGIONAL_NETWORK_LINKS = GLOBE_LINKS.filter(
  (l) => l.kind === 'local' || l.kind === 'regional',
);
export const INTERNATIONAL_NETWORK_LINKS = GLOBE_LINKS.filter((l) => l.kind === 'international');

export const GLOBE_LINK_KIND_COUNTS = {
  local: GLOBE_LINKS.filter((l) => l.kind === 'local').length,
  regional: GLOBE_LINKS.filter((l) => l.kind === 'regional').length,
  international: GLOBE_LINKS.filter((l) => l.kind === 'international').length,
};

function linkIndex(from, to) {
  const i = GLOBE_LINKS.findIndex(
    (l) => (l.from === from && l.to === to) || (l.from === to && l.to === from),
  );
  return i;
}

function pickPulseLink(candidates, color, speed, delay) {
  for (let i = 0; i < candidates.length; i += 1) {
    const [a, b] = candidates[i];
    const idx = linkIndex(a, b);
    if (idx >= 0) return { link: idx, speed, delay, color };
  }
  /* fallback: first link of matching kind */
  return null;
}

/** Pulsos sobre malla local/regional/internacional/atm (desfasados). */
const PULSE_SPECS = [
  { pairs: [['nyc', 'tor'], ['chi', 'nyc'], ['mia', 'hav']], color: 'red', speed: 0.19, delay: 0.0 },
  { pairs: [['mad', 'bcn'], ['par', 'mil'], ['lon', 'ams']], color: 'red', speed: 0.16, delay: 0.12 },
  { pairs: [['nbo', 'jnb'], ['lag', 'nbo'], ['cai', 'add']], color: 'red', speed: 0.15, delay: 0.22 },
  { pairs: [['del', 'blr'], ['bkk', 'sgp'], ['sel', 'tyo']], color: 'red', speed: 0.17, delay: 0.31 },
  { pairs: [['mel', 'syd'], ['syd', 'bne'], ['per', 'adl']], color: 'red', speed: 0.18, delay: 0.08 },
  { pairs: [['bog', 'lim'], ['sao', 'rio'], ['bue', 'mvd']], color: 'red', speed: 0.14, delay: 0.44 },
  { pairs: [['nyc', 'mad'], ['sao', 'lis'], ['mia', 'mad']], color: 'red', speed: 0.12, delay: 0.18 },
  { pairs: [['lax', 'tyo'], ['sfo', 'syd'], ['scl', 'syd']], color: 'red', speed: 0.11, delay: 0.52 },
  { pairs: [['dub', 'del'], ['cai', 'dub'], ['par', 'del']], color: 'red', speed: 0.13, delay: 0.37 },
  { pairs: [['tyo', 'syd'], ['sgp', 'syd'], ['bne', 'tyo']], color: 'red', speed: 0.12, delay: 0.61 },
  { pairs: [['gua', 'sjo'], ['mex', 'gua'], ['pan', 'bog']], color: 'red', speed: 0.2, delay: 0.27 },
  { pairs: [['jnb', 'cpt'], ['kin', 'nbo'], ['dak', 'lag']], color: 'red', speed: 0.15, delay: 0.71 },
  { pairs: [['sha', 'sel'], ['hkg', 'mnl'], ['bom', 'del']], color: 'red', speed: 0.16, delay: 0.48 },
  { pairs: [['yvr', 'sea'], ['sfo', 'lax'], ['dal', 'chi']], color: 'red', speed: 0.21, delay: 0.05 },
  { pairs: [['ist', 'dub'], ['ber', 'war'], ['ath', 'ist']], color: 'red', speed: 0.14, delay: 0.58 },
  { pairs: [['lax', 'sel'], ['yvr', 'tyo'], ['sao', 'syd']], color: 'red', speed: 0.1, delay: 0.66 },
  { pairs: [['pek', 'sha'], ['tpe', 'tyo'], ['fuk', 'osa']], color: 'red', speed: 0.17, delay: 0.25 },
  { pairs: [['hyd', 'blr'], ['maa', 'ccu'], ['khi', 'del']], color: 'red', speed: 0.15, delay: 0.41 },
  { pairs: [['acc', 'lag'], ['alg', 'cas'], ['dar', 'nbo']], color: 'red', speed: 0.13, delay: 0.55 },
  { pairs: [['phx', 'den'], ['atl', 'mia'], ['rec', 'sao']], color: 'red', speed: 0.18, delay: 0.33 },
  { pairs: [['vie', 'bud'], ['sto', 'war'], ['por', 'lis']], color: 'red', speed: 0.16, delay: 0.47 },
  { pairs: [['jed', 'riy'], ['bah', 'dub'], ['chc', 'akl']], color: 'red', speed: 0.12, delay: 0.63 },
  { pairs: [['cns', 'bne'], ['hob', 'mel'], ['ccs', 'bog']], color: 'red', speed: 0.14, delay: 0.19 },
  { pairs: [['bhz', 'rio'], ['min', 'chi'], ['win', 'cal']], color: 'red', speed: 0.2, delay: 0.74 },
  { pairs: [['han', 'bkk'], ['kul', 'sgp'], ['jkt', 'mnl']], color: 'red', speed: 0.11, delay: 0.29 },
];

export const ACTIVITY_PULSES = PULSE_SPECS.map((spec) => {
  const hit = pickPulseLink(spec.pairs, spec.color, spec.speed, spec.delay);
  if (hit) return hit;
  return {
    link: Math.min(GLOBE_LINKS.length - 1, Math.floor(Math.abs(spec.delay) * GLOBE_LINKS.length) % GLOBE_LINKS.length),
    speed: spec.speed,
    delay: spec.delay,
    color: spec.color,
  };
}).filter((p) => p.link >= 0);

export const GLOBE_PULSES = ACTIVITY_PULSES;

export function getMeshTopologyStats() {
  return {
    ...linkDegreeStats(GLOBE_LINKS),
    hubs: GLOBE_REGIONAL_HUBS,
    counts: GLOBE_LINK_KIND_COUNTS,
    seed: GLOBE_MESH_SEED,
  };
}

export const GLOBE_LABEL_CATALOG = LABEL_CATALOG;

export const GLOBE_LABEL_GROUPS = {
  sports: GLOBE_LABEL_CATEGORIES.sports,
  community: GLOBE_LABEL_CATEGORIES.community,
  competition: GLOBE_LABEL_CATEGORIES.competition,
  management: GLOBE_LABEL_CATEGORIES.management,
  experience: GLOBE_LABEL_CATEGORIES.experience,
};

export const GLOBE_LABELS_ALWAYS = ['players', 'venues', 'matches', 'community'];

export const GLOBE_LABEL_MAX = GLOBE_PACKET_MAX;

export const GLOBE_LABELS_DESKTOP = [...GLOBE_ALL_LABEL_KEYS];

export const GLOBE_LABELS_MOBILE = [...GLOBE_MOBILE_PRIORITY_LABELS];

export { GLOBE_SPORT_LABELS };

/** Anclas de etiqueta = rutas (no ciudades fijas). Compat. */
export const GLOBE_LABEL_ANCHORS = Object.fromEntries(
  Object.keys(GLOBE_LABEL_CATALOG).map((key) => {
    const meta = GLOBE_LABEL_CATALOG[key];
    const hub = GLOBE_NODES.find((n) => n.level === 'C') || GLOBE_NODES[0];
    return [key, { lon: hub.lon, lat: hub.lat, mode: meta.mode, emphasize: false }];
  }),
);

const ROTATING_SETS = [
  ['community', 'tournaments', 'scoreboard', 'padel', 'ranking', 'competitions', 'teams', 'associations'],
  ['community', 'bookings', 'padcoins', 'memberships', 'clubs', 'pickleball', 'stats', 'federations'],
  ['community', 'scoreboard', 'tennis', 'organizations', 'events', 'courts', 'liveResults', 'standings'],
  ['community', 'tournaments', 'padbol', 'loyalty', 'experiences', 'notifications', 'clubs', 'referees'],
];

export function pickActiveLabels({ elapsedMs = 0, compact = false, tablet = false, reducedMotion = false }) {
  const max = compact
    ? GLOBE_LABEL_MAX.mobile
    : tablet
      ? GLOBE_LABEL_MAX.tablet
      : GLOBE_LABEL_MAX.desktop;

  if (reducedMotion) {
    const stable = compact
      ? GLOBE_STATIC_LABELS.mobile
      : tablet
        ? GLOBE_STATIC_LABELS.tablet
        : GLOBE_STATIC_LABELS.desktop;
    return stable.slice(0, max);
  }

  const cycle = Math.floor(Math.max(0, elapsedMs) / 5200) % ROTATING_SETS.length;
  const rotating = ROTATING_SETS[cycle];
  const merged = [];
  GLOBE_LABELS_ALWAYS.forEach((k) => {
    if (!merged.includes(k)) merged.push(k);
  });
  rotating.forEach((k) => {
    if (!merged.includes(k)) merged.push(k);
  });
  return merged.slice(0, max);
}

export function resolveLabelNode() {
  return null;
}

export function selectNodesForViewport(compact, tablet) {
  // En escritorio conservar todos los nodos no aporta lectura adicional, pero
  // sí suma proyecciones por cuadro mientras la portada está animada.
  const target = compact ? 54 : tablet ? 90 : GLOBE_NODE_COUNTS.desktop.min;
  if (target >= GLOBE_NODES.length) return GLOBE_NODES;

  const byRegion = new Map();
  GLOBE_NODES.forEach((n) => {
    if (!byRegion.has(n.region)) byRegion.set(n.region, []);
    byRegion.get(n.region).push(n);
  });

  const selected = new Set();
  GLOBE_NODES.filter((n) => n.level === 'A' || n.level === 'C' || n.major).forEach((n) => {
    selected.add(n.id);
  });
  byRegion.forEach((list) => {
    const sorted = [...list].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const take = compact ? 3 : tablet ? 4 : 5;
    sorted.slice(0, take).forEach((n) => selected.add(n.id));
  });

  /* Expandir 2 saltos por malla local/regional */
  const localAdj = new Map();
  GLOBE_LINKS.filter((l) => l.kind === 'local' || l.kind === 'regional').forEach((l) => {
    if (!localAdj.has(l.from)) localAdj.set(l.from, []);
    if (!localAdj.has(l.to)) localAdj.set(l.to, []);
    localAdj.get(l.from).push(l.to);
    localAdj.get(l.to).push(l.from);
  });
  for (let hop = 0; hop < 2; hop += 1) {
    [...selected].forEach((id) => {
      (localAdj.get(id) || []).forEach((nb) => {
        if (selected.size < target) selected.add(nb);
      });
    });
  }

  [...GLOBE_NODES]
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .forEach((n) => {
      if (selected.size >= target) return;
      selected.add(n.id);
    });
  return GLOBE_NODES.filter((n) => selected.has(n.id));
}

export function selectLinksForViewport(nodes, compact, tablet) {
  const ids = new Set(nodes.map((n) => n.id));
  const target = compact ? 78 : tablet ? 145 : 180;
  const filtered = GLOBE_LINKS.filter((l) => ids.has(l.from) && ids.has(l.to));
  const ranked = [...filtered].sort((a, b) => {
    const order = { local: 0, regional: 1, international: 2 };
    const ka = order[a.kind] ?? 3;
    const kb = order[b.kind] ?? 3;
    if (ka !== kb) return ka - kb;
    const wa = a.weight === 'primary' ? 0 : 1;
    const wb = b.weight === 'primary' ? 0 : 1;
    return wa - wb;
  });

  const intlCap = compact
    ? Math.max(5, Math.floor(Math.min(target, ranked.length) * 0.16))
    : tablet
      ? Math.max(8, Math.floor(Math.min(target, ranked.length) * 0.18))
      : ranked.length;
  const out = [];
  let intl = 0;
  ranked.forEach((l) => {
    if (out.length >= target) return;
    if (l.kind === 'international') {
      if (intl >= intlCap) return;
      intl += 1;
    }
    out.push(l);
  });
  return out;
}

export function selectPulsesForViewport(links, compact, tablet) {
  const pair = new Set(links.map((l) => `${l.from}|${l.to}`));
  const available = GLOBE_PULSES.filter((p) => {
    const full = GLOBE_LINKS[p.link];
    return full && (pair.has(`${full.from}|${full.to}`) || pair.has(`${full.to}|${full.from}`));
  });
  const max = compact
    ? GLOBE_PULSE_COUNTS.mobile.max
    : tablet
      ? GLOBE_PULSE_COUNTS.tablet.max
      : GLOBE_PULSE_COUNTS.desktop.max;
  return available.slice(0, max);
}

export function countFrontNodes(nodes, yawDeg, eps = 0.02) {
  return nodes.filter((n) => {
    const λ = ((n.lon + yawDeg) * Math.PI) / 180;
    const φ = (n.lat * Math.PI) / 180;
    return Math.cos(φ) * Math.cos(λ) >= eps;
  }).length;
}

/** No hay semántica de presencia operativa. */
export function hasOperationalPresenceSemantics() {
  return false;
}
