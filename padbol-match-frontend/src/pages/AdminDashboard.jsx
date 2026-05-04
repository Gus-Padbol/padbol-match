import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { setAdminNavContext, clearAdminNavContext } from '../utils/adminNavContext';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import './AdminDashboard.css';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import { CATEGORIA_TORNEO_DEFAULT, TORNEO_CATEGORIA_OPTIONS } from '../constants/torneoCategoria';
import { badgeTorneoEstadoPublico } from '../utils/torneoEstadoPublico';
import { formatNivelTorneo, formatTipoTorneo, formatCategoriaTorneo } from '../utils/torneoFormatters';
import { precioInscripcionTorneo } from '../utils/torneoInscripcionPago';
import { getCroppedImgBlob } from '../utils/cropImage';

const CATEGORIAS = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

const MAX_FOTOS_SEDE = 20;

function newFranjaId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fj-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeFranjasHorarias(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((f) => ({
    id: String(f?.id || '').trim() || newFranjaId(),
    nombre: String(f?.nombre ?? '').trim(),
    hora_inicio: String(f?.hora_inicio ?? '').trim().slice(0, 5),
    hora_fin: String(f?.hora_fin ?? '').trim().slice(0, 5),
    precio:
      f?.precio === '' || f?.precio == null
        ? ''
        : String(f.precio).replace(/\./g, '').replace(/[^\d]/g, ''),
  }));
}

function franjasHorariasToDbPayload(rows) {
  return rows.map((r) => {
    const digits = String(r.precio ?? '').replace(/\./g, '').replace(/[^\d]/g, '');
    const precio = digits === '' ? 0 : parseInt(digits, 10);
    return {
      id: String(r.id || '').trim() || newFranjaId(),
      nombre: String(r.nombre || '').trim(),
      hora_inicio: String(r.hora_inicio || '').trim().slice(0, 5),
      hora_fin: String(r.hora_fin || '').trim().slice(0, 5),
      precio: Number.isFinite(precio) ? precio : 0,
    };
  });
}

function normalizeHexSedeAdmin(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

const ADMIN_TABS_ALLOWED = new Set(['resumen', 'torneos', 'reservas', 'validaciones', 'mi_sede', 'config', 'sedes_pendientes']);

/** Igual que `ADMIN_EMAILS` en App.js: emails con alcance global (torneos/reservas sin filtrar por sede). */
const ADMIN_EMAILS_LEGACY_SUPER = [
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
  'juanpablo@padbol.com',
];

function sanitizeAdminActiveTab(raw) {
  const t = String(raw || '').trim();
  return ADMIN_TABS_ALLOWED.has(t) ? t : 'resumen';
}

function hexToRgbSedeHero(hex) {
  const h = normalizeHexSedeAdmin(hex);
  if (!h || h.length < 7) return { r: 76, g: 29, b: 149 };
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

function luminanciaRelativaSedeHero(hex) {
  const { r, g, b } = hexToRgbSedeHero(hex);
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function textoAutoDesdePrimarioSedeHero(hexPrim) {
  return luminanciaRelativaSedeHero(hexPrim) < 0.5 ? '#ffffff' : '#0f172a';
}

/** Muestra "3ra" en lugar de "3" en validaciones y fichas. */
function formatNivelValidacionDisplay(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const map = { '1': '1ra', '2': '2da', '3': '3ra', '4': '4ta', '5': '5ta' };
  if (map[s]) return map[s];
  return s;
}

function bucketMonedaAdmin(raw) {
  const u = String(raw || '').trim().toUpperCase();
  if (u.includes('EUR') || u === '€') return 'EUR';
  if (u.includes('USD') || u.includes('US$') || u === 'U$S' || u === '$US') return 'USD';
  return 'ARS';
}

/** `fechaISO` = YYYY-MM-DD (reserva o fecha derivada de equipo). */
function fechaDentroDePeriodoDashboard(fechaISO, now, periodo, fechaDesde, fechaHasta) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaISO || '').trim())) return false;
  const [y, m, d] = fechaISO.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  if (Number.isNaN(fecha.getTime())) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  const day = startOfWeek.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  if (periodo === 'rango') {
    const desdeOk = /^\d{4}-\d{2}-\d{2}$/.test(fechaDesde);
    const hastaOk = /^\d{4}-\d{2}-\d{2}$/.test(fechaHasta);
    if (!desdeOk || !hastaOk) return false;
    const [dy, dm, dd] = fechaDesde.split('-').map(Number);
    const [hy, hm, hd] = fechaHasta.split('-').map(Number);
    const desde = new Date(dy, dm - 1, dd);
    const hasta = new Date(hy, hm - 1, hd, 23, 59, 59, 999);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return false;
    return fecha >= desde && fecha <= hasta;
  }
  if (periodo === 'hoy') return fecha >= startOfToday && fecha <= now;
  if (periodo === 'semana') return fecha >= startOfWeek && fecha <= now;
  if (periodo === 'anio') return fecha >= startOfYear && fecha <= now;
  return fecha >= startOfMonth && fecha <= now;
}

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

/** Misma sede aunque una API devuelva `sede_id` numérico y otra string (p. ej. 1 vs "1"). */
function mismoIdSede(a, b) {
  if (a == null || b == null || b === '') return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a).trim() === String(b).trim();
}

/** Reservas / torneos con `sede_id` o nombre de sede acotados al alcance del admin (evita filas sin sede_id). */
function filaDentroDelAlcanceSedes(row, sedesData) {
  if (!sedesData.length) return false;
  const nombreSet = new Set(
    sedesData.map((s) => String(s.nombre || '').trim().toLowerCase()).filter(Boolean)
  );
  const sid = row.sede_id;
  if (sid != null && sid !== '') {
    return sedesData.some((s) => mismoIdSede(s.id, sid));
  }
  const sn = String(row.sede_nombre || row.sede || '')
    .trim()
    .toLowerCase();
  if (!sn) return false;
  return nombreSet.has(sn);
}

