/**
 * Deportes ofrecidos en canchas (alta de sede, solicitud de licencia, POST /api/sedes/:id/deportes).
 * Claves en minúsculas; alineadas con {@link DEPORTES_SEDE_VALID} en el backend.
 */
export const DEPORTES_CANCHA_SEDE_OPTIONS = [
  { key: 'padbol', label: 'Padbol' },
  { key: 'padel', label: 'Pádel' },
  { key: 'pickleball', label: 'Pickleball' },
  { key: 'tenis', label: 'Tenis' },
  { key: 'futbol_5', label: 'Fútbol 5' },
  { key: 'futbol_7', label: 'Fútbol 7' },
];

export const DEPORTES_CANCHA_SEDE_KEYS = DEPORTES_CANCHA_SEDE_OPTIONS.map((o) => o.key);
