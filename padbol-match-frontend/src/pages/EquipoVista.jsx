import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { AppScreenHeaderBar } from '../components/AppUnifiedHeader';
import * as T from '../theme/designTokens';
import { cardStyle, pageBackgroundStyle, buttonPrimaryStyle } from '../theme/uiStyles';
import { getOrCreateUsuarioBasico } from '../utils/usuarioBasico';
import {
  readJugadorPerfil,
  isPerfilTorneoCompleto,
  refreshJugadorPerfilFromSupabase,
  nombreCompletoJugadorPerfil,
  PERFIL_CHANGE_EVENT,
} from '../utils/jugadorPerfil';
import { clearEquipoActual, readEquipoActualForTorneo } from '../utils/torneoEquipoLocal';

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

function normalizePlayer(p) {
  if (!p) return null;
  if (typeof p === 'string') {
    return { nombre: p, email: '', estado: 'confirmado' };
  }
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

export default function EquipoVista({ onLogout }) {
  const { id, equipoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const currentCliente = getCurrentCliente();
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
  const [perfilLsKey, setPerfilLsKey] = useState(0);

  const emailCuenta = String(currentCliente?.email || '').trim();
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
  }, [emailCuenta, id, equipoId]);

  useEffect(() => {
    const fn = () => setPerfilLsKey((k) => k + 1);
    window.addEventListener(PERFIL_CHANGE_EVENT, fn);
    return () => window.removeEventListener(PERFIL_CHANGE_EVENT, fn);
  }, []);

  const perfilTorneoCompleto = useMemo(() => {
    void perfilLsKey;
    return isPerfilTorneoCompleto();
  }, [perfilLsKey]);

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
      setLoading(false);
      return;
    }

    setEquipo(data || null);

    if (data?.torneo_id) {
      const { data: torneoData, error: torneoError } = await supabase
        .from('torneos')
        .select('*')
        .eq('id', Number(data.torneo_id))
        .maybeSingle();

      if (torneoError) {
        console.error(torneoError);
        setTorneo(null);
      } else {
        setTorneo(torneoData || null);
      }
    } else {
      setTorneo(null);
    }

    const jugadores = Array.isArray(data?.jugadores)
      ? data.jugadores.map(normalizePlayer).filter(Boolean)
      : typeof data?.jugadores === 'string' && data.jugadores.trim()
      ? data.jugadores
          .split(' + ')
          .map((n) => ({ nombre: n.trim(), email: '', estado: 'confirmado' }))
          .filter((p) => p.nombre)
      : [];

    const solicitudes = Array.isArray(data?.solicitudes)
      ? data.solicitudes.map(normalizePlayer).filter(Boolean)
      : [];

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
    const jp = readJugadorPerfil();
    const email = String(currentCliente?.email || jp?.email || '').trim();
    if (!email) return;
    const nombreNorm = String(currentCliente?.nombre || nombreCompletoJugadorPerfil(jp) || '')
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
            id: currentCliente?.id ?? usuarioLocal.id ?? p.id,
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
  }, [loading, equipoId, currentCliente?.email, currentCliente?.nombre, currentCliente?.id, perfilLsKey, usuarioLocal.id]);

  const soyCreador = String(equipo?.creador_id || '') === String(usuarioLocal.id);

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
    const jp = readJugadorPerfil();
    if (!currentCliente) {
      if (isPerfilTorneoCompleto(jp)) {
        const nm = nombreCompletoJugadorPerfil(jp);
        const em = String(jp?.email || '').trim();
        return { id: usuarioLocal.id, nombre: nm || usuarioLocal.nombre, email: em };
      }
      return { id: usuarioLocal.id, nombre: usuarioLocal.nombre, email: '' };
    }
    return {
      id: usuarioLocal.id,
      nombre: currentJugador?.nombre || currentCliente.nombre || currentCliente.email || usuarioLocal.nombre,
      email: currentJugador?.email || currentCliente.email || '',
    };
  }, [currentCliente, currentJugador, usuarioLocal.id, usuarioLocal.nombre, perfilLsKey]);

  const esMiEquipo = useMemo(() => {
    if (!equipo || !yo) return false;
    if (soyCreador) return true;
    return players.some((p) => samePerson(p, yo));
  }, [equipo, players, soyCreador, yo]);

  const miEquipoEnTorneo = useMemo(() => {
    if (!yo || !torneoEquipos.length || !equipo) return null;
    return (
      torneoEquipos.find(
        (e) => e.id !== equipo.id && getPlayers(e).some((p) => samePerson(p, yo))
      ) || null
    );
  }, [yo, torneoEquipos, equipo]);

  const miSolicitudEquipo = useMemo(() => {
    if (!yo || !torneoEquipos.length) return null;
    return torneoEquipos.find((e) => getRequests(e).some((r) => samePerson(r, yo))) || null;
  }, [yo, torneoEquipos]);

  const pedirUnirme = async () => {
    if (!equipo) return;
    if (!yo) return;
    if (!isPerfilTorneoCompleto()) {
      navigate(`/perfil?from=torneo&id=${encodeURIComponent(String(id))}`, {
        state: { avisoPerfilTorneo: 'Completá tu perfil para crear o unirte a un equipo' },
      });
      return;
    }
    if (equipo.equipo_abierto === false) {
      alert('Este equipo es cerrado: solo el creador puede sumar jugadores.');
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
    setSavingSalirEquipo(true);
    const nuevosJugadores = players.filter((p) => !samePerson(p, yo));
    const nuevasSolicitudes = requests.filter((r) => !samePerson(r, yo));
    const updates = { jugadores: nuevosJugadores, solicitudes: nuevasSolicitudes };
    if (soyCreador) {
      updates.creador_email = null;
      updates.creador_id = null;
    }
    const { error } = await supabase.from('equipos').update(updates).eq('id', Number(equipoId));
    setSavingSalirEquipo(false);
    if (error) {
      console.error(error);
      alert('No se pudo salir del equipo');
      return;
    }
    const tid = Number(id);
    const hint = readEquipoActualForTorneo(tid);
    if (hint && String(hint) === String(equipoId)) clearEquipoActual();
    setPlayers(nuevosJugadores);
    setRequests(nuevasSolicitudes);
    setEquipo((prev) => (prev ? { ...prev, ...updates } : prev));
    setDialogoSalirEquipo(false);
    navigate(`/torneo/${id}/equipos`);
  };

  const headerTitle = useMemo(() => {
    const nombre = (equipo?.nombre || '').trim() || 'Equipo';
    return esMiEquipo ? `Mi equipo: ${nombre}` : `Equipo: ${nombre}`;
  }, [equipo?.nombre, esMiEquipo]);

  const renderHeader = (titleText) => (
    <AppScreenHeaderBar
      title={titleText}
      backTo={`/torneo/${id}/equipos`}
      onLogout={onLogout || undefined}
      maxWidth="900px"
    />
  );

  const aceptarSolicitud = async (solicitud) => {
    if (!equipo) return;
    if (!soyCreador) return;

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
    const url = `${base}/torneo/${id}/equipos`;
    const txt = `Te invito a registrarte en el torneo y confirmar tu lugar en el equipo "${equipo?.nombre || ''}": ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(txt)}`;
  }, [id, equipo?.nombre]);

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

  if (loading) {
    return (
      <div style={{ ...pageBackgroundStyle, padding: '8px 12px 12px' }}>
        {renderHeader('Equipo')}
        <div style={{ ...cardStyle, maxWidth: '900px', margin: '0 auto' }}>Cargando equipo...</div>
      </div>
    );
  }

  if (!equipo) {
    return (
      <div style={{ ...pageBackgroundStyle, padding: '8px 12px 12px' }}>
        {renderHeader('Equipo')}
        <div style={{ ...cardStyle, maxWidth: '900px', margin: '0 auto' }}>
          <p>No se encontró el equipo.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...pageBackgroundStyle, padding: '8px 12px 12px' }}>
      {renderHeader(headerTitle)}

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div
          style={{
            ...cardStyle,
            marginBottom: 18,
          }}
        >
          <h2 style={{ marginTop: 0 }}>🏆 {equipo.nombre}</h2>

          {!torneoCancelado ? (
            <div
              style={{
                marginTop: '6px',
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

          {(esMiEquipo || soyCreador) && !torneoCancelado && !perfilTorneoCompleto ? (
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

          {soyCreador && !torneoCancelado ? (
            <div style={{ color: '#666', marginBottom: '16px' }}>
              {players.length}/{Number(equipo.cupo_maximo || 2)} jugadores
            </div>
          ) : null}

          <h3>Jugadores del equipo</h3>

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
                    <div style={{ fontWeight: 700 }}>{p.nombre}</div>
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
                  <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                  {samePerson(p, yo) && !perfilTorneoCompleto ? (
                    <div style={{ fontSize: '12px', color: T.colorWarningSoft, fontWeight: 800, marginTop: '4px' }}>
                      Perfil incompleto
                    </div>
                  ) : esJugadorPendiente(p) ? (
                    <div style={{ fontSize: '13px', color: T.colorWarningSoft, fontWeight: 600, marginTop: '4px' }}>
                      Pendiente de confirmar
                    </div>
                  ) : p.email ? (
                    <div style={{ fontSize: '13px', color: T.colorTextMuted, marginTop: '4px' }}>{p.email}</div>
                  ) : null}
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
                  <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                  {samePerson(p, yo) && !perfilTorneoCompleto ? (
                    <div style={{ fontSize: '12px', color: T.colorWarningSoft, fontWeight: 800, marginTop: '4px' }}>
                      Perfil incompleto
                    </div>
                  ) : esJugadorPendiente(p) ? (
                    <div style={{ fontSize: '13px', color: T.colorWarningSoft, fontWeight: 600, marginTop: '4px' }}>
                      Pendiente de confirmar
                    </div>
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
                  <div style={{ fontWeight: 700 }}>{p.nombre}</div>
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
              Solo el creador del equipo puede modificar este equipo.
            </p>
          ) : null}

          {!esMiEquipo && !soyCreador && torneoInscripcionAbierta ? (
            <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              {equipo.equipo_abierto === false ? (
                <p style={{ margin: 0, fontSize: '13px', color: T.colorTextMuted, lineHeight: 1.5 }}>
                  Equipo cerrado: el creador suma jugadores; no se aceptan solicitudes para unirse.
                </p>
              ) : solicitudPendienteAqui ? (
                <p style={{ margin: 0, fontSize: '13px', color: T.colorTextMuted, fontWeight: 600 }}>
                  Tu solicitud para unirte está pendiente de aprobación del creador.
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
                Salir del equipo
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
            </div>
          )}

        {soyCreador && !torneoCancelado && (
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
                    <div style={{ fontWeight: 700, marginBottom: '8px' }}>{sol.nombre}</div>

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
                ¿Seguro que querés salir del equipo?
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