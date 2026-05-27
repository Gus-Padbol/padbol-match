export const SEDE_AMENITY_DEFINITIONS = [
  { key: 'vestuarios', icon: '🚿', label: 'Vestuarios' },
  { key: 'duchas', icon: '🚿', label: 'Duchas' },
  { key: 'gimnasio', icon: '💪', label: 'Gimnasio' },
  { key: 'buffet', icon: '🍔', label: 'Buffet' },
  { key: 'restaurante', icon: '🍽️', label: 'Restaurante' },
  { key: 'estacionamiento', icon: '🅿️', label: 'Estacionamiento' },
  { key: 'accesibilidad', icon: '♿', label: 'Accesibilidad' },
  { key: 'wifi', icon: '📶', label: 'WiFi' },
  { key: 'camaras_seguridad', icon: '🎥', label: 'Cámaras de seguridad' },
  { key: 'iluminacion_led', icon: '💡', label: 'Iluminación LED' },
  { key: 'aire_acondicionado', icon: '❄️', label: 'Aire acondicionado' },
  { key: 'pro_shop', icon: '🏪', label: 'Pro shop' },
  { key: 'alquiler_equipamiento', icon: '👟', label: 'Alquiler de equipamiento' },
  { key: 'clases_profesores', icon: '🎓', label: 'Clases / Profesores' },
  { key: 'area_infantil', icon: '👶', label: 'Área infantil' },
  { key: 'transporte_publico', icon: '🚌', label: 'Acceso en transporte público' },
];

export function normalizeSedeAmenities(raw) {
  const keySet = new Set(SEDE_AMENITY_DEFINITIONS.map((item) => item.key));
  if (!raw) return [];

  const keys = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const key = String(item ?? '').trim().toLowerCase();
      if (keySet.has(key)) keys.push(key);
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
  return SEDE_AMENITY_DEFINITIONS.filter((item) => set.has(item.key));
}
