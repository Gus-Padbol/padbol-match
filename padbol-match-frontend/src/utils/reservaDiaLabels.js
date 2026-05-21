import { padbolLangToIntlLocale } from './padbolLang';

/**
 * Etiquetas cortas para el selector de día (Hoy, Mañana, día abreviado).
 * @param {string} iso YYYY-MM-DD
 * @param {number} index 0 = hoy relativo al inicio del rango
 * @param {(key: string) => string} t
 * @param {string} [language] i18n.language
 */
export function labelDiaReservaCorta(iso, index, t, language = 'es') {
  if (index === 0) return t('reservas.dayToday');
  if (index === 1) return t('reservas.dayTomorrow');
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = padbolLangToIntlLocale(String(language || 'es').split('-')[0]);
  const w = d.toLocaleDateString(locale, { weekday: 'short' });
  const day = d.getDate();
  const mo = d.toLocaleDateString(locale, { month: 'short' });
  return `${w} ${day} ${mo}`;
}
