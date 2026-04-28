import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_CONTENT_PADDING_TOP_PX,
} from '../constants/hubLayout';
import './AdminDashboard.css';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import { formatNivelTorneo, formatTipoTorneo } from '../utils/torneoFormatters';

const CATEGORIAS = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

// "2026-02-26" → "26 Feb 2026"
function formatFecha(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

// "2026-04-10" → "Viernes 10 de Abril"
function formatFechaDia(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase());
}

// "18:00" + 90 → "18:00 - 19:30"
function horaRango(hora, duracion) {
  if (!hora) return '—';
  if (hora.includes(' - ')) return hora; // already stored as a range — return as-is
  const dur = parseInt(duracion) || 90;  // default 90 min when not stored
  const [hh, mm] = hora.split(':').map(Number);
  const mins = (mm || 0) + dur;
  const endH = String(hh + Math.floor(mins / 60)).padStart(2, '0');
  const endM = String(mins % 60).padStart(2, '0');
  return `${hora} - ${endH}:${endM}`;
}

// Returns a JSX status badge for a reserva
function EstadoBadge({ reserva }) {
  if (reserva.estado === 'cancelada' || reserva.cancelada) {
    return <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>❌ Cancelada</span>;
  }
  if (reserva.estado === 'reservada') {
    return <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>📋 Reservada</span>;
  }
  if (reserva.estado === 'completada' || !esFutura(reserva)) {
    return <span style={{ background: '#e2e8f0', color: '#475569', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>✅ Completada</span>;
  }
  return <span style={{ background: '#ede9fe', color: '#3b2f6e', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>🟢 Confirmada</span>;
}

// Returns true if the reserva's fecha+hora is in the future.
// Reserva datetime is parsed with Argentina offset (-03:00) to avoid UTC drift.
function esFutura(reserva) {
  if (!reserva.fecha) return false;
  // hora may be stored as "18:00" or "18:00 - 19:30" — use start time only
  const startHora = (reserva.hora || '23:59').split(' - ')[0].trim();
  const timePart = /^\d{1,2}:\d{2}/.test(startHora) ? startHora.substring(0, 5) : '23:59';
  const ahora = new Date();
  // Use explicit Argentina offset so future/past status is stable across client timezones.
  const fechaSolo = reserva.fecha.substring(0, 10); // "YYYY-MM-DD"
  const reservaDate = new Date(`${fechaSolo}T${timePart}:00-03:00`);
  return reservaDate > ahora;
}

// Build a lookup: country name (lowercase) → flag emoji
const FLAG_MAP = {};
[...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].forEach(p => {
  FLAG_MAP[p.nombre.toLowerCase()] = p.bandera;
});

function sedeFlag(sede) {
  if (!sede?.pais) return '';
  const pais = sede.pais.trim();
  // Already starts with a flag emoji (multi-char emoji code point)
  if ([...pais][0]?.match(/\p{Emoji_Presentation}/u)) return [...pais][0];
  // Plain country name — look it up
  return FLAG_MAP[pais.toLowerCase()] || '';
}

export default function AdminDashboard({ apiBaseUrl = 'https://padbol-backend.onrender.com', rol = null, sedeId = null }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const currentEmail = (session?.user?.email || '').trim().toLowerCase();

  // Legacy email-based flags (kept for backward compatibility while roles roll out)
  const isSuperAdmin = rol === 'super_admin' || currentEmail === 'padbolinternacional@gmail.com';
  const isAdmin = isSuperAdmin || rol === 'admin_nacional' || rol === 'admin_club' ||
    ['admin@padbol.com', 'sm@padbol.com', 'juanpablo@padbol.com'].includes(currentEmail);

  // Role-based access flags
  const esAdminNacional = rol === 'admin_nacional';
  const esAdminClub     = rol === 'admin_club';
  const puedeVerConfig  = isSuperAdmin;
  const puedeCrearTorneosOficiales = isSuperAdmin || (!esAdminClub);

  const ROLE_BADGE = {
    super_admin:    '👑 Super Admin',
    admin_nacional: '🌎 Admin Nacional',
    admin_club:     '🏠 Admin Club',
  };

  const [reservas, setReservas] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [sedesMap, setSedesMap] = useState({});
  const [ingresos, setIngresos] = useState({ ARS: 0, USD: 0, EUR: 0 });
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [mensajeExito, setMensajeExito] = useState('');
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || sessionStorage.getItem('adminActiveTab') || 'resumen'
  );

  const [pendientes, setPendientes] = useState([]);
  const [pendientesLoading, setPendientesLoading] = useState(true);
  // keyed by player email: { open: bool, categoria: string, saving: bool }
  const [validacionState, setValidacionState] = useState({});

  useEffect(() => {
    console.log('[AdminDashboard] fetchData triggered — rol:', rol, 'sedeId:', sedeId);
    fetchData();
    fetchPendientes();
  }, [apiBaseUrl, rol]); // rol in deps: re-fetch after role resolves from null → actual value

  const fetchPendientes = async () => {
    setPendientesLoading(true);
    const { data, error } = await supabase
      .from('jugadores_perfil')
      .select('email, nombre, pais, nivel')
      .eq('pendiente_validacion', true)
      .order('nombre');
    if (!error) setPendientes(data || []);
    setPendientesLoading(false);
  };

  const aprobarJugador = async (email) => {
    setValidacionState(prev => ({ ...prev, [email]: { ...prev[email], saving: true } }));
    await supabase
      .from('jugadores_perfil')
      .update({ pendiente_validacion: false })
      .eq('email', email);
    setPendientes(prev => prev.filter(p => p.email !== email));
    setValidacionState(prev => { const s = { ...prev }; delete s[email]; return s; });
  };

  const guardarCategoria = async (email) => {
    const nuevaCategoria = validacionState[email]?.categoria;
    if (!nuevaCategoria) return;
    setValidacionState(prev => ({ ...prev, [email]: { ...prev[email], saving: true } }));
    await supabase
      .from('jugadores_perfil')
      .update({ nivel: nuevaCategoria, pendiente_validacion: false })
      .eq('email', email);
    setPendientes(prev => prev.filter(p => p.email !== email));
    setValidacionState(prev => { const s = { ...prev }; delete s[email]; return s; });
  };

  const toggleCambiarCategoria = (email, nivelActual) => {
    setValidacionState(prev => ({
      ...prev,
      [email]: {
        open: !prev[email]?.open,
        categoria: prev[email]?.categoria || nivelActual,
        saving: false,
      },
    }));
  };

  const eliminarTorneo = async (torneoId, torneoNombre) => {
    if (!window.confirm(`¿Eliminar el torneo "${torneoNombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/torneos/${torneoId}`, { method: 'DELETE' });
      if (res.ok) {
        setTorneos(prev => prev.filter(t => t.id !== torneoId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert('Error al eliminar: ' + (data.error || res.statusText));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const [editandoTorneoId, setEditandoTorneoId] = useState(null);
  const [editTorneoForm, setEditTorneoForm] = useState({});
  const [savingTorneo, setSavingTorneo] = useState(false);
  const [torneoStats, setTorneoStats] = useState({});

  // ── Config puntos (superAdmin only) ──
  const CONFIG_NIVELES_DEFAULT       = { club_no_oficial: 10, club_oficial: 30, nacional: 100, internacional: 300, mundial: 1000 };
  const CONFIG_POSICIONES_DEFAULT    = { 1: 30, 2: 20, 3: 15, 4: 12, 5: 8, 6: 6, 7: 4, 8: 3, 9: 1, 10: 1 };
  const CONFIG_NIVELES_LABELS_DEFAULT = { club_no_oficial: 'Club No Oficial', club_oficial: 'Club Oficial', nacional: 'Nacional', internacional: 'Internacional', mundial: 'Mundial' };
  const STANDARD_KEYS = ['club_no_oficial', 'club_oficial', 'nacional', 'internacional', 'mundial'];

  // ── localStorage keys used in this component ──
  // 'config_puntos'  — superAdmin points config (niveles, posiciones, tipos_custom, niveles_labels, niveles_hidden)
  // 'currentCliente' — logged-in user object (email, nombre, etc.)
  // 'adminActiveTab' — last active tab so browser-back preserves position

  // Migrate old posiciones data: old system stored point-multipliers (pos 1 = 100).
  // New system stores percentages summing to 100 (pos 1 = 30). Detect and reset.
  const migratePositions = (posiciones) => {
    if (!posiciones || posiciones[1] !== 30) return CONFIG_POSICIONES_DEFAULT;
    return posiciones;
  };

  const loadConfigFromStorage = () => {
    try {
      const raw = localStorage.getItem('config_puntos');
      if (!raw) return { niveles: CONFIG_NIVELES_DEFAULT, posiciones: CONFIG_POSICIONES_DEFAULT, tipos_custom: [] };
      const parsed = JSON.parse(raw);
      const migratedPos = migratePositions(parsed.posiciones);
      if (migratedPos !== parsed.posiciones) {
        // Write migrated value back so next load is clean
        parsed.posiciones = migratedPos;
        localStorage.setItem('config_puntos', JSON.stringify(parsed));
      }
      return parsed;
    } catch { return { niveles: CONFIG_NIVELES_DEFAULT, posiciones: CONFIG_POSICIONES_DEFAULT, tipos_custom: [] }; }
  };

  const [configNiveles,      setConfigNiveles]      = useState(() => loadConfigFromStorage().niveles);
  const [configPosiciones,   setConfigPosiciones]   = useState(() => loadConfigFromStorage().posiciones);
  const [configTiposCustom,  setConfigTiposCustom]  = useState(() => loadConfigFromStorage().tipos_custom || []);
  const [configNivelesLabels,setConfigNivelesLabels]= useState(() => ({ ...CONFIG_NIVELES_LABELS_DEFAULT, ...(loadConfigFromStorage().niveles_labels || {}) }));
  const [configNivelesHidden,setConfigNivelesHidden]= useState(() => new Set(loadConfigFromStorage().niveles_hidden || []));
  const [previewNivel,       setPreviewNivel]       = useState('nacional');
  const [configSaving,       setConfigSaving]       = useState(false);
  const [configMsg,          setConfigMsg]          = useState('');
  const [nuevoTipo,          setNuevoTipo]          = useState({ nombre: '', puntos: 0 });
  const [editandoTipoId,     setEditandoTipoId]     = useState(null);
  const [editandoTipoData,   setEditandoTipoData]   = useState({ nombre: '', puntos: 0 });

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch(`${apiBaseUrl}/api/config/puntos`)
      .then(r => r.json())
      .then(data => {
        const posiciones = migratePositions(data.posiciones);
        if (data.niveles)        { setConfigNiveles(data.niveles); }
        if (data.posiciones)     { setConfigPosiciones(posiciones); }
        if (data.tipos_custom)   { setConfigTiposCustom(data.tipos_custom); }
        if (data.niveles_labels) { setConfigNivelesLabels(prev => ({ ...CONFIG_NIVELES_LABELS_DEFAULT, ...data.niveles_labels })); }
        if (data.niveles_hidden) { setConfigNivelesHidden(new Set(data.niveles_hidden)); }
        localStorage.setItem('config_puntos', JSON.stringify({
          niveles:        data.niveles,
          posiciones:     posiciones,
          tipos_custom:   data.tipos_custom   || [],
          niveles_labels: data.niveles_labels || {},
          niveles_hidden: data.niveles_hidden || [],
        }));
      })
      .catch(() => {});
  }, [isSuperAdmin, apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarConfig = async () => {
    setConfigSaving(true);
    setConfigMsg('');
    try {
      const body = {
        niveles:        configNiveles,
        posiciones:     configPosiciones,
        tipos_custom:   configTiposCustom,
        niveles_labels: configNivelesLabels,
        niveles_hidden: [...configNivelesHidden],
      };
      localStorage.setItem('config_puntos', JSON.stringify(body));
      const res = await fetch(`${apiBaseUrl}/api/config/puntos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { setConfigMsg('✅ Configuración guardada'); }
      else        { setConfigMsg('⚠️ Guardado local OK, error en servidor'); }
    } catch {
      setConfigMsg('⚠️ Sin conexión — guardado solo en local');
    } finally {
      setConfigSaving(false);
      setTimeout(() => setConfigMsg(''), 3000);
    }
  };

  useEffect(() => {
    if (activeTab !== 'torneos' || torneos.length === 0) return;
    let cancelled = false;
    const fetchTorneoStats = async () => {
      const results = await Promise.all(
        torneos.map(async (t) => {
          try {
            const [eqRes, partRes] = await Promise.all([
              fetch(`${apiBaseUrl}/api/torneos/${t.id}/equipos`),
              fetch(`${apiBaseUrl}/api/torneos/${t.id}/partidos`),
            ]);
            const equipos  = eqRes.ok  ? await eqRes.json()  : [];
            const partidos = partRes.ok ? await partRes.json() : [];
            const jugados  = partidos.filter(p => p.estado === 'finalizado').length;
            // winner: equipo with highest puntos_ranking (finalizado) or puntos_totales (en_curso)
            const sorted = [...equipos].sort((a, b) =>
              t.estado === 'finalizado'
                ? (b.puntos_ranking || 0) - (a.puntos_ranking || 0)
                : (b.puntos_totales || 0) - (a.puntos_totales || 0)
            );
            return { id: t.id, equipos_count: equipos.length, partidos_jugados: jugados, total_partidos: partidos.length, winner: sorted[0] || null };
          } catch {
            return { id: t.id, equipos_count: 0, partidos_jugados: 0, total_partidos: 0, winner: null };
          }
        })
      );
      if (!cancelled) {
        const map = {};
        results.forEach(r => { map[r.id] = r; });
        setTorneoStats(map);
      }
    };
    fetchTorneoStats();
    return () => { cancelled = true; };
  }, [activeTab, torneos.length, apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirEditTorneo = (torneo) => {
    setEditandoTorneoId(torneo.id);
    setEditTorneoForm({
      nombre:       torneo.nombre       || '',
      nivel_torneo: torneo.nivel_torneo || '',
      tipo_torneo:  torneo.tipo_torneo  || '',
      fecha_inicio: torneo.fecha_inicio || '',
      fecha_fin:    torneo.fecha_fin    || '',
      sede_id:      torneo.sede_id      != null ? String(torneo.sede_id) : '',
    });
  };

  const guardarTorneo = async (torneoId) => {
    setSavingTorneo(true);
    try {
      const body = {
        ...editTorneoForm,
        sede_id: editTorneoForm.sede_id ? parseInt(editTorneoForm.sede_id) : null,
      };
      const res = await fetch(`${apiBaseUrl}/api/torneos/${torneoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setTorneos(prev => prev.map(t => t.id === torneoId ? { ...t, ...body } : t));
        setEditandoTorneoId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert('Error al guardar: ' + (data.error || res.statusText));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSavingTorneo(false);
    }
  };

  const fetchData = async () => {
    try {
      // Cargar sedes primero para poder resolver moneda por sede
      let sedesData = [];
      try {
        const sedesRes = await fetch(`${apiBaseUrl}/api/sedes`);
        if (sedesRes.ok) {
          sedesData = await sedesRes.json() || [];

          // Filter sedes by role scope
          if (esAdminClub && sedeId) {
            sedesData = sedesData.filter(s => s.id === sedeId);
          }
          // admin_nacional: filter by pais (stored in user_role_data)
          const roleData = (() => { try { return JSON.parse(localStorage.getItem('user_role_data') || '{}'); } catch { return {}; } })();
          if (esAdminNacional && roleData.pais) {
            sedesData = sedesData.filter(s => s.pais && s.pais.includes(roleData.pais.replace(/^[\p{Emoji_Presentation}\s]*/u, '').trim()));
          }

          const map = {};
          sedesData.forEach(s => { map[s.id] = s; });
          setSedesMap(map);
        }
      } catch { /* sedes opcionales */ }

      // nombre de sede → moneda (ej: "Padbol Vienna" → "EUR")
      const sedeMonedaMap = {};
      sedesData.forEach(s => {
        if (s.nombre && s.moneda) sedeMonedaMap[s.nombre.trim().toLowerCase()] = s.moneda;
      });

      // Set of allowed sede IDs for non-super-admin filtering
      const allowedSedeIds = new Set(sedesData.map(s => s.id));

      // Cargar reservas
      const resRes = await fetch(`${apiBaseUrl}/api/reservas`);
      let resData = await resRes.json();

      // Filter reservas by allowed sedes (for admin_nacional and admin_club)
      if (!isSuperAdmin && sedesData.length > 0) {
        resData = resData.filter(r => r.sede_id == null || allowedSedeIds.has(r.sede_id));
      }
      setReservas(resData);

      const totales = { ARS: 0, USD: 0, EUR: 0 };
      resData.forEach(item => {
        // Priority: reserva.moneda → sede's moneda → ARS
        const moneda =
          item.moneda ||
          (item.sede ? sedeMonedaMap[item.sede.trim().toLowerCase()] : null) ||
          'ARS';
        if (moneda in totales) totales[moneda] += item.precio || 0;
        else totales.ARS += item.precio || 0;
      });
      setIngresos(totales);

      // Cargar torneos (filter by sede scope for non-super-admin)
      const tornRes = await fetch(`${apiBaseUrl}/api/torneos`);
      let tornData = await tornRes.json();
      if (!isSuperAdmin && sedesData.length > 0) {
        tornData = tornData.filter(t => t.sede_id == null || allowedSedeIds.has(t.sede_id));
      }
      setTorneos(tornData);

      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setLoading(false);
    }
  };

  const iniciarEdicion = (reserva) => {
    setEditandoId(reserva.id);
    setEditFormData({ ...reserva, estado: reserva.estado || 'reservada' });
    setMensajeExito('');
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditFormData({});
  };

  const guardarEdicion = async (reservaId) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        setMensajeExito('✅ Reserva actualizada');
        setEditandoId(null);
        setTimeout(() => {
          fetchData();
          setMensajeExito('');
        }, 1500);
      } else {
        alert('Error al actualizar');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const cancelarReserva = async (reservaId) => {
    if (!window.confirm('¿Cancelar esta reserva?')) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMensajeExito('✅ Reserva cancelada');
        setTimeout(() => {
          fetchData();
          setMensajeExito('');
        }, 1500);
      } else {
        alert('Error al cancelar');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ── Mi Sede (admin_club + admin_nacional only) ──
  const puedeVerMiSede = (esAdminClub || esAdminNacional || isSuperAdmin) && sedeId;
  const [miSede,        setMiSede]        = useState(null);
  const [miSedeLoading, setMiSedeLoading] = useState(false);
  const [miSedeForm,    setMiSedeForm]    = useState({});
  const [miSedeSaving,  setMiSedeSaving]  = useState(false);
  const [miSedeMsg,     setMiSedeMsg]     = useState('');
  const [canchas,       setCanchas]       = useState([]);
  const [nuevaCancha,   setNuevaCancha]   = useState('');
  const [licenciaForm,  setLicenciaForm]  = useState({ numero_licencia: '', fecha_licencia: '', licencia_activa: true });
  const [licenciaSaving,setLicenciaSaving]= useState(false);
  const [licenciaMsg,   setLicenciaMsg]   = useState('');
  const [sedeStatus,     setSedeStatus]     = useState(null);
  const [logoUrl,        setLogoUrl]        = useState('');
  const [logoUploading,  setLogoUploading]  = useState(false);
  const [logoMsg,        setLogoMsg]        = useState('');
  const [fotosUrls,      setFotosUrls]      = useState([]);
  const [fotosUploading, setFotosUploading] = useState(false);
  const [fotosMsg,       setFotosMsg]       = useState('');

  useEffect(() => {
    if (activeTab !== 'mi_sede' || !sedeId) return;
    setMiSedeLoading(true);
    Promise.all([
      supabase.from('sedes').select('*').eq('id', sedeId).maybeSingle(),
      supabase.from('canchas').select('*').eq('sede_id', sedeId).order('nombre'),
    ]).then(([{ data: sedeData }, { data: canchasData }]) => {
      if (sedeData) {
        setMiSede(sedeData);
        setMiSedeForm({
          nombre:           sedeData.nombre          || '',
          direccion:        sedeData.direccion        || '',
          ciudad:           sedeData.ciudad           || '',
          pais:             sedeData.pais             || '',
          telefono:         sedeData.telefono         || '',
          email_contacto:   sedeData.email_contacto  || '',
          horario_apertura: sedeData.horario_apertura || '',
          horario_cierre:   sedeData.horario_cierre   || '',
          precio_turno:     sedeData.precio_turno     ?? '',
          precio_manana:    sedeData.precio_manana    ?? '',
          precio_tarde:     sedeData.precio_tarde     ?? '',
          moneda:           sedeData.moneda           || 'ARS',
          descripcion:      sedeData.descripcion      || '',
          mp_access_token:  sedeData.mp_access_token  || '',
          latitud:          sedeData.latitud  != null ? String(sedeData.latitud)  : '',
          longitud:         sedeData.longitud != null ? String(sedeData.longitud) : '',
          instagram:        sedeData.instagram  || '',
          facebook:         sedeData.facebook   || '',
          tiktok:           sedeData.tiktok     || '',
          twitter:          sedeData.twitter    || '',
          youtube:          sedeData.youtube    || '',
          website:          sedeData.website    || '',
        });
        setLicenciaForm({
          numero_licencia: sedeData.numero_licencia || '',
          fecha_licencia:  sedeData.fecha_licencia  || '',
          licencia_activa: sedeData.licencia_activa ?? true,
        });
        setLogoUrl(sedeData.logo_url || '');
        setFotosUrls(Array.isArray(sedeData.fotos_urls) ? sedeData.fotos_urls : []);
      }
      setCanchas(canchasData || []);
      setMiSedeLoading(false);
    }).catch(() => setMiSedeLoading(false));
  }, [activeTab, sedeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sedeId || !esAdminClub) return;
    supabase.from('sedes')
      .select('numero_licencia, licencia_activa')
      .eq('id', sedeId)
      .maybeSingle()
      .then(({ data }) => { if (data) setSedeStatus(data); });
  }, [sedeId, esAdminClub]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarMiSede = async () => {
    setMiSedeSaving(true); setMiSedeMsg('');
    const { error } = await supabase.from('sedes').update({
      nombre:           miSedeForm.nombre,
      direccion:        miSedeForm.direccion        || null,
      ciudad:           miSedeForm.ciudad           || null,
      pais:             miSedeForm.pais             || null,
      telefono:         miSedeForm.telefono         || null,
      email_contacto:   miSedeForm.email_contacto  || null,
      horario_apertura: miSedeForm.horario_apertura || null,
      horario_cierre:   miSedeForm.horario_cierre   || null,
      precio_turno:     miSedeForm.precio_turno  !== '' ? parseFloat(miSedeForm.precio_turno)  : null,
      precio_manana:    miSedeForm.precio_manana  !== '' ? parseFloat(miSedeForm.precio_manana) : null,
      precio_tarde:     miSedeForm.precio_tarde   !== '' ? parseFloat(miSedeForm.precio_tarde)  : null,
      moneda:           miSedeForm.moneda           || 'ARS',
      descripcion:      miSedeForm.descripcion      || null,
      mp_access_token:  miSedeForm.mp_access_token  || null,
      latitud:          miSedeForm.latitud  !== '' ? parseFloat(miSedeForm.latitud)  : null,
      longitud:         miSedeForm.longitud !== '' ? parseFloat(miSedeForm.longitud) : null,
      instagram:        miSedeForm.instagram  || null,
      facebook:         miSedeForm.facebook   || null,
      tiktok:           miSedeForm.tiktok     || null,
      twitter:          miSedeForm.twitter    || null,
      youtube:          miSedeForm.youtube    || null,
      website:          miSedeForm.website    || null,
    }).eq('id', sedeId);
    setMiSedeSaving(false);
    setMiSedeMsg(error ? `⚠️ ${error.message}` : '✅ Sede actualizada');
    setTimeout(() => setMiSedeMsg(''), 3000);
  };

  const guardarLicencia = async () => {
    setLicenciaSaving(true); setLicenciaMsg('');
    const { error } = await supabase.from('sedes').update({
      numero_licencia: licenciaForm.numero_licencia || null,
      fecha_licencia:  licenciaForm.fecha_licencia  || null,
      licencia_activa: licenciaForm.licencia_activa,
    }).eq('id', sedeId);
    setLicenciaSaving(false);
    setLicenciaMsg(error ? `⚠️ ${error.message}` : '✅ Licencia actualizada');
    setTimeout(() => setLicenciaMsg(''), 3000);
  };

  const subirLogo = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setLogoMsg('⚠️ El archivo supera los 2MB'); return; }
    setLogoUploading(true); setLogoMsg('');
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `${sedeId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('sedes').upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { setLogoMsg(`⚠️ ${uploadError.message}`); setLogoUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('sedes').getPublicUrl(path);
    await supabase.from('sedes').update({ logo_url: publicUrl }).eq('id', sedeId);
    setLogoUrl(`${publicUrl}?t=${Date.now()}`);
    setLogoUploading(false);
    setLogoMsg('✅ Logo actualizado');
    setTimeout(() => setLogoMsg(''), 3000);
  };

  const subirFoto = async (file) => {
    if (!file) return;
    if (fotosUrls.length >= 4) { setFotosMsg('⚠️ Máximo 4 fotos permitidas'); return; }
    if (file.size > 2 * 1024 * 1024) { setFotosMsg('⚠️ El archivo supera los 2MB'); return; }
    setFotosUploading(true); setFotosMsg('');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${sedeId}/fotos/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from('sedes').upload(path, file, { contentType: file.type });
    if (uploadError) { setFotosMsg(`⚠️ ${uploadError.message}`); setFotosUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('sedes').getPublicUrl(path);
    const newFotos = [...fotosUrls, publicUrl];
    await supabase.from('sedes').update({ fotos_urls: newFotos }).eq('id', sedeId);
    setFotosUrls(newFotos);
    setFotosUploading(false);
    setFotosMsg('✅ Foto agregada');
    setTimeout(() => setFotosMsg(''), 3000);
  };

  const eliminarFoto = async (url) => {
    const marker = '/public/sedes/';
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const storagePath = decodeURIComponent(url.substring(idx + marker.length).split('?')[0]);
      await supabase.storage.from('sedes').remove([storagePath]);
    }
    const newFotos = fotosUrls.filter(u => u !== url);
    await supabase.from('sedes').update({ fotos_urls: newFotos }).eq('id', sedeId);
    setFotosUrls(newFotos);
  };

  const agregarCancha = async () => {
    const nombre = nuevaCancha.trim();
    if (!nombre) return;
    const { data, error } = await supabase.from('canchas').insert({ sede_id: sedeId, nombre, estado: 'activa' }).select().single();
    if (!error && data) { setCanchas(prev => [...prev, data]); setNuevaCancha(''); }
    else if (error) alert('Error al agregar cancha: ' + error.message);
  };

  const toggleCanchaEstado = async (cancha) => {
    const nuevoEstado = cancha.estado === 'activa' ? 'inactiva' : 'activa';
    const { error } = await supabase.from('canchas').update({ estado: nuevoEstado }).eq('id', cancha.id);
    if (!error) setCanchas(prev => prev.map(c => c.id === cancha.id ? { ...c, estado: nuevoEstado } : c));
  };

  if (loading) {
    return (
      <div style={{ padding: `${HUB_CONTENT_PADDING_TOP_PX}px 20px ${HUB_CONTENT_PADDING_BOTTOM_PX}px`, textAlign: 'center', minHeight: '100vh', boxSizing: 'border-box' }}>
        <AppHeader title="Admin" />
        Cargando...
        <BottomNav />
      </div>
    );
  }

  const TABS = [
    { id: 'resumen',      label: '📊 Resumen' },
    { id: 'torneos',      label: '🏆 Torneos' },
    { id: 'reservas',     label: '📅 Reservas' },
    { id: 'validaciones', label: '⏳ Validaciones', badge: pendientes.length },
    ...(puedeVerMiSede  ? [{ id: 'mi_sede', label: '🏟️ Mi Sede' }] : []),
    ...(puedeVerConfig  ? [{ id: 'config',  label: '⚙️ Config' }]  : []),
  ];

  return (
    <div className="admin-dashboard" style={{ paddingTop: `${HUB_CONTENT_PADDING_TOP_PX}px`, paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px` }}>
      <AppHeader title="Admin" />
      <div className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0 }}>🏆 PADBOL MATCH - ADMIN</h1>
          {rol && ROLE_BADGE[rol] && (
            <span style={{
              padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700,
              background: rol === 'super_admin' ? 'rgba(250,204,21,0.25)' : rol === 'admin_nacional' ? 'rgba(52,211,153,0.2)' : 'rgba(147,197,253,0.2)',
              color: rol === 'super_admin' ? '#fde68a' : rol === 'admin_nacional' ? '#6ee7b7' : '#bfdbfe',
              border: `1px solid ${rol === 'super_admin' ? 'rgba(250,204,21,0.4)' : rol === 'admin_nacional' ? 'rgba(52,211,153,0.35)' : 'rgba(147,197,253,0.35)'}`,
              whiteSpace: 'nowrap',
            }}>
              {ROLE_BADGE[rol]}
            </span>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid rgba(255,255,255,0.3)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); sessionStorage.setItem('adminActiveTab', tab.id); }}
            style={{
              position: 'relative',
              padding: '10px 18px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid white' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              marginBottom: '-2px',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: '#d32f2f',
                color: 'white',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                fontSize: '11px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {mensajeExito && (
        <div style={{ background: '#4caf50', color: 'white', padding: '15px', borderRadius: '5px', marginBottom: '20px', textAlign: 'center' }}>
          {mensajeExito}
        </div>
      )}

      {activeTab === 'resumen' && <>
        {esAdminClub && sedeStatus && (() => {
          const { numero_licencia, licencia_activa } = sedeStatus;
          const badge = !numero_licencia
            ? { icon: '📋', text: 'Sin licencia asignada', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' }
            : licencia_activa
              ? { icon: '✅', text: 'Licencia PADBOL Activa', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
              : { icon: '⚠️', text: 'Licencia Suspendida',   bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
          return (
            <div style={{ marginBottom: '20px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                background: badge.bg, color: badge.color,
                border: `1px solid ${badge.border}`,
              }}>
                {badge.icon} {badge.text}
                {numero_licencia && (
                  <span style={{ fontFamily: 'monospace', fontWeight: 400, opacity: 0.75, marginLeft: '4px' }}>
                    · {numero_licencia}
                  </span>
                )}
              </span>
            </div>
          );
        })()}
        <div className="dashboard-grid">
        <div className="card ingresos">
          <h2>Ingresos Totales</h2>
          <div className="ingresos-por-moneda">
            <div className="ingreso-fila">
              <span className="ingreso-codigo">ARS</span>
              <span className="ingreso-valor">$ {ingresos.ARS.toLocaleString('es-AR')}</span>
            </div>
            <div className="ingreso-fila">
              <span className="ingreso-codigo">USD</span>
              <span className="ingreso-valor">US$ {ingresos.USD.toLocaleString('en-US')}</span>
            </div>
            <div className="ingreso-fila">
              <span className="ingreso-codigo">EUR</span>
              <span className="ingreso-valor">€ {ingresos.EUR.toLocaleString('de-DE')}</span>
            </div>
          </div>
        </div>
        <div className="card reservas">
          <h2>Total Reservas</h2>
          <p className="count">{reservas.length}</p>
        </div>
        <div className="card torneos">
          <h2>Total Torneos</h2>
          <p className="count">{torneos.length}</p>
        </div>
      </div>
      </>}

      {activeTab === 'torneos' && <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>📋 Torneos Creados</h2>
          <button
            onClick={() => navigate('/torneo/crear')}
            style={{ padding: '8px 16px', background: '#e53935', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            + Nuevo Torneo
          </button>
        </div>
        {torneos.length === 0 ? (
          <p style={{ color: '#999' }}>Sin torneos</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {torneos.map(torneo => {
              const sede = sedesMap[torneo.sede_id];
              const flag = sedeFlag(sede);
              const NIVEL_COLOR = {
                nacional:        { bg: '#f3f4f6', color: '#374151' },
                club_no_oficial: { bg: '#f5f3ff', color: '#6d28d9' },
                club_oficial:    { bg: '#ede9fe', color: '#5b21b6' },
                internacional:   { bg: '#dbeafe', color: '#1e40af' },
                mundial:         { bg: '#fef3c7', color: '#92400e' },
              };
              const FORMATO_COLOR = {
                round_robin:     { bg: '#ede9fe', color: '#5b21b6' },
                knockout:        { bg: '#fee2e2', color: '#991b1b' },
                grupos_knockout: { bg: '#e0e7ff', color: '#3730a3' },
              };
              const nivelColor   = NIVEL_COLOR[torneo.nivel_torneo]  || { bg: '#f3f4f6', color: '#374151' };
              const formatoColor = FORMATO_COLOR[torneo.tipo_torneo]  || { bg: '#f3f4f6', color: '#374151' };
              const estadoBadge  = {
                planificacion: { bg: '#e5e7eb', color: '#374151', label: 'Planificación' },
                en_curso:      { bg: '#dbeafe', color: '#1d4ed8', label: 'En curso'      },
                finalizado:    { bg: '#fef3c7', color: '#92400e', label: 'Finalizado'    },
              }[torneo.estado] || { bg: '#e5e7eb', color: '#374151', label: torneo.estado };
              // Shared badge style — fixed 120px, centered
              const badge = (bg, col) => ({
                background: bg, color: col,
                borderRadius: '10px', padding: '3px 0',
                fontSize: '11px', fontWeight: '600',
                width: '120px', display: 'block',
                textAlign: 'center',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              });

              const isEditingThis = editandoTorneoId === torneo.id;
              const inp = { padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };

              return (
                <div key={torneo.id} style={{
                  background: 'white',
                  border: isEditingThis ? '2px solid #667eea' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px 16px',
                }}>
                  {isEditingThis ? (
                    /* ── Inline edit form ── */
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Nombre</label>
                          <input style={inp} value={editTorneoForm.nombre} onChange={e => setEditTorneoForm(p => ({ ...p, nombre: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Sede</label>
                          <select style={inp} value={editTorneoForm.sede_id} onChange={e => setEditTorneoForm(p => ({ ...p, sede_id: e.target.value }))}>
                            <option value="">— Sin sede —</option>
                            {Object.values(sedesMap).map(s => (
                              <option key={s.id} value={String(s.id)}>{sedeFlag(s)} {s.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Nivel</label>
                          <input style={inp} value={editTorneoForm.nivel_torneo} onChange={e => setEditTorneoForm(p => ({ ...p, nivel_torneo: e.target.value }))} placeholder="Ej: Intermedio" />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Formato</label>
                          <select style={inp} value={editTorneoForm.tipo_torneo} onChange={e => setEditTorneoForm(p => ({ ...p, tipo_torneo: e.target.value }))}>
                            <option value="">— Seleccionar —</option>
                            <option value="round_robin">Round Robin</option>
                            <option value="knockout">Knockout</option>
                            <option value="grupos_knockout">Grupos + Knockout</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Fecha inicio</label>
                          <input type="date" style={inp} value={editTorneoForm.fecha_inicio} onChange={e => setEditTorneoForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Fecha fin</label>
                          <input type="date" style={inp} value={editTorneoForm.fecha_fin} onChange={e => setEditTorneoForm(p => ({ ...p, fecha_fin: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditandoTorneoId(null)}
                          style={{ padding: '6px 14px', background: 'transparent', color: '#666', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Cancelar
                        </button>
                        <button
                          disabled={savingTorneo}
                          onClick={() => guardarTorneo(torneo.id)}
                          style={{ padding: '6px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: savingTorneo ? 0.6 : 1 }}
                        >
                          {savingTorneo ? 'Guardando...' : '✅ Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Compact view: CSS grid keeps columns aligned across all cards ── */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 130px auto', gap: '0 12px', alignItems: 'center' }}>

                      {/* Col 1 — name, sede, status summary */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {flag && <span style={{ fontSize: '18px', flexShrink: 0 }}>{flag}</span>}
                          <strong style={{ fontSize: '14px', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{torneo.nombre}</strong>
                        </div>
                        {sede && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>{sede.nombre}</div>}
                        {(() => {
                          const st = torneoStats[torneo.id];
                          if (!st) return <div style={{ fontSize: '11px', color: '#ddd', marginTop: '3px' }}>···</div>;
                          if (torneo.estado === 'planificacion') return (
                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>
                              🔧 <strong>{st.equipos_count}</strong> equipo{st.equipos_count !== 1 ? 's' : ''} inscripto{st.equipos_count !== 1 ? 's' : ''}
                            </div>
                          );
                          if (torneo.estado === 'en_curso') return (
                            <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: '3px' }}>
                              ⚔️ <strong>{st.partidos_jugados}/{st.total_partidos}</strong> partidos
                            </div>
                          );
                          if (torneo.estado === 'finalizado') return (
                            <div style={{ fontSize: '11px', color: '#92400e', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🥇 <strong>{st.winner?.nombre || '—'}</strong>
                            </div>
                          );
                          return null;
                        })()}
                      </div>

                      {/* Col 2 — nivel */}
                      <div>
                        {torneo.nivel_torneo
                          ? <span style={badge(nivelColor.bg, nivelColor.color)}>{formatNivelTorneo(torneo.nivel_torneo)}</span>
                          : <span style={{ color: '#ddd', fontSize: '11px', display: 'block', width: '120px', textAlign: 'center' }}>—</span>}
                      </div>

                      {/* Col 3 — formato */}
                      <div>
                        {torneo.tipo_torneo
                          ? <span style={badge(formatoColor.bg, formatoColor.color)}>{formatTipoTorneo(torneo.tipo_torneo)}</span>
                          : <span style={{ color: '#ddd', fontSize: '11px', display: 'block', width: '120px', textAlign: 'center' }}>—</span>}
                      </div>

                      {/* Col 4 — estado */}
                      <div>
                        <span style={badge(estadoBadge.bg, estadoBadge.color)}>{estadoBadge.label}</span>
                      </div>

                      {/* Col 5 — dates (2 lines) */}
                      <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
                        {torneo.fecha_inicio
                          ? <>
                              <div style={{ color: '#374151' }}>{formatFecha(torneo.fecha_inicio)}</div>
                              {torneo.fecha_fin && <div style={{ color: '#aaa' }}>→ {formatFecha(torneo.fecha_fin)}</div>}
                            </>
                          : <div style={{ color: '#ddd' }}>—</div>}
                      </div>

                      {/* Col 6 — actions */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => navigate(`/torneo/${torneo.id}`)}
                          style={{ padding: '6px 14px', background: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                        >
                          Ver →
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => abrirEditTorneo(torneo)}
                            style={{ padding: '6px 10px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                            title="Editar torneo"
                          >
                            ✏️
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => eliminarTorneo(torneo.id, torneo.nombre)}
                            style={{ padding: '6px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                            title="Eliminar torneo"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {activeTab === 'validaciones' && <div className="section">
        <h2>⏳ Jugadores Pendientes de Validación</h2>
        {pendientesLoading ? (
          <p style={{ color: '#999' }}>Cargando...</p>
        ) : pendientes.length === 0 ? (
          <p style={{ color: '#999' }}>No hay jugadores pendientes de validación.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {pendientes.map(jugador => {
              const flag = (jugador.pais || '').split(' ')[0];
              const vs = validacionState[jugador.email] || {};
              return (
                <div key={jugador.email} style={{ background: 'white', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <strong style={{ fontSize: '15px' }}>{jugador.nombre}</strong>
                    <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>{jugador.email}</div>
                    <div style={{ marginTop: '5px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {flag && <span style={{ fontSize: '18px' }}>{flag}</span>}
                      <span style={{ background: '#fffde7', border: '1px solid #ffc107', color: '#7c5b00', borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: 'bold' }}>
                        {jugador.nivel}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <button
                      disabled={vs.saving}
                      onClick={() => aprobarJugador(jugador.email)}
                      style={{ padding: '7px 14px', background: '#43a047', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                    >
                      ✅ Aprobar
                    </button>
                    <button
                      disabled={vs.saving}
                      onClick={() => toggleCambiarCategoria(jugador.email, jugador.nivel)}
                      style={{ padding: '7px 14px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                    >
                      ✏️ Cambiar categoría
                    </button>

                    {vs.open && (
                      <>
                        <select
                          value={vs.categoria || jugador.nivel}
                          onChange={e => setValidacionState(prev => ({ ...prev, [jugador.email]: { ...prev[jugador.email], categoria: e.target.value } }))}
                          style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '13px' }}
                        >
                          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                          disabled={vs.saving}
                          onClick={() => guardarCategoria(jugador.email)}
                          style={{ padding: '7px 14px', background: '#7b1fa2', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                        >
                          {vs.saving ? 'Guardando...' : '💾 Guardar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {activeTab === 'reservas' && <div className="section">
        {(() => {
          // Upcoming ASC (soonest first), completed DESC (most recent first)
          const proximas    = reservas.filter(esFutura).sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1);
          const completadas = reservas.filter(r => !esFutura(r)).sort((a, b) => (a.fecha + a.hora) > (b.fecha + b.hora) ? -1 : 1);
          const allRows = [...proximas, ...completadas];

          if (allRows.length === 0) return <p style={{ color: '#aaa', padding: '10px 0' }}>Sin reservas registradas.</p>;

          // Build ordered day groups preserving insertion order
          const orderedDays = [];
          const dayMap = {};
          allRows.forEach(r => {
            const k = r.fecha || 'Sin fecha';
            if (!dayMap[k]) { dayMap[k] = []; orderedDays.push(k); }
            dayMap[k].push(r);
          });

          const shortDate = (str) => {
            if (!str || str === 'Sin fecha') return str;
            const [y, m, d] = str.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
            const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            return `${DIAS[date.getDay()]} ${d} ${MESES[m - 1]}`;
          };

          const BTN = (extra) => ({
            padding: '4px 10px', border: 'none', borderRadius: '3px',
            cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', color: 'white', ...extra,
          });

          return (
            <div className="reservas-table-wrap">
            <table className="reservas-table" style={{ tableLayout: 'fixed', width: '100%', minWidth: '988px', marginTop: 0 }}>
              <colgroup>
                <col style={{ width: '52px' }} /> {/* Date label */}
                <col style={{ width: '108px' }} />{/* Sede */}
                <col style={{ width: '112px' }} />{/* Horario */}
                <col style={{ width: '80px' }} /> {/* Cancha */}
                <col style={{ width: '116px' }} />{/* Nombre */}
                <col style={{ width: '200px' }} />{/* Email */}
                <col style={{ width: '88px' }} /> {/* Precio */}
                <col style={{ width: '102px' }} />{/* Estado */}
                <col style={{ width: '130px' }} />{/* Acciones */}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ padding: '10px 4px', fontSize: '10px', textAlign: 'center', color: '#888' }}></th>
                  <th>Sede</th>
                  <th>Horario</th>
                  <th style={{ textAlign: 'center' }}>Cancha</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orderedDays.map(dia => {
                  const rows = dayMap[dia];
                  const upcoming = esFutura(rows[0]);
                  const accentColor  = upcoming ? '#16a34a' : '#94a3b8';
                  const accentLight  = upcoming ? 'rgba(22,163,74,0.18)' : 'rgba(148,163,184,0.18)';
                  const dateBg       = upcoming ? '#f0fdf4' : 'rgba(148,163,184,0.08)';
                  const rowBg        = upcoming ? '#f0fdf4' : undefined;
                  const dateColor    = upcoming ? '#15803d' : '#64748b';
                  const dayTopBorder = `2px solid ${upcoming ? 'rgba(22,163,74,0.45)' : 'rgba(148,163,184,0.35)'}`;
                  return (
                    <React.Fragment key={dia}>
                      {rows.map((r, idx) => (
                        <tr key={r.id} style={rowBg ? { background: rowBg } : undefined}>
                          {/* Date cell: spans all rows for this day */}
                          {idx === 0 && (
                            <td rowSpan={rows.length} style={{
                              borderLeft: `4px solid ${accentColor}`,
                              borderRight: `2px solid ${accentLight}`,
                              borderTop: dayTopBorder,
                              borderBottom: `2px solid ${accentLight}`,
                              background: dateBg,
                              padding: '6px 2px',
                              verticalAlign: 'middle',
                              textAlign: 'center',
                            }}>
                              <span style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                writingMode: 'vertical-rl',
                                transform: 'rotate(180deg)',
                                fontSize: '11px',
                                fontWeight: '700',
                                color: dateColor,
                                letterSpacing: '0.04em',
                                whiteSpace: 'nowrap',
                                width: '100%',
                              }}>
                                {shortDate(dia)}
                              </span>
                            </td>
                          )}
                          {editandoId === r.id ? (
                            <>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}><input type="text" value={editFormData.sede || ''} onChange={e => setEditFormData({ ...editFormData, sede: e.target.value })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}>
                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                  <input type="time" value={editFormData.hora || ''} onChange={e => setEditFormData({ ...editFormData, hora: e.target.value })} style={{ padding: '4px', flex: 1, minWidth: 0 }} />
                                  <input type="number" placeholder="min" value={editFormData.duracion || ''} onChange={e => setEditFormData({ ...editFormData, duracion: e.target.value })} style={{ padding: '4px', width: '46px' }} title="Duración en minutos" />
                                </div>
                              </td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}><input type="number" value={editFormData.cancha || ''} onChange={e => setEditFormData({ ...editFormData, cancha: parseInt(e.target.value) })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}><input type="text" value={editFormData.nombre || ''} onChange={e => setEditFormData({ ...editFormData, nombre: e.target.value })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}><input type="email" value={editFormData.email || ''} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}><input type="number" value={editFormData.precio || ''} onChange={e => setEditFormData({ ...editFormData, precio: parseInt(e.target.value) })} style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }} /></td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}>
                                <select value={editFormData.estado || 'reservada'} onChange={e => setEditFormData({ ...editFormData, estado: e.target.value })} style={{ padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', width: '100%' }}>
                                  <option value="reservada">📋 Reservada</option>
                                  <option value="confirmada">🟢 Confirmada</option>
                                  <option value="completada">✅ Completada</option>
                                  <option value="cancelada">❌ Cancelada</option>
                                </select>
                              </td>
                              <td style={{ padding: '6px 8px', borderTop: idx === 0 ? dayTopBorder : undefined }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => guardarEdicion(r.id)} style={BTN({ background: '#4caf50' })}>✅ Guardar</button>
                                  <button onClick={cancelarEdicion} style={BTN({ background: '#999' })}>✕</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderTop: idx === 0 ? dayTopBorder : undefined }}>{r.sede}</td>
                              <td style={{ whiteSpace: 'nowrap', borderTop: idx === 0 ? dayTopBorder : undefined }}>{horaRango(r.hora, r.duracion)}</td>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap', borderTop: idx === 0 ? dayTopBorder : undefined }}>{r.cancha}</td>
                              <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderTop: idx === 0 ? dayTopBorder : undefined }}>{r.nombre}</td>
                              <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', borderTop: idx === 0 ? dayTopBorder : undefined }}>{r.email}</td>
                              <td style={{ whiteSpace: 'nowrap', borderTop: idx === 0 ? dayTopBorder : undefined }}>${(r.precio || 30000).toLocaleString('es-AR')}</td>
                              <td style={{ borderTop: idx === 0 ? dayTopBorder : undefined }}><EstadoBadge reserva={r} /></td>
                              <td style={{ borderTop: idx === 0 ? dayTopBorder : undefined }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => iniciarEdicion(r)} style={BTN({ background: '#667eea' })}>✏️ Editar</button>
                                  <button onClick={() => cancelarReserva(r.id)} style={BTN({ background: '#d32f2f' })}>🗑️</button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          );
        })()}
      </div>}

      {activeTab === 'config' && puedeVerConfig && <div className="section">
        <h2>⚙️ Configuración de Puntos</h2>

        {/* Niveles de torneo + tipos custom unificados */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '12px', fontSize: '16px' }}>
            Puntos base por nivel de torneo
          </h3>
          <table style={{ width: '100%', maxWidth: '560px', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            <thead>
              <tr style={{ background: '#3b2f6e', color: 'white' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left',   fontSize: '13px', fontWeight: 600 }}>Nivel</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, width: '130px' }}>Pts totales torneo</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, width: '90px' }}></th>
              </tr>
            </thead>
            <tbody>
              {/* Standard rows — editable names and deletable */}
              {STANDARD_KEYS.filter(key => !configNivelesHidden.has(key)).map((key, i) => (
                <tr key={key} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                  {editandoTipoId === key ? (
                    <>
                      <td style={{ padding: '7px 12px' }}>
                        <input type="text" value={editandoTipoData.nombre}
                          onChange={e => setEditandoTipoData(p => ({ ...p, nombre: e.target.value }))}
                          style={{ width: '100%', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', color: '#1e1b4b', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <input type="number" min="0" value={editandoTipoData.puntos}
                          onChange={e => setEditandoTipoData(p => ({ ...p, puntos: parseInt(e.target.value) || 0 }))}
                          style={{ width: '72px', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', textAlign: 'center', color: '#1e1b4b' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <button onClick={() => {
                          setConfigNivelesLabels(prev => ({ ...prev, [key]: editandoTipoData.nombre }));
                          setConfigNiveles(prev => ({ ...prev, [key]: editandoTipoData.puntos }));
                          setEditandoTipoId(null);
                        }} style={{ padding: '3px 8px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✅</button>
                        <button onClick={() => setEditandoTipoId(null)}
                          style={{ padding: '3px 8px', background: '#999', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '10px 16px', fontSize: '14px', color: '#333' }}>{configNivelesLabels[key]}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <input type="number" min="0" value={configNiveles[key] ?? 0}
                          onChange={e => setConfigNiveles(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                          style={{ width: '80px', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold', color: '#3b2f6e' }} />
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>pts totales</div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button onClick={() => { setEditandoTipoId(key); setEditandoTipoData({ nombre: configNivelesLabels[key], puntos: configNiveles[key] ?? 0 }); }}
                          style={{ padding: '3px 8px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✏️</button>
                        <button onClick={() => { if (window.confirm(`¿Eliminar el nivel "${configNivelesLabels[key]}"? Se ocultará de los torneos nuevos.`)) setConfigNivelesHidden(prev => new Set([...prev, key])); }}
                          style={{ padding: '3px 8px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {/* Custom rows — with edit/delete */}
              {configTiposCustom.length > 0 && (
                <tr>
                  <td colSpan="3" style={{ padding: '6px 16px 2px', fontSize: '11px', fontWeight: '600', color: '#7c3aed', background: '#f5f3ff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Tipos personalizados
                  </td>
                </tr>
              )}
              {configTiposCustom.map((tipo, i) => (
                <tr key={tipo.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fdf8ff' : 'white' }}>
                  {editandoTipoId === tipo.id ? (
                    <>
                      <td style={{ padding: '7px 12px' }}>
                        <input type="text" value={editandoTipoData.nombre}
                          onChange={e => setEditandoTipoData(p => ({ ...p, nombre: e.target.value }))}
                          style={{ width: '100%', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', color: '#1e1b4b', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <input type="number" min="0" value={editandoTipoData.puntos}
                          onChange={e => setEditandoTipoData(p => ({ ...p, puntos: parseInt(e.target.value) || 0 }))}
                          style={{ width: '72px', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', textAlign: 'center', color: '#1e1b4b' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <button onClick={() => { setConfigTiposCustom(prev => prev.map(t => t.id === tipo.id ? { ...t, ...editandoTipoData } : t)); setEditandoTipoId(null); }}
                          style={{ padding: '3px 8px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✅</button>
                        <button onClick={() => setEditandoTipoId(null)}
                          style={{ padding: '3px 8px', background: '#999', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '10px 16px', fontSize: '14px', color: '#333' }}>{tipo.nombre}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#3b2f6e' }}>{tipo.puntos}</div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>pts totales</div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button onClick={() => { setEditandoTipoId(tipo.id); setEditandoTipoData({ nombre: tipo.nombre, puntos: tipo.puntos }); }}
                          style={{ padding: '3px 8px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✏️</button>
                        <button onClick={() => setConfigTiposCustom(prev => prev.filter(t => t.id !== tipo.id))}
                          style={{ padding: '3px 8px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {/* Add row */}
              <tr style={{ background: '#f9f7ff', borderTop: '2px dashed #e9d5ff' }}>
                <td style={{ padding: '8px 12px' }}>
                  <input type="text" placeholder="Ej: FIPA Qualifier" value={nuevoTipo.nombre}
                    onChange={e => setNuevoTipo(p => ({ ...p, nombre: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && nuevoTipo.nombre.trim()) { setConfigTiposCustom(prev => [...prev, { id: Date.now().toString(), nombre: nuevoTipo.nombre.trim(), puntos: nuevoTipo.puntos || 0 }]); setNuevoTipo({ nombre: '', puntos: 0 }); } }}
                    style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #c4b5fd', borderRadius: '5px', fontSize: '13px', color: '#1e1b4b', background: 'white', boxSizing: 'border-box' }} />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input type="number" placeholder="Pts" min="0" value={nuevoTipo.puntos || ''}
                    onChange={e => setNuevoTipo(p => ({ ...p, puntos: parseInt(e.target.value) || 0 }))}
                    style={{ width: '72px', padding: '6px 8px', border: '1.5px solid #c4b5fd', borderRadius: '5px', fontSize: '13px', color: '#1e1b4b', textAlign: 'center', background: 'white' }} />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <button
                    onClick={() => { if (!nuevoTipo.nombre.trim()) return; setConfigTiposCustom(prev => [...prev, { id: Date.now().toString(), nombre: nuevoTipo.nombre.trim(), puntos: nuevoTipo.puntos || 0 }]); setNuevoTipo({ nombre: '', puntos: 0 }); }}
                    style={{ padding: '5px 12px', background: 'linear-gradient(135deg, #7c3aed, #4c1d95)', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    + Agregar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Distribución por posición */}
        {(() => {
          const todosNiveles = STANDARD_KEYS
            .filter(key => !configNivelesHidden.has(key))
            .map(key => ({ value: key, label: configNivelesLabels[key] || key, pts: configNiveles[key] ?? 0 }))
            .concat(configTiposCustom.map(t => ({ value: t.id, label: t.nombre, pts: t.puntos })));
          const totalPts = todosNiveles.find(n => n.value === previewNivel)?.pts
            ?? todosNiveles[0]?.pts ?? 0;
          const pctSum = [1,2,3,4,5,6,7,8,9,10].reduce((acc, pos) => acc + (configPosiciones[pos] ?? 0), 0);
          const pctDiff = pctSum - 100;
          return (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '12px', fontSize: '16px' }}>
                Distribución de puntos por posición
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Previsualizar con:
                </label>
                <select value={previewNivel} onChange={e => setPreviewNivel(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: '600', color: '#3b2f6e', background: 'white', cursor: 'pointer' }}>
                  {todosNiveles.map(n => (
                    <option key={n.value} value={n.value}>{n.label} ({n.pts} pts totales)</option>
                  ))}
                </select>
              </div>
              <table style={{ width: '100%', maxWidth: '520px', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                <thead>
                  <tr style={{ background: '#3b2f6e', color: 'white' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left',   fontSize: '13px', fontWeight: 600 }}>Posición</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, width: '110px' }}>% del total</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, width: '100px', whiteSpace: 'nowrap' }}>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4,5,6,7,8,9,10].map((pos, i) => {
                    const pct = configPosiciones[pos] ?? 0;
                    const pts = Math.round((pct / 100) * totalPts);
                    return (
                      <tr key={pos} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                        <td style={{ padding: '10px 16px', fontSize: '14px', color: '#333' }}>
                          {pos === 1 ? '🥇 1ro' : pos === 2 ? '🥈 2do' : pos === 3 ? '🥉 3ro' : `${pos}°`}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <input type="number" min="0" max="100" value={pct}
                              onChange={e => setConfigPosiciones(prev => ({ ...prev, [pos]: parseInt(e.target.value) || 0 }))}
                              style={{ width: '70px', padding: '5px 24px 5px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', textAlign: 'right', fontWeight: 'bold', color: '#3b2f6e' }} />
                            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#999', pointerEvents: 'none' }}>%</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', width: '100px', verticalAlign: 'middle', fontSize: '15px', fontWeight: 'bold', color: pts > 0 ? '#3b2f6e' : '#ccc', whiteSpace: 'nowrap' }}>
                          {pts > 0 ? pts : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Percentage sum indicator */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                marginTop: '10px', padding: '7px 14px', borderRadius: '8px',
                background: pctDiff === 0 ? 'rgba(22,163,74,0.15)' : pctDiff > 0 ? 'rgba(220,38,38,0.12)' : 'rgba(234,88,12,0.12)',
                border: `1.5px solid ${pctDiff === 0 ? '#16a34a' : pctDiff > 0 ? '#dc2626' : '#ea580c'}`,
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: pctDiff === 0 ? '#16a34a' : pctDiff > 0 ? '#dc2626' : '#ea580c' }}>
                  Total: {pctSum}%
                </span>
                <span style={{ fontSize: '12px', color: pctDiff === 0 ? '#16a34a' : pctDiff > 0 ? '#dc2626' : '#ea580c' }}>
                  {pctDiff === 0 ? '✓ Distribución completa' : pctDiff > 0 ? `⚠ Excede por ${pctDiff}%` : `Faltan ${-pctDiff}%`}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
          <button
            onClick={guardarConfig}
            disabled={configSaving}
            style={{
              padding: '12px 28px',
              background: configSaving ? '#a78bfa' : 'linear-gradient(135deg, #7c3aed, #4c1d95)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: configSaving ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '15px',
              boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
              opacity: configSaving ? 0.8 : 1,
            }}
          >
            {configSaving ? '⏳ Guardando...' : '💾 Guardar configuración'}
          </button>
          {configMsg && (
            <span style={{ fontSize: '14px', fontWeight: '600', color: configMsg.startsWith('✅') ? '#86efac' : '#fde68a' }}>
              {configMsg}
            </span>
          )}
        </div>

      </div>}

      {/* ── Mi Sede tab ── */}
      {activeTab === 'mi_sede' && puedeVerMiSede && <div className="section">
        <h2>🏟️ Mi Sede</h2>

        {miSedeLoading ? (
          <p style={{ color: '#999' }}>Cargando datos de la sede...</p>
        ) : !miSede ? (
          <p style={{ color: '#f87171' }}>No se encontró información de la sede.</p>
        ) : (<>

          {/* ── 0. Licencia PADBOL ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>🔐 Licencia PADBOL</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px' }}>
              {isSuperAdmin ? (
                /* Editable for super_admin */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Número de licencia</label>
                    <input
                      type="text"
                      value={licenciaForm.numero_licencia}
                      placeholder="Ej: FIPA-ARG-001"
                      onChange={e => setLicenciaForm(p => ({ ...p, numero_licencia: e.target.value }))}
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Fecha de otorgamiento</label>
                    <input
                      type="date"
                      value={licenciaForm.fecha_licencia}
                      onChange={e => setLicenciaForm(p => ({ ...p, fecha_licencia: e.target.value }))}
                      style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Estado</label>
                    <select
                      value={licenciaForm.licencia_activa ? 'activa' : 'suspendida'}
                      onChange={e => setLicenciaForm(p => ({ ...p, licencia_activa: e.target.value === 'activa' }))}
                      style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
                    >
                      <option value="activa">✅ Activa</option>
                      <option value="suspendida">❌ Suspendida</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={guardarLicencia} disabled={licenciaSaving}
                      style={{ padding: '10px 24px', background: licenciaSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: licenciaSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                      {licenciaSaving ? '⏳ Guardando...' : '💾 Guardar licencia'}
                    </button>
                    {licenciaMsg && <span style={{ fontSize: '13px', fontWeight: 600, color: licenciaMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{licenciaMsg}</span>}
                  </div>
                </>
              ) : (
                /* Read-only for admin_club / admin_nacional */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Número de licencia</span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e1b4b', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                      {licenciaForm.numero_licencia || <span style={{ color: '#aaa', fontFamily: 'inherit', fontWeight: 400 }}>—</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Fecha de otorgamiento</span>
                    <span style={{ fontSize: '14px', color: '#333' }}>
                      {licenciaForm.fecha_licencia
                        ? new Date(licenciaForm.fecha_licencia + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : <span style={{ color: '#aaa' }}>—</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Estado</span>
                    <span style={{
                      padding: '4px 14px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                      background: licenciaForm.licencia_activa ? '#dcfce7' : '#fee2e2',
                      color:      licenciaForm.licencia_activa ? '#16a34a' : '#dc2626',
                    }}>
                      {licenciaForm.licencia_activa ? '✅ Activa' : '❌ Suspendida'}
                    </span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    🔒 Solo un Super Admin puede modificar estos datos.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── 1. Info General ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>Información General</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px' }}>
              {[
                { label: 'Nombre del club',        field: 'nombre' },
                { label: 'Dirección',              field: 'direccion' },
                { label: 'Ciudad',                 field: 'ciudad' },
                { label: 'País',                   field: 'pais' },
                { label: 'WhatsApp del club',       field: 'telefono', placeholder: 'Ej: 2213032019', hint: 'Sin 0 adelante, sin 15' },
                { label: 'Email de contacto',      field: 'email_contacto' },
                { label: 'Horario apertura',       field: 'horario_apertura', placeholder: 'Ej: 08:00' },
                { label: 'Horario cierre',         field: 'horario_cierre',   placeholder: 'Ej: 23:00' },
                { label: 'Latitud',                field: 'latitud',          placeholder: 'Ej: -34.6037' },
                { label: 'Longitud',               field: 'longitud',         placeholder: 'Ej: -58.3816', hint: 'Puedes obtener las coordenadas desde Google Maps (clic derecho → "¿Qué hay aquí?")' },
              ].map(({ label, field, placeholder, hint }) => (
                <div key={field} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555', paddingTop: '8px' }}>{label}</label>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      value={miSedeForm[field] || ''}
                      placeholder={placeholder || ''}
                      onChange={e => setMiSedeForm(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333', boxSizing: 'border-box' }}
                    />
                    {hint && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#9ca3af' }}>{hint}</p>}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555', paddingTop: '8px' }}>Descripción del club</label>
                <div style={{ flex: 1 }}>
                  <textarea
                    rows={4}
                    maxLength={300}
                    value={miSedeForm.descripcion || ''}
                    placeholder="Ej: Primer club de PADBOL del mundo, donde todo comenzó..."
                    onChange={e => setMiSedeForm(p => ({ ...p, descripcion: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '12px', color: (miSedeForm.descripcion || '').length >= 280 ? '#dc2626' : '#9ca3af', marginTop: '3px' }}>
                    {(miSedeForm.descripcion || '').length}/300
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Moneda</label>
                <select value={miSedeForm.moneda || 'ARS'} onChange={e => setMiSedeForm(p => ({ ...p, moneda: e.target.value }))}
                  style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}>
                  <option value="ARS">ARS — Peso argentino</option>
                  <option value="USD">USD — Dólar estadounidense</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="BRL">BRL — Real brasileño</option>
                  <option value="CLP">CLP — Peso chileno</option>
                  <option value="UYU">UYU — Peso uruguayo</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={guardarMiSede} disabled={miSedeSaving}
                  style={{ padding: '10px 24px', background: miSedeSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  {miSedeSaving ? '⏳ Guardando...' : '💾 Guardar cambios'}
                </button>
                {miSedeMsg && <span style={{ fontSize: '13px', fontWeight: 600, color: miSedeMsg.startsWith('✅') ? '#4ade80' : '#fca5a5' }}>{miSedeMsg}</span>}
              </div>
            </div>
          </div>

          {/* ── 2. Precios ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>Precios</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '400px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label style={{ flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Precio por turno (90 min)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>{miSedeForm.moneda || 'ARS'}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={miSedeForm.precio_turno !== '' && miSedeForm.precio_turno !== null
                      ? Number(miSedeForm.precio_turno).toLocaleString('es-AR')
                      : ''}
                    onChange={e => {
                      const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                      setMiSedeForm(p => ({ ...p, precio_turno: digits }));
                    }}
                    style={{ width: '120px', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', textAlign: 'right' }}
                  />
                </div>
              </div>
              <p style={{ margin: '4px 0 18px', fontSize: '12px', color: '#9ca3af', lineHeight: 1.5 }}>
                Precio base aplicado cuando no hay tarifas diferenciadas.
              </p>

              {[
                { field: 'precio_manana', label: '🌅 Mañana (08–16hs)' },
                { field: 'precio_tarde',  label: '🌆 Tarde/noche (16–23hs)' },
              ].map(({ field, label }) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <label style={{ flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555', width: '190px' }}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>{miSedeForm.moneda || 'ARS'}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={miSedeForm[field] !== '' && miSedeForm[field] !== null
                        ? Number(miSedeForm[field]).toLocaleString('es-AR')
                        : ''}
                      onChange={e => {
                        const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                        setMiSedeForm(p => ({ ...p, [field]: digits }));
                      }}
                      placeholder="Ej: 5000"
                      style={{ width: '120px', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', textAlign: 'right' }}
                    />
                  </div>
                </div>
              ))}
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#9ca3af', lineHeight: 1.5 }}>
                Si se configuran ambas tarifas, el precio cambia automáticamente según el horario del turno.
              </p>

              <button onClick={guardarMiSede} disabled={miSedeSaving}
                style={{ padding: '8px 20px', background: miSedeSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                {miSedeSaving ? '⏳ Guardando...' : '💾 Guardar precios'}
              </button>
            </div>
          </div>

          {/* ── 3. Mercado Pago ── */}
          {(esAdminClub || isSuperAdmin) && (
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>💳 Mercado Pago</h3>
              <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '480px' }}>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#555', lineHeight: 1.5 }}>
                  Ingresa el Access Token de tu cuenta de Mercado Pago para recibir los pagos directamente en tu cuenta.
                </p>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>
                  Access Token de MP
                </label>
                <input
                  type="password"
                  value={miSedeForm.mp_access_token || ''}
                  placeholder="APP_USR-..."
                  onChange={e => setMiSedeForm(p => ({ ...p, mp_access_token: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', color: '#333', boxSizing: 'border-box', fontFamily: 'monospace', marginBottom: '14px' }}
                />
                <button onClick={guardarMiSede} disabled={miSedeSaving}
                  style={{ padding: '8px 20px', background: miSedeSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  {miSedeSaving ? '⏳ Guardando...' : '💾 Guardar token'}
                </button>
              </div>
            </div>
          )}

          {/* ── 4. Redes Sociales ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>📱 Redes Sociales</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '480px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#555', lineHeight: 1.5 }}>
                Ingresa las URLs completas (incluye https://). Solo se muestran las redes que tengas cargadas.
              </p>
              {[
                { field: 'instagram', label: '📸 Instagram', placeholder: 'https://instagram.com/tusede' },
                { field: 'facebook',  label: '👍 Facebook',  placeholder: 'https://facebook.com/tusede' },
                { field: 'tiktok',    label: '🎵 TikTok',    placeholder: 'https://tiktok.com/@tusede' },
                { field: 'twitter',   label: '✖ Twitter / X', placeholder: 'https://x.com/tusede' },
                { field: 'youtube',   label: '▶ YouTube',   placeholder: 'https://youtube.com/@tusede' },
                { field: 'website',   label: '🌐 Sitio web', placeholder: 'https://tusede.com' },
              ].map(({ field, label, placeholder }) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <label style={{ width: '150px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>{label}</label>
                  <input
                    type="url"
                    value={miSedeForm[field] || ''}
                    placeholder={placeholder}
                    onChange={e => setMiSedeForm(p => ({ ...p, [field]: e.target.value }))}
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', color: '#333', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button onClick={guardarMiSede} disabled={miSedeSaving}
                style={{ marginTop: '8px', padding: '8px 20px', background: miSedeSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                {miSedeSaving ? '⏳ Guardando...' : '💾 Guardar redes'}
              </button>
            </div>
          </div>

          {/* ── 5. Canchas ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>Canchas</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '480px' }}>
              {canchas.length === 0 ? (
                <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>No hay canchas registradas para esta sede.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#555' }}>Cancha</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#555', width: '110px' }}>Estado</th>
                      <th style={{ padding: '8px 12px', width: '90px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {canchas.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 12px', fontSize: '14px', color: '#333' }}>{c.nombre}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                            background: c.estado === 'activa' ? '#dcfce7' : '#fee2e2',
                            color:      c.estado === 'activa' ? '#16a34a' : '#dc2626',
                          }}>
                            {c.estado === 'activa' ? '✓ Activa' : '✗ Inactiva'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button onClick={() => toggleCanchaEstado(c)}
                            style={{ padding: '4px 10px', background: c.estado === 'activa' ? '#fee2e2' : '#dcfce7', color: c.estado === 'activa' ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                            {c.estado === 'activa' ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Add court */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="text" placeholder="Ej: Cancha 3" value={nuevaCancha}
                  onChange={e => setNuevaCancha(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') agregarCancha(); }}
                  style={{ flex: 1, padding: '7px 10px', border: '1.5px solid #a5b4fc', borderRadius: '6px', fontSize: '13px', color: '#333' }} />
                <button onClick={agregarCancha}
                  style={{ padding: '7px 16px', background: 'linear-gradient(135deg, #4f46e5, #3730a3)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' }}>
                  + Agregar
                </button>
              </div>
            </div>
          </div>

        </>)}

        {/* ── 4. Fotos ── always visible when tab is active */}
        {!miSedeLoading && <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>📸 Fotos</h3>

          {/* Logo */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: '#1e1b4b' }}>Logo del club</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo del club"
                  style={{ width: '100px', height: '100px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#f9fafb' }}
                />
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '10px', border: '2px dashed #d1d5db', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '28px' }}>🏟️</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Sin logo</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                  display: 'inline-block', padding: '9px 18px',
                  background: logoUploading ? '#e5e7eb' : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                  color: logoUploading ? '#9ca3af' : 'white',
                  borderRadius: '8px', cursor: logoUploading ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '13px',
                }}>
                  {logoUploading ? '⏳ Subiendo...' : '📤 Subir logo'}
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    disabled={logoUploading}
                    onChange={e => subirLogo(e.target.files[0])}
                  />
                </label>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>JPG, PNG o WEBP · máx. 2MB</span>
                <span style={{ fontSize: '11px', color: '#c4b5fd', lineHeight: 1.4 }}>💡 Recomendado: PNG transparente, mín. 300×300 px</span>
                {logoMsg && <span style={{ fontSize: '13px', fontWeight: 600, color: logoMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{logoMsg}</span>}
              </div>
            </div>
          </div>

          {/* Fotos de canchas */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e1b4b' }}>
                Fotos de las canchas
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#9ca3af', marginLeft: '8px' }}>({fotosUrls.length}/4)</span>
              </p>
              {fotosUrls.length < 4 && (
                <label style={{
                  display: 'inline-block', padding: '7px 16px',
                  background: fotosUploading ? '#e5e7eb' : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                  color: fotosUploading ? '#9ca3af' : 'white',
                  borderRadius: '8px', cursor: fotosUploading ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '13px',
                }}>
                  {fotosUploading ? '⏳ Subiendo...' : '+ Agregar foto'}
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    disabled={fotosUploading}
                    onChange={e => subirFoto(e.target.files[0])}
                  />
                </label>
              )}
            </div>
            {fotosUrls.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>No hay fotos cargadas aún.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {fotosUrls.map((url, i) => (
                  <div key={url} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/3', background: '#f1f5f9' }}>
                    <img
                      src={url}
                      alt={`Cancha ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <button
                      onClick={() => eliminarFoto(url)}
                      style={{
                        position: 'absolute', top: '6px', right: '6px',
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: 'rgba(220,38,38,0.85)', color: 'white',
                        border: 'none', cursor: 'pointer', fontSize: '14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1,
                      }}
                      title="Eliminar foto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {fotosMsg && <p style={{ margin: '12px 0 0', fontSize: '13px', fontWeight: 600, color: fotosMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{fotosMsg}</p>}
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#9ca3af' }}>JPG, PNG o WEBP · máx. 2MB por foto</p>
          </div>
        </div>}

      </div>}

      <BottomNav />
    </div>
  );
}