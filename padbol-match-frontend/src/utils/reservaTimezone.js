import { ymdTodayTorneoTz } from './torneoFechaInicioArt';

/** Sedes en Argentina: calendario y “hora actual” vs slots usan America/Argentina/Buenos_Aires. */
export function sedePaisEsArgentina(sede) {
  const p = String(sede?.pais || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return p === 'argentina' || p.startsWith('argentina ');
}

/** YYYY-MM-DD de “hoy” para la reserva según sede (ART si Argentina; si no, calendario del navegador). */
export function ymdHoyParaReservaSede(sede) {
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
 * Instantáneo UTC del inicio del slot en la fecha calendario de negocio.
 * Argentina: wall clock en Buenos Aires (IANA = UTC−3 sin DST desde 2009).
 * Otras sedes: mismo YYYY-MM-DD + HH:mm interpretado en hora local del navegador.
 */
export function slotStartMsParaReservaSede(fechaYmd, horaHHMM, sede) {
  const fy = String(fechaYmd || '').trim();
  const tm = String(horaHHMM || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fy) || !tm) return null;
  const h = parseInt(tm[1], 10);
  const min = parseInt(tm[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (sedePaisEsArgentina(sede)) {
    const hs = String(h).padStart(2, '0');
    const ms = String(min).padStart(2, '0');
    return new Date(`${fy}T${hs}:${ms}:00-03:00`).getTime();
  }
  const md = fy.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return new Date(Number(md[1]), Number(md[2]) - 1, Number(md[3]), h, min, 0, 0).getTime();
}
