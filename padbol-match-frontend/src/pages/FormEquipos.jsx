import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getOrCreateUsuarioBasico } from '../utils/usuarioBasico';
import {
  isPerfilTorneoCompleto,
  refreshJugadorPerfilFromSupabase,
  PERFIL_CHANGE_EVENT,
} from '../utils/jugadorPerfil';
import { setTorneoEquipoActual, clearEquipoActual, readEquipoActualForTorneo } from '../utils/torneoEquipoLocal';
import { setAdminNavContext, tieneContextoAdminGestionEquiposTorneo } from '../utils/adminNavContext';
import {
  getEquipoInscripcionEstado,
  etiquetaInscripcionEstado,
  iniciarPagoInscripcionTorneo,
  torneoPermiteNuevasInscripciones,
} from '../utils/torneoInscripcionPago';
import { authUrlWithRedirect, authLoginRedirectPath } from '../utils/authLoginRedirect';
import { getDisplayName } from '../utils/displayName';
import useUserRole from '../hooks/useUserRole';
import { computeIsAdminEnTorneo, computePuedeGestionarEquiposTorneo } from '../utils/torneoAdminAccess';
import {
  jugadorNombreTorneoEtiqueta,
  fetchJugadoresPerfilPorJugadores,
  buildJugadorPerfilLookupMaps,
  normalizeJugadorEmail,
} from '../utils/jugadorNombreTorneo';
import {
  buildCreadorJugadorParaEquipo,
  ensureCreadorPrimeroEnLista,
} from '../utils/equipoCreadorJugadores';
import { invitarJugadorEquipo } from '../utils/equipoInvitarApi';
import { CapitanBadgeC, esCapitanJugadorEnFila, ICONO_CAPITAN } from '../utils/equipoCapitanUi';
import TorneoTabbedView from '../components/torneo/TorneoTabbedView';

/** Backup del destino post-login (la URL ya lleva `?redirect=` con el mismo path). */
const PENDING_TORNEO_INVITE_LS = 'padbol_invite_torneo_equipo_return';

function esJugadorPendiente(p) {
  return p?.estado === 'pendiente';
}

function jugadorRegistradoParaTorneo(p) {
  if (!p || esJugadorPendiente(p)) return false;
  if (String(p.email || '').trim()) return true;
  if (p.id != null && p.id !== '') return true;
  return false;
}

function equipoListoParaTorneo(players, cupo) {
  const c = Number(cupo || 2);
  if (!players || players.length < c) return false;
  return players.every(jugadorRegistradoParaTorneo);
}

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