export default function AdminDashboard({ apiBaseUrl = 'https://padbol-backend.onrender.com', rol = null, sedeId = null }) {
  console.log('AdminDashboard montado', { rol, sedeId });
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const currentEmail = (session?.user?.email || '').trim().toLowerCase();

  // Legacy email-based flags (kept for backward compatibility while roles roll out)
  const isSuperAdmin =
    rol === 'super_admin' || ADMIN_EMAILS_LEGACY_SUPER.includes(currentEmail);
  const isAdmin = isSuperAdmin || rol === 'admin_nacional' || rol === 'admin_club' ||
    ['admin@padbol.com', 'sm@padbol.com', 'juanpablo@padbol.com'].includes(currentEmail);

  // Role-based access flags
  const esAdminNacional = rol === 'admin_nacional';
  const esAdminClub     = rol === 'admin_club';
  const puedeVerConfig  = isSuperAdmin;
  const puedeVerSedesPendientes = isSuperAdmin;
  const puedeCrearTorneosOficiales = isSuperAdmin || (!esAdminClub);

  const ROLE_BADGE = {
    super_admin:    '👑 Super Admin',
    admin_nacional: '🌎 Admin Nacional',
    admin_club:     '🏠 Admin Club',
  };

  const [reservas, setReservas] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [sedesMap, setSedesMap] = useState({});
  /** Equipos de torneos en alcance (para ingresos por inscripción confirmada). */
  const [equiposInscripcionRows, setEquiposInscripcionRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [mensajeExito, setMensajeExito] = useState('');
  const [activeTab, setActiveTab] = useState(() => sanitizeAdminActiveTab(searchParams.get('tab')));

  const [pendientes, setPendientes] = useState([]);
  const [pendientesLoading, setPendientesLoading] = useState(true);
  // keyed by player email: { open: bool, categoria: string, saving: bool }
  const [validacionState, setValidacionState] = useState({});
  // keyed by sede name for super-admin reservas detail expand/collapse
  const [superAdminReservasOpen, setSuperAdminReservasOpen] = useState({});
  const [superAdminPeriodo, setSuperAdminPeriodo] = useState('hoy'); // hoy | semana | mes | anio | rango
  const [superAdminFechaDesde, setSuperAdminFechaDesde] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [superAdminFechaHasta, setSuperAdminFechaHasta] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const [sedesPendientes, setSedesPendientes] = useState([]);
  const [sedesPendientesLoading, setSedesPendientesLoading] = useState(false);

  const cargarSedesPendientes = useCallback(async () => {
    if (!puedeVerSedesPendientes) return;
    setSedesPendientesLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Sin sesión');
      const res = await fetch(`${apiBaseUrl}/api/admin/sedes-pendientes?estado=pendiente`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => []);
      if (!res.ok) throw new Error(j.error || res.statusText);
      setSedesPendientes(Array.isArray(j) ? j : []);
    } catch (e) {
      console.error('[AdminDashboard] sedes pendientes:', e);
      setSedesPendientes([]);
    } finally {
      setSedesPendientesLoading(false);
    }
  }, [apiBaseUrl, puedeVerSedesPendientes]);

  const aprobarSedePendiente = useCallback(
    async (id) => {
      if (!window.confirm('¿Aprobar esta sede? Se creará en el sistema y el rol admin_club para el licenciatario.')) return;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error('Sin sesión');
        const res = await fetch(`${apiBaseUrl}/api/admin/sedes-pendientes/${id}/aprobar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || res.statusText);
        setMensajeExito('✅ Sede aprobada');
        void cargarSedesPendientes();
        void fetchData();
        setTimeout(() => setMensajeExito(''), 4000);
      } catch (e) {
        alert(e.message || String(e));
      }
    },
    [apiBaseUrl, cargarSedesPendientes]
  );

  const rechazarSedePendiente = useCallback(
    async (id) => {
      const motivo = window.prompt('Motivo del rechazo (obligatorio):');
      if (motivo == null) return;
      const m = String(motivo).trim();
      if (!m) {
        alert('El motivo es obligatorio.');
        return;
      }
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error('Sin sesión');
        const res = await fetch(`${apiBaseUrl}/api/admin/sedes-pendientes/${id}/rechazar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo: m }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || res.statusText);
        setMensajeExito('Solicitud rechazada.');
        void cargarSedesPendientes();
        setTimeout(() => setMensajeExito(''), 4000);
      } catch (e) {
        alert(e.message || String(e));
      }
    },
    [apiBaseUrl, cargarSedesPendientes]
  );

  useEffect(() => {
    if (activeTab === 'sedes_pendientes' && puedeVerSedesPendientes) {
      void cargarSedesPendientes();
    }
  }, [activeTab, puedeVerSedesPendientes, cargarSedesPendientes]);

  useEffect(() => {
    console.log('[AdminDashboard] fetchData triggered — rol:', rol, 'sedeId:', sedeId);
    fetchData();
    fetchPendientes();
  }, [apiBaseUrl, rol, sedeId, session?.access_token]); // token: alcance correcto en GET torneos/reservas

  useEffect(() => {
    if (esAdminClub) setAdminNavContext(true);
  }, [esAdminClub]);

  useEffect(() => {
    const raw = searchParams.get('tab');
    if (raw == null || String(raw).trim() === '') {
      setActiveTab('resumen');
      return;
    }
    const t = sanitizeAdminActiveTab(raw);
    setActiveTab((prev) => {
      if (prev === t) return prev;
      sessionStorage.setItem('adminActiveTab', t);
      return t;
    });
  }, [searchParams]);

  const cifrasFinanzasResumen = useMemo(() => {
    const now = new Date();
    const inP = (iso) =>
      fechaDentroDePeriodoDashboard(
        iso,
        now,
        superAdminPeriodo,
        superAdminFechaDesde,
        superAdminFechaHasta
      );

    const reservasFiltradas = reservas.filter((r) => inP(String(r?.fecha || '').trim()));

    const fechaInscripcionEquipo = (eq) => {
      const u = eq?.updated_at || eq?.created_at;
      if (!u) return '';
      return String(u).slice(0, 10);
    };
    const equiposInsFiltrados = equiposInscripcionRows.filter(
      (eq) =>
        String(eq?.inscripcion_estado || '').toLowerCase() === 'confirmado' &&
        inP(fechaInscripcionEquipo(eq))
    );

    const torneoById = {};
    torneos.forEach((t) => {
      torneoById[t.id] = t;
    });

    if (isSuperAdmin) {
      const acum = {
        reservas: { ARS: 0, USD: 0, EUR: 0 },
        inscripciones: { ARS: 0, USD: 0, EUR: 0 },
      };
      reservasFiltradas.forEach((r) => {
        const sn = String(r?.sede || '').trim().toLowerCase();
        const sedeRow = Object.values(sedesMap || {}).find(
          (s) => sn && String(s?.nombre || '').trim().toLowerCase() === sn
        );
        const mon = bucketMonedaAdmin(sedeRow?.moneda || r?.moneda || 'ARS');
        acum.reservas[mon] = (acum.reservas[mon] || 0) + (Number(r?.precio) || 0);
      });
      equiposInsFiltrados.forEach((eq) => {
        const t = torneoById[eq.torneo_id];
        const mon = bucketMonedaAdmin(t?.moneda || 'ARS');
        acum.inscripciones[mon] = (acum.inscripciones[mon] || 0) + precioInscripcionTorneo(t);
      });
      const total = { ARS: 0, USD: 0, EUR: 0 };
      ['ARS', 'USD', 'EUR'].forEach((k) => {
        total[k] = (acum.reservas[k] || 0) + (acum.inscripciones[k] || 0);
      });
      return {
        tipo: 'super',
        porFuente: acum,
        total,
        reservasEnPeriodo: reservasFiltradas.length,
      };
    }

    const monedaSede =
      esAdminClub && sedeId != null && sedeId !== ''
        ? bucketMonedaAdmin(sedesMap[String(sedeId)]?.moneda || 'ARS')
        : 'ARS';

    let reservasSum = 0;
    reservasFiltradas.forEach((r) => {
      reservasSum += Number(r?.precio) || 0;
    });
    let insSum = 0;
    equiposInsFiltrados.forEach((eq) => {
      insSum += precioInscripcionTorneo(torneoById[eq.torneo_id]);
    });
    return {
      tipo: 'sede',
      moneda: monedaSede,
      reservas: reservasSum,
      inscripciones: insSum,
      total: reservasSum + insSum,
      reservasEnPeriodo: reservasFiltradas.length,
    };
  }, [
    reservas,
    equiposInscripcionRows,
    torneos,
    superAdminPeriodo,
    superAdminFechaDesde,
    superAdminFechaHasta,
    isSuperAdmin,
    currentEmail,
    esAdminClub,
    sedeId,
    sedesMap,
  ]);

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
      categoria:    torneo.categoria    || CATEGORIA_TORNEO_DEFAULT,
      tipo_torneo:  torneo.tipo_torneo  || '',
      fecha_inicio: torneo.fecha_inicio || '',
      fecha_fin:    torneo.fecha_fin    || '',
      sede_id:      torneo.sede_id      != null ? String(torneo.sede_id) : '',
    });
  };

  const guardarTorneo = async (torneoId) => {
    if (!String(editTorneoForm.categoria || '').trim()) {
      alert('Seleccioná la categoría del torneo');
      return;
    }
    setSavingTorneo(true);
    try {
      const body = {
        ...editTorneoForm,
        sede_id: editTorneoForm.sede_id ? parseInt(editTorneoForm.sede_id) : null,
        categoria: String(editTorneoForm.categoria || '').trim() || CATEGORIA_TORNEO_DEFAULT,
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
      console.log('ADMIN fetchData:', {
        isSuperAdmin,
        rol,
        email: currentEmail,
        sedeId,
      });
      const listAuthHeaders = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      let allSedesRows = [];
      try {
        const { data: sedesRows, error: sedesErr } = await supabase
          .from('sedes')
          .select('id, nombre, ciudad, pais, moneda');
        if (!sedesErr) {
          allSedesRows = sedesRows || [];
          if (isSuperAdmin) {
            console.log('[Admin] sedes para super admin', allSedesRows);
          } else {
            console.log('[Admin] sedes cargadas', allSedesRows);
          }
        }
      } catch { /* sedes opcionales */ }

      /** Sedes del alcance del rol (para filtrar reservas/torneos). Super: todas. */
      let sedesAlcance = [];
      if (isSuperAdmin) {
        sedesAlcance = allSedesRows;
      } else if (esAdminClub && sedeId != null && sedeId !== '') {
        sedesAlcance = allSedesRows.filter((s) => mismoIdSede(s.id, sedeId));
      } else if (esAdminNacional) {
        const roleData = (() => {
          try {
            return JSON.parse(localStorage.getItem('user_role_data') || '{}');
          } catch {
            return {};
          }
        })();
        const paisAdmin = roleData.pais
          ? String(roleData.pais).replace(/^[\p{Emoji_Presentation}\s]*/u, '').trim()
          : '';
        if (paisAdmin) {
          sedesAlcance = allSedesRows.filter(
            (s) => s.pais && String(s.pais).includes(paisAdmin)
          );
        } else {
          sedesAlcance = [];
        }
      } else {
        sedesAlcance = [];
      }

      /** Mapa de sedes: super ve todas las sedes (nombres en torneos de cualquier sede); el resto solo su alcance. */
      const sedesParaMapa = isSuperAdmin ? allSedesRows : sedesAlcance;
      const nextSedesMap = {};
      sedesParaMapa.forEach((s) => {
        nextSedesMap[s.id] = s;
      });
      setSedesMap(nextSedesMap);
      console.log('[Admin] sedesMap', nextSedesMap);

      const resRes = await fetch(`${apiBaseUrl}/api/reservas`, { headers: { ...listAuthHeaders } });
      let resData = await resRes.json();

      if (!isSuperAdmin) {
        if (sedesAlcance.length === 0) resData = [];
        else resData = resData.filter((r) => filaDentroDelAlcanceSedes(r, sedesAlcance));
      }
      setReservas(resData);

      const tornRes = await fetch(`${apiBaseUrl}/api/torneos`, { headers: { ...listAuthHeaders } });
      const tornResOk = tornRes.ok;
      const tornResStatus = tornRes.status;
      let tornData = [];
      let tornParseError = null;
      try {
        const parsed = await tornRes.json();
        if (Array.isArray(parsed)) {
          tornData = parsed;
        } else {
          tornParseError = { invalidPayload: parsed };
        }
      } catch (e) {
        tornParseError = { message: e?.message || String(e) };
      }
      if (!isSuperAdmin) {
        if (sedesAlcance.length === 0) tornData = [];
        else tornData = tornData.filter((t) => filaDentroDelAlcanceSedes(t, sedesAlcance));
      }
      if (isSuperAdmin && (!tornData || tornData.length === 0)) {
        const error =
          tornParseError ||
          (!tornResOk ? { status: tornResStatus, statusText: tornRes.statusText } : null);
        console.log('fetchData torneos:', { isSuperAdmin, torneos: tornData, error });
      }
      setTorneos(tornData);

      let eqIns = [];
      if (tornData.length > 0) {
        const tids = tornData.map((t) => t.id).filter((id) => Number.isFinite(Number(id)));
        if (tids.length > 0) {
          const { data: eqd, error: eqErr } = await supabase
            .from('equipos')
            .select('torneo_id, inscripcion_estado, updated_at, created_at')
            .in('torneo_id', tids);
          if (!eqErr && Array.isArray(eqd)) eqIns = eqd;
        }
      }
      setEquiposInscripcionRows(eqIns);

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
  const [logoCropOpen, setLogoCropOpen] = useState(false);
  const [logoCropSrc, setLogoCropSrc] = useState(null);
  const [logoCrop, setLogoCrop] = useState({ x: 0, y: 0 });
  const [logoCropZoom, setLogoCropZoom] = useState(1);
  const [logoCropAreaListo, setLogoCropAreaListo] = useState(false);
  const logoCropPixelsRef = useRef(null);
  const colorFondoLogoSaveTimerRef = useRef(null);
  const [fotosUrls,      setFotosUrls]      = useState([]);
  const [fotosUploading, setFotosUploading] = useState(false);
  const [fotosMsg,       setFotosMsg]       = useState('');
  const [fotosUploadLabel, setFotosUploadLabel] = useState('');
  const [franjasHorarias, setFranjasHorarias] = useState([]);
  const [franjasSaving, setFranjasSaving] = useState(false);
  const [franjasMsg, setFranjasMsg] = useState('');
  const [fotosDestacadas, setFotosDestacadas] = useState([]);
  const [fotosDestacadasSaving, setFotosDestacadasSaving] = useState(false);
  const [fotosDestacadasMsg, setFotosDestacadasMsg] = useState('');

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
          color_fondo_logo: normalizeHexSedeAdmin(sedeData.color_fondo_logo) || '#000000',
          color_hero_primario: normalizeHexSedeAdmin(sedeData.color_hero_primario) || '#4C1D95',
          color_hero_secundario: normalizeHexSedeAdmin(sedeData.color_hero_secundario) || '#7C3AED',
          color_borde_hero: normalizeHexSedeAdmin(sedeData.color_borde_hero) || '#6D28D9',
        });
        setLicenciaForm({
          numero_licencia: sedeData.numero_licencia || '',
          fecha_licencia:  sedeData.fecha_licencia  || '',
          licencia_activa: sedeData.licencia_activa ?? true,
        });
        setLogoUrl(sedeData.logo_url || '');
        const todasFotos = Array.isArray(sedeData.fotos_urls)
          ? sedeData.fotos_urls.map((u) => String(u || '').trim()).filter(Boolean)
          : [];
        setFotosUrls(todasFotos);
        const destRaw = Array.isArray(sedeData.fotos_destacadas) ? sedeData.fotos_destacadas : [];
        setFotosDestacadas(
          destRaw
            .map((u) => String(u || '').trim())
            .filter((u) => todasFotos.includes(u))
            .slice(0, 4)
        );
        setFranjasHorarias(normalizeFranjasHorarias(sedeData.franjas_horarias));
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

  const schedulePersistColorFondoLogo = useCallback(
    (hex) => {
      if (!sedeId) return;
      if (colorFondoLogoSaveTimerRef.current) window.clearTimeout(colorFondoLogoSaveTimerRef.current);
      colorFondoLogoSaveTimerRef.current = window.setTimeout(async () => {
        colorFondoLogoSaveTimerRef.current = null;
        const v = normalizeHexSedeAdmin(hex) || '#000000';
        const { error } = await supabase.from('sedes').update({ color_fondo_logo: v }).eq('id', sedeId);
        if (!error) {
          setMiSede((prev) => (prev ? { ...prev, color_fondo_logo: v } : prev));
          setLogoMsg('✅ Color del logo guardado');
          window.setTimeout(() => setLogoMsg(''), 2500);
        } else {
          setLogoMsg(`⚠️ ${error.message}`);
        }
      }, 400);
    },
    [sedeId]
  );

  const guardarMiSede = async () => {
    setMiSedeSaving(true); setMiSedeMsg('');
    const prev = miSede;
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
      color_fondo_logo: normalizeHexSedeAdmin(miSedeForm.color_fondo_logo) || '#000000',
      color_hero_primario: normalizeHexSedeAdmin(miSedeForm.color_hero_primario) || '#4C1D95',
      color_hero_secundario: normalizeHexSedeAdmin(miSedeForm.color_hero_secundario) || '#7C3AED',
      color_borde_hero: normalizeHexSedeAdmin(miSedeForm.color_borde_hero) || '#6D28D9',
    }).eq('id', sedeId);
    setMiSedeSaving(false);
    setMiSedeMsg(error ? `⚠️ ${error.message}` : '✅ Sede actualizada');
    setTimeout(() => setMiSedeMsg(''), 3000);
    if (!error && prev) {
      const secret = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_PADBOL_SEDE_CRITICO_NOTIFY_SECRET : '';
      const pushCambio = (campo, a, b) => {
        const sa = a == null || a === '' ? '' : String(a);
        const sb = b == null || b === '' ? '' : String(b);
        if (sa !== sb) return { campo, anterior: sa || '—', nuevo: sb || '—' };
        return null;
      };
      const cambios = [
        pushCambio('nombre', prev.nombre, miSedeForm.nombre),
        pushCambio('dirección / ubicación', prev.direccion, miSedeForm.direccion),
        pushCambio(
          'latitud',
          prev.latitud != null && prev.latitud !== '' ? String(prev.latitud) : '',
          miSedeForm.latitud !== '' && Number.isFinite(parseFloat(miSedeForm.latitud)) ? String(parseFloat(miSedeForm.latitud)) : ''
        ),
        pushCambio(
          'longitud',
          prev.longitud != null && prev.longitud !== '' ? String(prev.longitud) : '',
          miSedeForm.longitud !== '' && Number.isFinite(parseFloat(miSedeForm.longitud)) ? String(parseFloat(miSedeForm.longitud)) : ''
        ),
        pushCambio('email de contacto / admin', prev.email_contacto, miSedeForm.email_contacto),
      ].filter(Boolean);
      if (secret && cambios.length) {
        const sedeNombre = String(miSedeForm.nombre || prev.nombre || '').trim() || '(sede)';
        void fetch(`${apiBaseUrl}/api/notify/sede-cambio-critico`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret,
            sedeNombre,
            actorEmail: currentEmail,
            cambios,
          }),
        }).catch(() => {});
      }
      setMiSede((p) =>
        p
          ? {
              ...p,
              nombre: miSedeForm.nombre,
              direccion: miSedeForm.direccion || null,
              email_contacto: miSedeForm.email_contacto || null,
              latitud: miSedeForm.latitud !== '' ? parseFloat(miSedeForm.latitud) : null,
              longitud: miSedeForm.longitud !== '' ? parseFloat(miSedeForm.longitud) : null,
              color_hero_primario: normalizeHexSedeAdmin(miSedeForm.color_hero_primario) || '#4C1D95',
              color_hero_secundario: normalizeHexSedeAdmin(miSedeForm.color_hero_secundario) || '#7C3AED',
              color_borde_hero: normalizeHexSedeAdmin(miSedeForm.color_borde_hero) || '#6D28D9',
            }
          : p
      );
    }
  };

  const guardarLicencia = async () => {
    setLicenciaSaving(true); setLicenciaMsg('');
    const prev = miSede;
    const { error } = await supabase.from('sedes').update({
      numero_licencia: licenciaForm.numero_licencia || null,
      fecha_licencia:  licenciaForm.fecha_licencia  || null,
      licencia_activa: licenciaForm.licencia_activa,
    }).eq('id', sedeId);
    setLicenciaSaving(false);
    setLicenciaMsg(error ? `⚠️ ${error.message}` : '✅ Licencia actualizada');
    setTimeout(() => setLicenciaMsg(''), 3000);
    if (!error && prev) {
      const secret = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_PADBOL_SEDE_CRITICO_NOTIFY_SECRET : '';
      const cambios = [];
      const sa = (v) => (v == null || v === '' ? '' : String(v));
      const sbBool = (v) => (v ? 'activa' : 'suspendida');
      if (sa(prev.numero_licencia) !== sa(licenciaForm.numero_licencia)) {
        cambios.push({ campo: 'número de licencia', anterior: sa(prev.numero_licencia) || '—', nuevo: sa(licenciaForm.numero_licencia) || '—' });
      }
      if (sa(prev.fecha_licencia) !== sa(licenciaForm.fecha_licencia)) {
        cambios.push({ campo: 'fecha de licencia', anterior: sa(prev.fecha_licencia) || '—', nuevo: sa(licenciaForm.fecha_licencia) || '—' });
      }
      if (Boolean(prev.licencia_activa) !== Boolean(licenciaForm.licencia_activa)) {
        cambios.push({
          campo: 'estado de licencia',
          anterior: sbBool(Boolean(prev.licencia_activa)),
          nuevo: sbBool(Boolean(licenciaForm.licencia_activa)),
        });
      }
      if (secret && cambios.length) {
        const sedeNombre = String(miSedeForm.nombre || prev.nombre || '').trim() || '(sede)';
        void fetch(`${apiBaseUrl}/api/notify/sede-cambio-critico`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret,
            sedeNombre,
            actorEmail: currentEmail,
            cambios,
          }),
        }).catch(() => {});
      }
      setMiSede((p) =>
        p
          ? {
              ...p,
              numero_licencia: licenciaForm.numero_licencia || null,
              fecha_licencia: licenciaForm.fecha_licencia || null,
              licencia_activa: licenciaForm.licencia_activa,
            }
          : p
      );
    }
  };

  const cerrarModalLogoCrop = useCallback(() => {
    if (logoCropSrc) URL.revokeObjectURL(logoCropSrc);
    setLogoCropSrc(null);
    setLogoCropOpen(false);
    setLogoCrop({ x: 0, y: 0 });
    setLogoCropZoom(1);
    logoCropPixelsRef.current = null;
    setLogoCropAreaListo(false);
  }, [logoCropSrc]);

  const onLogoCropComplete = useCallback((_, areaPixels) => {
    logoCropPixelsRef.current = areaPixels;
    setLogoCropAreaListo(Boolean(areaPixels?.width));
  }, []);

  const abrirRecorteLogoDesdeFile = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoMsg('⚠️ El archivo supera los 2MB');
      return;
    }
    if (!String(file.type || '').startsWith('image/')) {
      setLogoMsg('⚠️ Elegí una imagen');
      return;
    }
    setLogoMsg('');
    const url = URL.createObjectURL(file);
    setLogoCropSrc(url);
    setLogoCrop({ x: 0, y: 0 });
    setLogoCropZoom(1);
    logoCropPixelsRef.current = null;
    setLogoCropAreaListo(false);
    setLogoCropOpen(true);
  };

  const subirLogoBlob = async (blob) => {
    if (!sedeId) return;
    setLogoUploading(true);
    setLogoMsg('');
    const path = `sedes/${sedeId}/logo.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (uploadError) {
      setLogoMsg(`⚠️ ${uploadError.message}`);
      setLogoUploading(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: dbErr } = await supabase.from('sedes').update({ logo_url: publicUrl }).eq('id', sedeId);
    if (dbErr) {
      setLogoMsg(`⚠️ ${dbErr.message}`);
      setLogoUploading(false);
      return;
    }
    setLogoUrl(`${publicUrl}?t=${Date.now()}`);
    setLogoUploading(false);
    setLogoMsg('✅ Logo actualizado');
    setTimeout(() => setLogoMsg(''), 3000);
  };

  const confirmarRecorteLogo = async () => {
    const src = logoCropSrc;
    const pixels = logoCropPixelsRef.current;
    if (!src || !pixels) return;
    setLogoUploading(true);
    setLogoMsg('');
    try {
      const blob = await getCroppedImgBlob(src, pixels, 'image/jpeg', 0.92);
      cerrarModalLogoCrop();
      await subirLogoBlob(blob);
    } catch (e) {
      setLogoMsg(`⚠️ ${e?.message || 'Error al recortar'}`);
    } finally {
      setLogoUploading(false);
    }
  };

  /**
   * Sube varias fotos. Recibe un `File[]` ya materializado (p. ej. desde onChange leyendo files antes de cualquier await).
   * Opcional `opts.uploadingPrimed`: si true, el caller ya puso Subiendo… y no se llama setFotosUploading(true) al inicio.
   */
  const subirFotosMultiples = async (fileList, opts = {}) => {
    const uploadingPrimed = Boolean(opts.uploadingPrimed);
    if (!sedeId) {
      if (uploadingPrimed) {
        setFotosUploading(false);
        setFotosUploadLabel('');
      }
      return;
    }
    const picked = (Array.isArray(fileList) ? fileList : Array.from(fileList || [])).filter((f) =>
      String(f.type || '').startsWith('image/')
    );
    if (!picked.length) {
      if (uploadingPrimed) {
        setFotosUploading(false);
        setFotosUploadLabel('');
      }
      return;
    }
    const espacio = MAX_FOTOS_SEDE - fotosUrls.length;
    if (espacio <= 0) {
      setFotosMsg(`⚠️ Máximo ${MAX_FOTOS_SEDE} fotos permitidas`);
      if (uploadingPrimed) {
        setFotosUploading(false);
        setFotosUploadLabel('');
      }
      return;
    }
    const toProcess = picked.slice(0, espacio);
    if (picked.length > espacio) {
      setFotosMsg(`Solo podés agregar ${espacio} ${espacio === 1 ? 'foto más' : 'fotos más'}.`);
    } else {
      setFotosMsg('');
    }
    if (!uploadingPrimed) {
      setFotosUploading(true);
      setFotosUploadLabel('Subiendo...');
    }
    const n = toProcess.length;
    let completed = 0;
    const failures = [];
    const urlsOk = [];

    const uploadOne = async (file, index) => {
      const name = file.name || `foto-${index}`;
      if (file.size > 2 * 1024 * 1024) {
        failures.push(`${name}: supera 2MB`);
        completed += 1;
        setFotosUploadLabel(`Subiendo ${completed} de ${n} fotos...`);
        return;
      }
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${sedeId}/fotos/${Date.now()}_${index}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('sedes')
        .upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (uploadError) {
        failures.push(`${name}: ${uploadError.message}`);
      } else {
        const {
          data: { publicUrl },
        } = supabase.storage.from('sedes').getPublicUrl(path);
        urlsOk.push({ index, url: publicUrl });
      }
      completed += 1;
      setFotosUploadLabel(`Subiendo ${completed} de ${n} fotos...`);
    };

    await Promise.all(toProcess.map((f, i) => uploadOne(f, i)));
    urlsOk.sort((a, b) => a.index - b.index);
    const merged = [...fotosUrls, ...urlsOk.map((x) => x.url)];
    if (urlsOk.length) {
      await supabase.from('sedes').update({ fotos_urls: merged }).eq('id', sedeId);
      setFotosUrls(merged);
    }
    setFotosUploading(false);
    setFotosUploadLabel('');
    if (failures.length && urlsOk.length) {
      setFotosMsg(`⚠️ Algunas no se subieron: ${failures.join(' · ')}`);
    } else if (failures.length) {
      setFotosMsg(`⚠️ ${failures.join(' · ')}`);
    } else if (urlsOk.length) {
      setFotosMsg(`✅ ${urlsOk.length === 1 ? '1 foto agregada' : `${urlsOk.length} fotos agregadas`}`);
    }
    if (failures.length || urlsOk.length) {
      setTimeout(() => setFotosMsg(''), 5000);
    }
  };

  const guardarFranjas = async () => {
    if (!sedeId) return;
    setFranjasSaving(true);
    setFranjasMsg('');
    const payload = franjasHorariasToDbPayload(franjasHorarias);
    const { error } = await supabase.from('sedes').update({ franjas_horarias: payload }).eq('id', sedeId);
    setFranjasSaving(false);
    if (error) {
      setFranjasMsg(`⚠️ ${error.message}`);
    } else {
      setFranjasMsg('✅ Franjas guardadas');
      setFranjasHorarias(normalizeFranjasHorarias(payload));
      setMiSede((prev) => (prev ? { ...prev, franjas_horarias: payload } : prev));
    }
    setTimeout(() => setFranjasMsg(''), 3000);
  };

  const guardarFotosDestacadas = async () => {
    if (!sedeId) return;
    setFotosDestacadasSaving(true);
    setFotosDestacadasMsg('');
    const arr = fotosDestacadas.filter((u) => fotosUrls.includes(u)).slice(0, 4);
    const { error } = await supabase.from('sedes').update({ fotos_destacadas: arr }).eq('id', sedeId);
    setFotosDestacadasSaving(false);
    if (error) setFotosDestacadasMsg(`⚠️ ${error.message}`);
    else {
      setFotosDestacadas(arr);
      setFotosDestacadasMsg('✅ Destacadas guardadas');
    }
    setTimeout(() => setFotosDestacadasMsg(''), 3000);
  };

  const toggleDestacadaFoto = (url) => {
    setFotosDestacadas((prev) => {
      const i = prev.indexOf(url);
      if (i >= 0) return prev.filter((u) => u !== url);
      if (prev.length >= 4) {
        window.setTimeout(() => {
          setFotosDestacadasMsg('Ya tenés 4 fotos en el carrusel. Quitá una para agregar otra');
          window.setTimeout(() => setFotosDestacadasMsg(''), 4000);
        }, 0);
        return prev;
      }
      return [...prev, url];
    });
  };

  const eliminarFoto = async (url) => {
    const marker = '/public/sedes/';
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const storagePath = decodeURIComponent(url.substring(idx + marker.length).split('?')[0]);
      await supabase.storage.from('sedes').remove([storagePath]);
    }
    const newFotos = fotosUrls.filter((u) => u !== url);
    await supabase.from('sedes').update({ fotos_urls: newFotos }).eq('id', sedeId);
    setFotosUrls(newFotos);
    setFotosDestacadas((prev) => prev.filter((u) => u !== url));
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

  const handleVolverHubDesdeAdmin = () => {
    clearAdminNavContext();
    navigate('/');
  };

  if (loading) {
    return (
      <div
        style={{
          padding: `${hubContentPaddingTopCss(location.pathname)} 20px calc(${HUB_CONTENT_PADDING_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`,
          textAlign: 'center',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <AppHeader title="" showBack={false} adminPanelMinimalHeader />
        Cargando...
      </div>
    );
  }

  const fechaActualLarga = (() => {
    const s = new Date().toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  })();

  const TABS = [
    { id: 'resumen',      label: '📊 Resumen' },
    { id: 'torneos',      label: '🏆 Torneos' },
    { id: 'reservas',     label: '⚽ Reservas' },
    { id: 'validaciones', label: '⏳ Validaciones', badge: pendientes.length },
    ...(puedeVerMiSede  ? [{ id: 'mi_sede', label: '🏟️ Mi Sede' }] : []),
    ...(puedeVerSedesPendientes ? [{ id: 'sedes_pendientes', label: '🏟️ Sedes pendientes' }] : []),
    ...(puedeVerConfig  ? [{ id: 'config',  label: '⚙️ Config' }]  : []),
  ];

  const sedeClubHeader =
    sedeId != null && sedeId !== ''
      ? Object.values(sedesMap).find((s) => mismoIdSede(s.id, sedeId)) || null
      : null;
  const tituloPanelAdmin = (() => {
    if (isSuperAdmin) {
      return '🌐 Panel Super Admin';
    }
    if (esAdminClub && sedeClubHeader?.nombre) {
      return `Panel Admin · ${sedeClubHeader.nombre}`;
    }
    if (esAdminNacional) {
      return 'Panel Admin Nacional';
    }
    const badge = ROLE_BADGE[rol] || 'Admin';
    return `Panel ${badge.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+\s*/, '')}`;
  })();
  const logoPanelSrc =
    (esAdminClub && sedeClubHeader?.logo_url && String(sedeClubHeader.logo_url).trim()) ||
    '/logo-padbol-match.png';

  return (
    <div
      className="admin-dashboard"
      style={{
        minHeight: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'none',
        WebkitOverflowScrolling: 'auto',
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `calc(12px + ${HUB_CONTENT_PADDING_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`,
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="" showBack={false} adminPanelMinimalHeader />
      <div className="admin-header" style={{ marginTop: 0, paddingTop: 0 }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 0 }}>
          <img
            src={logoPanelSrc}
            alt=""
            style={{
              ...padbolLogoImgStyle,
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto',
              height: '110px',
              marginBottom: '8px',
              borderRadius: sedeClubHeader?.logo_url ? 12 : padbolLogoImgStyle.borderRadius,
            }}
          />
          <p style={{ margin: '0 0 12px', color: '#fff', fontSize: '18px', fontWeight: 700, textAlign: 'center' }}>
            {tituloPanelAdmin}
          </p>
          <p style={{ margin: '0 0 10px', color: '#cbd5e1', fontSize: '12px', textAlign: 'center' }}>
            {fechaActualLarga}
          </p>
          {esAdminClub && sedeStatus ? (() => {
            const { numero_licencia, licencia_activa } = sedeStatus;
            if (!numero_licencia) {
              return (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '14px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'rgba(241,245,249,0.95)',
                      color: '#64748b',
                      border: '1px solid rgba(148,163,184,0.5)',
                      boxShadow: '0 1px 4px rgba(15,23,42,0.08)',
                    }}
                  >
                    📋 Sin licencia asignada
                  </span>
                </div>
              );
            }
            if (licencia_activa) {
              return (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '14px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 12px',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      background: 'linear-gradient(145deg, #C9A84C 0%, #dcc062 42%, #F0D060 100%)',
                      color: '#5a3e00',
                      border: '1px solid #9a7b2e',
                      boxShadow:
                        '0 2px 12px rgba(201, 168, 76, 0.45), 0 1px 3px rgba(90, 62, 0, 0.12), inset 0 1px 0 rgba(255,255,255,0.35)',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', lineHeight: 1 }} aria-hidden>⭐</span>
                    Licencia PADBOL Activa
                  </span>
                </div>
              );
            }
            return (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '14px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)',
                    color: '#991b1b',
                    border: '1px solid #fca5a5',
                    boxShadow: '0 1px 6px rgba(220,38,38,0.15)',
                  }}
                >
                  ⚠️ Licencia Suspendida
                </span>
              </div>
            );
          })() : null}
        </div>
      </div>

      <div
        style={{
          ...hubInstagramColumnWrapStyle,
          paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
        }}
      >
      {(isSuperAdmin || esAdminNacional) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '12px',
            paddingLeft: '12px',
            paddingRight: '12px',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/admin/nueva-sede')}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #22c55e, #15803d)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(21,128,61,0.35)',
            }}
          >
            {isSuperAdmin ? '➕ Nueva Sede' : '➕ Solicitar Nueva Sede'}
          </button>
        </div>
      )}

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '8px', marginBottom: '24px', borderBottom: '2px solid rgba(255,255,255,0.3)', paddingTop: 0, paddingBottom: '0', overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch', position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#667eea' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              sessionStorage.setItem('adminActiveTab', tab.id);
              navigate(`/admin?tab=${encodeURIComponent(tab.id)}`, { replace: true });
            }}
            style={{
              position: 'relative',
              padding: '10px 18px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid white' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              color: activeTab === tab.id ? '#fff' : '#1f2937',
              fontSize: '14px',
              marginBottom: '-2px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
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
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', marginBottom: '8px' }}>
            Período del resumen financiero
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              whiteSpace: 'nowrap',
              paddingBottom: '2px',
            }}
          >
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'semana', label: 'Semana' },
              { id: 'mes', label: 'Mes' },
              { id: 'anio', label: 'Año' },
              { id: 'rango', label: 'Rango' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSuperAdminPeriodo(opt.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '999px',
                  border: superAdminPeriodo === opt.id ? '1px solid #a5b4fc' : '1px solid #cbd5e1',
                  background: superAdminPeriodo === opt.id ? '#6366f1' : '#fff',
                  color: superAdminPeriodo === opt.id ? '#fff' : '#334155',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {superAdminPeriodo === 'rango' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', maxWidth: '420px' }}>
              <input
                type="date"
                value={superAdminFechaDesde}
                onChange={(e) => setSuperAdminFechaDesde(e.target.value)}
                aria-label="Desde"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  color: '#334155',
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="date"
                value={superAdminFechaHasta}
                onChange={(e) => setSuperAdminFechaHasta(e.target.value)}
                aria-label="Hasta"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  color: '#334155',
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="dashboard-grid">
        <div className="card ingresos" style={cifrasFinanzasResumen.tipo === 'sede' ? { gridColumn: '1 / -1' } : undefined}>
          <h2>Ingresos del período</h2>
          {cifrasFinanzasResumen.tipo === 'sede' ? (
            <div className="ingresos-por-moneda">
              <div className="ingreso-fila" style={{ textAlign: 'left' }}>
                <span className="ingreso-codigo" style={{ flex: 1 }}>
                  ⚽ Reservas de canchas
                </span>
                <span className="ingreso-valor" style={{ fontSize: '1.1rem' }}>
                  $ {cifrasFinanzasResumen.reservas.toLocaleString('es-AR')} {cifrasFinanzasResumen.moneda}
                </span>
              </div>
              <div className="ingreso-fila" style={{ textAlign: 'left' }}>
                <span className="ingreso-codigo" style={{ flex: 1 }}>
                  🏆 Inscripciones a torneos
                </span>
                <span className="ingreso-valor" style={{ fontSize: '1.1rem' }}>
                  $ {cifrasFinanzasResumen.inscripciones.toLocaleString('es-AR')} {cifrasFinanzasResumen.moneda}
                </span>
              </div>
              <div
                className="ingreso-fila"
                style={{ textAlign: 'left', borderLeftColor: '#16a34a', background: '#f0fdf4' }}
              >
                <span className="ingreso-codigo" style={{ flex: 1, color: '#166534' }}>
                  Total
                </span>
                <span className="ingreso-valor" style={{ fontSize: '1.25rem', color: '#15803d' }}>
                  $ {cifrasFinanzasResumen.total.toLocaleString('es-AR')} {cifrasFinanzasResumen.moneda}
                </span>
              </div>
            </div>
          ) : (
            (() => {
              const MON = ['ARS', 'USD', 'EUR'];
              const fmt = (obj) =>
                MON.filter((m) => (Number(obj?.[m]) || 0) > 0)
                  .map((m) => {
                    const n = Number(obj[m]) || 0;
                    if (m === 'ARS') return `$ ${n.toLocaleString('es-AR')} ARS`;
                    if (m === 'USD') return `US$ ${n.toLocaleString('en-US')} USD`;
                    return `€ ${n.toLocaleString('de-DE')} EUR`;
                  })
                  .join(' · ') || 'Sin ingresos en el período';
              const pf = cifrasFinanzasResumen.porFuente;
              return (
                <div className="ingresos-por-moneda">
                  <div className="ingreso-fila" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                    <span className="ingreso-codigo" style={{ width: '100%' }}>
                      ⚽ Reservas de canchas
                    </span>
                    <span className="ingreso-valor" style={{ fontSize: '0.95rem', textAlign: 'right' }}>
                      {fmt(pf.reservas)}
                    </span>
                  </div>
                  <div className="ingreso-fila" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                    <span className="ingreso-codigo" style={{ width: '100%' }}>
                      🏆 Inscripciones a torneos
                    </span>
                    <span className="ingreso-valor" style={{ fontSize: '0.95rem', textAlign: 'right' }}>
                      {fmt(pf.inscripciones)}
                    </span>
                  </div>
                  <div
                    className="ingreso-fila"
                    style={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: '6px',
                      borderLeftColor: '#16a34a',
                      background: '#f0fdf4',
                    }}
                  >
                    <span className="ingreso-codigo" style={{ width: '100%', color: '#166534' }}>
                      Total
                    </span>
                    <span className="ingreso-valor" style={{ fontSize: '1rem', textAlign: 'right', color: '#15803d' }}>
                      {fmt(cifrasFinanzasResumen.total)}
                    </span>
                  </div>
                </div>
              );
            })()
          )}
        </div>
        <div className="card reservas">
          <h2>Reservas en período</h2>
          <p className="count">{cifrasFinanzasResumen.reservasEnPeriodo}</p>
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
              const ciudadSede = String(sede?.ciudad || '').trim();
              const paisSede = String(sede?.pais || '').trim();
              const ubicacionSede = [ciudadSede, paisSede].filter(Boolean).join(', ');
              const NIVEL_COLOR = {
                club:          { bg: '#e2e8f0', color: '#475569' },
                nacional:      { bg: '#dbeafe', color: '#1e40af' },
                internacional: { bg: '#ede9fe', color: '#5b21b6' },
                fipa:          { bg: '#fef3c7', color: '#b45309' },
              };
              const FORMATO_COLOR = {
                round_robin:     { bg: '#ede9fe', color: '#5b21b6' },
                knockout:        { bg: '#fee2e2', color: '#991b1b' },
                grupos_knockout: { bg: '#e0e7ff', color: '#3730a3' },
              };
              const nivelTorneoRaw = String(torneo.nivel_torneo || '').trim().toLowerCase();
              const nivelCanonico = (
                nivelTorneoRaw === 'club_no_oficial' || nivelTorneoRaw === 'club_oficial'
              ) ? 'club' : (
                nivelTorneoRaw === 'mundial'
              ) ? 'fipa' : nivelTorneoRaw;
              const nivelColor   = NIVEL_COLOR[nivelCanonico] || { bg: '#e2e8f0', color: '#475569' };
              const formatoColor = FORMATO_COLOR[torneo.tipo_torneo]  || { bg: '#f3f4f6', color: '#374151' };
              const estadoBadge =
                badgeTorneoEstadoPublico(torneo.estado) || {
                  bg: '#94a3b8',
                  color: '#ffffff',
                  label: String(torneo.estado || '').trim() || '—',
                };
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
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Categoría *</label>
                          <select
                            style={inp}
                            value={editTorneoForm.categoria || CATEGORIA_TORNEO_DEFAULT}
                            onChange={(e) => setEditTorneoForm((p) => ({ ...p, categoria: e.target.value }))}
                            required
                          >
                            {TORNEO_CATEGORIA_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
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
                    /* ── Compact view in stacked layout: title/sede → badges → estado/equipos/dates/actions ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          {flag && <span style={{ fontSize: '18px', flexShrink: 0 }}>{flag}</span>}
                          <strong style={{ fontSize: '14px', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{torneo.nombre}</strong>
                        </div>
                        {sede ? <div style={{ fontSize: '11px', color: '#aaa', marginTop: '3px' }}>{sede.nombre}</div> : null}
                        {ubicacionSede ? (
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                            {flag ? `${flag} ${ubicacionSede}` : ubicacionSede}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {torneo.nivel_torneo
                          ? <span style={badge(nivelColor.bg, nivelColor.color)}>{formatNivelTorneo(torneo.nivel_torneo)}</span>
                          : null}
                        <span style={badge('#f0fdf4', '#166534')}>{formatCategoriaTorneo(torneo.categoria)}</span>
                        {torneo.tipo_torneo
                          ? <span style={badge(formatoColor.bg, formatoColor.color)}>{formatTipoTorneo(torneo.tipo_torneo)}</span>
                          : null}
                        <span style={badge(estadoBadge.bg, estadoBadge.color)}>{estadoBadge.label}</span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '11px', lineHeight: 1.5, color: '#374151' }}>
                          {torneo.fecha_inicio
                            ? <>
                                <div>{formatFecha(torneo.fecha_inicio)}</div>
                                {torneo.fecha_fin && <div style={{ color: '#9ca3af' }}>→ {formatFecha(torneo.fecha_fin)}</div>}
                              </>
                            : <div style={{ color: '#ddd' }}>—</div>}
                        </div>
                        {(() => {
                          const st = torneoStats[torneo.id];
                          if (!st) return <div style={{ fontSize: '11px', color: '#ddd' }}>···</div>;
                          if (torneo.estado === 'planificacion') return (
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                              🔧 <strong>{st.equipos_count}</strong> equipo{st.equipos_count !== 1 ? 's' : ''} inscripto{st.equipos_count !== 1 ? 's' : ''}
                            </div>
                          );
                          if (torneo.estado === 'en_curso') return (
                            <div style={{ fontSize: '11px', color: '#1d4ed8' }}>
                              ⚔️ <strong>{st.partidos_jugados}/{st.total_partidos}</strong> partidos
                            </div>
                          );
                          if (torneo.estado === 'finalizado') return (
                            <div style={{ fontSize: '11px', color: '#92400e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🥇 <strong>{st.winner?.nombre || '—'}</strong>
                            </div>
                          );
                          return null;
                        })()}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                        <button
                          onClick={() => navigate(`/torneo/${torneo.id}`, { state: { fromAdmin: true } })}
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
                        {formatNivelValidacionDisplay(jugador.nivel)}
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
          if (isSuperAdmin) {
            const now = new Date();
            const getMonedaCanonica = (reserva) => {
              console.log('[Admin] moneda raw', reserva?.moneda);
              const s = String(reserva?.moneda || '').trim().toUpperCase();
              if (!s) return 'ARS';
              if (s.includes('EUR') || s.includes('€')) return 'EUR';
              if (s.includes('USD') || s.includes('US$') || s.includes('U$S') || s === '$US') return 'USD';
              return 'ARS';
            };
            const resolveSedeDesdeReserva = (reserva) => {
              const sedeReserva = String(reserva?.sede || '').trim();
              if (!sedeReserva) return null;
              const sedeReservaLower = sedeReserva.toLowerCase();
              return Object.values(sedesMap || {}).find((s) => {
                const nombreSede = String(s?.nombre || '').trim();
                if (!nombreSede) return false;
                const nombreSedeLower = nombreSede.toLowerCase();
                return nombreSedeLower.includes(sedeReservaLower) || sedeReservaLower.includes(nombreSedeLower);
              }) || null;
            };
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfWeek = new Date(startOfToday);
            const day = startOfWeek.getDay(); // 0 Sun ... 6 Sat
            const diffToMonday = day === 0 ? 6 : day - 1;
            startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const isInPeriodo = (fechaISO) => {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return false;
              const [y, m, d] = fechaISO.split('-').map(Number);
              const fecha = new Date(y, m - 1, d);
              if (Number.isNaN(fecha.getTime())) return false;
              if (superAdminPeriodo === 'rango') {
                const desdeOk = /^\d{4}-\d{2}-\d{2}$/.test(superAdminFechaDesde);
                const hastaOk = /^\d{4}-\d{2}-\d{2}$/.test(superAdminFechaHasta);
                if (!desdeOk || !hastaOk) return false;
                const [dy, dm, dd] = superAdminFechaDesde.split('-').map(Number);
                const [hy, hm, hd] = superAdminFechaHasta.split('-').map(Number);
                const desde = new Date(dy, dm - 1, dd);
                const hasta = new Date(hy, hm - 1, hd, 23, 59, 59, 999);
                if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return false;
                return fecha >= desde && fecha <= hasta;
              }
              if (superAdminPeriodo === 'hoy') return fecha >= startOfToday && fecha <= now;
              if (superAdminPeriodo === 'semana') return fecha >= startOfWeek && fecha <= now;
              if (superAdminPeriodo === 'anio') return fecha >= startOfYear && fecha <= now;
              return fecha >= startOfMonth && fecha <= now; // mes
            };
            const reservasPeriodo = reservas.filter((r) => {
              const f = String(r?.fecha || '').trim();
              return isInPeriodo(f);
            });

            const ingresosMes = {};
            const porSede = new Map();
            reservasPeriodo.forEach((r) => {
              const sedeNombre = String(r?.sede || 'Sin sede').trim() || 'Sin sede';
              const sedeInfo = resolveSedeDesdeReserva(r) || {};
              console.log('[Admin] sede de reserva', r?.sede, 'sedeInfo', sedeInfo);
              const pais = String(sedeInfo?.pais || '').trim() || 'Sin definir';
              const ciudad = String(sedeInfo?.ciudad || '').trim() || 'Sin definir';
              const moneda = getMonedaCanonica({ moneda: sedeInfo?.moneda || r?.moneda });
              const precio = Number(r?.precio) || 0;
              ingresosMes[moneda] = (ingresosMes[moneda] || 0) + precio;

              if (!porSede.has(sedeNombre)) {
                porSede.set(sedeNombre, {
                  sede: sedeNombre,
                  pais,
                  ciudad,
                  reservasCount: 0,
                  ingresos: {},
                  rows: [],
                });
              }
              const g = porSede.get(sedeNombre);
              g.reservasCount += 1;
              g.ingresos[moneda] = (g.ingresos[moneda] || 0) + precio;
              g.rows.push(r);
            });

            const MONEDA_ORDEN = ['ARS', 'USD', 'EUR'];
            const fmtIngresos = (obj) => {
              const keys = Object.keys(obj || {});
              const ordered = [
                ...MONEDA_ORDEN.filter((m) => keys.includes(m)),
                ...keys.filter((m) => !MONEDA_ORDEN.includes(m)),
              ];
              const parts = ordered
                .filter((m) => (Number(obj?.[m]) || 0) > 0)
                .map((m) => `${m} ${(Number(obj?.[m]) || 0).toLocaleString('es-AR')}`);
              return parts.length ? parts.join(' · ') : 'Sin ingresos en el período';
            };

            const sedesRows = [...porSede.values()].sort((a, b) => b.reservasCount - a.reservasCount);

            return (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', whiteSpace: 'nowrap', paddingBottom: '2px' }}>
                  {[
                    { id: 'hoy', label: 'Hoy' },
                    { id: 'semana', label: 'Esta semana' },
                    { id: 'mes', label: 'Este mes' },
                    { id: 'anio', label: 'Este año' },
                    { id: 'rango', label: 'Rango' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSuperAdminPeriodo(opt.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '999px',
                        border: superAdminPeriodo === opt.id ? '1px solid #a5b4fc' : '1px solid #cbd5e1',
                        background: superAdminPeriodo === opt.id ? '#6366f1' : '#fff',
                        color: superAdminPeriodo === opt.id ? '#fff' : '#334155',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {superAdminPeriodo === 'rango' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input
                      type="date"
                      value={superAdminFechaDesde}
                      onChange={(e) => setSuperAdminFechaDesde(e.target.value)}
                      aria-label="Desde"
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '16px',
                        color: '#334155',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                    <input
                      type="date"
                      value={superAdminFechaHasta}
                      onChange={(e) => setSuperAdminFechaHasta(e.target.value)}
                      aria-label="Hasta"
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '16px',
                        color: '#334155',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ) : null}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  <div style={{ background: 'white', borderRadius: '10px', padding: '14px', border: '1px solid #e5e7eb' }}>
                    <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>Total reservas del período</div>
                    <div style={{ color: '#0f172a', fontSize: '26px', fontWeight: 900, marginTop: '6px' }}>{reservasPeriodo.length}</div>
                  </div>
                  <div style={{ background: 'white', borderRadius: '10px', padding: '14px', border: '1px solid #e5e7eb' }}>
                    <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>Ingresos del período</div>
                    <div style={{ color: '#0f172a', fontSize: '14px', fontWeight: 800, marginTop: '8px', lineHeight: 1.45 }}>
                      {fmtIngresos(ingresosMes)}
                    </div>
                  </div>
                </div>

                {sedesRows.length === 0 ? (
                  <p style={{ color: '#aaa', padding: '10px 0', margin: 0 }}>Sin reservas en el período seleccionado.</p>
                ) : (
                  <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>Sede + País</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>Reservas del período</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>Ingresos del período</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#64748b' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sedesRows.map((g) => {
                          const open = !!superAdminReservasOpen[g.sede];
                          return (
                            <React.Fragment key={g.sede}>
                              <tr style={{ borderTop: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 12px', color: '#475569' }}>
                                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{g.sede}</div>
                                  <div style={{ marginTop: '2px', fontSize: '11px', color: '#94a3b8' }}>{g.ciudad}</div>
                                  <div style={{ marginTop: '2px' }}>
                                    {(() => {
                                      const flag = sedeFlag({ pais: g.pais });
                                      return flag ? `${flag} ${g.pais}` : g.pais;
                                    })()}
                                  </div>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>{g.reservasCount}</td>
                                <td style={{ padding: '10px 12px', color: '#334155', fontWeight: 600 }}>{fmtIngresos(g.ingresos)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    onClick={() => setSuperAdminReservasOpen((prev) => ({ ...prev, [g.sede]: !open }))}
                                    style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#334155' }}
                                  >
                                    {open ? 'Ocultar detalle' : 'Ver detalle →'}
                                  </button>
                                </td>
                              </tr>
                              {open ? (
                                <tr>
                                  <td colSpan={4} style={{ padding: '10px 12px', background: '#f8fafc' }}>
                                    <div style={{ display: 'grid', gap: '6px' }}>
                                      {g.rows.map((r) => (
                                        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '120px 120px 1fr 1fr 110px', gap: '8px', fontSize: '12px', color: '#334155', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px' }}>
                                          <span>{r.fecha || '—'}</span>
                                          <span>{horaRango(r.hora, r.duracion)}</span>
                                          <span>{r.nombre || '—'}</span>
                                          <span>{r.email || '—'}</span>
                                          <span style={{ textAlign: 'right', fontWeight: 700 }}>${(Number(r.precio) || 0).toLocaleString('es-AR')}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          }

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

      {/* ── Sedes pendientes (super admin) ── */}
      {activeTab === 'sedes_pendientes' && puedeVerSedesPendientes && (
        <div className="section" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ color: '#fff', textAlign: 'center', marginBottom: '18px' }}>🏟️ Sedes pendientes de aprobación</h2>
          {sedesPendientesLoading ? (
            <p style={{ color: '#e2e8f0', textAlign: 'center' }}>Cargando…</p>
          ) : sedesPendientes.length === 0 ? (
            <p style={{ color: '#e2e8f0', textAlign: 'center' }}>No hay solicitudes pendientes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sedesPendientes.map((sp) => (
                <div
                  key={sp.id}
                  style={{
                    background: '#fff',
                    borderRadius: '14px',
                    padding: '18px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    color: '#1e293b',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '10px' }}>{sp.nombre}</div>
                  <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#475569' }}>
                    <div>
                      <strong>País:</strong> {sp.pais || '—'} · <strong>Ciudad:</strong> {sp.ciudad || '—'}
                    </div>
                    <div>
                      <strong>Dirección:</strong> {sp.direccion || '—'}
                    </div>
                    <div>
                      <strong>Horario:</strong> {sp.horario_apertura || '—'} — {sp.horario_cierre || '—'}
                    </div>
                    <div>
                      <strong>Precio / moneda:</strong> {sp.precio_base ?? '—'} {sp.moneda || ''}
                    </div>
                    <div>
                      <strong>WhatsApp / email sede:</strong> {sp.whatsapp || '—'} · {sp.email_contacto || '—'}
                    </div>
                    <div>
                      <strong>Licencia:</strong> {sp.numero_licencia || '—'} · {sp.fecha_contrato || '—'} ·{' '}
                      {sp.tipo_licencia || '—'}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <strong>Licenciatario:</strong> {sp.licenciatario_nombre || '—'} ({sp.licenciatario_email || '—'}) ·{' '}
                      {sp.licenciatario_telefono || '—'} · {sp.licenciatario_pais || '—'}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                      Solicitud #{sp.id} · Enviada por {sp.created_by || '—'} · {sp.created_at ? new Date(sp.created_at).toLocaleString('es-AR') : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => void aprobarSedePendiente(sp.id)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#16a34a',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ✅ Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => void rechazarSedePendiente(sp.id)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#dc2626',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ❌ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mi Sede tab ── */}
      {activeTab === 'mi_sede' && puedeVerMiSede && <div className="section admin-mi-sede-form">
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

          {/* ── Colores del hero (página pública de la sede) ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>Colores del hero</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                El bloque derecho del hero público usa siempre un degradado del color principal al secundario. El texto se ajusta solo según la luminosidad del color principal.
              </p>
              {[
                { label: 'Color principal (degradado inicio)', field: 'color_hero_primario' },
                { label: 'Color secundario (degradado fin)', field: 'color_hero_secundario' },
                { label: 'Color del borde / filete', field: 'color_borde_hero' },
              ].map(({ label, field }) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <label style={{ width: '200px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>{label}</label>
                  <input
                    type="color"
                    value={normalizeHexSedeAdmin(miSedeForm[field]) || (field === 'color_hero_primario' ? '#4C1D95' : field === 'color_hero_secundario' ? '#7C3AED' : '#6D28D9')}
                    onChange={(e) => setMiSedeForm((p) => ({ ...p, [field]: e.target.value }))}
                    style={{ width: 48, height: 36, padding: 0, border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={miSedeForm[field] || ''}
                    onChange={(e) => setMiSedeForm((p) => ({ ...p, [field]: e.target.value }))}
                    style={{ flex: 1, minWidth: '120px', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333', fontFamily: 'monospace' }}
                  />
                </div>
              ))}
              <div
                style={{
                  marginTop: '18px',
                  borderRadius: '14px',
                  border: `3px solid ${normalizeHexSedeAdmin(miSedeForm.color_borde_hero) || '#6D28D9'}`,
                  overflow: 'hidden',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    minHeight: '88px',
                    background: `linear-gradient(135deg, ${normalizeHexSedeAdmin(miSedeForm.color_hero_primario) || '#4C1D95'} 0%, ${normalizeHexSedeAdmin(miSedeForm.color_hero_secundario) || '#7C3AED'} 100%)`,
                  }}
                >
                  <div style={{ width: '72px', flexShrink: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '22px' }}>⚽</div>
                  <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '17px',
                        color: textoAutoDesdePrimarioSedeHero(miSedeForm.color_hero_primario),
                        textAlign: 'center',
                        textShadow: '0 1px 6px rgba(0,0,0,0.25)',
                      }}
                    >
                      {miSedeForm.nombre || 'Tu club'}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        color:
                          textoAutoDesdePrimarioSedeHero(miSedeForm.color_hero_primario) === '#ffffff'
                            ? 'rgba(255,255,255,0.9)'
                            : 'rgba(15,23,42,0.85)',
                      }}
                    >
                      Vista previa del hero público
                    </div>
                  </div>
                </div>
              </div>
              <p style={{ margin: '14px 0 0', fontSize: '12px', color: '#94a3b8' }}>Guardá los cambios con «Guardar cambios» en Información general.</p>
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
                <div key={field} className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555', paddingTop: '8px' }}>{label}</label>
                  <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                    <input
                      type="text"
                      value={miSedeForm[field] || ''}
                      placeholder={placeholder || ''}
                      onChange={e => setMiSedeForm(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: '100%', maxWidth: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333', boxSizing: 'border-box' }}
                    />
                    {hint && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#9ca3af' }}>{hint}</p>}
                  </div>
                </div>
              ))}
              <div className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555', paddingTop: '8px' }}>Descripción del club</label>
                <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                  <textarea
                    rows={6}
                    maxLength={300}
                    value={miSedeForm.descripcion || ''}
                    placeholder="Ej: Primer club de PADBOL del mundo, donde todo comenzó..."
                    onChange={e => setMiSedeForm(p => ({ ...p, descripcion: e.target.value }))}
                    style={{ width: '100%', maxWidth: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '12px', color: (miSedeForm.descripcion || '').length >= 280 ? '#dc2626' : '#9ca3af', marginTop: '3px' }}>
                    {(miSedeForm.descripcion || '').length}/300
                  </div>
                </div>
              </div>
              <div className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Moneda</label>
                <select value={miSedeForm.moneda || 'ARS'} onChange={e => setMiSedeForm(p => ({ ...p, moneda: e.target.value }))}
                  style={{ width: '100%', maxWidth: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333', boxSizing: 'border-box', flex: 1, minWidth: 0 }}>
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
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px' }}>
              <div className="admin-mi-sede-field-row admin-mi-sede-precio-base" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <label style={{ flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>Precio por turno (90 min)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, maxWidth: '100%' }}>
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
                    style={{ width: '100%', maxWidth: '100%', minWidth: 0, padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', textAlign: 'right', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <p style={{ margin: '4px 0 18px', fontSize: '12px', color: '#9ca3af', lineHeight: 1.5 }}>
                Precio base cuando ninguna franja cubre el horario del turno.
              </p>

              <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>Franjas horarias y precios</p>
              <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#9ca3af', lineHeight: 1.5 }}>
                Definí tantas franjas como quieras. El precio de la reserva se elige según la hora de inicio del turno (formato 24 h).
              </p>
              {franjasHorarias.map((fj, idx) => (
                <div
                  key={fj.id}
                  className="admin-franja-bloque"
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px',
                    marginBottom: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Franja {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => setFranjasHorarias((rows) => rows.filter((r) => r.id !== fj.id))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                      title="Eliminar franja"
                    >
                      ✕
                    </button>
                  </div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#555' }}>Nombre</label>
                  <input
                    type="text"
                    value={fj.nombre}
                    placeholder="Ej: Mañana, Tarde, Noche"
                    onChange={(e) => {
                      const v = e.target.value;
                      setFranjasHorarias((rows) => rows.map((r) => (r.id === fj.id ? { ...r, nombre: v } : r)));
                    }}
                    style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
                  />
                  <div className="admin-franja-horas" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Inicio</label>
                      <input
                        type="time"
                        value={fj.hora_inicio}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFranjasHorarias((rows) => rows.map((r) => (r.id === fj.id ? { ...r, hora_inicio: v } : r)));
                        }}
                        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '7px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
                      />
                    </div>
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Fin</label>
                      <input
                        type="time"
                        value={fj.hora_fin}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFranjasHorarias((rows) => rows.map((r) => (r.id === fj.id ? { ...r, hora_fin: v } : r)));
                        }}
                        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '7px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
                      />
                    </div>
                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                        Precio ({miSedeForm.moneda || 'ARS'})
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          fj.precio === '' || fj.precio == null
                            ? ''
                            : Number(String(fj.precio).replace(/\D/g, '') || 0).toLocaleString('es-AR')
                        }
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                          setFranjasHorarias((rows) => rows.map((r) => (r.id === fj.id ? { ...r, precio: digits } : r)));
                        }}
                        placeholder="Ej: 8000"
                        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', textAlign: 'right' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() =>
                    setFranjasHorarias((rows) => [
                      ...rows,
                      { id: newFranjaId(), nombre: '', hora_inicio: '', hora_fin: '', precio: '' },
                    ])
                  }
                  style={{
                    padding: '8px 16px',
                    background: '#e0e7ff',
                    color: '#3730a3',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  + Agregar franja
                </button>
                <button
                  type="button"
                  onClick={guardarFranjas}
                  disabled={franjasSaving}
                  style={{
                    padding: '8px 20px',
                    background: franjasSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: franjasSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px',
                  }}
                >
                  {franjasSaving ? '⏳ Guardando...' : '💾 Guardar franjas'}
                </button>
                {franjasMsg ? (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: franjasMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{franjasMsg}</span>
                ) : null}
              </div>
              <button onClick={guardarMiSede} disabled={miSedeSaving} type="button"
                style={{ marginTop: '16px', padding: '8px 20px', background: miSedeSaving ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #4338ca)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                {miSedeSaving ? '⏳ Guardando...' : '💾 Guardar precio base'}
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
                <div key={field} className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <label style={{ width: '150px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555' }}>{label}</label>
                  <input
                    type="url"
                    value={miSedeForm[field] || ''}
                    placeholder={placeholder}
                    onChange={e => setMiSedeForm(p => ({ ...p, [field]: e.target.value }))}
                    style={{ flex: 1, minWidth: 0, maxWidth: '100%', width: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', color: '#333', boxSizing: 'border-box' }}
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
              <div className="admin-mi-sede-field-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Ej: Cancha 3" value={nuevaCancha}
                  onChange={e => setNuevaCancha(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') agregarCancha(); }}
                  style={{ flex: 1, minWidth: 0, maxWidth: '100%', width: '100%', padding: '7px 10px', border: '1.5px solid #a5b4fc', borderRadius: '6px', fontSize: '13px', color: '#333', boxSizing: 'border-box' }} />
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
                <div
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    background: normalizeHexSedeAdmin(miSedeForm.color_fondo_logo) || '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={logoUrl}
                    alt="Logo del club"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                </div>
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
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      abrirRecorteLogoDesdeFile(f);
                    }}
                  />
                </label>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>JPG, PNG o WEBP · máx. 2MB</span>
                <span style={{ fontSize: '11px', color: '#c4b5fd', lineHeight: 1.4 }}>💡 Recomendado: PNG transparente, mín. 300×300 px</span>
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb', width: '100%', maxWidth: '320px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Fondo del logo en la página pública de la sede
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <input
                      type="color"
                      aria-label="Color de fondo del logo"
                      value={normalizeHexSedeAdmin(miSedeForm.color_fondo_logo) || '#000000'}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMiSedeForm((prev) => ({ ...prev, color_fondo_logo: v }));
                        schedulePersistColorFondoLogo(v);
                      }}
                      style={{ width: '48px', height: '40px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', background: '#fff' }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Se aplica detrás del logo en el hero. Por defecto negro (#000000).
                    </span>
                  </div>
                </div>
                {logoMsg && <span style={{ fontSize: '13px', fontWeight: 600, color: logoMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{logoMsg}</span>}
              </div>
            </div>
          </div>

          {/* Fotos de canchas */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e1b4b' }}>
                Fotos de las canchas
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#9ca3af', marginLeft: '8px' }}>
                  ({fotosUrls.length}/{MAX_FOTOS_SEDE})
                </span>
              </p>
              {fotosUrls.length < MAX_FOTOS_SEDE && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <label style={{
                    display: 'inline-block', padding: '7px 16px',
                    background: fotosUploading ? '#e5e7eb' : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                    color: fotosUploading ? '#9ca3af' : 'white',
                    borderRadius: '8px', cursor: fotosUploading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '13px',
                  }}>
                    {fotosUploading ? '⏳ Subiendo...' : '+ Agregar fotos'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      disabled={fotosUploading}
                      onChange={(e) => {
                        const input = e.target;
                        const files = Array.from(input.files || []);
                        input.value = '';
                        if (!files.length) return;
                        setFotosUploading(true);
                        setFotosUploadLabel(files.length > 1 ? `Subiendo ${files.length} fotos...` : 'Subiendo 1 de 1...');
                        void subirFotosMultiples(files, { uploadingPrimed: true });
                      }}
                    />
                  </label>
                  <label
                    style={{
                      display: 'inline-block',
                      padding: '7px 14px',
                      background: fotosUploading ? '#f1f5f9' : '#fff',
                      color: fotosUploading ? '#94a3b8' : '#3730a3',
                      border: '2px solid #a5b4fc',
                      borderRadius: '8px',
                      cursor: fotosUploading ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                    title="Recomendado en Safari iPhone: una foto por vez"
                  >
                    + Agregar una foto
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={fotosUploading}
                      onChange={(e) => {
                        const input = e.target;
                        const file = input.files && input.files[0];
                        input.value = '';
                        if (!file) return;
                        setFotosUploading(true);
                        setFotosUploadLabel('Subiendo 1 de 1...');
                        void subirFotosMultiples([file], { uploadingPrimed: true });
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
            {fotosUploadLabel ? (
              <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: '#6366f1' }}>{fotosUploadLabel}</p>
            ) : null}
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
              Marcá hasta 4 fotos con ★ para el carrusel de la página pública (orden 1–4). Guardá con el botón inferior.
            </p>
            {fotosUrls.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>No hay fotos cargadas aún.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {fotosUrls.map((url, i) => {
                  const ord = fotosDestacadas.indexOf(url);
                  const destacada = ord >= 0;
                  return (
                    <div key={url} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/3', background: '#f1f5f9' }}>
                      <img
                        src={url}
                        alt={`Cancha ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {destacada ? (
                        <span
                          style={{
                            position: 'absolute',
                            left: '8px',
                            bottom: '8px',
                            minWidth: '22px',
                            height: '22px',
                            padding: '0 6px',
                            borderRadius: '8px',
                            background: 'rgba(15,23,42,0.75)',
                            color: '#f8fafc',
                            fontSize: '12px',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                          }}
                        >
                          {ord + 1}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleDestacadaFoto(url)}
                        title={destacada ? 'Quitar del carrusel' : 'Destacar en carrusel'}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: destacada ? 'rgba(234,179,8,0.95)' : 'rgba(15,23,42,0.55)',
                          color: destacada ? '#1e1b4b' : '#fef9c3',
                        }}
                      >
                        ★
                      </button>
                      <button
                        type="button"
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
                  );
                })}
              </div>
            )}
            {fotosUrls.length > 0 ? (
              <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={guardarFotosDestacadas}
                  disabled={fotosDestacadasSaving}
                  style={{
                    padding: '8px 20px',
                    background: fotosDestacadasSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: fotosDestacadasSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px',
                  }}
                >
                  {fotosDestacadasSaving ? '⏳ Guardando...' : '💾 Guardar destacadas'}
                </button>
                {fotosDestacadasMsg ? (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: fotosDestacadasMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>
                    {fotosDestacadasMsg}
                  </span>
                ) : null}
              </div>
            ) : null}
            {fotosMsg ? <p style={{ margin: '12px 0 0', fontSize: '13px', fontWeight: 600, color: fotosMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{fotosMsg}</p> : null}
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#9ca3af' }}>
              Imágenes · máx. 2MB por archivo · hasta {MAX_FOTOS_SEDE} fotos. En iPhone, si varias a la vez no suben, usá «+ Agregar una foto».
            </p>
          </div>
        </div>}

      </div>}
      </div>

      {logoCropOpen && logoCropSrc ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Recortar logo del club"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20000,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget && !logoUploading) cerrarModalLogoCrop();
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#fff',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>Recortar logo</h3>
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
                Mové y hacé zoom para encuadrar el logo. Se guardará como JPG en buena calidad.
              </p>
            </div>
            <div style={{ position: 'relative', width: '100%', height: 'min(56vh, 360px)', background: '#0f172a' }}>
              <Cropper
                image={logoCropSrc}
                crop={logoCrop}
                zoom={logoCropZoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setLogoCrop}
                onZoomChange={setLogoCropZoom}
                onCropComplete={onLogoCropComplete}
              />
            </div>
            <div style={{ padding: '14px 18px 18px' }}>
              <label
                htmlFor="admin-logo-crop-zoom"
                style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}
              >
                Zoom
              </label>
              <input
                id="admin-logo-crop-zoom"
                type="range"
                min={1}
                max={3}
                step={0.02}
                value={logoCropZoom}
                onChange={(ev) => setLogoCropZoom(Number(ev.target.value))}
                style={{ width: '100%', marginBottom: '16px' }}
              />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={logoUploading}
                  onClick={() => !logoUploading && cerrarModalLogoCrop()}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '12px 16px',
                    fontSize: '15px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    cursor: logoUploading ? 'default' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!logoCropAreaListo || logoUploading}
                  onClick={() => void confirmarRecorteLogo()}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '12px 16px',
                    fontSize: '15px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    border: 'none',
                    background: logoCropAreaListo && !logoUploading ? '#15803d' : '#94a3b8',
                    color: '#fff',
                    cursor: logoCropAreaListo && !logoUploading ? 'pointer' : 'default',
                  }}
                >
                  {logoUploading ? 'Subiendo…' : 'Confirmar recorte'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}