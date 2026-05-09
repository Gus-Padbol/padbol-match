import { DateTime } from 'luxon';

const TZ_SEDE_DEFAULT = 'America/Argentina/Buenos_Aires';

function normalizeKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function inferTimezoneFromCiudadPais(ciudad, pais) {
  const c = normalizeKey(ciudad);
  const p = normalizeKey(pais);
  if (c === 'miami') return 'America/New_York';
  if (c === 'madrid') return 'Europe/Madrid';
  if (p.includes('argentina')) return TZ_SEDE_DEFAULT;
  return TZ_SEDE_DEFAULT;
}

function normalizeSedeTz(sede) {
  const raw = String(sede?.timezone || '').trim();
  if (raw) {
    const probe = DateTime.now().setZone(raw);
    if (probe.isValid) return raw;
  }
  return inferTimezoneFromCiudadPais(sede?.ciudad, sede?.pais);
}

/** YYYY-MM-DD de “hoy” en la zona de la sede (IANA en `sedes.timezone` o inferencia). */
export function ymdHoyParaReservaSede(sede) {
  const z = normalizeSedeTz(sede);
  return DateTime.now().setZone(z).toFormat('yyyy-LL-dd');
}

/**
 * Instantáneo UTC del inicio del slot: fecha + HH:mm en la pared local de la sede.
 */
export function slotStartMsParaReservaSede(fechaYmd, horaHHMM, sede) {
  const fy = String(fechaYmd || '').trim().slice(0, 10);
  const tm = String(horaHHMM || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fy) || !tm) return null;
  const z = normalizeSedeTz(sede);
  const [yy, mo, dd] = fy.split('-').map((x) => parseInt(x, 10));
  const dt = DateTime.fromObject(
    { year: yy, month: mo, day: dd, hour: parseInt(tm[1], 10), minute: parseInt(tm[2], 10), second: 0 },
    { zone: z },
  );
  return dt.isValid ? dt.toMillis() : null;
}
