/** Primera URL de `fotos_urls` o imagen legacy (cards sede en /reservar y hub). */
export function primeraFotoSede(sede) {
  const arr = sede?.fotos_urls;
  if (Array.isArray(arr)) {
    for (const item of arr) {
      const u = String(item || '').trim();
      if (u) return u;
    }
  }
  const alt = String(sede?.imagen_url || sede?.foto_url || sede?.foto || '').trim();
  return alt || null;
}

export function horarioDisponibleTexto(sede) {
  const a = String(sede?.horario_apertura || '').trim() || '10:00';
  const c = String(sede?.horario_cierre || '').trim() || '23:00';
  return `Turnos ${a} – ${c}`;
}

/** Precio mínimo por turno para mostrar en card (mañana/tarde o base). */
export function precioDesdeCard(sede) {
  const base = Number(sede?.precio_por_reserva || sede?.precio_turno || 0);
  const m = Number(sede?.precio_manana);
  const t = Number(sede?.precio_tarde);
  if (Number.isFinite(m) && m > 0 && Number.isFinite(t) && t > 0) return Math.min(m, t);
  if (Number.isFinite(m) && m > 0) return m;
  if (Number.isFinite(t) && t > 0) return t;
  return base;
}

const SEP = ' · ';

/**
 * Ubicación para cards / cabeceras de reserva: opcionalmente bandera al inicio de `pais`,
 * y siempre **ciudad primero**, **nombre de país después**, unidos con punto medio (` · `).
 * Ej.: pais `🇺🇸 Estados Unidos`, ciudad `Miami` → flag `🇺🇸`, linea `Miami · Estados Unidos`.
 */
export function ciudadPaisConBandera(sede) {
  const ciudad = String(sede?.ciudad || '').trim();
  const raw = String(sede?.pais || '').trim();
  if (!raw) return { linea: ciudad || '—', flag: '' };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && String(parts[0]).length <= 8) {
    const paisSinBandera = parts.slice(1).join(' ').trim();
    const linea = [ciudad, paisSinBandera].filter(Boolean).join(SEP) || paisSinBandera || ciudad || '—';
    return {
      flag: parts[0],
      linea,
    };
  }
  const linea = [ciudad, raw].filter(Boolean).join(SEP) || raw;
  return { flag: '', linea };
}
