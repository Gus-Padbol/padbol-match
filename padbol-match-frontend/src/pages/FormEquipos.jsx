import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { APP_HEADER_BTN_VOLVER } from '../components/AppUnifiedHeader';
import { getOrCreateUsuarioBasico } from '../utils/usuarioBasico';
import {
  readJugadorPerfil,
  isPerfilTorneoCompleto,
  refreshJugadorPerfilFromSupabase,
  nombreCompletoJugadorPerfil,
  PERFIL_CHANGE_EVENT,
} from '../utils/jugadorPerfil';
import { setTorneoEquipoActual, clearEquipoActual, readEquipoActualForTorneo } from '../utils/torneoEquipoLocal';

const INSCRIPCION_LOGOUT_BTN = {
  background: 'rgba(255,255,255,0.22)',
  border: '1px solid rgba(255,255,255,0.28)',
  borderRadius: '50%',
  width: '38px',
  height: '38px',
  color: 'white',
  fontSize: '16px',
  cursor: 'pointer',
  flexShrink: 0,
};

function getCurrentCliente() {
  try {
    const raw = localStorage.getItem('currentCliente');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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
  if (typeof p === 'string') return { nombre: p, email: '', estado: 'confirmado' };
  const email = p.email != null && p.email !== undefined ? String(p.email) : '';
  let estado = p.estado;
  if (!estado) {
    estado = String(email).trim() ? 'confirmado' : 'pendiente';
  }
  return {
    id: p.id != null && p.id !== '' ? p.id : null,
    nombre: p.nombre || p.email || 'Jugador',
    email,
    estado,
  };
}

function getPlayers(eq) {
  if (Array.isArray(eq?.jugadores)) {
    return eq.jugadores.map(normalizePlayer).filter(Boolean);
  }
  if (typeof eq?.jugadores === 'string' && eq.jugadores.trim()) {
    return eq.jugadores
      .split(' + ')
      .map((n) => ({ nombre: n.trim(), email: '', estado: 'confirmado' }))
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

function esCreadorEquipo(eq, emailCuentaTrim, usuarioBasico) {
  if (!eq || !usuarioBasico?.id) return false;
  if (String(eq.creador_id || '') === String(usuarioBasico.id)) return true;
  if (!eq.creador_id && emailCuentaTrim && (eq.creador_email || '').trim() === emailCuentaTrim) return true;
  return false;
}

function formatTipoTorneo(raw) {
  const t = String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (t === 'round_robin') return 'Round robin';
  if (t === 'knockout' || t === 'eliminatoria') return 'Knockout';
  if (t === 'grupos_knockout') return 'Grupos + knockout';
  return raw || '—';
}

function formatNivelTorneo(raw) {
  const n = String(raw || '').toLowerCase();
  if (n === 'local') return 'Local';
  if (n === 'nacional') return 'Nacional';
  if (n === 'internacional') return 'Internacional';
  return raw || '—';
}

export default function FormEquipos({ onLogout }) {
  const { id } = useParams();
  const torneoId = parseInt(id, 10);
  const navigate = useNavigate();
  const location = useLocation();

  const currentCliente = getCurrentCliente();
  const emailCuenta = (currentCliente?.email || '').trim();

  const [perfilLsKey, setPerfilLsKey] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      const em = String(emailCuenta || '').trim();
      if (em) await refreshJugadorPerfilFromSupabase(em);
      if (alive) setPerfilLsKey((k) => k + 1);
    })();
    return () => {
      alive = false;
    };
  }, [torneoId, emailCuenta]);

  useEffect(() => {
    const fn = () => setPerfilLsKey((k) => k + 1);
    window.addEventListener(PERFIL_CHANGE_EVENT, fn);
    return () => window.removeEventListener(PERFIL_CHANGE_EVENT, fn);
  }, []);

  const perfilTorneoCompleto = useMemo(() => {
    void perfilLsKey;
    return isPerfilTorneoCompleto();
  }, [perfilLsKey]);

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
  const [companeroNombre, setCompaneroNombre] = useState('');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  /** inicio | crear | lista | mi_equipo | otros — solo isMobile */
  const [mobileVista, setMobileVista] = useState('inicio');
  /** null | crear | lista — solo escritorio, paso elección antes de acción */
  const [desktopFlujo, setDesktopFlujo] = useState(null);
  const [salirEquipoIdConfirm, setSalirEquipoIdConfirm] = useState(null);
  const [savingSalirEquipo, setSavingSalirEquipo] = useState(false);

  useEffect(() => {
    setDesktopFlujo(null);
  }, [torneoId]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const cargarTodo = async () => {
    if (!torneoId) return;

    setLoading(true);

    const [
      { data: torneoData, error: torneoError },
      { data: jugadoresData, error: jugadoresError },
      { data: equiposData, error: equiposError },
    ] = await Promise.all([
      supabase.from('torneos').select('*').eq('id', torneoId).maybeSingle(),
      supabase.from('jugadores_torneo').select('*').eq('torneo_id', torneoId).order('id', { ascending: true }),
      supabase.from('equipos').select('*').eq('torneo_id', torneoId).order('id', { ascending: true }),
    ]);

    if (torneoError) console.error(torneoError);
    if (jugadoresError) console.error(jugadoresError);
    if (equiposError) console.error(equiposError);

    let sedeNombre = null;
    if (torneoData?.sede_id) {
      const { data: sedeData, error: sedeError } = await supabase
        .from('sedes')
        .select('nombre')
        .eq('id', torneoData.sede_id)
        .maybeSingle();
      if (sedeError) console.error(sedeError);
      sedeNombre = sedeData?.nombre || null;
    }
    setNombreSede(sedeNombre);

    setTorneo(torneoData || null);
    setJugadoresTorneo(Array.isArray(jugadoresData) ? jugadoresData : []);
    setEquipos(Array.isArray(equiposData) ? equiposData : []);
    setLoading(false);
  };

  useEffect(() => {
    cargarTodo();
  }, [torneoId]);

  const equiposNormalizados = useMemo(() => {
    return equipos.map((eq) => ({
      ...eq,
      players: getPlayers(eq),
      requests: getRequests(eq),
      cupo: Number(eq.cupo_maximo || 2),
    }));
  }, [equipos]);

  const currentJugador = useMemo(() => {
    const jp = readJugadorPerfil();
    const jpEmail = String(jp?.email || '').trim();
    if (!currentCliente) {
      if (jpEmail) {
        const byEmail = jugadoresTorneo.find((j) => j.email === jpEmail);
        if (byEmail) return byEmail;
      }
      return null;
    }

    if (currentCliente.email) {
      const byEmail = jugadoresTorneo.find((j) => j.email === currentCliente.email);
      if (byEmail) return byEmail;
    }

    if (!currentCliente.email && currentCliente.nombre) {
      const byName = jugadoresTorneo.find((j) => j.nombre === currentCliente.nombre);
      if (byName) return byName;
    }

    return null;
  }, [jugadoresTorneo, currentCliente, perfilLsKey]);

  const yo = useMemo(() => {
    const u = getOrCreateUsuarioBasico();
    const jp = readJugadorPerfil();
    if (!currentCliente) {
      if (isPerfilTorneoCompleto(jp)) {
        const nm = nombreCompletoJugadorPerfil(jp);
        const em = String(jp?.email || '').trim();
        return { id: u.id, nombre: nm || u.nombre, email: em };
      }
      return { id: u.id, nombre: u.nombre, email: '' };
    }
    const nombreCliente = String(currentCliente.nombre || '').trim();
    const emailCliente = String(currentCliente.email || '').trim();
    const nombreJug = String(currentJugador?.nombre || '').trim();
    const emailJug = String(currentJugador?.email || '').trim();
    return {
      id: u.id,
      nombre: nombreJug || nombreCliente || emailCliente || u.nombre,
      email: emailJug || emailCliente,
    };
  }, [currentCliente, currentJugador, perfilLsKey]);

  const miEquipo = useMemo(() => {
    if (!yo) return null;
    const u = getOrCreateUsuarioBasico();
    const hintedId = readEquipoActualForTorneo(torneoId);
    if (hintedId) {
      const hinted = equiposNormalizados.find((eq) => String(eq.id) === String(hintedId));
      if (hinted) {
        if (String(hinted.creador_id || '') === String(u.id)) return hinted;
        if (yo && hinted.players.some((p) => samePerson(p, yo))) return hinted;
      }
    }
    return (
      equiposNormalizados.find(
        (eq) =>
          String(eq.creador_id || '') === String(u.id) || eq.players.some((p) => samePerson(p, yo))
      ) || null
    );
  }, [equiposNormalizados, yo, torneoId]);

  const miSolicitudPendiente = useMemo(() => {
    if (!yo) return null;
    return equiposNormalizados.find((eq) => eq.requests.some((r) => samePerson(r, yo))) || null;
  }, [equiposNormalizados, yo]);

  useEffect(() => {
    if (loading) return;
    const hintedId = readEquipoActualForTorneo(torneoId);
    if (!hintedId) return;
    const hinted = equiposNormalizados.find((eq) => String(eq.id) === String(hintedId));
    const u = getOrCreateUsuarioBasico();
    const inTeam =
      hinted &&
      (String(hinted.creador_id || '') === String(u.id) ||
        (yo && hinted.players.some((p) => samePerson(p, yo))));
    if (!inTeam) clearEquipoActual();
  }, [loading, torneoId, equiposNormalizados, yo]);

  const torneoCerrado = torneo?.estado === 'finalizado' || torneo?.estado === 'cancelado';
  const torneoCancelado = torneo?.estado === 'cancelado';

  useEffect(() => {
    if (loading) return;
    if (torneo?.estado === 'cancelado') return;
    const email = String(currentCliente?.email || readJugadorPerfil()?.email || '').trim();
    if (!email || !yo) return;
    const nombreNorm = (yo.nombre || '').trim().toLowerCase();
    if (!nombreNorm) return;

    const run = async () => {
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
  }, [loading, currentCliente?.email, yo, equipos, torneo?.estado]);

  useEffect(() => {
    if (!isMobile || torneoCerrado) return;
    if (miEquipo) setMobileVista('mi_equipo');
    else if (miSolicitudPendiente) setMobileVista('lista');
  }, [isMobile, torneoCerrado, miEquipo?.id, miSolicitudPendiente?.id]);

  const crearEquipo = async () => {
    if (miEquipo) {
      alert('Ya estás en un equipo');
      return;
    }

    if (miSolicitudPendiente) {
      alert('Ya tienes una solicitud pendiente');
      return;
    }

    if (!nombreEquipo.trim()) {
      alert('Indica el nombre del equipo');
      return;
    }

    if (!isPerfilTorneoCompleto()) {
      navigate(`/perfil?from=torneo&id=${encodeURIComponent(String(id))}`, {
        state: { avisoPerfilTorneo: 'Completá tu perfil para crear o unirte a un equipo' },
      });
      return;
    }

    setSaving(true);

    const usuario = getOrCreateUsuarioBasico();
    const jp = readJugadorPerfil();
    const emailCreador = String(currentCliente?.email || jp?.email || '').trim();
    const creadorJugador = {
      id: usuario.id,
      nombre: nombreCompletoJugadorPerfil(jp) || String(currentCliente?.nombre || '').trim() || usuario.nombre,
      email: emailCreador,
    };

    const { data, error } = await supabase
      .from('equipos')
      .insert([
        {
          torneo_id: torneoId,
          nombre: nombreEquipo.trim(),
          cupo_maximo: Number(cupoMaximo),
          creador_id: usuario.id,
          creador_email: emailCreador,
          jugadores: [creadorJugador],
          solicitudes: [],
          equipo_abierto: equipoAbierto,
        },
      ])
      .select();

    setSaving(false);

    if (error) {
      console.error(error);
      alert('Error creando equipo');
      return;
    }

    const nuevo = Array.isArray(data) ? data[0] : null;
    if (!nuevo) {
      alert('Error creando equipo');
      return;
    }

    setEquipos((prev) => [...prev, nuevo]);
    setTorneoEquipoActual(torneoId, nuevo.id);
    setNombreEquipo('');
    setCupoMaximo(2);
    setEquipoAbierto(false);
  };

  const pedirUnirme = async (equipo) => {
    if (miEquipo) {
      alert('Ya estás en un equipo');
      return;
    }

    if (miSolicitudPendiente) {
      alert('Ya tienes una solicitud pendiente');
      return;
    }

    if (!isPerfilTorneoCompleto()) {
      navigate(`/perfil?from=torneo&id=${encodeURIComponent(String(id))}`, {
        state: { avisoPerfilTorneo: 'Completá tu perfil para crear o unirte a un equipo' },
      });
      return;
    }

    const players = getPlayers(equipo);
    const requests = getRequests(equipo);
    const cupo = Number(equipo.cupo_maximo || 2);

    if (equipo.equipo_abierto === false) {
      alert('Este equipo es cerrado: solo el creador puede sumar jugadores.');
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
  };

  const ejecutarSalirDelEquipoForm = async () => {
    if (!yo || salirEquipoIdConfirm == null) return;
    const raw = equipos.find((e) => e.id === salirEquipoIdConfirm);
    if (!raw) {
      setSalirEquipoIdConfirm(null);
      return;
    }
    const lista = getPlayers(raw);
    const nuevos = lista.filter((p) => !samePerson(p, yo));
    const reqs = getRequests(raw);
    const nuevasSolicitudes = reqs.filter((r) => !samePerson(r, yo));
    const u = getOrCreateUsuarioBasico();
    const soyCreadorEq = esCreadorEquipo(raw, emailCuenta, u);
    const updates = { jugadores: nuevos, solicitudes: nuevasSolicitudes };
    if (soyCreadorEq) {
      updates.creador_email = null;
      updates.creador_id = null;
    }
    setSavingSalirEquipo(true);
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
        return {
          ...e,
          jugadores: nuevos,
          solicitudes: nuevasSolicitudes,
          ...(soyCreadorEq ? { creador_email: null, creador_id: null } : {}),
        };
      })
    );
    await cargarTodo();
    if (isMobile && mobileVista === 'mi_equipo') setMobileVista('lista');
    setDesktopFlujo(null);
  };

  const aceptarSolicitud = async (equipo, solicitud) => {
    const u = getOrCreateUsuarioBasico();
    if (!esCreadorEquipo(equipo, emailCuenta, u)) return;

    const players = getPlayers(equipo);
    const requests = getRequests(equipo);
    const cupo = Number(equipo.cupo_maximo || 2);

    if (players.length >= cupo) {
      alert('Equipo completo');
      return;
    }

    const solicitudConfirmada = {
      ...solicitud,
      estado: String(solicitud.email || '').trim() ? 'confirmado' : 'pendiente',
    };
    const nuevosJugadores = [...players, solicitudConfirmada];
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
    if (!esCreadorEquipo(equipo, emailCuenta, u)) return;

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
    if (!miEquipo || !esCreadorEquipo(miEquipo, emailCuenta, u)) return;

    const nombre = companeroNombre.trim();
    if (!nombre) {
      alert('Escribe el nombre del compañero');
      return;
    }

    const players = getPlayers(miEquipo);
    const cupo = Number(miEquipo.cupo_maximo || miEquipo.cupo || 2);
    if (players.length >= cupo) {
      alert('Equipo completo');
      return;
    }

    const nuevo = { nombre, estado: 'pendiente', email: null };
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
    if (torneoCerrado) return pool;
    return pool.filter((eq) => {
      const cupo = Number(eq.cupo_maximo || eq.cupo || 2);
      return eq.equipo_abierto === true && eq.players.length < cupo;
    });
  }, [torneoCerrado, miEquipoEnListado, otrosEquiposVisibles, equiposVisibles]);

  const otrosEquiposDisponiblesParaUnirse = useMemo(
    () =>
      otrosEquiposVisibles.filter((eq) => {
        const cupo = Number(eq.cupo_maximo || eq.cupo || 2);
        return eq.equipo_abierto === true && eq.players.length < cupo;
      }),
    [otrosEquiposVisibles]
  );

  const listaUnirseInscripcionAbiertaVacia = !torneoCerrado && equiposUnirseListado.length === 0;
  const puedeOfrecerCrearDesdeLista = !torneoCerrado && !miEquipo && !miSolicitudPendiente;

  const volverInscripcionPath = '/torneos';

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
  const soyCreadorMiEquipo = !!miEquipo && esCreadorEquipo(miEquipo, emailCuenta, getOrCreateUsuarioBasico());

  const invitarWhatsappHref = useMemo(() => {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';
    const url = `${base}/torneo/${id}/equipos`;
    const txt = `Te invito a registrarte en el torneo "${torneo?.nombre || 'Padbol'}" y confirmar tu lugar en el equipo: ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(txt)}`;
  }, [id, torneo?.nombre]);

  const renderEquipoCard = (eq, esTuEquipo, textoUnir = '+ Pedir unirme') => {
    const nombres = eq.players.map((p) => p.nombre).filter(Boolean);
    const cupo = Number(eq.cupo_maximo || eq.cupo || 2);
    const numJug = eq.players.length;
    const plazasLlenas = numJug >= cupo;
    const soyCreador = esCreadorEquipo(eq, emailCuenta, getOrCreateUsuarioBasico());
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

        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
          {nombres.length > 0 ? nombres.join(' - ') : 'Sin jugadores'}
        </div>

        {eq.players.length > 0 ? (
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', display: 'grid', gap: '4px' }}>
            {eq.players.map((p, idx) => (
              <div
                key={`${eq.id}-pl-${idx}`}
                style={{
                  display: 'flex',
                  justifyContent: esTuEquipo && !soyCreador ? 'flex-start' : 'space-between',
                  gap: '8px',
                }}
              >
                <span style={{ fontWeight: 600, color: '#334155' }}>{p.nombre}</span>
                {samePerson(p, yo) && !perfilTorneoCompleto ? (
                  <span style={{ color: '#b45309', fontWeight: 800, fontSize: '11px' }}>Perfil incompleto</span>
                ) : !(esTuEquipo && !soyCreador) ? (
                  esJugadorPendiente(p) ? (
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
            ))}
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
              Salir del equipo
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
                <div style={{ fontSize: '13px', marginBottom: '6px' }}>{sol.nombre}</div>

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
    isMobile && !torneoCerrado && !miEquipo && !miSolicitudPendiente && mobileVista === 'inicio';
  const mobileCrear =
    isMobile && !torneoCerrado && !miEquipo && !miSolicitudPendiente && mobileVista === 'crear';
  const mobileListaEquipos =
    isMobile && !miEquipo && !torneoCerrado && (mobileVista === 'lista' || miSolicitudPendiente);
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
        Creador del equipo: {yo?.nombre || 'Jugador'}
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
          Abierto: otros jugadores pueden <strong>solicitar</strong> unirse; el creador sigue aprobando cada
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
          {eq.players.map((p) => p.nombre).filter(Boolean).join(' · ')}
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

      {listaUnirseInscripcionAbiertaVacia ? (
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
            No hay equipos disponibles para unirte en este torneo
          </p>
          {puedeOfrecerCrearDesdeLista && typeof onCrearEquipoClick === 'function' ? (
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
        <>
          <h3 style={{ marginTop: miEquipoEnListado ? '20px' : 0, marginBottom: '12px' }}>
            🏆 Formar equipos ({equiposUnirseListado.length})
          </h3>

          {miEquipoEnListado && equiposUnirseListado.length > 0 ? (
            <div
              style={{
                marginTop: '32px',
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

          {equiposUnirseListado.map((eq) => renderEquipoCard(eq, false, textoUnir))}
        </>
      )}
    </>
  );

  const estadoEtiquetaInscripcion = torneoCerrado
    ? torneo?.estado === 'finalizado'
      ? 'Finalizado'
      : torneo?.estado === 'cancelado'
        ? 'Cancelado'
        : String(torneo?.estado || '—')
    : 'Inscripción abierta';

  const mostrarPasoEleccion = !torneoCerrado && !miEquipo && !miSolicitudPendiente;
  const mostrarEleccionDesktop = !isMobile && mostrarPasoEleccion;

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

  const bloqueTorneo = (
    <div
      style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '18px 20px',
        marginBottom: '16px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Torneo
      </div>
      <h2 style={{ margin: '6px 0 10px', fontSize: 'clamp(1.15rem, 3vw, 1.45rem)', fontWeight: 900, color: '#0f172a', lineHeight: 1.25 }}>
        {torneo?.nombre || `Torneo #${torneoId}`}
      </h2>
      {nombreSede ? (
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', fontWeight: 600 }}>📍 {nombreSede}</div>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '10px 16px',
          fontSize: '14px',
          color: '#334155',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Tipo</div>
          <div style={{ fontWeight: 700 }}>{formatTipoTorneo(torneo?.tipo_torneo)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Nivel</div>
          <div style={{ fontWeight: 700 }}>{formatNivelTorneo(torneo?.nivel_torneo)}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Equipos</div>
          <div style={{ fontWeight: 700 }}>{equipos.length}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Estado</div>
          <div style={{ fontWeight: 800, color: torneoCerrado ? '#b45309' : '#15803d' }}>{estadoEtiquetaInscripcion}</div>
        </div>
      </div>
      {torneo?.fecha_inicio ? (
        <div style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>Fecha inicio: {torneo.fecha_inicio}</div>
      ) : null}
    </div>
  );

  const elFuturoPago = (
    <div
      style={{
        border: '2px dashed rgba(255,255,255,0.38)',
        borderRadius: '14px',
        padding: '14px 16px',
        marginBottom: '16px',
        background: 'rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: '13px', color: 'rgba(255,255,255,0.95)' }}>Equipo pendiente de pago</div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)', marginTop: '6px', lineHeight: 1.45 }}>
        Próximamente: tu inscripción se confirmará al completar el pago.
      </div>
    </div>
  );

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
          <div style={{ fontSize: '17px', fontWeight: 900, color: '#14532d' }}>Ya tengo equipo</div>
          <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.45 }}>Inscribí tu equipo completo.</div>
          <button
            type="button"
            onClick={() => setDesktopFlujo('crear')}
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
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          minHeight: '40px',
        }}
      >
        <button type="button" onClick={() => navigate(volverInscripcionPath)} style={APP_HEADER_BTN_VOLVER}>
          ← Volver
        </button>
        {onLogout ? (
          <button type="button" onClick={() => onLogout()} style={INSCRIPCION_LOGOUT_BTN} aria-label="Cerrar sesión">
            ⏻
          </button>
        ) : (
          <span style={{ width: 38, flexShrink: 0 }} aria-hidden />
        )}
      </div>
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
            width: 'min(100%, 112px)',
            maxWidth: '112px',
            height: 'auto',
            display: 'block',
            objectFit: 'contain',
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
          Inscripción al torneo
        </h1>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '4px 12px 12px' }}>
        {renderInscripcionHeader()}
        <div style={{ maxWidth: '1100px', margin: '4px auto 0', color: 'white' }}>Cargando...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '4px 12px 12px' }}>
      {renderInscripcionHeader()}

      <div style={{ maxWidth: '1100px', margin: '0 auto', marginTop: '4px' }}>
        {bloqueTorneo}

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
          <>
        {bloqueEleccionDesktop}

        {!torneoCancelado && !perfilTorneoCompleto ? (
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
            <div style={{ marginBottom: '10px' }}>Pendiente de completar perfil</div>
            <button
              type="button"
              onClick={() =>
                navigate(`/perfil?from=torneo&id=${encodeURIComponent(String(id))}`, {
                  state: { avisoPerfilTorneo: 'Completa tu perfil para participar en torneos' },
                })
              }
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
              border: '1px solid #86efac'
            }}
          >
            ✅ Ya formas parte del equipo: {miEquipo.nombre}
          </div>
        )}

        {miEquipo && !torneoCancelado && !isMobile ? elFuturoPago : null}

        {miEquipo && soyCreadorMiEquipo && !torneoCerrado ? (
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
            {!torneoCerrado && !miSolicitudPendiente && equiposUnirseListado.length > 0 ? (
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
                  onClick={() => setDesktopFlujo('crear')}
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
              {listaEquiposContenido('+ Pedir unirme', () => setDesktopFlujo('crear'))}
            </div>
          </div>
        )}

        {!isMobile && !mostrarEleccionDesktop && (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
            {listaEquiposContenido('+ Pedir unirme', () => setDesktopFlujo('crear'))}
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
              <div style={{ fontSize: '17px', fontWeight: 900, color: '#14532d' }}>Ya tengo equipo</div>
              <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.45 }}>Inscribí tu equipo completo.</div>
              <button
                type="button"
                onClick={() => setMobileVista('crear')}
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
            {!torneoCerrado && !miSolicitudPendiente && equiposUnirseListado.length > 0 ? (
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
                  onClick={() => setMobileVista('crear')}
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
                () => setMobileVista('crear')
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
            {miEquipo && !torneoCancelado ? elFuturoPago : null}
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
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#334155',
                      lineHeight: 1.45,
                    }}
                  >
                    No hay equipos disponibles para unirte en este torneo
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
                        onClick={() => setMobileVista('crear')}
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
                ¿Seguro que querés salir del equipo?
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
                  {savingSalirEquipo ? 'Saliendo…' : 'Salir'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}