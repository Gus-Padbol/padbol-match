// La respuesta pública contiene filas activas; la tarifa específica prevalece sobre Base.
export function resolverOfertasCanonicas(rows, deporte) {
  const dep = String(deporte || '').trim().toLowerCase();
  const chosen = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const duration = Number(row?.duracion_minutos);
    const sport = String(row?.deporte || '').trim().toLowerCase();
    const price = row?.precio == null || row.precio === '' ? NaN : Number(row.precio);
    if (![60,90,120].includes(duration) || !Number.isFinite(price) || price < 0 || (sport && sport !== dep) || row.activo === false) continue;
    const priority = sport === dep && dep ? 2 : 1;
    if (!chosen.has(duration) || chosen.get(duration).priority < priority) chosen.set(duration, { duracion_minutos: duration, precio: price, priority });
  }
  return [...chosen.values()].sort((a,b) => a.duracion_minutos-b.duracion_minutos).map(({priority,...row}) => row);
}
