export const SEDE_AMENITY_DEFINITIONS = [
  { key: 'vestuarios', label: 'Vestuarios' },
  { key: 'duchas', label: 'Duchas' },
  { key: 'gimnasio', label: 'Gimnasio' },
  { key: 'buffet', label: 'Buffet' },
  { key: 'restaurante', label: 'Restaurante' },
  { key: 'estacionamiento', label: 'Estacionamiento' },
  { key: 'accesibilidad', label: 'Accesibilidad' },
  { key: 'wifi', label: 'WiFi' },
  { key: 'camaras_seguridad', label: 'Cámaras de seguridad' },
  { key: 'iluminacion_led', label: 'Iluminación LED' },
  { key: 'aire_acondicionado', label: 'Aire acondicionado' },
  { key: 'pro_shop', label: 'Pro shop' },
  { key: 'alquiler_equipamiento', label: 'Alquiler de equipamiento' },
  { key: 'clases_profesores', label: 'Clases / Profesores' },
  { key: 'area_infantil', label: 'Área infantil' },
  { key: 'transporte_publico', label: 'Acceso en transporte público' },
];

export function normalizeSedeAmenities(raw) {
  const keySet = new Set(SEDE_AMENITY_DEFINITIONS.map((item) => item.key));
  if (!raw) return [];

  const keys = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const key = String(item ?? '').trim().toLowerCase();
      if (keySet.has(key) || key.startsWith('custom:')) keys.push(key);
    }
  }
  return [...new Set(keys)];
}

export function amenitiesArrayToSelectionSet(amenities) {
  return new Set(normalizeSedeAmenities(amenities));
}

/** Pills ordenadas para perfil público según keys guardadas en sedes.amenities. */
export function resolveSedeAmenityChips(amenities) {
  const set = amenitiesArrayToSelectionSet(amenities);
  return [
    ...SEDE_AMENITY_DEFINITIONS.filter((item) => set.has(item.key)),
    ...[...set].filter((key) => key.startsWith('custom:')).map((key) => ({ key, label: key.slice(7) })),
  ];
}
