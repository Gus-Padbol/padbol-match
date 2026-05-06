import { supabase } from '../supabaseClient';
import { normalizeJugadorEmail } from './jugadorNombreTorneo';
import { isPerfilTorneoCompleto } from './jugadorPerfil';
import { authUrlWithRedirect, authLoginRedirectPath } from './authLoginRedirect';
import { getDisplayName } from './displayName';

function normalizePlayer(p) {
  if (!p) return null;
  if (typeof p === 'string') return { nombre: p, email: '', estado: 'confirmado', foto_url: '' };
  const email = normalizeJugadorEmail(p);
  let estado = p.estado;
  if (!estado) {
    estado = email ? 'confirmado' : 'pendiente';
  }
  const rawNombre = String(p.nombre || '').trim();
  const nombre = rawNombre && !rawNombre.includes('@') ? rawNombre : '';
  return {
    id: p.id != null && p.id !== '' ? String(p.id) : null,
    nombre,
    apellido: p.apellido != null && String(p.apellido).trim() ? String(p.apellido).trim() : '',
    alias: p.alias != null && String(p.alias).trim() ? String(p.alias).trim() : '',
    email,
    estado,
    rol: p.rol != null && String(p.rol).trim() ? String(p.rol).trim() : '',
    foto_url: p?.foto_url != null && String(p.foto_url).trim() ? String(p.foto_url).trim() : '',
  };
}

function getPlayers(eq) {
  if (Array.isArray(eq?.jugadores)) {
    return eq.jugadores.map(normalizePlayer).filter(Boolean);
  }
  if (typeof eq?.jugadores === 'string' && eq.jugadores.trim()) {
    return eq.jugadores
      .split(' + ')
      .map((n) => ({ nombre: n.trim(), email: '', estado: 'confirmado', foto_url: '' }))
      .filter((p) => p.nombre);
  }
  return [];
}

function getRequests(eq) {
  if (Array.isArray(eq?.solicitudes)) {
    return eq.solicitudes.map(normalizePlayer).filter(Boolean);
  }
  return [];
}

function samePerson(a, b) {
  if (!a || !b) return false;
  if (a.id != null && b.id != null && String(a.id) === String(b.id)) return true;
  const ea = String(a.email || '').trim().toLowerCase();
  const eb = String(b.email || '').trim().toLowerCase();
  if (ea && eb && ea === eb) return true;
  const na = String(a.nombre || '').trim().toLowerCase();
  const nb = String(b.nombre || '').trim().toLowerCase();
  return Boolean(na && na === nb);
}

function jugadorCoincideConYo(p, yo, authUserId) {
  if (!p || !yo) return false;
  if (samePerson(p, yo)) return true;
  const pid = p.id != null && p.id !== '' ? String(p.id) : '';
  if (authUserId && pid && pid === String(authUserId)) return true;
  return false;
}

function esCreadorEquipoOMiAuth(eq, authEmailTrim, authUserId) {
  if (!eq || !authUserId) return false;
  if (String(eq.creador_id || '') === String(authUserId)) return true;
  const em = String(authEmailTrim || '').trim().toLowerCase();
  const ce = String(eq.creador_email || '').trim().toLowerCase();
  if (em && ce && ce === em) return true;
  return false;
}

/** `tipo_equipo` (insert) o columna legacy `tipo`. */
export function normalizeTipoEquipoEnEquipo(eq) {
  const t = String(eq?.tipo_equipo ?? eq?.tipo ?? '').trim().toLowerCase();
  if (t === 'abierto' || t === 'cerrado') return t;
  return '';
}

/**
 * Equipo abierto que aún no tiene inscripción confirmada y tiene cupo libre.
 * Visible para “busco compañero” sin depender de la revelación por horas del listado general.
 */
export function equipoAbiertoBuscandoCompanero(eq) {
  if (!eq) return false;
  if (normalizeTipoEquipoEnEquipo(eq) !== 'abierto') return false;
  if (eq.equipo_abierto === false) return false;
  const ins = String(eq.inscripcion_estado ?? '').trim().toLowerCase();
  if (ins === 'confirmado') return false;
  const cupo = Number(eq.cupo_maximo || eq.cupo || 2);
  return getPlayers(eq).length < cupo;
}

