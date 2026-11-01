// Same public availability contract used by ReservaForm. No booking or price writes.
async function readSlots({ apiBase, sedeId, fecha, duracion, deporte, fetchImpl = fetch }, expandCourts = false) {
  const query = new URLSearchParams({ sede_id: String(sedeId), fecha, duracion: String(duracion), deporte });
  if (expandCourts) query.set('expand_courts', 'true');
  const response = await fetchImpl(`${apiBase}/api/disponibilidad?${query.toString()}`, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || !Array.isArray(payload?.slots)) throw new Error('AVAILABILITY_UNAVAILABLE');
  return payload.slots;
}
export async function fetchPartidoDisponibilidadPublica(context) {
  const slots = await readSlots(context);
  return slots
    .filter((slot) => slot?.disponible === true && Number(slot.canchas_libres) > 0 && /^\d{2}:\d{2}$/.test(String(slot.hora || '')))
    .map((slot) => ({ ...slot, hora_inicio: slot.hora }));
}
export async function fetchPartidoCanchasPublicas(context) {
  const slots = await readSlots(context, true);
  return slots.filter((slot) => String(slot?.hora || '') === context.hora && Number.isSafeInteger(Number(slot?.cancha)) && Number(slot.cancha) > 0)
    .map((slot) => ({ numero: Number(slot.cancha), cancha_id: slot.cancha_id, nombre: slot.nombre_cancha || slot.cancha_nombre || `Cancha ${slot.cancha}`, disponible: slot.disponible === true }));
}
