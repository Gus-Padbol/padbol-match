/**
 * Utilidades antimeridiano para GeoJSON / proyección del globo.
 * Detecta saltos ±180°, normaliza longitudes y divide rings.
 */

/** Normaliza longitud a [−180, 180]. Conserva ±180 como bordes del antimeridiano. */
export function normalizeLon(lon) {
  let x = Number(lon);
  if (!Number.isFinite(x)) return 0;
  if (x === 180 || x === -180) return x;
  x = ((((x + 180) % 360) + 360) % 360) - 180;
  return x === -180 ? 180 : x;
}

/** Diferencia de longitud más corta en (−180, 180]. */
export function lonDelta(a, b) {
  return normalizeLon(b - a);
}

/**
 * True si el segmento GeoJSON cruza el antimeridiano
 * (salto absoluto > 180° en la representación cruda).
 */
export function hasAntimeridianJump(lonA, lonB, threshold = 180) {
  return Math.abs(Number(lonA) - Number(lonB)) > threshold - 1e-9;
}

/**
 * Interpola el cruce en lon = ±180 entre dos puntos.
 * Desenvuelve la longitud del destino para no interpolar a través del salto crudo.
 * Devuelve [lonEdge, lat] con lonEdge ∈ {−180, 180} coherente con el lado de `from`.
 */
export function antimeridianCrossing(from, to) {
  const lon1 = Number(from[0]);
  const lon2 = Number(to[0]);
  const lat1 = Number(from[1]);
  const lat2 = Number(to[1]);
  const edge = lon1 > 0 ? 180 : -180;
  let lon2u = lon2;
  if (lon1 > 0 && lon2 < 0) lon2u = lon2 + 360;
  if (lon1 < 0 && lon2 > 0) lon2u = lon2 - 360;
  const denom = lon2u - lon1;
  const t = Math.abs(denom) < 1e-9 ? 0.5 : (edge - lon1) / denom;
  const lat = lat1 + (lat2 - lat1) * Math.max(0, Math.min(1, t));
  return [edge, lat];
}

/**
 * Divide un ring GeoJSON en polilíneas sin saltos antimeridiano.
 * No une puntos separados por ~360°.
 */
export function splitRingAtAntimeridian(ring) {
  if (!ring || ring.length < 2) return [];
  const parts = [];
  let current = [[normalizeLon(ring[0][0]), Number(ring[0][1])]];

  for (let i = 1; i < ring.length; i += 1) {
    const prevRaw = ring[i - 1];
    const nextRaw = ring[i];
    const prev = [normalizeLon(prevRaw[0]), Number(prevRaw[1])];
    const next = [normalizeLon(nextRaw[0]), Number(nextRaw[1])];

    if (hasAntimeridianJump(prevRaw[0], nextRaw[0])) {
      const cross = antimeridianCrossing(prevRaw, nextRaw);
      /* Conservar ±180 sin colapsar −180→180 */
      current.push([cross[0], cross[1]]);
      if (current.length >= 2) parts.push(current);
      const otherEdge = cross[0] > 0 ? -180 : 180;
      current = [[otherEdge, cross[1]], next];
    } else if (Math.abs(lonDelta(prev[0], next[0])) > 170) {
      /* Salto residual tras normalizar: cortar igual */
      const cross = antimeridianCrossing(prevRaw, nextRaw);
      current.push([cross[0], cross[1]]);
      if (current.length >= 2) parts.push(current);
      const otherEdge = cross[0] > 0 ? -180 : 180;
      current = [[otherEdge, cross[1]], next];
    } else {
      current.push(next);
    }
  }

  if (current.length >= 2) parts.push(current);
  return parts;
}

/**
 * True si un segmento proyectado sería una banda errónea
 * (ambos puntos frontales pero longitud geodésica demasiado larga en pantalla).
 */
export function isSpuriousChord(pa, pb, radius, maxFrac = 1.15) {
  if (!pa || !pb) return true;
  const dx = pa.x - pb.x;
  const dy = pa.y - pb.y;
  return Math.hypot(dx, dy) > radius * maxFrac;
}

/** Densifica un segmento lon/lat con slerp (pasos mínimos). */
export function densifySegment(from, to, maxStepDeg = 4) {
  const dLon = Math.abs(lonDelta(from[0], to[0]));
  const dLat = Math.abs(to[1] - from[1]);
  const span = Math.max(dLon, dLat);
  const steps = Math.max(1, Math.ceil(span / maxStepDeg));
  if (steps === 1) return [from, to];
  const out = [from];
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    /* interpolación lineal en lon normalizada (tras split antimeridiano es segura) */
    const lon = from[0] + lonDelta(from[0], to[0]) * t;
    const lat = from[1] + (to[1] - from[1]) * t;
    out.push([normalizeLon(lon), lat]);
  }
  out.push(to);
  return out;
}

export function densifyRing(ring, maxStepDeg = 4) {
  if (!ring || ring.length < 2) return [];
  const out = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const seg = densifySegment(ring[i], ring[i + 1], maxStepDeg);
    if (i === 0) out.push(...seg);
    else out.push(...seg.slice(1));
  }
  return out;
}