export function buildYoParaSolicitud(session, userProfile) {
  const authUserId = session?.user?.id != null && session.user.id !== '' ? String(session.user.id) : '';
  const email = String(session?.user?.email || '').trim();
  const nombre = getDisplayName(userProfile, session) || 'Jugador';
  return { id: authUserId || null, nombre, email };
}

export function findMiEquipoEnLista(equipos, session, userProfile) {
  if (!session?.user || !Array.isArray(equipos)) return null;
  const authUserId = String(session.user.id || '');
  const authEmail = String(session.user.email || '').trim().toLowerCase();
  const yo = buildYoParaSolicitud(session, userProfile);
  return (
    equipos.find(
      (eq) =>
        esCreadorEquipoOMiAuth(eq, authEmail, authUserId) ||
        getPlayers(eq).some((p) => jugadorCoincideConYo(p, yo, authUserId))
    ) || null
  );
}

export function findMiSolicitudEquipo(equipos, session, userProfile) {
  if (!session?.user || !Array.isArray(equipos)) return null;
  const authUserId = String(session.user.id || '');
  const yo = buildYoParaSolicitud(session, userProfile);
  return equipos.find((eq) => getRequests(eq).some((r) => jugadorCoincideConYo(r, yo, authUserId))) || null;
}

export function fotoCapitanEquipo(eq) {
  const players = getPlayers(eq);
  if (!players.length) return '';
  const uid = String(eq?.creador_id || '').trim();
  const em = String(eq?.creador_email || '').trim().toLowerCase();
  const cap =
    (uid ? players.find((p) => String(p?.id || '') === uid) : null) ||
    (em ? players.find((p) => String(p?.email || '').trim().toLowerCase() === em) : null) ||
    players[0];
  return cap ? String(cap.foto_url || '').trim() : '';
}

/**
 * Añade solicitud de unión (misma lógica que FormEquipos.pedirUnirme).
 * @returns {{ ok: true, nuevasSolicitudes: object[] } | { ok: false, message: string }}
 */
export async function solicitarUnirseAEquipoAbierto({
  equipo,
  session,
  userProfile,
  authLoading,
  navigate,
  location,
  torneoIdForRedirect,
  equiposTorneo,
}) {
  const yo = buildYoParaSolicitud(session, userProfile);
  const authUserId = session?.user?.id != null && session.user.id !== '' ? String(session.user.id) : '';

  const miEquipo = findMiEquipoEnLista(equiposTorneo, session, userProfile);
  if (miEquipo) {
    return { ok: false, message: 'Ya estás en un equipo' };
  }
  const miSolicitud = findMiSolicitudEquipo(equiposTorneo, session, userProfile);
  if (miSolicitud) {
    return { ok: false, message: 'Ya tienes una solicitud pendiente' };
  }

  if (authLoading) {
    return { ok: false, message: '' };
  }
  if (!session?.user) {
    navigate(authUrlWithRedirect(authLoginRedirectPath(location)));
    return { ok: false, message: '' };
  }
  if (!isPerfilTorneoCompleto()) {
    const back = `/torneo/${torneoIdForRedirect}/equipos`;
    navigate(`/mi-perfil?from=torneo&id=${encodeURIComponent(String(torneoIdForRedirect))}&redirect=${encodeURIComponent(back)}`, {
      state: { avisoPerfilTorneo: 'Completa tu perfil para crear o unirte a un equipo' },
    });
    return { ok: false, message: '' };
  }

  const players = getPlayers(equipo);
  const requests = getRequests(equipo);
  const cupo = Number(equipo.cupo_maximo || equipo.cupo || 2);

  if (equipo.equipo_abierto === false) {
    return { ok: false, message: 'Este equipo es cerrado: solo el capitán puede sumar jugadores.' };
  }

  if (players.length >= cupo) {
    return { ok: false, message: 'Equipo completo' };
  }

  if (requests.some((r) => samePerson(r, yo))) {
    return { ok: false, message: 'Ya pediste unirte a este equipo' };
  }

  const yoInscripcion = {
    ...yo,
    estado: String(yo.email || '').trim() ? 'confirmado' : 'pendiente',
  };
  const nuevasSolicitudes = [...requests, yoInscripcion];

  const { error } = await supabase.from('equipos').update({ solicitudes: nuevasSolicitudes }).eq('id', equipo.id);

  if (error) {
    console.error(error);
    return { ok: false, message: 'Error al pedir unirte' };
  }

  return { ok: true, nuevasSolicitudes };
}
