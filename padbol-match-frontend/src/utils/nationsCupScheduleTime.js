import { DateTime, IANAZone } from 'luxon';

/** The event's explicit zone determines the instant; never use the device zone. */
export function nationsCupScheduleInstant(localDateTime, timeZone) {
  if (typeof timeZone !== 'string' || !IANAZone.isValidZone(timeZone)) {
    throw new Error('Selecciona una zona horaria válida para el torneo.');
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(localDateTime || ''))) {
    throw new Error('Completa fecha y hora del partido.');
  }
  const date = DateTime.fromFormat(localDateTime, "yyyy-MM-dd'T'HH:mm", { zone: timeZone });
  if (!date.isValid || date.toFormat("yyyy-MM-dd'T'HH:mm") !== localDateTime) {
    throw new Error('La hora indicada no existe en la zona horaria del torneo.');
  }
  if (date.getPossibleOffsets().length !== 1) {
    throw new Error('La hora es ambigua por el cambio de horario. Elige una hora inequívoca.');
  }
  return date.toUTC().toISO({ suppressMilliseconds: true });
}

export function nationsCupScheduleLocal(instant, timeZone) {
  if (!IANAZone.isValidZone(timeZone) || typeof instant !== 'string') return '';
  const value = DateTime.fromISO(instant, { zone: timeZone });
  return value.isValid ? value.toFormat("yyyy-MM-dd'T'HH:mm") : '';
}