function pathSegmentJugadorPublico(p) {
  const raw = String(p?.alias || '').trim() || String(p?.nombre || '').trim() || 'jugador';
  return encodeURIComponent(raw.toLowerCase().replace(/\s+/g, '-'));
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

function equipoUserIdCoincide(eq, usuarioLocalId, authUserId) {
  const uidCol = String(eq?.creador_id || '');
  if (!uidCol) return false;
  if (uidCol === String(usuarioLocalId)) return true;
  if (authUserId && uidCol === String(authUserId)) return true;
  return false;
}

function jugadorCoincideConYo(p, yo, authUserId) {
  if (!p || !yo) return false;
  if (samePerson(p, yo)) return true;
  const pid = p.id != null && p.id !== '' ? String(p.id) : '';
  if (authUserId && pid && pid === String(authUserId)) return true;
  return false;
}

/** True si auth user id ya figura como creador o en jugadores[] de la fila equipos. */
function usuarioEstaEnEquipoRow(eq, authUserId) {
  if (!eq || !authUserId) return false;
  const uid = String(authUserId);
  if (String(eq.creador_id || '') === uid) return true;
  return getPlayers(eq).some((p) => {
    const pid = p.id != null && p.id !== '' ? String(p.id) : '';
    return pid === uid;
  });
}

function esCreadorEquipo(eq, authEmailTrim, usuarioBasico) {
  if (!eq || !usuarioBasico?.id) return false;
  if (String(eq.creador_id || '') === String(usuarioBasico.id)) return true;
  const em = String(authEmailTrim || '').trim().toLowerCase();
  const ce = String(eq.creador_email || '').trim().toLowerCase();
  if (!eq.creador_id && em && ce && ce === em) return true;
  return false;
}

function esCreadorEquipoOMiAuth(eq, authEmailTrim, usuarioBasico, authUserId) {
  return esCreadorEquipo(eq, authEmailTrim, usuarioBasico) || equipoUserIdCoincide(eq, usuarioBasico.id, authUserId);
}

export default function FormEquipos() {
  const { id } = useParams();
  const { session, loading: authLoading, userProfile } = useAuth();
  const torneoId = parseInt(id, 10);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const wantsCrearEquipo = searchParams.get('crear') === '1';
  const inviteEquipoIdNum = useMemo(() => {
    const r = searchParams.get('equipo');
    if (r == null || String(r).trim() === '') return NaN;
    const n = parseInt(String(r).trim(), 10);
    return Number.isFinite(n) ? n : NaN;
  }, [searchParams]);

  const inscripcionPageShellStyle = useMemo(
    () => ({
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#667eea,#764ba2)',
      boxSizing: 'border-box',
      paddingTop: hubContentPaddingTopCss(location.pathname),
      paddingLeft: 12,
      paddingRight: 12,
      paddingBottom: `calc(${HUB_CONTENT_PADDING_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`,
    }),
    [location.pathname]
  );

  const nombreCreador = session?.user ? getDisplayName(userProfile, session) : '';

  const authEmail = useMemo(() => String(session?.user?.email || '').trim(), [session?.user?.email]);

  const cuentaAuth = useMemo(() => {
    if (!authEmail) return null;
    return {
      email: authEmail,
      nombre: getDisplayName(userProfile, session),
      whatsapp: String(userProfile?.whatsapp || '').trim(),
      foto: userProfile?.foto_url ?? userProfile?.foto ?? null,
    };
  }, [authEmail, userProfile, session]);

  const currentClienteTorneo = useMemo(() => {
    if (!authEmail) return null;
    return { email: authEmail };
  }, [authEmail]);
  const { rol, sedeId: userSedeId, pais: userPaisRol } = useUserRole(currentClienteTorneo);

  const [perfilLsKey, setPerfilLsKey] = useState(0);

  const authUserId = useMemo(
    () => (session?.user?.id != null && session.user.id !== '' ? String(session.user.id) : null),
    [session?.user?.id]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const em = String(authEmail || '').trim();
      if (em) await refreshJugadorPerfilFromSupabase(em);
      if (alive) setPerfilLsKey((k) => k + 1);
    })();
    return () => {
      alive = false;
    };
  }, [torneoId, authEmail]);

  useEffect(() => {
    const fn = () => setPerfilLsKey((k) => k + 1);
    window.addEventListener(PERFIL_CHANGE_EVENT, fn);
    return () => window.removeEventListener(PERFIL_CHANGE_EVENT, fn);
  }, []);

  const perfilTorneoCompleto = useMemo(() => {
    void perfilLsKey;
    return isPerfilTorneoCompleto();
  }, [perfilLsKey]);
  const perfilIncompleto = !perfilTorneoCompleto;

  const [torneo, setTorneo] = useState(null);
  const [jugadoresTorneo, setJugadoresTorneo] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [nombreEquipo, setNombreEquipo] = useState('');
  const [cupoMaximo, setCupoMaximo] = useState(2);
  /** false = cerrado (default), true = abierto (solicitudes + etiquetas) */
  const [equipoAbierto, setEquipoAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nombreSede, setNombreSede] = useState(null);
  /** Fila sede del torneo (nombre, pais, ciudad) para permisos admin_nacional. */
  const [sedeTorneoRow, setSedeTorneoRow] = useState(null);
  const [companeroNombre, setCompaneroNombre] = useState('');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  /** inicio | crear | lista | mi_equipo | otros — solo isMobile */
  const [mobileVista, setMobileVista] = useState('inicio');
  /** null | crear | lista — solo escritorio, paso elección antes de acción */
  const [desktopFlujo, setDesktopFlujo] = useState(null);
  /** Tras abrir ?crear=1 sin sesión: se limpia la URL y se muestra aviso + CTA a login. */
  const [bannerCrearEquipoRequiereLogin, setBannerCrearEquipoRequiereLogin] = useState(false);
  const [salirEquipoIdConfirm, setSalirEquipoIdConfirm] = useState(null);
  const [savingSalirEquipo, setSavingSalirEquipo] = useState(false);
  const [mpInscripcionLoading, setMpInscripcionLoading] = useState(false);
  /** Filas `tabla_puntos` del torneo (solo si está finalizado). */
  const [tablaPuntosRows, setTablaPuntosRows] = useState([]);
  const [partidos, setPartidos] = useState([]);
  /** Fila en BD: ya existe equipo con este creador_id en el torneo (miEquipo aún no reflejado en UI). */
  const [equipoDuplicadoBloqueoId, setEquipoDuplicadoBloqueoId] = useState(null);
  const [perfilMapsTorneo, setPerfilMapsTorneo] = useState(() => buildJugadorPerfilLookupMaps([]));
  const [inviteEquipoRow, setInviteEquipoRow] = useState(null);
  const [inviteEquipoLoading, setInviteEquipoLoading] = useState(false);
  const [inviteEquipoError, setInviteEquipoError] = useState(null);
  const [inviteAccionPending, setInviteAccionPending] = useState(false);

  useEffect(() => {
    setDesktopFlujo(null);
    setMobileVista('inicio');
    setEquipoDuplicadoBloqueoId(null);
  }, [torneoId]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const irACrearEquipo = useCallback(() => {
    if (authLoading) return;
    if (!session?.user) {
      navigate(authUrlWithRedirect(`/torneo/${id}/equipos?crear=1`));
      return;
    }
    if (isMobile) setMobileVista('crear');
    else setDesktopFlujo('crear');
  }, [authLoading, session?.user, navigate, id, isMobile]);

  useEffect(() => {
    if (session?.user) setBannerCrearEquipoRequiereLogin(false);
  }, [session?.user]);

  const cargarTodo = async () => {
    if (!torneoId) return;

    setLoading(true);

    const [
      { data: torneoData, error: torneoError },
      { data: jugadoresData, error: jugadoresError },
      { data: equiposData, error: equiposError },
      { data: partidosData, error: partidosError },
    ] = await Promise.all([
      supabase.from('torneos').select('*').eq('id', torneoId).maybeSingle(),
      supabase.from('jugadores_torneo').select('*').eq('torneo_id', torneoId).order('id', { ascending: true }),
      supabase.from('equipos').select('*').eq('torneo_id', torneoId).order('id', { ascending: true }),
      supabase.from('partidos').select('*').eq('torneo_id', torneoId).order('fecha_hora', { ascending: true }),
    ]);

    if (torneoError) console.error(torneoError);
    if (jugadoresError) console.error(jugadoresError);
    if (equiposError) console.error(equiposError);
    if (partidosError) console.error(partidosError);

    let sedeNombre = null;
    let sedeFull = null;
    if (torneoData?.sede_id) {
      const { data: sedeData, error: sedeError } = await supabase
        .from('sedes')
        .select('nombre, pais, ciudad')
        .eq('id', torneoData.sede_id)
        .maybeSingle();
      if (sedeError) console.error(sedeError);
      sedeNombre = sedeData?.nombre || null;
      sedeFull = sedeData || null;
    }
    setNombreSede(sedeNombre);
    setSedeTorneoRow(sedeFull);

    setTorneo(torneoData || null);
    setJugadoresTorneo(Array.isArray(jugadoresData) ? jugadoresData : []);
    setEquipos(Array.isArray(equiposData) ? equiposData : []);
    setPartidos(Array.isArray(partidosData) ? partidosData : []);

    setLoading(false);
  };

  useEffect(() => {
    cargarTodo();
  }, [torneoId]);

  useEffect(() => {
    if (!Number.isFinite(torneoId) || torneo?.estado !== 'finalizado') {
      setTablaPuntosRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('tabla_puntos')
        .select('equipo_id, posicion, puntos')
        .eq('torneo_id', torneoId)
        .order('posicion', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[FormEquipos] tabla_puntos', error);
        setTablaPuntosRows([]);
        return;
      }
      setTablaPuntosRows(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [torneoId, torneo?.estado]);

  useEffect(() => {
    if (!Number.isFinite(inviteEquipoIdNum) || !Number.isFinite(torneoId)) {
      setInviteEquipoRow(null);
      setInviteEquipoError(null);
      setInviteEquipoLoading(false);
      return;
    }
    let cancelled = false;
    setInviteEquipoLoading(true);
    setInviteEquipoError(null);
    (async () => {
      const { data, error } = await supabase
        .from('equipos')
        .select('*')
        .eq('id', inviteEquipoIdNum)
        .maybeSingle();
      if (cancelled) return;
      setInviteEquipoLoading(false);
      if (error) {
        console.error(error);
        setInviteEquipoError('No se pudo cargar el equipo.');
        setInviteEquipoRow(null);
        return;
      }
      if (!data || Number(data.torneo_id) !== Number(torneoId)) {
        setInviteEquipoError('Este equipo no pertenece a este torneo.');
        setInviteEquipoRow(null);
        return;
      }
      setInviteEquipoRow(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteEquipoIdNum, torneoId]);

  useEffect(() => {
    if (!Number.isFinite(inviteEquipoIdNum) || !Number.isFinite(torneoId)) return;
    if (authLoading) return;
    if (session?.user) return;
    const returnPath = `/torneo/${torneoId}/equipos?equipo=${encodeURIComponent(String(inviteEquipoIdNum))}`;
    try {
      localStorage.setItem(PENDING_TORNEO_INVITE_LS, JSON.stringify({ returnPath, ts: Date.now() }));
    } catch (_) {}
    navigate(`/login?redirect=${encodeURIComponent(returnPath)}`, { replace: true });
  }, [inviteEquipoIdNum, torneoId, session?.user, authLoading, navigate]);

  useEffect(() => {
    if (!Number.isFinite(inviteEquipoIdNum)) return;
    const found = equipos.find((e) => Number(e.id) === Number(inviteEquipoIdNum));
    if (found) setInviteEquipoRow({ ...found });
  }, [equipos, inviteEquipoIdNum]);

  const equiposNormalizados = useMemo(() => {
    return equipos.map((eq) => ({
      ...eq,
      players: getPlayers(eq),
      requests: getRequests(eq),
      cupo: Number(eq.cupo_maximo || 2),
    }));
  }, [equipos]);

  const jugadoresParaLookupPerfil = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const eq of equipos) {
      for (const p of getPlayers(eq)) {
        const em = normalizeJugadorEmail(p);
        if (!em) continue;
        if (seen.has(em)) continue;
        seen.add(em);
        out.push(p);
      }
      for (const r of getRequests(eq)) {
        const em = normalizeJugadorEmail(r);
        if (!em) continue;
        if (seen.has(em)) continue;
        seen.add(em);
        out.push(r);
      }
    }
    return out;
  }, [equipos]);

  const perfilFetchKeyForm = useMemo(
    () =>
      jugadoresParaLookupPerfil
        .map((p) => normalizeJugadorEmail(p))
        .filter(Boolean)
        .sort()
        .join(';'),
    [jugadoresParaLookupPerfil]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!jugadoresParaLookupPerfil.length) {
        if (!cancelled) setPerfilMapsTorneo(buildJugadorPerfilLookupMaps([]));
        return;
      }
      const rows = await fetchJugadoresPerfilPorJugadores(jugadoresParaLookupPerfil);
      if (cancelled) return;
      setPerfilMapsTorneo(buildJugadorPerfilLookupMaps(rows));
    })();
    return () => {
      cancelled = true;
    };
  }, [perfilFetchKeyForm]);

  const nombreTorneoCtxForm = useMemo(
    () => ({
      perfilByEmailLower: perfilMapsTorneo.perfilByEmailLower,
      jugadoresTorneo,
      authSessionEmail: session?.user?.email ?? null,
      perfilSesion: userProfile,
      authSession: session,
      authUserId,
    }),
    [perfilMapsTorneo, jugadoresTorneo, session, userProfile, authUserId]
  );

  const currentJugador = useMemo(() => {
    const sessionEmail = String(session?.user?.email || '').trim();
    if (!cuentaAuth) {
      if (sessionEmail) {
        const byEmail = jugadoresTorneo.find((j) => j.email === sessionEmail);
        if (byEmail) return byEmail;
      }
      return null;
    }

    if (cuentaAuth.email) {
      const byEmail = jugadoresTorneo.find((j) => j.email === cuentaAuth.email);
      if (byEmail) return byEmail;
    }

    if (!cuentaAuth.email && cuentaAuth.nombre) {
      const byName = jugadoresTorneo.find((j) => j.nombre === cuentaAuth.nombre);
      if (byName) return byName;
    }

    return null;
  }, [jugadoresTorneo, cuentaAuth, perfilLsKey, session?.user?.email]);

  const yo = useMemo(() => {
    const u = getOrCreateUsuarioBasico();
    const idEfectivo = authUserId || u.id;
    if (!cuentaAuth) {
      return { id: idEfectivo, nombre: u.nombre, email: '' };
    }
    const nombreCliente = String(cuentaAuth.nombre || '').trim();
    const emailCliente = String(cuentaAuth.email || '').trim();
    const nombreJug = String(currentJugador?.nombre || '').trim();
    const emailJug = String(currentJugador?.email || '').trim();
    const nombreVis =
      (nombreJug && !nombreJug.includes('@') ? nombreJug : '') ||
      (nombreCliente && !nombreCliente.includes('@') ? nombreCliente : '') ||
      (session?.user ? getDisplayName(userProfile, session) : '') ||
      u.nombre;
    return {
      id: idEfectivo,
      nombre: nombreVis,
      email: emailJug || emailCliente,
    };
  }, [cuentaAuth, currentJugador, perfilLsKey, authUserId, session, userProfile]);

  const miEquipo = useMemo(() => {
    if (!yo) return null;
    const u = getOrCreateUsuarioBasico();
    const hintedId = readEquipoActualForTorneo(torneoId);
    if (hintedId) {
      const hinted = equiposNormalizados.find((eq) => String(eq.id) === String(hintedId));
      if (hinted) {
        const inTeam =
          esCreadorEquipoOMiAuth(hinted, authEmail, u, authUserId) ||
          hinted.players.some((p) => jugadorCoincideConYo(p, yo, authUserId));
        if (inTeam) return hinted;
      }
    }
    return (
      equiposNormalizados.find(
        (eq) =>
          esCreadorEquipoOMiAuth(eq, authEmail, u, authUserId) ||
          eq.players.some((p) => jugadorCoincideConYo(p, yo, authUserId))
      ) || null
    );
  }, [equiposNormalizados, yo, torneoId, authEmail, authUserId]);

  const miSolicitudPendiente = useMemo(() => {
    if (!yo) return null;
    return (
      equiposNormalizados.find((eq) => eq.requests.some((r) => jugadorCoincideConYo(r, yo, authUserId))) || null
    );
  }, [equiposNormalizados, yo, authUserId]);

  useEffect(() => {
    if (miEquipo?.id) setEquipoDuplicadoBloqueoId(null);
  }, [miEquipo?.id]);

  useEffect(() => {
    if (loading) return;
    const hintedId = readEquipoActualForTorneo(torneoId);
    if (!hintedId) return;
    const hinted = equiposNormalizados.find((eq) => String(eq.id) === String(hintedId));
    const u = getOrCreateUsuarioBasico();
    const inTeam =
      hinted &&
      (esCreadorEquipoOMiAuth(hinted, authEmail, u, authUserId) ||
        hinted.players.some((p) => jugadorCoincideConYo(p, yo, authUserId)));
    if (!inTeam) clearEquipoActual();
  }, [loading, torneoId, equiposNormalizados, yo, authEmail, authUserId]);

  const torneoCerrado = torneo?.estado === 'finalizado' || torneo?.estado === 'cancelado';
  const torneoCancelado = torneo?.estado === 'cancelado';
  const torneoFinalizado = torneo?.estado === 'finalizado';
  const flujoInscripcionTorneoActivo = Boolean(torneo && torneoPermiteNuevasInscripciones(torneo));

  useEffect(() => {
    if (location.state?.fromAdmin === true) setAdminNavContext(true);
  }, [location.state?.fromAdmin]);

  const sedesMapForm = useMemo(() => {
    if (!torneo?.sede_id) return {};
    const nombre = nombreSede || sedeTorneoRow?.nombre;
    if (!nombre) return {};
    const sid = String(torneo.sede_id);
    return {
      [sid]: {
        nombre,
        ciudad: sedeTorneoRow?.ciudad || '',
        pais: sedeTorneoRow?.pais || '',
      },
    };
  }, [torneo?.sede_id, nombreSede, sedeTorneoRow]);

  const contextoGestionEquiposTorneo = tieneContextoAdminGestionEquiposTorneo(location.state);

  const esAdminGestionTorneo = useMemo(
    () =>
      computeIsAdminEnTorneo({
        email: authEmail,
        torneo,
        sedeTorneo: sedeTorneoRow,
        rol,
        userSedeId,
        userPaisRol,
        fromAdmin: Boolean(location.state?.fromAdmin),
      }),
    [authEmail, torneo, sedeTorneoRow, rol, userSedeId, userPaisRol, location.state?.fromAdmin]
  );

  const puedeGestionarEquiposTorneo = useMemo(
    () =>
      computePuedeGestionarEquiposTorneo({
        torneo,
        sedeTorneo: sedeTorneoRow,
        rol,
        userSedeId,
        userPaisRol,
        fromAdmin: contextoGestionEquiposTorneo,
      }),
    [torneo, sedeTorneoRow, rol, userSedeId, userPaisRol, contextoGestionEquiposTorneo]
  );

  const torneoNavStateForm = useMemo(() => {
    const base =
      location.state && typeof location.state === 'object' ? { ...location.state } : {};
    if (location.state?.fromAdmin === true) base.fromAdmin = true;
    return Object.keys(base).length ? base : null;
  }, [location.state]);

  const filasClasificacionFinalizado = useMemo(() => {
    if (!torneoFinalizado || !Array.isArray(tablaPuntosRows) || tablaPuntosRows.length === 0) return [];
    const eqById = {};
    for (const e of equipos) eqById[e.id] = e;
    return tablaPuntosRows
      .map((row) => {
        const eq = eqById[row.equipo_id];
        const players = eq ? getPlayers(eq) : [];
        return {
          equipoId: eq?.id ?? row.equipo_id,
          posicion: Number(row.posicion) || 0,
          puntos: row.puntos,
          fotoEquipoUrl: String(eq?.foto_url || '').trim(),
          jugadores: players,
          equipoNombre: String(eq?.nombre || '').trim() || `Equipo #${row.equipo_id}`,
          jugadorLineas: players.slice(0, 4).map((p) => jugadorNombreTorneoEtiqueta(p, nombreTorneoCtxForm)),
        };
      })
      .sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
  }, [torneoFinalizado, tablaPuntosRows, equipos, nombreTorneoCtxForm]);

  /** Tras registro/login con ?crear=1: abrir formulario crear y limpiar la query. */
  useEffect(() => {
    if (!wantsCrearEquipo || loading) return;
    if (authLoading) return;
    const equipoQ = searchParams.get('equipo');
    const eqTail = equipoQ ? `?equipo=${encodeURIComponent(equipoQ)}` : '';
    if (!session?.user) {
      setBannerCrearEquipoRequiereLogin(true);
      navigate(`/torneo/${id}/equipos${eqTail}`, { replace: true });
      return;
    }
    if (!flujoInscripcionTorneoActivo || miEquipo || miSolicitudPendiente) {
      navigate(`/torneo/${id}/equipos${eqTail}`, { replace: true });
      return;
    }
    if (isMobile) setMobileVista('crear');
    else setDesktopFlujo('crear');
    navigate(`/torneo/${id}/equipos${eqTail}`, { replace: true });
  }, [
    wantsCrearEquipo,
    loading,
    authLoading,
    session?.user,
    flujoInscripcionTorneoActivo,
    miEquipo?.id,
    miSolicitudPendiente?.id,
    isMobile,
    id,
    navigate,
    searchParams,
  ]);

  useEffect(() => {
    if (loading || authLoading) return;
    if (torneo?.estado === 'cancelado') return;

    const run = async () => {
      if (!session?.user) return;
      const email = String(session.user.email || cuentaAuth?.email || '').trim();
      if (!email || !yo) return;
      const nombreNorm = (yo.nombre || '').trim().toLowerCase();
      if (!nombreNorm) return;

      for (const eq of equipos) {
        const players = getPlayers(eq);
        let changed = false;
        const next = players.map((p) => {
          if (
            p.estado === 'pendiente' &&
            (p.nombre || '').trim().toLowerCase() === nombreNorm &&
            !String(p.email || '').trim()
          ) {
            changed = true;
            return { ...p, email, estado: 'confirmado', id: yo.id ?? p.id };
          }
          return p;
        });
        if (!changed) continue;
        const { error } = await supabase.from('equipos').update({ jugadores: next }).eq('id', eq.id);
        if (!error) {
          setEquipos((prev) => prev.map((e) => (e.id === eq.id ? { ...e, jugadores: next } : e)));
        }
      }
    };
    void run();
  }, [loading, authLoading, authEmail, yo, equipos, torneo?.estado, authUserId, session?.user]);

  useEffect(() => {
    if (!isMobile || !flujoInscripcionTorneoActivo) return;
    if (miEquipo) setMobileVista('mi_equipo');
    else if (miSolicitudPendiente) setMobileVista('lista');
  }, [isMobile, flujoInscripcionTorneoActivo, miEquipo?.id, miSolicitudPendiente?.id]);

  const crearEquipo = async () => {
    const { data } = await supabase.auth.getSession();
    const sess = data.session;

    if (!sess || !sess.user) {
      alert('Tienes que iniciar sesión');
      navigate(authUrlWithRedirect(`/torneo/${torneoId}/equipos`));
      return;
    }

    if (!isPerfilTorneoCompleto()) {
      const back = `/torneo/${torneoId}/equipos`;
      navigate(
        `/mi-perfil?from=torneo&id=${encodeURIComponent(String(id))}&redirect=${encodeURIComponent(back)}`,
        {
          state: { avisoPerfilTorneo: 'Completa tu perfil para crear un equipo' },
        }
      );
      return;
    }

    const userId = sess.user.id;
    const emailAuth = String(sess.user.email || '').trim();
    const tipoEquipo = equipoAbierto ? 'abierto' : 'cerrado';

    const creadorJugador = buildCreadorJugadorParaEquipo(sess, userProfile, yo);
    if (!creadorJugador) {
      alert('Tienes que iniciar sesión');
      return;
    }
    if (!String(creadorJugador.email || '').trim()) {
      alert('Tu sesión no tiene email. Necesitamos el email en el equipo para identificar jugadores.');
      return;
    }

    const insertRow = {
      nombre: nombreEquipo.trim(),
      tipo_equipo: tipoEquipo,
      torneo_id: torneoId,
      creador_id: userId,
      jugadores: [creadorJugador],
      solicitudes: [],
      cupo_maximo: cupoMaximo,
      equipo_abierto: equipoAbierto,
    };
    if (emailAuth) insertRow.creador_email = emailAuth;

    setSaving(true);
    const { data: inserted, error } = await supabase
      .from('equipos')
      .insert(insertRow)
      .select('id, jugadores')
      .maybeSingle();
    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }

    const rowId = inserted?.id;
    if (rowId) {
      const persisted = getPlayers({ jugadores: inserted?.jugadores });
      const creatorPresent = persisted.some((p) => jugadorCoincideConYo(p, yo, String(userId)));
      if (!creatorPresent) {
        const fixed = ensureCreadorPrimeroEnLista(persisted, creadorJugador, yo, String(userId));
        const { error: repairErr } = await supabase
          .from('equipos')
          .update({ jugadores: fixed })
          .eq('id', rowId);
        if (repairErr) console.error('equipos jugadores (reparar creador):', repairErr);
      }
    }

    setSaving(false);
    window.location.reload();
  };

  const pedirUnirme = async (equipo, opts = {}) => {
    if (miEquipo) {
      alert('Ya estás en un equipo');
      return;
    }

    if (miSolicitudPendiente) {
      alert('Ya tienes una solicitud pendiente');
      return;
    }

    if (authLoading) return;
    if (!session?.user) {
      navigate(authUrlWithRedirect(authLoginRedirectPath(location)));
      return;
    }
    if (!isPerfilTorneoCompleto()) {
      const back = `/torneo/${torneoId}/equipos`;
      navigate(
        `/mi-perfil?from=torneo&id=${encodeURIComponent(String(id))}&redirect=${encodeURIComponent(back)}`,
        {
          state: { avisoPerfilTorneo: 'Completa tu perfil para crear o unirte a un equipo' },
        }
      );
      return;
    }

    const players = getPlayers(equipo);
    const requests = getRequests(equipo);
    const cupo = Number(equipo.cupo_maximo || 2);

    if (equipo.equipo_abierto === false) {
      alert('Este equipo es cerrado: solo el capitán puede sumar jugadores.');
      return;
    }

    if (players.length >= cupo) {
      alert('Equipo completo');
      return;
    }

    if (requests.some((r) => samePerson(r, yo))) {
      alert('Ya pediste unirte a este equipo');
      return;
    }

    const yoInscripcion = {
      ...yo,
      estado: String(yo.email || '').trim() ? 'confirmado' : 'pendiente',
    };
    const nuevasSolicitudes = [...requests, yoInscripcion];

    const { error } = await supabase
      .from('equipos')
      .update({ solicitudes: nuevasSolicitudes })
      .eq('id', equipo.id);

    if (error) {
      console.error(error);
      alert('Error al pedir unirte');
      return;
    }

    setEquipos((prev) =>
      prev.map((eq) =>
        eq.id === equipo.id ? { ...eq, solicitudes: nuevasSolicitudes } : eq
      )
    );
    if (typeof opts.onSuccess === 'function') opts.onSuccess();
  };

  const rechazarInvitacionDeepLink = () => {
    try {
      localStorage.removeItem(PENDING_TORNEO_INVITE_LS);
    } catch (_) {}
    navigate(`/torneo/${id}/equipos`, { replace: true });
  };

  const confirmarInvitacionDeepLink = async () => {
    if (!inviteEquipoRow) return;
    setInviteAccionPending(true);
    try {
      await pedirUnirme(inviteEquipoRow, {
        onSuccess: () => {
          try {
            localStorage.removeItem(PENDING_TORNEO_INVITE_LS);
          } catch (_) {}
          navigate(`/torneo/${id}/equipos`, { replace: true });
        },
      });
    } finally {
      setInviteAccionPending(false);
    }
  };

  const ejecutarSalirDelEquipoForm = async () => {
    if (!yo || salirEquipoIdConfirm == null) return;
    const raw = equipos.find((e) => e.id === salirEquipoIdConfirm);
    if (!raw) {
      setSalirEquipoIdConfirm(null);
      return;
    }
    const u = getOrCreateUsuarioBasico();
    const soyCreadorEq = esCreadorEquipoOMiAuth(raw, authEmail, u, authUserId);

    setSavingSalirEquipo(true);
    if (soyCreadorEq) {
      const { error } = await supabase.from('equipos').delete().eq('id', raw.id);
      setSavingSalirEquipo(false);
      if (error) {
        console.error(error);
        alert('No se pudo eliminar el equipo');
        return;
      }
      setSalirEquipoIdConfirm(null);
      const hint = readEquipoActualForTorneo(torneoId);
      if (hint && String(hint) === String(raw.id)) clearEquipoActual();
      setEquipos((prev) => prev.filter((e) => e.id !== raw.id));
    } else {
      const lista = getPlayers(raw);
      const nuevos = lista.filter((p) => !samePerson(p, yo));
      const reqs = getRequests(raw);
      const nuevasSolicitudes = reqs.filter((r) => !samePerson(r, yo));
      const updates = { jugadores: nuevos, solicitudes: nuevasSolicitudes };
      const { error } = await supabase.from('equipos').update(updates).eq('id', raw.id);
      setSavingSalirEquipo(false);
      if (error) {
        console.error(error);
        alert('No se pudo salir del equipo');
        return;
      }
      setSalirEquipoIdConfirm(null);
      const hint = readEquipoActualForTorneo(torneoId);
      if (hint && String(hint) === String(raw.id)) clearEquipoActual();
      setEquipos((prev) =>
        prev.map((e) => {
          if (e.id !== raw.id) return e;
          return { ...e, jugadores: nuevos, solicitudes: nuevasSolicitudes };
        })
      );
    }
    await cargarTodo();
    if (isMobile && mobileVista === 'mi_equipo') setMobileVista('lista');
    setDesktopFlujo(null);
  };

  const aceptarSolicitud = async (equipo, solicitud) => {
    const u = getOrCreateUsuarioBasico();
    if (!esCreadorEquipoOMiAuth(equipo, authEmail, u, authUserId)) return;

    const players = getPlayers(equipo);
    const requests = getRequests(equipo);
    const cupo = Number(equipo.cupo_maximo || 2);

    if (players.length >= cupo) {
      alert('Equipo completo');
      return;
    }

    const inviteEmail = String(solicitud.email || '').trim().toLowerCase();
    if (inviteEmail) {
      try {
        const data = await invitarJugadorEquipo(equipo.id, inviteEmail);
        const upd = data?.equipo;
        if (upd) {
          setEquipos((prev) => prev.map((eq) => (eq.id === upd.id ? { ...eq, ...upd } : eq)));
        }
      } catch (err) {
        console.error(err);
        alert(err?.message || 'Error al aceptar');
      }
      return;
    }

    const solicitudConfirmada = {
      ...solicitud,
      estado: String(solicitud.email || '').trim() ? 'confirmado' : 'pendiente',
    };
    const creadorEntry =
      session?.user && buildCreadorJugadorParaEquipo(session, userProfile, yo);
    const basePlayers = ensureCreadorPrimeroEnLista(players, creadorEntry, yo, authUserId);
    const nuevosJugadores = [...basePlayers, solicitudConfirmada];
    const nuevasSolicitudes = requests.filter((r) => !samePerson(r, solicitud));

    const { error } = await supabase
      .from('equipos')
      .update({
        jugadores: nuevosJugadores,
        solicitudes: nuevasSolicitudes,
      })
      .eq('id', equipo.id);

    if (error) {
      console.error(error);
      alert('Error al aceptar');
      return;
    }

    setEquipos((prev) =>
      prev.map((eq) =>
        eq.id === equipo.id
          ? { ...eq, jugadores: nuevosJugadores, solicitudes: nuevasSolicitudes }
          : eq
      )
    );
  };

  const rechazarSolicitud = async (equipo, solicitud) => {
    const u = getOrCreateUsuarioBasico();
    if (!esCreadorEquipoOMiAuth(equipo, authEmail, u, authUserId)) return;

    const requests = getRequests(equipo);
    const nuevasSolicitudes = requests.filter((r) => !samePerson(r, solicitud));

    const { error } = await supabase
      .from('equipos')
      .update({ solicitudes: nuevasSolicitudes })
      .eq('id', equipo.id);

    if (error) {
      console.error(error);
      alert('Error al rechazar');
      return;
    }

    setEquipos((prev) =>
      prev.map((eq) =>
        eq.id === equipo.id ? { ...eq, solicitudes: nuevasSolicitudes } : eq
      )
    );
  };

  const agregarCompanero = async () => {
    const u = getOrCreateUsuarioBasico();
    if (!miEquipo || !esCreadorEquipoOMiAuth(miEquipo, authEmail, u, authUserId)) return;

    const nombre = companeroNombre.trim();
    if (!nombre) {
      alert('Escribe el nombre del compañero');
      return;
    }

    let players = getPlayers(miEquipo);
    const creadorEntry =
      session?.user && buildCreadorJugadorParaEquipo(session, userProfile, yo);
    players = ensureCreadorPrimeroEnLista(players, creadorEntry, yo, authUserId);

    const cupo = Number(miEquipo.cupo_maximo || miEquipo.cupo || 2);
    if (players.length >= cupo) {
      alert('Equipo completo');
      return;
    }

    const nuevo = { nombre, estado: 'pendiente', email: null };
    if (jugadorCoincideConYo(nuevo, yo, authUserId)) {
      alert('No puedes agregarte como compañero');
      return;
    }
    if (players.some((p) => samePerson(p, nuevo))) {
      alert('Ese jugador ya está en el equipo');
      return;
    }

    const nuevosJugadores = [...players, nuevo];
    setSaving(true);
    const { error } = await supabase
      .from('equipos')
      .update({ jugadores: nuevosJugadores })
      .eq('id', miEquipo.id);
    setSaving(false);

    if (error) {
      console.error(error);
      alert('Error al agregar compañero');
      return;
    }

    setEquipos((prev) =>
      prev.map((eq) => (eq.id === miEquipo.id ? { ...eq, jugadores: nuevosJugadores } : eq))
    );
    setCompaneroNombre('');
  };

  const equiposVisibles = equiposNormalizados.filter((eq) => eq.players.length > 0);

  const miEquipoEnListado = useMemo(() => {
    if (!miEquipo) return null;
    return equiposVisibles.find((e) => e.id === miEquipo.id) || null;
  }, [miEquipo, equiposVisibles]);

  const otrosEquiposVisibles = useMemo(() => {
    if (miEquipoEnListado) return equiposVisibles.filter((e) => e.id !== miEquipoEnListado.id);
    return equiposVisibles;
  }, [equiposVisibles, miEquipoEnListado]);

  const equiposUnirseListado = useMemo(() => {
    const pool = miEquipoEnListado ? otrosEquiposVisibles : equiposVisibles;
    if (!flujoInscripcionTorneoActivo) return pool;
    return pool.filter((eq) => {
      const cupo = Number(eq.cupo_maximo || eq.cupo || 2);
      return eq.equipo_abierto === true && eq.players.length < cupo;
    });
  }, [flujoInscripcionTorneoActivo, miEquipoEnListado, otrosEquiposVisibles, equiposVisibles]);

  const otrosEquiposDisponiblesParaUnirse = useMemo(
    () =>
      otrosEquiposVisibles.filter((eq) => {
        const cupo = Number(eq.cupo_maximo || eq.cupo || 2);
        return eq.equipo_abierto === true && eq.players.length < cupo;
      }),
    [otrosEquiposVisibles]
  );

  const puedeOfrecerCrearDesdeLista = flujoInscripcionTorneoActivo && !miEquipo && !miSolicitudPendiente;
  /** Equipos con al menos un jugador en ficha (lista principal del torneo). */
  const sinEquiposEnTorneoVisibles = equiposVisibles.length === 0;

  const miEquipoLleno =
    !!miEquipo && miEquipo.players.length >= Number(miEquipo.cupo_maximo || miEquipo.cupo || 2);
  const miEquipoListoParaJugar = useMemo(
    () =>
      !!miEquipo &&
      equipoListoParaTorneo(miEquipo.players, Number(miEquipo.cupo_maximo || miEquipo.cupo || 2)),
    [miEquipo]
  );
  const miEquipoHayPendientes = useMemo(
    () => !!(miEquipo?.players && miEquipo.players.some(esJugadorPendiente)),
    [miEquipo]
  );
  const uBas = getOrCreateUsuarioBasico();
  const soyCreadorMiEquipo = !!miEquipo && esCreadorEquipoOMiAuth(miEquipo, authEmail, uBas, authUserId);

  const invitarWhatsappHref = useMemo(() => {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';
    const teamQ =
      miEquipo?.id != null && miEquipo.id !== '' ? `?equipo=${encodeURIComponent(String(miEquipo.id))}` : '';
    const url = `${base}/torneo/${id}/equipos${teamQ}`;
    const txt = `Te invito a registrarte en el torneo "${torneo?.nombre || 'Padbol'}" y confirmar tu lugar en el equipo: ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(txt)}`;
  }, [id, torneo?.nombre, miEquipo?.id]);

  const confirmarInscripcionTorneo = async () => {
    if (!miEquipo || !torneo) return;
    if (!soyCreadorMiEquipo) return;
    if (!miEquipoListoParaJugar) return;
    if (getEquipoInscripcionEstado(miEquipo) === 'confirmado') return;
    if (authLoading) return;
    if (!session?.user) {
      navigate(authUrlWithRedirect(authLoginRedirectPath(location)));
      return;
    }
    const em = String(session.user.email || '').trim();
    if (!em) {
      alert('Necesitas un email en tu perfil para pagar la inscripción.');
      return;
    }
    setMpInscripcionLoading(true);
    const r = await iniciarPagoInscripcionTorneo({
      equipoId: miEquipo.id,
      torneoId,
      email: em,
      torneoNombre: torneo.nombre,
      equipoNombre: miEquipo.nombre,
      torneo,
    });
    setMpInscripcionLoading(false);
    if (!r.ok) alert(r.error);
  };

  const renderEquipoCard = (eq, esTuEquipo, textoUnir = '+ Pedir unirme') => {
    const cupo = Number(eq.cupo_maximo || eq.cupo || 2);
    const numJug = eq.players.length;
    const plazasLlenas = numJug >= cupo;
    const soyCreador = esCreadorEquipoOMiAuth(eq, authEmail, getOrCreateUsuarioBasico(), authUserId);
    const marcaAbierto = eq.equipo_abierto === true;
    let estadoLinea = { texto: '', color: '#64748b' };
    if (plazasLlenas) {
      estadoLinea = { texto: 'Equipo completo', color: '#64748b' };
    } else if (eq.equipo_abierto === false) {
      estadoLinea = { texto: 'Equipo cerrado', color: '#b91c1c' };
    } else if (marcaAbierto) {
      estadoLinea = { texto: 'Equipo abierto – faltan jugadores', color: '#15803d' };
    } else {
      estadoLinea = { texto: 'Cupos libres', color: '#64748b' };
    }
    const mostrarBotonUnirse = marcaAbierto && !plazasLlenas;
    const insEst = getEquipoInscripcionEstado(eq);

    const cardStyle = esTuEquipo
      ? {
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '10px',
          background: '#ffffff',
          border: '2px solid #22c55e',
          boxShadow: '0 6px 22px rgba(22, 163, 74, 0.2)',
        }
      : {
          padding: '14px',
          borderRadius: '10px',
          marginBottom: '10px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          boxShadow: 'none',
        };

    return (
      <div key={eq.id} style={cardStyle}>
        {esTuEquipo ? (
          <div
            style={{
              fontSize: '10px',
              fontWeight: 900,
              letterSpacing: '0.12em',
              color: '#15803d',
              marginBottom: '8px',
            }}
          >
            TU EQUIPO
          </div>
        ) : null}

        <div style={{ fontWeight: 'bold', fontSize: '16px', color: esTuEquipo ? '#14532d' : '#1e293b' }}>{eq.nombre}</div>

        <div
          style={{
            marginTop: '8px',
            fontSize: '14px',
            fontWeight: 700,
            color: estadoLinea.color,
            lineHeight: 1.35,
          }}
        >
          {estadoLinea.texto}
        </div>

        <div style={{ marginTop: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: '999px',
              ...(insEst === 'confirmado'
                ? { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }
                : { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }),
            }}
          >
            {etiquetaInscripcionEstado(insEst)}
          </span>
        </div>

        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
          {eq.players.length > 0
            ? eq.players.map((p, i) => (
                <React.Fragment key={`${eq.id}-sum-${i}`}>
                  {i > 0 ? ' - ' : null}
                  {jugadorNombreTorneoEtiqueta(p, nombreTorneoCtxForm)}
                  {esCapitanJugadorEnFila(p, eq) ? <CapitanBadgeC /> : null}
                </React.Fragment>
              ))
            : 'Sin jugadores'}
        </div>

        {eq.players.length > 0 ? (
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', display: 'grid', gap: '4px' }}>
            {eq.players.map((p, idx) => {
              const rolTuEquipo = esTuEquipo && esJugadorPendiente(p) ? ' (pendiente)' : '';
              const ocultarEstadoRepetido = esTuEquipo && rolTuEquipo;
              return (
              <div
                key={`${eq.id}-pl-${idx}`}
                style={{
                  display: 'flex',
                  justifyContent: esTuEquipo && !soyCreador ? 'flex-start' : 'space-between',
                  gap: '8px',
                }}
              >
                <span style={{ fontWeight: 600, color: '#334155', display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span>{jugadorNombreTorneoEtiqueta(p, nombreTorneoCtxForm)}</span>
                  {esCapitanJugadorEnFila(p, eq) ? <CapitanBadgeC /> : null}
                  {rolTuEquipo ? (
                    <span style={{ fontWeight: 600, color: '#64748b' }}>{rolTuEquipo}</span>
                  ) : null}
                </span>
                {samePerson(p, yo) && !perfilTorneoCompleto ? (
                  <span style={{ color: '#b45309', fontWeight: 800, fontSize: '11px' }}>Perfil incompleto</span>
                ) : !(esTuEquipo && !soyCreador) ? (
                  ocultarEstadoRepetido ? null : esJugadorPendiente(p) ? (
                    <span style={{ color: '#b45309', fontWeight: 600 }}>Pendiente de confirmación</span>
                  ) : (
                    <span
                      style={{
                        color: esTuEquipo ? '#15803d' : '#64748b',
                        fontWeight: 600,
                      }}
                    >
                      {esTuEquipo ? 'Confirmado' : 'Jugador confirmado'}
                    </span>
                  )
                ) : null}
              </div>
            );
            })}
          </div>
        ) : null}

        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
          {numJug}/{cupo} jugadores
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(`/torneo/${id}/equipos/${eq.id}`)}
            style={{
              padding: '6px 10px',
              background: eq.id === miEquipo?.id ? '#166534' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {eq.id === miEquipo?.id ? 'Ver mi equipo' : 'Ver equipo'}
          </button>

          {mostrarBotonUnirse &&
            !miEquipo &&
            !miSolicitudPendiente &&
            !soyCreador &&
            yo && (
            <button
              onClick={() => pedirUnirme(eq)}
              style={{
                padding: '6px 10px',
                background: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {textoUnir}
            </button>
          )}

          {esTuEquipo &&
          yo &&
          !torneoCancelado &&
          (eq.players.some((p) => samePerson(p, yo)) || soyCreador) ? (
            <button
              type="button"
              onClick={() => setSalirEquipoIdConfirm(eq.id)}
              style={{
                padding: '6px 10px',
                background: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {soyCreador ? 'Disolver equipo' : 'Salir del equipo'}
            </button>
          ) : null}
        </div>

        {soyCreador && eq.requests.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
              Solicitudes pendientes
            </div>

            {eq.requests.map((sol, idx) => (
              <div
                key={`${eq.id}-req-${idx}`}
                style={{
                  background: '#fff',
                  borderRadius: '8px',
                  padding: '8px',
                  marginBottom: '8px',
                }}
              >
                <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                  {jugadorNombreTorneoEtiqueta(sol, nombreTorneoCtxForm)}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => aceptarSolicitud(eq, sol)}
                    style={{
                      padding: '6px 10px',
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Aceptar
                  </button>

                  <button
                    onClick={() => rechazarSolicitud(eq, sol)}
                    style={{
                      padding: '6px 10px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const mobileInicio =
    isMobile && flujoInscripcionTorneoActivo && !miEquipo && !miSolicitudPendiente && mobileVista === 'inicio';
  const mobileCrear =
    isMobile && flujoInscripcionTorneoActivo && !miEquipo && !miSolicitudPendiente && mobileVista === 'crear';
  const mobileListaEquipos =
    isMobile && !miEquipo && flujoInscripcionTorneoActivo && (mobileVista === 'lista' || miSolicitudPendiente);
  const mobileListaTorneoCerrado = isMobile && torneoCerrado;
  const mobileMiEquipoVista = isMobile && miEquipo && mobileVista === 'mi_equipo';
  const mobileOtrosEquipos = isMobile && miEquipo && mobileVista === 'otros';

  const crearEquipoFormulario = (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
      <h3>👥 Crear equipo</h3>

      <div
        style={{
          padding: '12px',
          marginBottom: '12px',
          borderRadius: '8px',
          background: '#f3f4f6',
          fontWeight: 600,
        }}
      >
        {ICONO_CAPITAN} Capitán: {nombreCreador}
      </div>

      <input
        placeholder="Nombre del equipo"
        value={nombreEquipo}
        onChange={(e) => setNombreEquipo(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginTop: '10px',
          borderRadius: '8px',
          border: '1px solid #ccc',
        }}
      />

      <select
        value={cupoMaximo}
        onChange={(e) => setCupoMaximo(Number(e.target.value))}
        style={{
          width: '100%',
          padding: '10px',
          marginTop: '10px',
          borderRadius: '8px',
          border: '1px solid #ccc',
        }}
      >
        <option value={2}>Equipo de 2</option>
        <option value={3}>Equipo de 3</option>
        <option value={4}>Equipo de 4</option>
      </select>

      <div style={{ marginTop: '14px' }}>
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '8px' }}>Tipo de equipo</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setEquipoAbierto(false)}
            style={{
              flex: '1 1 120px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: equipoAbierto ? '1px solid #d1d5db' : '2px solid #166534',
              background: equipoAbierto ? '#fff' : '#ecfdf5',
              color: equipoAbierto ? '#6b7280' : '#14532d',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cerrado
          </button>
          <button
            type="button"
            onClick={() => setEquipoAbierto(true)}
            style={{
              flex: '1 1 120px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: !equipoAbierto ? '1px solid #d1d5db' : '2px solid #2563eb',
              background: !equipoAbierto ? '#fff' : '#eff6ff',
              color: !equipoAbierto ? '#6b7280' : '#1e40af',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Abierto
          </button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6b7280', lineHeight: 1.45 }}>
          Abierto: otros jugadores pueden <strong>solicitar</strong> unirse; el capitán sigue aprobando cada
          ingreso.
        </p>
      </div>

      <button
        type="button"
        onClick={crearEquipo}
        disabled={saving || !nombreEquipo.trim()}
        style={{
          marginTop: '10px',
          width: '100%',
          padding: '12px',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          opacity: saving || !nombreEquipo.trim() ? 0.6 : 1,
        }}
      >
        + Crear equipo
      </button>
    </div>
  );

  const renderEquipoLecturaCancelado = (eq) => (
    <div
      key={eq.id}
      style={{
        padding: '14px',
        borderRadius: '10px',
        marginBottom: '10px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b' }}>{eq.nombre}</div>
      {eq.players.length > 0 ? (
        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', lineHeight: 1.45 }}>
          {eq.players.map((p, i) => (
            <React.Fragment key={`${eq.id}-can-${i}`}>
              {i > 0 ? ' · ' : null}
              {jugadorNombreTorneoEtiqueta(p, nombreTorneoCtxForm)}
              {esCapitanJugadorEnFila(p, eq) ? <CapitanBadgeC /> : null}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>Sin jugadores</div>
      )}
    </div>
  );

  const listaEquiposContenido = (textoUnir, onCrearEquipoClick) => (
    <>
      {torneoCerrado && !torneoCancelado && (
        <div
          style={{
            marginBottom: '12px',
            background: '#f3f4f6',
            color: '#374151',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Este torneo está {torneo?.estado}. Solo se muestran los equipos participantes.
        </div>
      )}

      {miEquipoEnListado ? (
        <div
          style={{
            marginBottom: '8px',
            padding: '18px 16px',
            borderRadius: '14px',
            background: 'linear-gradient(180deg, #ecfdf5 0%, #f7fee7 100%)',
            border: '2px solid #86efac',
            boxShadow: '0 4px 22px rgba(34, 197, 94, 0.18)',
          }}
        >
          <h3
            style={{
              margin: '0 0 14px',
              fontSize: '1.2rem',
              color: '#14532d',
              fontWeight: 900,
              letterSpacing: '-0.02em',
            }}
          >
            Tu equipo
          </h3>
          {renderEquipoCard(miEquipoEnListado, true, textoUnir)}
        </div>
      ) : null}

      {flujoInscripcionTorneoActivo &&
      (sinEquiposEnTorneoVisibles || (!miEquipoEnListado && equiposUnirseListado.length === 0)) ? (
        <div style={{ marginTop: miEquipoEnListado ? '20px' : 0 }}>
          <p
            style={{
              margin: '0 0 18px',
              fontSize: '15px',
              fontWeight: 700,
              color: '#334155',
              lineHeight: 1.45,
            }}
          >
            No hay equipos buscando jugadores en este momento
          </p>
          {puedeOfrecerCrearDesdeLista && typeof onCrearEquipoClick === 'function' ? (
            <button
              type="button"
              onClick={onCrearEquipoClick}
              style={{
                width: '100%',
                maxWidth: '320px',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: 800,
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
              }}
            >
              Crear mi equipo
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {equiposUnirseListado.length > 0 && (
            <h3 style={{ marginTop: miEquipoEnListado ? '20px' : 0, marginBottom: '12px' }}>
              🏆 Formar equipos ({equiposUnirseListado.length})
            </h3>
          )}

          {miEquipoEnListado ? (
            <div
              style={{
                marginTop: '20px',
                marginBottom: '12px',
                fontWeight: 800,
                fontSize: '15px',
                color: '#334155',
                letterSpacing: '0.02em',
              }}
            >
              Otros equipos disponibles
            </div>
          ) : null}

          {miEquipoEnListado && equiposUnirseListado.length === 0 ? (
            <div
              style={{
                marginBottom: '14px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                color: '#64748b',
                lineHeight: 1.45,
              }}
            >
              No hay otros equipos abiertos a los que unirte en este momento.
            </div>
          ) : null}

          {equiposUnirseListado.map((eq) => renderEquipoCard(eq, false, textoUnir))}
        </>
      )}
    </>
  );

  const mostrarPasoEleccion = flujoInscripcionTorneoActivo && !miEquipo && !miSolicitudPendiente;
  const mostrarEleccionDesktop = !isMobile && mostrarPasoEleccion;

  const handleInscripcionHeaderBack = useCallback(() => {
    if (esAdminGestionTorneo && contextoGestionEquiposTorneo) {
      navigate('/admin');
      return;
    }
    if (!mostrarPasoEleccion) {
      if (typeof window !== 'undefined') window.history.back();
      return;
    }
    if (isMobile) {
      if (mobileVista !== 'inicio') {
        setMobileVista('inicio');
        return;
      }
    } else if (desktopFlujo != null) {
      setDesktopFlujo(null);
      return;
    }
    if (typeof window !== 'undefined') window.history.back();
  }, [
    esAdminGestionTorneo,
    contextoGestionEquiposTorneo,
    navigate,
    mostrarPasoEleccion,
    isMobile,
    mobileVista,
    desktopFlujo,
  ]);

  const hayParamInvitacionEquipo = Number.isFinite(inviteEquipoIdNum);

  const bloqueInvitacionEquipoDeepLink =
    !hayParamInvitacionEquipo || !flujoInscripcionTorneoActivo ? null : (() => {
      const u0 = getOrCreateUsuarioBasico();
      const jugadoresConfirmadosInv = inviteEquipoRow
        ? getPlayers(inviteEquipoRow).filter(jugadorRegistradoParaTorneo)
        : [];
      const yaOtroEquipoMismoTorneo =
        !!session?.user && !!miEquipo && Number(miEquipo.id) !== Number(inviteEquipoIdNum);
      const yaEsteEquipo =
        !!session?.user && !!miEquipo && Number(miEquipo.id) === Number(inviteEquipoIdNum);
      const solicitudPendienteEnInvitado =
        !!session?.user &&
        !!inviteEquipoRow &&
        getRequests(inviteEquipoRow).some((r) => jugadorCoincideConYo(r, yo, authUserId));
      const yaEnPlantelInvitado =
        !!session?.user &&
        !!inviteEquipoRow &&
        (esCreadorEquipoOMiAuth(inviteEquipoRow, authEmail, u0, authUserId) ||
          usuarioEstaEnEquipoRow(inviteEquipoRow, authUserId) ||
          getPlayers(inviteEquipoRow).some((p) => jugadorCoincideConYo(p, yo, authUserId)));
      const equipoCerradoNoSolicitudes = inviteEquipoRow && inviteEquipoRow.equipo_abierto === false;
      const cupoInv = inviteEquipoRow ? Number(inviteEquipoRow.cupo_maximo || inviteEquipoRow.cupo || 2) : 2;
      const llenoInv =
        inviteEquipoRow && getPlayers(inviteEquipoRow).length >= cupoInv;

      return (
        <div
          key="invitacion-deep-link"
          style={{
            marginBottom: '16px',
            padding: '18px 20px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 55%)',
            border: '2px solid #6366f1',
            boxShadow: '0 10px 36px rgba(79, 70, 229, 0.18)',
            textAlign: 'left',
          }}
        >
          {inviteEquipoLoading && !inviteEquipoRow ? (
            <div style={{ fontWeight: 700, color: '#312e81' }}>Cargando invitación…</div>
          ) : inviteEquipoError ? (
            <div style={{ fontWeight: 700, color: '#991b1b' }}>{inviteEquipoError}</div>
          ) : yaOtroEquipoMismoTorneo ? (
            <div style={{ fontWeight: 700, color: '#92400e', lineHeight: 1.5 }}>
              Ya estás inscripto en otro equipo en este torneo.
            </div>
          ) : yaEnPlantelInvitado || yaEsteEquipo ? (
            <>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#14532d', marginBottom: '8px' }}>
                Ya formás parte de {inviteEquipoRow?.nombre ? `«${inviteEquipoRow.nombre}»` : 'este equipo'}.
              </div>
              <button
                type="button"
                onClick={() => navigate(`/torneo/${id}/equipos/${inviteEquipoIdNum}`)}
                style={{
                  marginTop: '10px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 800,
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white',
                }}
              >
                Ver equipo
              </button>
            </>
          ) : solicitudPendienteEnInvitado ? (
            <div style={{ fontWeight: 700, color: '#92400e', lineHeight: 1.5 }}>
              Tu solicitud para unirte a {inviteEquipoRow?.nombre ? `«${inviteEquipoRow.nombre}»` : 'este equipo'}{' '}
              está pendiente de aprobación del capitán.
            </div>
          ) : inviteEquipoRow ? (
            <>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.14em',
                  color: '#4338ca',
                  marginBottom: '8px',
                }}
              >
                INVITACIÓN
              </div>
              <h2
                style={{
                  margin: '0 0 6px',
                  fontSize: 'clamp(1.2rem, 3.5vw, 1.45rem)',
                  fontWeight: 900,
                  color: '#0f172a',
                }}
              >
                {inviteEquipoRow.nombre || 'Equipo'}
              </h2>
              <p style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#334155', lineHeight: 1.45 }}>
                Fuiste invitado a unirte a este equipo
              </p>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#64748b',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}
              >
                Jugadores confirmados
              </div>
              <ul style={{ margin: '0 0 16px', paddingLeft: '20px', color: '#1e293b', fontWeight: 600, lineHeight: 1.5 }}>
                {jugadoresConfirmadosInv.length ? (
                  jugadoresConfirmadosInv.map((p, idx) => (
                    <li key={`inv-conf-${idx}`} style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span>{jugadorNombreTorneoEtiqueta(p, nombreTorneoCtxForm)}</span>
                      {inviteEquipoRow && esCapitanJugadorEnFila(p, inviteEquipoRow) ? <CapitanBadgeC /> : null}
                    </li>
                  ))
                ) : (
                  <li style={{ listStyle: 'none', marginLeft: '-20px', color: '#64748b' }}>
                    Todavía no hay jugadores confirmados
                  </li>
                )}
              </ul>
              {!session?.user ? (
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#475569' }}>
                  Iniciá sesión para confirmar tu lugar.
                </p>
              ) : equipoCerradoNoSolicitudes ? (
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#b45309', lineHeight: 1.45 }}>
                  Este equipo es cerrado: no acepta solicitudes. Contactá al capitán para que te sume.
                </p>
              ) : llenoInv ? (
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#64748b' }}>
                  Este equipo ya está completo.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <button
                    type="button"
                    disabled={inviteAccionPending}
                    onClick={() => void confirmarInvitacionDeepLink()}
                    style={{
                      padding: '12px 18px',
                      fontSize: '15px',
                      fontWeight: 800,
                      borderRadius: '12px',
                      border: 'none',
                      cursor: inviteAccionPending ? 'default' : 'pointer',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      color: 'white',
                      boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                      opacity: inviteAccionPending ? 0.65 : 1,
                    }}
                  >
                    {inviteAccionPending ? 'Enviando…' : 'Confirmar mi lugar'}
                  </button>
                  <button
                    type="button"
                    disabled={inviteAccionPending}
                    onClick={rechazarInvitacionDeepLink}
                    style={{
                      padding: '12px 18px',
                      fontSize: '14px',
                      fontWeight: 800,
                      borderRadius: '12px',
                      border: '2px solid #cbd5e1',
                      cursor: inviteAccionPending ? 'default' : 'pointer',
                      background: '#fff',
                      color: '#475569',
                    }}
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      );
    })();

  const btnVolverEleccionStyle = {
    alignSelf: 'flex-start',
    padding: '8px 12px',
    fontSize: '14px',
    fontWeight: 700,
    color: 'white',
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '12px',
  };

  const bloqueBannerCrearLogin =
    !torneoFinalizado && bannerCrearEquipoRequiereLogin && !session?.user ? (
      <div
        style={{
          marginBottom: '16px',
          padding: '14px 16px',
          borderRadius: '12px',
          background: '#fef9c3',
          border: '1px solid #fde047',
          color: '#854d0e',
          fontWeight: 700,
          lineHeight: 1.45,
        }}
      >
        <div style={{ marginBottom: '10px' }}>Para crear un equipo necesitas iniciar sesión.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => navigate(authUrlWithRedirect(`/torneo/${id}/equipos?crear=1`))}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 800,
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              color: 'white',
              boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
            }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => setBannerCrearEquipoRequiereLogin(false)}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px',
              cursor: 'pointer',
              background: 'transparent',
              color: '#713f12',
              border: '1px solid rgba(113,63,18,0.35)',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    ) : null;

  const bloqueMiEquipoResumenFinalizado =
    torneoFinalizado && session?.user && miEquipo ? (
      <div
        style={{
          marginBottom: '16px',
          padding: '14px 16px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.14)',
          border: '1px solid rgba(255,255,255,0.22)',
          color: 'white',
          fontWeight: 700,
          fontSize: '14px',
          lineHeight: 1.45,
        }}
      >
        <div style={{ marginBottom: '10px' }}>
          Tu equipo: <strong>{miEquipo.nombre}</strong>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/torneo/${id}/equipos/${miEquipo.id}`)}
          style={{
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 800,
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.95)',
            color: '#15803d',
          }}
        >
          Ver mi equipo
        </button>
      </div>
    ) : null;

  const bloqueInscripcionTorneo =
    miEquipo && !torneoCancelado && !torneoFinalizado ? (
      <div
        style={{
          border: '2px dashed rgba(255,255,255,0.38)',
          borderRadius: '14px',
          padding: '14px 16px',
          marginBottom: '16px',
          background: 'rgba(255,255,255,0.07)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '8px',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '13px', color: 'rgba(255,255,255,0.95)' }}>
            Inscripción al torneo
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: '999px',
              ...(getEquipoInscripcionEstado(miEquipo) === 'confirmado'
                ? { background: 'rgba(220,252,231,0.95)', color: '#166534' }
                : { background: 'rgba(254,243,199,0.95)', color: '#92400e' }),
            }}
          >
            {getEquipoInscripcionEstado(miEquipo) === 'confirmado' ? 'Confirmada' : 'Pendiente de pago'}
          </span>
        </div>
        {getEquipoInscripcionEstado(miEquipo) === 'pendiente' ? (
          <div
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.78)',
              lineHeight: 1.45,
              marginBottom: soyCreadorMiEquipo && miEquipoListoParaJugar ? '12px' : 0,
            }}
          >
            Cuando el equipo esté completo, el capitán puede pagar la inscripción para confirmar el cupo.
          </div>
        ) : null}
        {soyCreadorMiEquipo && miEquipoListoParaJugar && getEquipoInscripcionEstado(miEquipo) === 'pendiente' ? (
          <button
            type="button"
            disabled={mpInscripcionLoading}
            onClick={() => void confirmarInscripcionTorneo()}
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: '14px',
              fontWeight: 800,
              borderRadius: '10px',
              border: 'none',
              cursor: mpInscripcionLoading ? 'default' : 'pointer',
              opacity: mpInscripcionLoading ? 0.7 : 1,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              boxShadow: '0 4px 14px rgba(217,119,6,0.35)',
            }}
          >
            {mpInscripcionLoading ? 'Redirigiendo…' : 'Confirmar inscripción'}
          </button>
        ) : null}
      </div>
    ) : null;

  const bloqueEleccionDesktop =
    mostrarEleccionDesktop && desktopFlujo === null ? (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '22px 20px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
            border: '2px solid rgba(34,197,94,0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '17px', fontWeight: 900, color: '#14532d' }}>Crear equipo</div>
          <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.45 }}>
            Nombre del equipo, tamaño (2 / 3 / 4) y si aceptás solicitudes para unirse.
          </div>
          <button
            type="button"
            onClick={irACrearEquipo}
            style={{
              marginTop: '4px',
              padding: '14px 16px',
              fontSize: '15px',
              fontWeight: 800,
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              color: 'white',
              boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
            }}
          >
            Crear equipo
          </button>
        </div>
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '22px 20px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
            border: '2px solid rgba(99,102,241,0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '17px', fontWeight: 900, color: '#312e81' }}>Estoy solo o me falta compañero</div>
          <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.45 }}>
            Arma un equipo y busca compañero o súmate a uno disponible
          </div>
          <button
            type="button"
            onClick={() => setDesktopFlujo('lista')}
            style={{
              marginTop: '4px',
              padding: '14px 16px',
              fontSize: '15px',
              fontWeight: 800,
              borderRadius: '12px',
              border: '2px solid #6366f1',
              cursor: 'pointer',
              background: '#eef2ff',
              color: '#4338ca',
            }}
          >
            Ver equipos disponibles
          </button>
        </div>
      </div>
    ) : null;

  const renderInscripcionHeader = () => (
    <>
      <AppHeader
        title={
          esAdminGestionTorneo
            ? torneoFinalizado
              ? 'Resultados'
              : 'Gestión del torneo'
            : torneoFinalizado
              ? 'Resultados'
              : 'Inscripción'
        }
        onBack={handleInscripcionHeaderBack}
        backLabel={
          esAdminGestionTorneo && contextoGestionEquiposTorneo ? '← Admin' : undefined
        }
      />
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '2px 12px 6px',
          boxSizing: 'border-box',
        }}
      >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '2px 8px 0',
        }}
      >
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{
            ...padbolLogoImgStyle,
            marginBottom: '12px',
            filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.28))',
          }}
        />
        <h1
          style={{
            margin: '8px 0 0',
            padding: '0 16px',
            width: '100%',
            maxWidth: '720px',
            boxSizing: 'border-box',
            fontSize: 'clamp(1.2rem, 4.2vw, 1.6rem)',
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            textShadow: '0 2px 24px rgba(0,0,0,0.25)',
          }}
        >
          {esAdminGestionTorneo
            ? torneoFinalizado
              ? 'Resultados del torneo'
              : 'Gestión de equipos y torneo'
            : torneoFinalizado
              ? 'Resultados del torneo'
              : 'Inscripción al torneo'}
        </h1>
      </div>
    </div>
    </>
  );

  if (loading) {
    return (
      <div style={inscripcionPageShellStyle}>
        {renderInscripcionHeader()}
        <div style={{ maxWidth: '1100px', margin: '4px auto 0', padding: '0 12px', boxSizing: 'border-box' }}>
          {!esAdminGestionTorneo ? bloqueInvitacionEquipoDeepLink : null}
        </div>
        <div style={{ maxWidth: '1100px', margin: '4px auto 0', color: 'white' }}>Cargando...</div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={inscripcionPageShellStyle}>
      {renderInscripcionHeader()}

      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          marginTop: '4px',
          paddingLeft: 12,
          paddingRight: 12,
          boxSizing: 'border-box',
        }}
      >
        {!esAdminGestionTorneo ? bloqueInvitacionEquipoDeepLink : null}

        {torneoCancelado ? (
          <>
            <div
              style={{
                marginBottom: '18px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '18px 20px',
                borderRadius: '14px',
                fontWeight: 800,
                fontSize: 'clamp(1rem, 3.5vw, 1.15rem)',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              Este torneo fue cancelado
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '14px', color: '#334155', fontWeight: 800 }}>
                Equipos ({equiposVisibles.length})
              </h3>
              {equiposVisibles.length === 0 ? (
                <p style={{ color: '#64748b', margin: 0 }}>No hay equipos registrados.</p>
              ) : (
                equiposVisibles.map((eq) => renderEquipoLecturaCancelado(eq))
              )}
            </div>
          </>
        ) : (
          <TorneoTabbedView
            torneo={torneo}
            equipos={equipos}
            partidos={partidos}
            setPartidos={setPartidos}
            sedesMap={sedesMapForm}
            torneoId={id}
            navigate={navigate}
            session={session}
            isAdmin={esAdminGestionTorneo}
            puedeGestionarEquiposTorneo={puedeGestionarEquiposTorneo}
            navigateState={torneoNavStateForm}
            showTorneoLogo={false}
            clasificacionFinalFilas={
              torneoFinalizado && filasClasificacionFinalizado.length > 0 ? filasClasificacionFinalizado : null
            }
            equiposTabFooter={
              esAdminGestionTorneo ? null : torneoFinalizado ? (
                bloqueMiEquipoResumenFinalizado
              ) : (
                <>
                  {bloqueBannerCrearLogin}
                  {bloqueEleccionDesktop}

        {equipoDuplicadoBloqueoId && !miEquipo ? (
          <div
            style={{
              marginBottom: '18px',
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              color: '#92400e',
              padding: '14px 16px',
              borderRadius: '12px',
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            <div style={{ marginBottom: '12px' }}>Ya tienes un equipo en este torneo</div>
            <button
              type="button"
              onClick={() => navigate(`/torneo/${id}/equipos/${equipoDuplicadoBloqueoId}`)}
              style={{
                width: '100%',
                maxWidth: '320px',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: 800,
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: 'white',
                boxShadow: '0 4px 14px rgba(180,83,9,0.35)',
              }}
            >
              Ver mi equipo
            </button>
          </div>
        ) : null}

        {session?.user && !torneoCancelado && perfilIncompleto ? (
          <div
            style={{
              marginBottom: '18px',
              background: '#fef9c3',
              border: '1px solid #fde047',
              color: '#854d0e',
              padding: '14px 16px',
              borderRadius: '12px',
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            <div style={{ marginBottom: '10px' }}>Ficha de jugador pendiente</div>
            <button
              type="button"
              onClick={() => {
                const back = `/torneo/${torneoId}/equipos`;
                navigate(
                  `/mi-perfil?from=torneo&id=${encodeURIComponent(String(id))}&redirect=${encodeURIComponent(back)}`,
                  {
                    state: { avisoPerfilTorneo: 'Completa tu perfil para participar en torneos' },
                  }
                );
              }}
              style={{
                padding: '8px 14px',
                background: '#ca8a04',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Ir a Mi perfil
            </button>
          </div>
        ) : null}

        {location.state?.justRegistered && !miEquipo && !miSolicitudPendiente && (
          <div
            style={{
              marginBottom: '18px',
              background: '#dcfce7',
              color: '#166534',
              padding: '14px 16px',
              borderRadius: '12px',
              fontWeight: 700
            }}
          >
            Inscripción exitosa. Ahora puedes crear tu equipo o pedir unirte a uno existente.
          </div>
        )}

        {miEquipo && !torneoCancelado && (
          <div
            style={{
              marginBottom: '18px',
              background: '#dcfce7',
              color: '#166534',
              padding: '14px 16px',
              borderRadius: '12px',
              fontWeight: 700,
              border: '1px solid #86efac',
            }}
          >
            <div style={{ marginBottom: '12px', lineHeight: 1.45 }}>
              Ya sos parte del equipo <strong>{miEquipo.nombre}</strong>
              {soyCreadorMiEquipo ? (
                <span style={{ display: 'block', marginTop: '6px', fontSize: '13px', fontWeight: 600, opacity: 0.92 }}>
                  {ICONO_CAPITAN} Sos capitán del equipo
                </span>
              ) : (
                <span style={{ display: 'block', marginTop: '6px', fontSize: '13px', fontWeight: 600, opacity: 0.92 }}>
                  Sos miembro del equipo
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate(`/torneo/${id}/equipos/${miEquipo.id}`)}
              style={{
                width: '100%',
                maxWidth: '320px',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: 800,
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
                color: 'white',
                boxShadow: '0 4px 14px rgba(22,101,52,0.35)',
              }}
            >
              Ver mi equipo
            </button>
          </div>
        )}

        {miEquipo && !torneoCancelado && !isMobile ? bloqueInscripcionTorneo : null}

        {miEquipo && soyCreadorMiEquipo && !torneoFinalizado && !torneoCancelado ? (
          <div
            style={{
              marginBottom: '18px',
              background: '#fff',
              padding: '16px 18px',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
            }}
          >
            {!miEquipoLleno ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: '10px', color: '#111' }}>Agregar compañero</div>
                <input
                  type="text"
                  placeholder="Nombre del compañero"
                  value={companeroNombre}
                  onChange={(e) => setCompaneroNombre(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ccc',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={agregarCompanero}
                  disabled={saving}
                  style={{
                    padding: '10px 16px',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: saving ? 'default' : 'pointer',
                    opacity: saving ? 0.65 : 1,
                  }}
                >
                  Agregar
                </button>
              </>
            ) : miEquipoListoParaJugar ? (
              <div style={{ fontSize: '14px', color: '#166534', fontWeight: 700 }}>Equipo completo</div>
            ) : (
              <div style={{ fontSize: '14px', color: '#b45309', fontWeight: 700 }}>
                Faltan confirmar jugadores
              </div>
            )}
            <a
              href={invitarWhatsappHref}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-block',
                marginTop: '12px',
                padding: '10px 16px',
                background: '#25d366',
                color: 'white',
                borderRadius: '8px',
                fontWeight: 700,
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Invitar por WhatsApp
            </a>
          </div>
        ) : null}

        {miSolicitudPendiente && !miEquipo && !torneoCancelado && (
          <div
            style={{
              marginBottom: '18px',
              background: '#fef3c7',
              color: '#92400e',
              padding: '14px 16px',
              borderRadius: '12px',
              fontWeight: 700
            }}
          >
            Tienes una solicitud pendiente para unirte al equipo: {miSolicitudPendiente.nombre}
          </div>
        )}

        {!isMobile && mostrarEleccionDesktop && desktopFlujo === 'crear' && (
          <div>
            <button type="button" onClick={() => setDesktopFlujo(null)} style={btnVolverEleccionStyle}>
              ← Elegir otra opción
            </button>
            {crearEquipoFormulario}
          </div>
        )}

        {!isMobile && mostrarEleccionDesktop && desktopFlujo === 'lista' && (
          <div>
            <button type="button" onClick={() => setDesktopFlujo(null)} style={btnVolverEleccionStyle}>
              ← Elegir otra opción
            </button>
            {flujoInscripcionTorneoActivo && !miSolicitudPendiente && equiposUnirseListado.length > 0 ? (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '14px 16px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,0.95)', fontSize: '15px', fontWeight: 600 }}>
                  ¿No encontrás equipo?
                </p>
                <button
                  type="button"
                  onClick={irACrearEquipo}
                  style={{
                    width: '100%',
                    maxWidth: '320px',
                    padding: '12px 16px',
                    fontSize: '15px',
                    fontWeight: 800,
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: 'white',
                    boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                  }}
                >
                  Crear mi equipo
                </button>
              </div>
            ) : null}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
              {listaEquiposContenido('+ Pedir unirme', irACrearEquipo)}
            </div>
          </div>
        )}

        {!isMobile && !mostrarEleccionDesktop && !miEquipo && !miSolicitudPendiente && (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
            {listaEquiposContenido('+ Pedir unirme', irACrearEquipo)}
          </div>
        )}

        {mobileInicio && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              marginTop: '10px',
            }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '20px 18px',
                border: '2px solid rgba(34,197,94,0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '17px', fontWeight: 900, color: '#14532d' }}>Crear equipo</div>
              <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.45 }}>
                Nombre del equipo, tamaño (2 / 3 / 4) y si aceptás solicitudes para unirse.
              </div>
              <button
                type="button"
                onClick={irACrearEquipo}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '15px',
                  fontWeight: 800,
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white',
                  boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                }}
              >
                Crear equipo
              </button>
            </div>
            <div
              style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '20px 18px',
                border: '2px solid rgba(99,102,241,0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '17px', fontWeight: 900, color: '#312e81' }}>Estoy solo o me falta compañero</div>
              <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.45 }}>
                Arma un equipo y busca compañero o súmate a uno disponible
              </div>
              <button
                type="button"
                onClick={() => setMobileVista('lista')}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '15px',
                  fontWeight: 800,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  background: '#eef2ff',
                  color: '#4338ca',
                  border: '2px solid #6366f1',
                }}
              >
                Ver equipos disponibles
              </button>
            </div>
          </div>
        )}

        {mobileCrear && (
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <button
              type="button"
              onClick={() => setMobileVista('inicio')}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 12px',
                fontSize: '14px',
                fontWeight: 700,
                color: 'white',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              ← Elegir otra opción
            </button>
            {crearEquipoFormulario}
          </div>
        )}

        {(mobileListaEquipos || mobileListaTorneoCerrado) && (
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {!mobileListaTorneoCerrado && !miSolicitudPendiente ? (
              <button
                type="button"
                onClick={() => setMobileVista('inicio')}
                style={{
                  alignSelf: 'flex-start',
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'white',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                ← Elegir otra opción
              </button>
            ) : null}
            {flujoInscripcionTorneoActivo && !miSolicitudPendiente && equiposUnirseListado.length > 0 ? (
              <div
                style={{
                  padding: '14px 16px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  textAlign: 'center',
                }}
              >
                <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,0.95)', fontSize: '15px', fontWeight: 600 }}>
                  ¿No encontrás equipo?
                </p>
                <button
                  type="button"
                  onClick={irACrearEquipo}
                  style={{
                    width: '100%',
                    maxWidth: '320px',
                    padding: '12px 16px',
                    fontSize: '15px',
                    fontWeight: 800,
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: 'white',
                    boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                  }}
                >
                  Crear mi equipo
                </button>
              </div>
            ) : null}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
              {listaEquiposContenido(
                mobileListaTorneoCerrado ? '+ Pedir unirme' : 'Unirme',
                irACrearEquipo
              )}
            </div>
          </div>
        )}

        {mobileMiEquipoVista && (
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {miEquipoEnListado ? (
              <div
                style={{
                  padding: '18px 16px',
                  borderRadius: '14px',
                  background: 'linear-gradient(180deg, #ecfdf5 0%, #f7fee7 100%)',
                  border: '2px solid #86efac',
                  boxShadow: '0 4px 22px rgba(34, 197, 94, 0.18)',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 14px',
                    fontSize: '1.2rem',
                    color: '#14532d',
                    fontWeight: 900,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Tu equipo
                </h3>
                {renderEquipoCard(miEquipoEnListado, true, '+ Pedir unirme')}
              </div>
            ) : null}
            {miEquipo && !torneoCancelado ? bloqueInscripcionTorneo : null}
            <button
              type="button"
              onClick={() => setMobileVista('otros')}
              disabled={otrosEquiposVisibles.length === 0}
              style={{
                width: '100%',
                padding: '14px 18px',
                fontSize: '15px',
                fontWeight: 700,
                borderRadius: '12px',
                cursor: otrosEquiposVisibles.length === 0 ? 'default' : 'pointer',
                background: otrosEquiposVisibles.length === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.95)',
                color: '#4f46e5',
                border: '2px solid rgba(255,255,255,0.85)',
                opacity: otrosEquiposVisibles.length === 0 ? 0.6 : 1,
              }}
            >
              Ver otros equipos
            </button>
          </div>
        )}

        {mobileOtrosEquipos && (
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <button
              type="button"
              onClick={() => setMobileVista('mi_equipo')}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 12px',
                fontSize: '14px',
                fontWeight: 700,
                color: 'white',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              ← Mi equipo
            </button>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ marginTop: 0, color: '#334155', fontWeight: 800 }}>Otros equipos disponibles</h3>
              {otrosEquiposDisponiblesParaUnirse.length === 0 ? (
                <div>
                  <p
                    style={{
                      margin: '0 0 18px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#64748b',
                      lineHeight: 1.45,
                    }}
                  >
                    No hay otros equipos abiertos a los que unirte en este momento.
                  </p>
                  {puedeOfrecerCrearDesdeLista ? (
                    <div
                      style={{
                        padding: '14px 16px 16px',
                        borderRadius: '12px',
                        background: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        textAlign: 'center',
                      }}
                    >
                      <p style={{ margin: '0 0 10px', color: '#4338ca', fontSize: '15px', fontWeight: 600 }}>
                        ¿No encontrás equipo?
                      </p>
                      <button
                        type="button"
                        onClick={irACrearEquipo}
                        style={{
                          width: '100%',
                          maxWidth: '320px',
                          padding: '12px 16px',
                          fontSize: '15px',
                          fontWeight: 800,
                          borderRadius: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          color: 'white',
                          boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                        }}
                      >
                        Crear mi equipo
                      </button>
                      <p
                        style={{
                          margin: '14px 0 0',
                          fontSize: '14px',
                          color: '#64748b',
                          lineHeight: 1.45,
                          fontWeight: 500,
                        }}
                      >
                        Puedes crear tu propio equipo y buscar compañeros
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                otrosEquiposDisponiblesParaUnirse.map((eq) => renderEquipoCard(eq, false, 'Unirme'))
              )}
            </div>
          </div>
        )}
                </>
              )
            }
          />
        )}

        {salirEquipoIdConfirm != null ? (
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              background: 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={() => !savingSalirEquipo && setSalirEquipoIdConfirm(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="form-salir-equipo-msg"
              style={{
                background: '#fff',
                borderRadius: '14px',
                padding: '22px 20px',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p
                id="form-salir-equipo-msg"
                style={{ margin: '0 0 18px', fontSize: '16px', fontWeight: 700, color: '#0f172a', lineHeight: 1.45 }}
              >
                {(() => {
                  const eqSalir = equipos.find((e) => e.id === salirEquipoIdConfirm);
                  const uDlg = getOrCreateUsuarioBasico();
                  const esCreadorDlg =
                    !!eqSalir && esCreadorEquipoOMiAuth(eqSalir, authEmail, uDlg, authUserId);
                  return esCreadorDlg
                    ? '¿Disolver el equipo? Se eliminará por completo.'
                    : '¿Quieres salir del equipo?';
                })()}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={savingSalirEquipo}
                  onClick={() => setSalirEquipoIdConfirm(null)}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    cursor: savingSalirEquipo ? 'default' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingSalirEquipo}
                  onClick={() => void ejecutarSalirDelEquipoForm()}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    border: 'none',
                    background: '#b91c1c',
                    color: '#fff',
                    cursor: savingSalirEquipo ? 'default' : 'pointer',
                    opacity: savingSalirEquipo ? 0.7 : 1,
                  }}
                >
                  {(() => {
                    const eqSalir = equipos.find((e) => e.id === salirEquipoIdConfirm);
                    const uDlg = getOrCreateUsuarioBasico();
                    const esCreadorDlg =
                      !!eqSalir && esCreadorEquipoOMiAuth(eqSalir, authEmail, uDlg, authUserId);
                    if (savingSalirEquipo) return 'Saliendo…';
                    return esCreadorDlg ? 'Disolver' : 'Salir';
                  })()}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <BottomNav />
    </div>
  );
}