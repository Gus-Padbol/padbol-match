/** Configuración explícita requerida por el esquema de sedes; no completa valores ausentes. */
export function validateSedeRequiredConfiguration(input = {}) {
  const rawPrice = String(input.precio_turno ?? '').trim();
  const price = Number(rawPrice);
  if (!rawPrice || !Number.isInteger(price) || price < 0 || price > 2147483647) {
    return { ok: false, error: 'price' };
  }
  const opening = String(input.horario_apertura ?? '').trim();
  const closing = String(input.horario_cierre ?? '').trim();
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!validTime.test(opening) || !validTime.test(closing)) {
    return { ok: false, error: 'hours' };
  }
  // El servidor interpreta cierre <= apertura como cierre al día siguiente.
  return { ok: true, fields: { precio_turno: price, horario_apertura: opening, horario_cierre: closing } };
}
