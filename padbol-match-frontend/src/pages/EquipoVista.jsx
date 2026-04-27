import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import * as T from '../theme/designTokens';
import { cardStyle, pageBackgroundStyle, buttonPrimaryStyle } from '../theme/uiStyles';
import { getOrCreateUsuarioBasico } from '../utils/usuarioBasico';
import {
  isPerfilTorneoCompleto,
  refreshJugadorPerfilFromSupabase,
  PERFIL_CHANGE_EVENT,
} from '../utils/jugadorPerfil';
import { clearEquipoActual, readEquipoActualForTorneo } from '../utils/torneoEquipoLocal';
import {
  getEquipoInscripcionEstado,
  etiquetaInscripcionEstado,
  iniciarPagoInscripcionTorneo,
} from '../utils/torneoInscripcionPago';
import { getDisplayName } from '../utils/displayName';
import { authUrlWithRedirect, authLoginRedirectPath } from '../utils/authLoginRedirect';
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

function esJugadorPendiente(p) {
  return p?.estado === 'pendiente';
}

function normalizePlayer(p) {
  if (!p) return null;
  if (typeof p === 'string') {
    return { nombre: p, email: '', estado: 'confirmado' };
  }
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
  };
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

export default function EquipoVista() {
  const { id, equipoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading, userProfile } = useAuth();

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

  const usuarioLocal = getOrCreateUsuarioBasico();

  const [equipo, setEquipo] = useState(null);
  const [torneo, setTorneo] = useState(null);
  const [players, setPlayers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jugadoresTorneo, setJugadoresTorneo] = useState([]);
  const [torneoEquipos, setTorneoEquipos] = useState([]);
  const [savingSolicitud, setSavingSolicitud] = useState(false);
  const [dialogoSalirEquipo, setDialogoSalirEquipo] = useState(false);
  const [savingSalirEquipo, setSavingSalirEquipo] = useState(false);
  /** Jugador a quitar del equipo (solo creador; no el slot creador). */
  const [dialogoEliminarJugador, setDialogoEliminarJugador] = useState(null);
  const [savingEliminarJugador, setSavingEliminarJugador] = useState(false);
  const [mpInscripcionLoading, setMpInscripcionLoading] = useState(false);
  const [perfilLsKey, setPerfilLsKey] = useState(0);
  const [perfilMapsJugadores, setPerfilMapsJugadores] = useState(() =>
    buildJugadorPerfilLookupMaps([])
  );
  const [reenviandoEmail, setReenviandoEmail] = useState(null);
  /** `jugadores_perfil` (incl. whatsapp) solo emails de jugadores en equipo con estado pendiente; se actualiza en {@link cargarEquipo}. */
  const [perfilPendientesPorEmail, setPerfilPendientesPorEmail] = useState(() => new Map());
  const [nombreSedeTorneo, setNombreSedeTorneo] = useState(null);

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
  }, [authEmail, id, equipoId]);

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

  const cargarEquipo = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('equipos')
      .select('*')
      .eq('id', Number(equipoId))
      .maybeSingle();

    if (error) {
      console.error(error);
      setEquipo(null);
      setTorneo(null);
      setPlayers([]);
      setRequests([]);
      setNombreSedeTorneo(null);
      setPerfilPendientesPorEmail(new Map());
      setLoading(false);
      return;
    }

    let row = data || null;

    if (row?.torneo_id) {
      const { data: torneoData, error: torneoError } = await supabase
        .from('torneos')
        .select('*')
        .eq('id', Number(row.torneo_id))
        .maybeSingle();

      if (torneoError) {
        console.error(torneoError);
        setTorneo(null);
        setNombreSedeTorneo(null);
      } else {
        setTorneo(torneoData || null);
        let sedeNombre = null;
        if (torneoData?.sede_id != null && torneoData.sede_id !== '') {
          const { data: sedeData, error: sedeError } = await supabase
            .from('sedes')
            .select('nombre')
            .eq('id', Number(torneoData.sede_id))
            .maybeSingle();
          if (sedeError) console.error(sedeError);
          else sedeNombre = sedeData?.nombre != null ? String(sedeData.nombre).trim() : null;
        }
        setNombreSedeTorneo(sedeNombre && sedeNombre.length ? sedeNombre : null);
      }
    } else {
      setTorneo(null);
      setNombreSedeTorneo(null);
    }

    let jugadores = Array.isArray(row?.jugadores)
      ? row.jugadores.map(normalizePlayer).filter(Boolean)
      : typeof row?.jugadores === 'string' && row.jugadores.trim()
      ? row.jugadores
          .split(' + ')
          .map((n) => ({ nombre: n.trim(), email: '', estado: 'confirmado' }))
          .filter((p) => p.nombre)
      : [];

    const { data: sessionWrap } = await supabase.auth.getSession();
    const sess = sessionWrap?.session;
    const authUid = sess?.user?.id ? String(sess.user.id) : null;
    const creadorId =
      row?.creador_id != null && row.creador_id !== '' ? String(row.creador_id) : '';
    const creadorEnLista = jugadores.some((p) => {
      const pid = p.id != null && p.id !== '' ? String(p.id) : '';
      return Boolean(creadorId && pid && pid === creadorId);
    });

    if (authUid && creadorId && authUid === creadorId && !creadorEnLista && sess?.user) {
      const creadorEntry = buildCreadorJugadorParaEquipo(sess, userProfile, yo);
      if (creadorEntry) {
        jugadores = ensureCreadorPrimeroEnLista(jugadores, creadorEntry, yo, authUid);
        const { error: persistErr } = await supabase
          .from('equipos')
          .update({ jugadores })
          .eq('id', Number(equipoId));
        if (persistErr) {
          console.error('equipoVista: persistir creador en jugadores', persistErr);
        } else if (row) {
          row = { ...row, jugadores };
        }
      }
    }

    const solicitudes = Array.isArray(row?.solicitudes)
      ? row.solicitudes.map(normalizePlayer).filter(Boolean)
      : [];

    const pendientesConEmail = jugadores.filter((p) => esJugadorPendiente(p) && normalizeJugadorEmail(p));
    const perfilesPend = pendientesConEmail.length
      ? await fetchJugadoresPerfilPorJugadores(pendientesConEmail)
      : [];
    setPerfilPendientesPorEmail(buildJugadorPerfilLookupMaps(perfilesPend).perfilByEmailLower);

    setEquipo(row);
    setPlayers(jugadores);
    setRequests(solicitudes);
    setLoading(false);
  };

  useEffect(() => {
    if (equipoId) cargarEquipo();
  }, [equipoId]);

  useEffect(() => {
    const tid = equipo?.torneo_id;
    if (!tid) {
      setJugadoresTorneo([]);
      setTorneoEquipos([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: jt }, { data: eqs }] = await Promise.all([
        supabase.from('jugadores_torneo').select('*').eq('torneo_id', tid).order('id', { ascending: true }),
        supabase.from('equipos').select('*').eq('torneo_id', tid).order('id', { ascending: true }),
      ]);
      if (!cancelled) {
        setJugadoresTorneo(Array.isArray(jt) ? jt : []);
        setTorneoEquipos(Array.isArray(eqs) ? eqs : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [equipo?.torneo_id]);

  useEffect(() => {
    if (loading || !equipoId) return;
    const email = String(cuentaAuth?.email || session?.user?.email || '').trim();
    if (!email) return;
    const nombreNorm = String(
      cuentaAuth?.nombre || (session?.user ? getDisplayName(userProfile, session) : '') || ''
    )
      .trim()
      .toLowerCase();
    if (!nombreNorm) return;
    const run = async () => {
      const { data, error } = await supabase
        .from('equipos')
        .select('jugadores')
        .eq('id', Number(equipoId))
        .maybeSingle();
      if (error || !data?.jugadores || !Array.isArray(data.jugadores)) return;
      const arr = data.jugadores.map(normalizePlayer).filter(Boolean);
      let changed = false;
      const next = arr.map((p) => {
        if (
          p.estado === 'pendiente' &&
          (p.nombre || '').trim().toLowerCase() === nombreNorm &&
          !String(p.email || '').trim()
        ) {
          changed = true;
          return {
            ...p,
            email,
            estado: 'confirmado',
            id: cuentaAuth?.id ?? usuarioLocal.id ?? p.id,
          };
        }
        return p;
      });
      if (!changed) return;
      const { error: upErr } = await supabase
        .from('equipos')
        .update({ jugadores: next })
        .eq('id', Number(equipoId));
      if (!upErr) cargarEquipo();
    };
    void run();
  }, [
    loading,
    equipoId,
    cuentaAuth?.email,
    cuentaAuth?.nombre,
    cuentaAuth?.id,
    perfilLsKey,
    usuarioLocal.id,
    session?.user,
  ]);

  const perfilFetchKeyEquipo = useMemo(
    () =>
      [...players, ...requests]
        .map((p) => normalizeJugadorEmail(p))
        .filter(Boolean)
        .sort()
        .join(';'),
    [players, requests]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const combined = [...players, ...requests];
      if (!combined.length) {
        if (!cancelled) setPerfilMapsJugadores(buildJugadorPerfilLookupMaps([]));
        return;
      }
      const rows = await fetchJugadoresPerfilPorJugadores(combined);
      if (cancelled) return;
      setPerfilMapsJugadores(buildJugadorPerfilLookupMaps(rows));
    })();
    return () => {
      cancelled = true;
    };
  }, [perfilFetchKeyEquipo]);

  const nombreTorneoCtx = useMemo(
    () => ({
      perfilByEmailLower: perfilMapsJugadores.perfilByEmailLower,
      jugadoresTorneo,
      authSessionEmail: session?.user?.email ?? null,
      perfilSesion: userProfile,
      authSession: session,
      authUserId,
    }),
    [perfilMapsJugadores, jugadoresTorneo, session, userProfile, authUserId]
  );

  const soyCreador = useMemo(() => {
    if (!equipo) return false;
    const uidCol = String(equipo.creador_id || '');
    if (uidCol && uidCol === String(usuarioLocal.id)) return true;
    if (authUserId && uidCol && uidCol === String(authUserId)) return true;
    const em = String(authEmail || '').trim().toLowerCase();
    const ce = String(equipo.creador_email || '').trim().toLowerCase();
    return Boolean(!equipo.creador_id && em && ce && ce === em);
  }, [equipo, usuarioLocal.id, authEmail, authUserId]);

  const urlCompartirLugarEquipoWa = useMemo(() => {
    const tid = id != null && String(id).trim() !== '' ? String(id).trim() : '';
    if (!tid) return '';
    const eid = equipoId != null && String(equipoId).trim() !== '' ? String(equipoId).trim() : '';
    const link = eid
      ? `https://padbol-match-9abn.vercel.app/torneo/${tid}/equipos?equipo=${encodeURIComponent(eid)}`
      : `https://padbol-match-9abn.vercel.app/torneo/${tid}/equipos`;
    const nombreTorneo = String(torneo?.nombre || '').trim() || 'Padbol';
    const nombreSede = String(nombreSedeTorneo || '').trim() || 'la sede del torneo';
    const nombreEquipo = String(equipo?.nombre || '').trim() || 'nuestro equipo';
    const mensaje = `¡Hola! Te invito a jugar juntos el torneo de Padbol ${nombreTorneo} en ${nombreSede}. Somos el equipo ${nombreEquipo}. ¡Confirmá tu lugar y nos vemos en la cancha! 🎯 ${link}`;
    return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  }, [id, equipoId, torneo?.nombre, nombreSedeTorneo, equipo?.nombre]);

  const abrirCompartirLugarEquipoWa = () => {
    if (!urlCompartirLugarEquipoWa) return;
    window.open(urlCompartirLugarEquipoWa, '_blank', 'noopener,noreferrer');
  };

  const reenviarInvitacionPendiente = async (emailNorm) => {
    if (!emailNorm || !equipoId) return;
    setReenviandoEmail(emailNorm);
    try {
      await invitarJugadorEquipo(Number(equipoId), emailNorm);
    } catch (err) {
      console.error(err);
      alert(err?.message || 'Error al reenviar');
    } finally {
      setReenviandoEmail(null);
    }
  };

  const btnPendienteOutline = {
    fontSize: '11px',
    fontWeight: 700,
    padding: '4px 9px',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#475569',
    lineHeight: 1.2,
  };

  const renderPendienteDeConfirmar = (p, { conAccionesCreador }) => {
    const etiqueta = (
      <span style={{ fontSize: '13px', color: T.colorWarningSoft, fontWeight: 600 }}>
        Pendiente de confirmar
      </span>
    );
    if (!conAccionesCreador) {
      return (
        <div style={{ marginTop: '4px' }}>{etiqueta}</div>
      );
    }
    const em = normalizeJugadorEmail(p);
    const map = perfilPendientesPorEmail;
    const row = em && map instanceof Map ? map.get(em) : null;
    const tieneWaPerfil = Boolean(row && String(row.whatsapp || '').trim());

    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          marginTop: '4px',
        }}
      >
        {etiqueta}
        {!em || !tieneWaPerfil ? (
          <button
            type="button"
            onClick={abrirCompartirLugarEquipoWa}
            disabled={!urlCompartirLugarEquipoWa}
            style={{
              ...btnPendienteOutline,
              opacity: urlCompartirLugarEquipoWa ? 1 : 0.5,
              cursor: urlCompartirLugarEquipoWa ? 'pointer' : 'default',
            }}
          >
            Compartir link
          </button>
        ) : (
          <button
            type="button"
            disabled={reenviandoEmail === em}
            onClick={() => void reenviarInvitacionPendiente(em)}
            style={{
              ...btnPendienteOutline,
              opacity: reenviandoEmail === em ? 0.65 : 1,
              cursor: reenviandoEmail === em ? 'default' : 'pointer',
            }}
          >
            {reenviandoEmail === em ? 'Enviando…' : 'Reenviar invitación'}
          </button>
        )}
      </div>
    );
  };

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
    const idEfectivo = authUserId || usuarioLocal.id;
    if (!cuentaAuth) {
      return { id: idEfectivo, nombre: usuarioLocal.nombre, email: '' };
    }
    const nombreCliente = String(cuentaAuth.nombre || '').trim();
    const nj = String(currentJugador?.nombre || '').trim();
    const nombreVis =
      (nj && !nj.includes('@') ? nj : '') ||
      (nombreCliente && !nombreCliente.includes('@') ? nombreCliente : '') ||
      (session?.user ? getDisplayName(userProfile, session) : '') ||
      usuarioLocal.nombre;
    return {
      id: idEfectivo,
      nombre: nombreVis,
      email: currentJugador?.email || cuentaAuth.email || '',
    };
  }, [cuentaAuth, currentJugador, usuarioLocal.id, usuarioLocal.nombre, perfilLsKey, authUserId, session, userProfile]);

  const esMiEquipo = useMemo(() => {
    if (!equipo || !yo) return false;
    if (soyCreador) return true;
    return players.some(
      (p) =>
        samePerson(p, yo) || (authUserId && String(p.id || '') === String(authUserId))
    );
  }, [equipo, players, soyCreador, yo, authUserId]);

  const miEquipoEnTorneo = useMemo(() => {
    if (!yo || !torneoEquipos.length || !equipo) return null;
    return (
      torneoEquipos.find(
        (e) =>
          e.id !== equipo.id &&
          getPlayers(e).some(
            (p) =>
              samePerson(p, yo) || (authUserId && String(p.id || '') === String(authUserId))
          )
      ) || null
    );
  }, [yo, torneoEquipos, equipo, authUserId]);

  const miSolicitudEquipo = useMemo(() => {
    if (!yo || !torneoEquipos.length) return null;
    return (
      torneoEquipos.find((e) =>
        getRequests(e).some(
          (r) => samePerson(r, yo) || (authUserId && String(r.id || '') === String(authUserId))
        )
      ) || null
    );
  }, [yo, torneoEquipos, authUserId]);

  const pedirUnirme = async () => {
    if (!equipo) return;
    if (!yo) return;
    if (authLoading) return;
    if (!session?.user) {
      navigate(authUrlWithRedirect(authLoginRedirectPath(location)));
      return;
    }
    if (!isPerfilTorneoCompleto()) {
      const back = location.pathname || `/torneo/${id}/equipos`;
      navigate(
        `/mi-perfil?from=torneo&id=${encodeURIComponent(String(id))}&redirect=${encodeURIComponent(back)}`,
        {
          state: { avisoPerfilTorneo: 'Completa tu perfil para crear o unirte a un equipo' },
        }
      );
      return;
    }
    if (equipo.equipo_abierto === false) {
      alert('Este equipo es cerrado: solo el capitán puede sumar jugadores.');
      return;
    }
    if (miEquipoEnTorneo) {
      alert('Ya estás en un equipo');
      return;
    }
    if (miSolicitudEquipo && miSolicitudEquipo.id !== equipo.id) {
      alert('Ya tienes una solicitud pendiente');
      return;
    }
    const cupo = Number(equipo.cupo_maximo || 2);
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
    setSavingSolicitud(true);
    const { error } = await supabase
      .from('equipos')
      .update({ solicitudes: nuevasSolicitudes })
      .eq('id', Number(equipoId));
    setSavingSolicitud(false);
    if (error) {
      console.error(error);
      alert('Error al pedir unirte');
      return;
    }
    cargarEquipo();
  };

  const ejecutarSalirDelEquipo = async () => {
    if (!equipo || !yo) return;
    const tid = Number(id);

    setSavingSalirEquipo(true);
    if (soyCreador) {
      const { error } = await supabase.from('equipos').delete().eq('id', Number(equipoId));
      setSavingSalirEquipo(false);
      if (error) {
        console.error(error);
        alert('No se pudo eliminar el equipo');
        return;
      }
      const hint = readEquipoActualForTorneo(tid);
      if (hint && String(hint) === String(equipoId)) clearEquipoActual();
    } else {
      const nuevosJugadores = players.filter((p) => !samePerson(p, yo));
      const nuevasSolicitudes = requests.filter((r) => !samePerson(r, yo));
      const updates = { jugadores: nuevosJugadores, solicitudes: nuevasSolicitudes };
      const { error } = await supabase.from('equipos').update(updates).eq('id', Number(equipoId));
      setSavingSalirEquipo(false);
      if (error) {
        console.error(error);
        alert('No se pudo salir del equipo');
        return;
      }
      const hint = readEquipoActualForTorneo(tid);
      if (hint && String(hint) === String(equipoId)) clearEquipoActual();
      setPlayers(nuevosJugadores);
      setRequests(nuevasSolicitudes);
      setEquipo((prev) => (prev ? { ...prev, ...updates } : prev));
    }
    setDialogoSalirEquipo(false);
    navigate(`/torneo/${id}/equipos`);
  };

  const ejecutarEliminarJugadorDelEquipo = async () => {
    const victima = dialogoEliminarJugador?.jugador;
    if (!equipo || !victima || !soyCreador) return;
    if (esCapitanJugadorEnFila(victima, equipo)) return;

    setSavingEliminarJugador(true);
    const nuevosJugadores = players.filter((pl) => !samePerson(pl, victima));
    const nuevasSolicitudes = requests.filter((r) => !samePerson(r, victima));
    const updates = { jugadores: nuevosJugadores, solicitudes: nuevasSolicitudes };
    const { error } = await supabase.from('equipos').update(updates).eq('id', Number(equipoId));
    setSavingEliminarJugador(false);
    if (error) {
      console.error(error);
      alert('No se pudo eliminar al jugador del equipo');
      return;
    }
    setDialogoEliminarJugador(null);
    await cargarEquipo();
  };

  const aceptarSolicitud = async (solicitud) => {
    if (!equipo) return;
    if (!soyCreador) return;

    const cupo = Number(equipo.cupo_maximo || 2);
    if (players.length >= cupo) {
      alert('Equipo completo');
      return;
    }

    const inviteEmail = String(solicitud.email || '').trim().toLowerCase();
    if (inviteEmail) {
      try {
        await invitarJugadorEquipo(Number(equipoId), inviteEmail);
      } catch (err) {
        console.error(err);
        alert(err?.message || 'Error al aceptar');
        return;
      }
      cargarEquipo();
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
      .eq('id', Number(equipoId));

    if (error) {
      console.error(error);
      alert('Error al aceptar');
      return;
    }

    cargarEquipo();
  };

  const rechazarSolicitud = async (solicitud) => {
    if (!equipo) return;
    if (!soyCreador) return;

    const nuevasSolicitudes = requests.filter((r) => !samePerson(r, solicitud));

    const { error } = await supabase
      .from('equipos')
      .update({ solicitudes: nuevasSolicitudes })
      .eq('id', Number(equipoId));

    if (error) {
      console.error(error);
      alert('Error al rechazar');
      return;
    }

    cargarEquipo();
  };

  const invitarWhatsappHref = useMemo(() => {
    const base =
      typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const eid = equipoId != null && String(equipoId).trim() !== '' ? String(equipoId).trim() : '';
    const url = eid
      ? `${base}/torneo/${id}/equipos?equipo=${encodeURIComponent(eid)}`
      : `${base}/torneo/${id}/equipos`;
    const txt = `Te invito a registrarte en el torneo y confirmar tu lugar en el equipo "${equipo?.nombre || ''}": ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(txt)}`;
  }, [id, equipoId, equipo?.nombre]);

  const cupoEquipo = Number(equipo?.cupo_maximo || 2);
  const plazasLlenasEquipo = players.length >= cupoEquipo;
  const marcaAbierto = equipo?.equipo_abierto === true;
  const estadoEquipoLinea = (() => {
    if (!equipo) return { texto: '', color: '#64748b' };
    if (plazasLlenasEquipo) return { texto: 'Equipo completo', color: '#64748b' };
    if (equipo.equipo_abierto === false) return { texto: 'Equipo cerrado', color: '#b91c1c' };
    if (marcaAbierto) return { texto: 'Equipo abierto – faltan jugadores', color: '#15803d' };
    return { texto: 'Cupos libres', color: '#64748b' };
  })();
  const torneoCancelado = torneo?.estado === 'cancelado';
  const torneoInscripcionAbierta =
    torneo && torneo.estado !== 'finalizado' && torneo.estado !== 'cancelado';
  const solicitudPendienteAqui = !!(yo && requests.some((r) => samePerson(r, yo)));
  const solicitudPendienteOtroEquipo = !!(
    yo &&
    miSolicitudEquipo &&
    miSolicitudEquipo.id !== equipo?.id
  );
  const puedePedirUnirse =
    !!equipo &&
    torneoInscripcionAbierta &&
    marcaAbierto &&
    !esMiEquipo &&
    !soyCreador &&
    !!yo &&
    !plazasLlenasEquipo &&
    !miEquipoEnTorneo &&
    !solicitudPendienteOtroEquipo &&
    !solicitudPendienteAqui;

  const equipoListoJugar =
    plazasLlenasEquipo &&
    players.every((p) => {
      if (esJugadorPendiente(p)) return false;
      return String(p.email || '').trim() !== '' || p.id != null;
    });

  const formaPartePlantel = !!(yo && players.some((p) => samePerson(p, yo)));
  const puedeMostrarSalirEquipo =
    esMiEquipo && !torneoCancelado && (formaPartePlantel || soyCreador);

  const inscripcionEstadoEquipo = equipo ? getEquipoInscripcionEstado(equipo) : 'pendiente';

  const equipoPageShellStyle = useMemo(
    () => ({
      ...pageBackgroundStyle,
      boxSizing: 'border-box',
      paddingTop: hubContentPaddingTopCss(location.pathname),
      paddingLeft: 12,
      paddingRight: 12,
      paddingBottom: `calc(${HUB_CONTENT_PADDING_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`,
    }),
    [location.pathname]
  );

  const confirmarInscripcionDesdeVista = async () => {
    if (!equipo || !torneo) return;
    if (!soyCreador) return;
    if (!equipoListoJugar) return;
    if (getEquipoInscripcionEstado(equipo) === 'confirmado') return;
    if (authLoading) return;
    if (!session?.user) {
      navigate(authUrlWithRedirect(authLoginRedirectPath(location)));
      return;
    }
    const em = String(authEmail || session?.user?.email || '').trim();
    if (!em) {
      alert('Necesitas un email en tu perfil para pagar la inscripción.');
      return;
    }
    setMpInscripcionLoading(true);
    const r = await iniciarPagoInscripcionTorneo({
      equipoId: equipo.id,
      torneoId: Number(id),
      email: em,
      torneoNombre: torneo.nombre,
      equipoNombre: equipo.nombre,
      torneo,
    });
    setMpInscripcionLoading(false);
    if (!r.ok) alert(r.error);
  };

  if (loading) {
    return (
      <div style={equipoPageShellStyle}>
        <AppHeader title="Equipo" />
        <div style={{ ...cardStyle, maxWidth: '900px', margin: '0 auto' }}>Cargando equipo...</div>
        <BottomNav />
      </div>
    );
  }

  if (!equipo) {
    return (
      <div style={equipoPageShellStyle}>
        <AppHeader title="Equipo" />
        <div style={{ ...cardStyle, maxWidth: '900px', margin: '0 auto' }}>
          <p>No se encontró el equipo.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={equipoPageShellStyle}>
      <AppHeader title="Equipo" />

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div
          style={{
            ...cardStyle,
            marginBottom: 18,
          }}
        >
          {esMiEquipo ? (
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: soyCreador ? '0.04em' : '0.08em',
                textTransform: soyCreador ? 'none' : 'uppercase',
                color: T.colorTextMuted,
                marginBottom: '8px',
              }}
            >
              {soyCreador ? `${ICONO_CAPITAN} Capitán` : 'Tu equipo'}
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            <span style={{ fontSize: '22px', lineHeight: 1 }} aria-hidden>
              👥
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.25,
              }}
            >
              {equipo.nombre}
            </h2>
          </div>

          {!torneoCancelado ? (
            <div
              style={{
                marginBottom: '12px',
                fontSize: '15px',
                fontWeight: 700,
                color: estadoEquipoLinea.color,
                lineHeight: 1.35,
              }}
            >
              {estadoEquipoLinea.texto}
            </div>
          ) : null}

          {!torneoCancelado ? (
            <div style={{ marginBottom: '14px' }}>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  ...(inscripcionEstadoEquipo === 'confirmado'
                    ? { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }
                    : { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }),
                }}
              >
                {etiquetaInscripcionEstado(inscripcionEstadoEquipo)}
              </span>
            </div>
          ) : null}

          {torneoCancelado ? (
            <div
              style={{
                marginBottom: '16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '14px 16px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '15px',
                textAlign: 'center',
              }}
            >
              Este torneo fue cancelado
            </div>
          ) : null}

          {session?.user && (esMiEquipo || soyCreador) && !torneoCancelado && perfilIncompleto ? (
            <div
              style={{
                marginBottom: '14px',
                padding: '12px 14px',
                background: '#fef9c3',
                border: '1px solid #fde047',
                borderRadius: '10px',
                color: '#854d0e',
                fontSize: '14px',
                fontWeight: 700,
                lineHeight: 1.45,
              }}
            >
              <div style={{ marginBottom: '10px' }}>Pendiente de completar perfil</div>
              <button
                type="button"
                onClick={() => {
                  const back = location.pathname || `/torneo/${id}/equipos`;
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

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '12px',
              marginTop: '4px',
              marginBottom: '10px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Jugadores</h3>
            <span style={{ fontSize: '13px', fontWeight: 700, color: T.colorTextMuted }}>
              {players.length}/{cupoEquipo}
            </span>
          </div>

          {torneoCancelado ? (
            players.length === 0 ? (
              <div style={{ color: '#666' }}>Todavía no hay jugadores</div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {players.map((p, idx) => (
                  <div
                    key={`${p.nombre}-${idx}`}
                    style={{
                      padding: '12px',
                      borderRadius: 12,
                      background: T.colorCardMuted,
                    }}
                  >
                    <div style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span>{jugadorNombreTorneoEtiqueta(p, nombreTorneoCtx)}</span>
                      {esCapitanJugadorEnFila(p, equipo) ? <CapitanBadgeC /> : null}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : players.length === 0 ? (
            <div style={{ color: '#666' }}>Todavía no hay jugadores</div>
          ) : soyCreador ? (
            <div style={{ display: 'grid', gap: '10px' }}>
                {players.map((p, idx) => (
                <div
                  key={`${p.email || p.nombre}-${idx}`}
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    background: T.colorCardMuted
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span>{jugadorNombreTorneoEtiqueta(p, nombreTorneoCtx)}</span>
                        {esCapitanJugadorEnFila(p, equipo) ? <CapitanBadgeC /> : null}
                      </div>
                      {samePerson(p, yo) && !perfilTorneoCompleto ? (
                        <div style={{ fontSize: '12px', color: T.colorWarningSoft, fontWeight: 800, marginTop: '4px' }}>
                          Perfil incompleto
                        </div>
                      ) : esJugadorPendiente(p) ? (
                        renderPendienteDeConfirmar(p, { conAccionesCreador: true })
                      ) : null}
                    </div>
                    {soyCreador && !torneoCancelado && !esCapitanJugadorEnFila(p, equipo) ? (
                      <button
                        type="button"
                        aria-label={`Quitar a ${jugadorNombreTorneoEtiqueta(p, nombreTorneoCtx)} del equipo`}
                        onClick={() =>
                          setDialogoEliminarJugador({
                            jugador: p,
                            etiqueta: jugadorNombreTorneoEtiqueta(p, nombreTorneoCtx),
                          })
                        }
                        style={{
                          flexShrink: 0,
                          width: '28px',
                          height: '28px',
                          padding: 0,
                          lineHeight: 1,
                          fontSize: '16px',
                          fontWeight: 700,
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          background: '#fff',
                          color: '#b91c1c',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : esMiEquipo ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {players.map((p, idx) => (
                <div
                  key={`${p.nombre}-${idx}`}
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    background: T.colorCardMuted
                  }}
                >
                  <div style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span>{jugadorNombreTorneoEtiqueta(p, nombreTorneoCtx)}</span>
                    {esCapitanJugadorEnFila(p, equipo) ? <CapitanBadgeC /> : null}
                  </div>
                  {samePerson(p, yo) && !perfilTorneoCompleto ? (
                    <div style={{ fontSize: '12px', color: T.colorWarningSoft, fontWeight: 800, marginTop: '4px' }}>
                      Perfil incompleto
                    </div>
                  ) : esJugadorPendiente(p) ? (
                    renderPendienteDeConfirmar(p, { conAccionesCreador: false })
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {players.map((p, idx) => (
                <div
                  key={`${p.nombre}-${idx}`}
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    background: T.colorCardMuted
                  }}
                >
                  <div style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span>{jugadorNombreTorneoEtiqueta(p, nombreTorneoCtx)}</span>
                    {esCapitanJugadorEnFila(p, equipo) ? <CapitanBadgeC /> : null}
                  </div>
                  {samePerson(p, yo) && !perfilTorneoCompleto ? (
                    <div style={{ fontSize: '12px', color: T.colorWarningSoft, fontWeight: 800, marginTop: '4px' }}>
                      Perfil incompleto
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {esMiEquipo && !soyCreador && !torneoCancelado ? (
            <p style={{ marginTop: '16px', marginBottom: 0, fontSize: '13px', color: T.colorTextMuted, lineHeight: 1.5 }}>
              Solo el capitán del equipo puede modificar este equipo.
            </p>
          ) : null}

          {!esMiEquipo && !soyCreador && torneoInscripcionAbierta ? (
            <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              {equipo.equipo_abierto === false ? (
                <p style={{ margin: 0, fontSize: '13px', color: T.colorTextMuted, lineHeight: 1.5 }}>
                  Equipo cerrado: el capitán suma jugadores; no se aceptan solicitudes para unirse.
                </p>
              ) : solicitudPendienteAqui ? (
                <p style={{ margin: 0, fontSize: '13px', color: T.colorTextMuted, fontWeight: 600 }}>
                  Tu solicitud para unirte está pendiente de aprobación del capitán.
                </p>
              ) : solicitudPendienteOtroEquipo ? (
                <p style={{ margin: 0, fontSize: '13px', color: T.colorTextMuted }}>
                  Ya tienes una solicitud pendiente en otro equipo de este torneo.
                </p>
              ) : puedePedirUnirse ? (
                <button
                  type="button"
                  onClick={() => void pedirUnirme()}
                  disabled={savingSolicitud}
                  style={{
                    ...buttonPrimaryStyle,
                    width: '100%',
                    maxWidth: '280px',
                    opacity: savingSolicitud ? 0.65 : 1,
                    cursor: savingSolicitud ? 'default' : 'pointer',
                  }}
                >
                  {savingSolicitud ? 'Enviando…' : 'Solicitar unirme'}
                </button>
              ) : miEquipoEnTorneo ? (
                <p style={{ margin: 0, fontSize: '13px', color: T.colorTextMuted }}>
                  Ya participas en otro equipo de este torneo.
                </p>
              ) : plazasLlenasEquipo ? (
                <p style={{ margin: 0, fontSize: '13px', color: T.colorTextMuted }}>Equipo completo.</p>
              ) : null}
            </div>
          ) : null}

          {puedeMostrarSalirEquipo ? (
            <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setDialogoSalirEquipo(true)}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  cursor: 'pointer',
                }}
              >
                {soyCreador ? 'Disolver equipo' : 'Salir del equipo'}
              </button>
            </div>
          ) : null}

        </div>

        {soyCreador &&
          torneo &&
          torneo.estado !== 'finalizado' &&
          torneo.estado !== 'cancelado' && (
            <div
              style={{
                ...cardStyle,
                marginBottom: 18,
              }}
            >
              <h3 style={{ marginTop: 0 }}>Invitar jugadores</h3>
              {players.length >= cupoEquipo ? (
                equipoListoJugar ? (
                  <p style={{ margin: '0 0 14px', fontSize: '14px', color: T.colorSuccessStrong, fontWeight: 700 }}>
                    Equipo completo
                  </p>
                ) : (
                  <p style={{ margin: '0 0 14px', fontSize: '14px', color: T.colorWarningSoft, fontWeight: 700 }}>
                    Faltan confirmar jugadores
                  </p>
                )
              ) : null}
              {equipoListoJugar && inscripcionEstadoEquipo === 'pendiente' ? (
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: T.colorTextMuted, lineHeight: 1.45 }}>
                  Paga la inscripción del equipo para confirmar el cupo en el torneo.
                </p>
              ) : null}
              {soyCreador && equipoListoJugar && inscripcionEstadoEquipo === 'pendiente' ? (
                <button
                  type="button"
                  disabled={mpInscripcionLoading}
                  onClick={() => void confirmarInscripcionDesdeVista()}
                  style={{
                    ...buttonPrimaryStyle,
                    width: '100%',
                    marginBottom: '14px',
                    opacity: mpInscripcionLoading ? 0.7 : 1,
                    cursor: mpInscripcionLoading ? 'default' : 'pointer',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  }}
                >
                  {mpInscripcionLoading ? 'Redirigiendo…' : 'Confirmar inscripción'}
                </button>
              ) : null}
              {marcaAbierto ? (
                <a
                  href={invitarWhatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '10px 16px',
                    background: '#25d366',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Invitar por WhatsApp
                </a>
              ) : null}
            </div>
          )}

        {soyCreador && !torneoCancelado && marcaAbierto && (
          <div
            style={{
              ...cardStyle,
              marginBottom: 18,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Solicitudes pendientes</h3>

            {requests.length === 0 ? (
              <div style={{ color: '#666' }}>No hay solicitudes pendientes.</div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {requests.map((sol, idx) => (
                  <div
                    key={`${sol.email || sol.nombre}-${idx}`}
                    style={{
                      background: '#f9fafb',
                      borderRadius: '10px',
                      padding: '12px'
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '8px' }}>
                      {jugadorNombreTorneoEtiqueta(sol, nombreTorneoCtx)}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => aceptarSolicitud(sol)}
                        style={{
                          padding: '8px 12px',
                          background: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        Aceptar
                      </button>

                      <button
                        onClick={() => rechazarSolicitud(sol)}
                        style={{
                          padding: '8px 12px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer'
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
        )}

        {dialogoSalirEquipo ? (
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
            onClick={() => !savingSalirEquipo && setDialogoSalirEquipo(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="salir-equipo-titulo"
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
                id="salir-equipo-titulo"
                style={{ margin: '0 0 18px', fontSize: '16px', fontWeight: 700, color: '#0f172a', lineHeight: 1.45 }}
              >
                {soyCreador
                  ? '¿Disolver el equipo? Se eliminará por completo.'
                  : '¿Quieres salir del equipo?'}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={savingSalirEquipo}
                  onClick={() => setDialogoSalirEquipo(false)}
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
                  onClick={() => void ejecutarSalirDelEquipo()}
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
                  {savingSalirEquipo ? 'Saliendo…' : soyCreador ? 'Disolver' : 'Salir'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {dialogoEliminarJugador ? (
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
            onClick={() => !savingEliminarJugador && setDialogoEliminarJugador(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="eliminar-jugador-titulo"
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
                id="eliminar-jugador-titulo"
                style={{ margin: '0 0 18px', fontSize: '16px', fontWeight: 700, color: '#0f172a', lineHeight: 1.45 }}
              >
                ¿Eliminar a {dialogoEliminarJugador.etiqueta || 'este jugador'} del equipo?
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={savingEliminarJugador}
                  onClick={() => setDialogoEliminarJugador(null)}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    cursor: savingEliminarJugador ? 'default' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingEliminarJugador}
                  onClick={() => void ejecutarEliminarJugadorDelEquipo()}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    border: 'none',
                    background: '#b91c1c',
                    color: '#fff',
                    cursor: savingEliminarJugador ? 'default' : 'pointer',
                    opacity: savingEliminarJugador ? 0.7 : 1,
                  }}
                >
                  {savingEliminarJugador ? 'Eliminando…' : 'Confirmar'}
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