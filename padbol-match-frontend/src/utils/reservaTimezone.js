import { DateTime } from 'luxon';
import { ymdTodayTorneoTz } from './torneoFechaInicioArt';

function normalizeSedeTz(sede) {
  const raw = String(sede?.timezone || '').trim();
  if (!raw) return null;
  return DateTime.now().setZone(raw).isValid ? raw : null;
}

/** Sedes en Argentina (sin columna timezone): calendario ART. */
export function sedePaisEsArgentina(sede) {
  const p = String(sede?.pais || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return p === 'argentina' || p.startsWith('argentina ');
}

/** YYYY-MM-DD de “hoy” para la reserva según sede (`timezone` IANA o fallback). */
export function ymdHoyParaReservaSede(sede) {
  const tz = normalizeSedeTz(sede);
  if (tz) return DateTime.now().setZone(tz).toFormat('yyyy-LL-dd');
  if (sedePaisEsArgentina(sede)) {
    return ymdTodayTorneoTz() || ymdLocalBrowser();
  }
  return ymdLocalBrowser();
}

function ymdLocalBrowser() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Instantáneo UTC del inicio del slot en la fecha calendario de negocio de la sede.
 * Usa `sede.timezone` (IANA) cuando existe; si no, ART para Argentina; si no, hora local del navegador.
 */
export function slotStartMsParaReservaSede(fechaYmd, horaHHMM, sede) {
  const fy = String(fechaYmd || '').trim();
  const tm = String(horaHHMM || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fy) || !tm) return null;
  const h = parseInt(tm[1], 10);
  const min = parseInt(tm[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;

  const tz = normalizeSedeTz(sede);
  if (tz) {
    const [yy, mo, dd] = fy.split('-').map((x) => parseInt(x, 10));
    const dt = DateTime.fromObject(
      { year: yy, month: mo, day: dd, hour: h, minute: min, second: 0 },
      { zone: tz },
    );
    return dt.isValid ? dt.toMillis() : null;
  }

  if (sedePaisEsArgentina(sede)) {
    const hs = String(h).padStart(2, '0');
    const ms = String(min).padStart(2, '0');
    return new Date(`${fy}T${hs}:${ms}:00-03:00`).getTime();
  }
  const md = fy.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return new Date(Number(md[1]), Number(md[2]) - 1, Number(md[3]), h, min, 0, 0).getTime();
}
