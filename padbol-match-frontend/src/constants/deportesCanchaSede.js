/**
 * Deportes ofrecidos en canchas (alta de sede, solicitud de licencia, POST /api/sedes/:id/deportes).
 * Claves en minúsculas; alineadas con oficiales del Backend.
 * MEJ-07 `custom` solo en CRUD de cancha / precios (ver `canchaDeporteCustom.js`); no va en preferencias ni torneos.
 */
export const DEPORTES_CANCHA_SEDE_OPTIONS = [
  { key: 'padbol', label: 'Padbol' },
  { key: 'padel', label: 'Pádel' },
  { key: 'pickleball', label: 'Pickleball' },
  { key: 'tenis', label: 'Tenis' },
];

export const DEPORTES_CANCHA_SEDE_KEYS = DEPORTES_CANCHA_SEDE_OPTIONS.map((o) => o.key);
