/**
 * Permisos de gestión de torneo según `user_roles` y sede/nivel del torneo.
 */

export function mismoIdSedeTorneo(a, b) {
  if (a == null || b == null || b === '') return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a).trim() === String(b).trim();
}

export function torneoNivelEsNacional(rawNivel) {
  const n = String(rawNivel || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  return n === 'nacional' || n.includes('nacional');
}

export function paisAdminCoincideSede(paisAdminRaw, paisSedeRaw) {
  const strip = (p) =>
    String(p || '')
      .replace(/^[\p{Emoji_Presentation}\s]+/u, '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const a = strip(paisAdminRaw);
  const b = strip(paisSedeRaw);
  if (!a || !b) return false;
  return b.includes(a) || a.includes(b);
}

export function readCachedUserRoleData() {
  try {
    const raw = localStorage.getItem('user_role_data');
    if (!raw) return null;
    const d = JSON.parse(raw);
    return { rol: d.rol, sedeId: d.sedeId, pais: d.pais };
  } catch {
    return null;
  }
}

/** Emails con acceso global histórico (sin depender de fila en user_roles). */
const LEGACY_GLOBAL_ADMIN_EMAILS = [
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
];

/**
 * Puede usar controles de gestión del torneo (iniciar/finalizar, resultados, gestionar equipos en UI).
 */
export function computeIsAdminEnTorneo({
  email,
  torneo,
  sedeTorneo,
  rol,
  userSedeId,
  userPaisRol,
  fromAdmin,
}) {
  const em = String(email || '').trim().toLowerCase();
  if (LEGACY_GLOBAL_ADMIN_EMAILS.includes(em)) return true;
  if (rol === 'super_admin') return true;
  if (!torneo) return false;

  if (rol === 'admin_club' && userSedeId != null && userSedeId !== '') {
    if (mismoIdSedeTorneo(userSedeId, torneo.sede_id)) return true;
  }

  if (fromAdmin) {
    const cached = readCachedUserRoleData();
    if (cached?.rol === 'admin_club' && mismoIdSedeTorneo(cached.sedeId, torneo.sede_id)) return true;
    if (cached?.rol === 'super_admin') return true;
    if (cached?.rol === 'admin_nacional' && torneoNivelEsNacional(torneo.nivel_torneo) && sedeTorneo) {
      if (paisAdminCoincideSede(cached.pais, sedeTorneo.pais)) return true;
    }
  }

  if (rol === 'admin_nacional' && torneoNivelEsNacional(torneo.nivel_torneo) && sedeTorneo) {
    if (paisAdminCoincideSede(userPaisRol, sedeTorneo.pais)) return true;
  }

  return false;
}

/**
 * Botón "Gestionar" equipos del torneo: solo `admin_club` de la sede del torneo o `admin_nacional`
 * del país en torneos nacionales. Sin `super_admin`, sin emails legacy, sin atajo `fromAdmin` / caché.
 */
export function computePuedeGestionarEquiposTorneo({
  torneo,
  sedeTorneo,
  rol,
  userSedeId,
  userPaisRol,
}) {
  if (!torneo) return false;
  if (rol === 'super_admin') return true;

  if (rol === 'admin_club' && userSedeId != null && userSedeId !== '') {
    if (mismoIdSedeTorneo(userSedeId, torneo.sede_id)) return true;
  }

  if (rol === 'admin_nacional' && torneoNivelEsNacional(torneo.nivel_torneo) && sedeTorneo) {
    if (paisAdminCoincideSede(userPaisRol, sedeTorneo.pais)) return true;
  }

  return false;
}
