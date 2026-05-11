const BASE_PORCENTAJES = [
  { posicion: '1er lugar', porcentaje: 40 },
  { posicion: '2do lugar', porcentaje: 25 },
  { posicion: '3er lugar', porcentaje: 15 },
  { posicion: '4to lugar', porcentaje: 10 },
];

export function torneoCantidadPosicionesDistribucion(torneoLike) {
  const cantidad = parseInt(String(torneoLike?.cantidad_equipos ?? ''), 10);
  if (Number.isFinite(cantidad) && cantidad > 0) return Math.max(4, cantidad);

  const cupos = parseInt(String(torneoLike?.cupos_maximos ?? ''), 10);
  if (Number.isFinite(cupos) && cupos > 0) return Math.max(4, cupos);

  return 4;
}

export function calcularDistribucionPuntosTorneo(totalPuntosRaw, torneoLike = {}) {
  const totalPuntos = Number(String(totalPuntosRaw ?? '').replace(',', '.'));
  if (!Number.isFinite(totalPuntos) || totalPuntos <= 0) return [];

  const posiciones = torneoCantidadPosicionesDistribucion(torneoLike);
  const rows = BASE_PORCENTAJES.map((row) => ({
    ...row,
    puntos: Math.round((totalPuntos * row.porcentaje) / 100),
  }));

  if (posiciones > 4) {
    const porcentajeResto = 10 / (posiciones - 4);
    for (let pos = 5; pos <= posiciones; pos += 1) {
      rows.push({
        posicion: `${pos}to lugar`,
        porcentaje: porcentajeResto,
        puntos: Math.round((totalPuntos * porcentajeResto) / 100),
      });
    }
  } else {
    rows.push({
      posicion: 'Resto',
      porcentaje: 10,
      puntos: Math.round(totalPuntos * 0.1),
    });
  }

  return rows;
}

export function formatPorcentajeDistribucion(porcentaje) {
  const n = Number(porcentaje);
  if (!Number.isFinite(n)) return '0%';
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '')}%`;
}
