import { DEPORTES_CANCHA_SEDE_KEYS } from '../constants/deportesCanchaSede';

/** Conserva el deporte elegido al abrir una acción del hub; sin selección deja intacta la URL base. */
export function hubSportActionPath(basePath, selectedSport) {
  const path = String(basePath || '').trim();
  const sport = String(selectedSport || '').trim().toLowerCase();
  if (!path || !DEPORTES_CANCHA_SEDE_KEYS.includes(sport)) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}deporte=${encodeURIComponent(sport)}`;
}
