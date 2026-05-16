import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { getDisplayName } from '../utils/displayName';
import { getDistanceKm } from '../utils/sedeCardUi';
import { precioDesdeFranjas } from '../utils/franjasHorarias';
import { duracionesReservaDisponibles, precioReservaTurno, RESERVA_DURACIONES_MIN } from '../utils/sedePreciosDuracion';
import { hubContentPaddingTopCss, hubMainPaddingBottomCss } from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

const ACCENT = '#e53935';

/** Normaliza `duraciones` del GET disponibilidad-slots (variantes de payload y precio numérico/string). */
function normalizarDuracionesDisponibilidadSlotsPayload(d) {
  if (!d || typeof d !== 'object') return [];
  const listRaw = Array.isArray(d.duraciones)
    ? d.duraciones
    : Array.isArray(d?.data?.duraciones)
      ? d.data.duraciones
      : [];
  const out = [];
  for (const row of listRaw) {
    if (!row || typeof row !== 'object') continue;
    const dm = Number(row.duracion_minutos ?? row.duracionMinutos ?? row.minutos);
    if (!Number.isFinite(dm) || dm < 15) continue;
    const rawPr = row.precio;
    let pr = null;
    if (rawPr != null && rawPr !== '') {
      const n = Number(String(rawPr).replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) pr = Math.round(n);
    }
    out.push({ duracion_minutos: Math.floor(dm), precio: pr });
  }
  out.sort((a, b) => a.duracion_minutos - b.duracion_minutos);
  return out;
}

const DEPORTES = [
  { id: 'padbol', label: 'Padbol', jugadores: 4 },
  { id: 'padel', label: 'Pádel', jugadores: 4 },
  { id: 'pickleball', label: 'Pickleball', jugadores: 4 },
  { id: 'squash', label: 'Squash', jugadores: 4 },
  { id: 'tenis', label: 'Tenis', jugadores: 4 },
  { id: 'futbol_5', label: 'Fútbol 5', jugadores: 10 },
  { id: 'futbol_7', label: 'Fútbol 7', jugadores: 14 },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysISO(baseYmd, days) {
  const [y, m, da] = baseYmd.split('-').map((x) => parseInt(x, 10));
  const d = new Date(y, m - 1, da);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextNDaysFrom(todayStr, count) {
  const n = Number(count);
  const len = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  return Array.from({ length: len }, (_, i) => addDaysISO(todayStr, i));
}

function labelDiaCorta(iso, index) {
  if (index === 0) return 'Hoy';
  if (index === 1) return 'Mañana';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const w = d.toLocaleDateString('es', { weekday: 'short' });
  const day = d.getDate();
  const mo = d.toLocaleDateString('es', { month: 'short' });
  return `${w} ${day} ${mo}`;
}

function shareUrl() {
  const text = `Sumate a mi partido en Padbol Match: ${window.location.origin}/partidos-abiertos`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function findSedeById(sedesList, sedeIdRaw) {
  const id = String(sedeIdRaw ?? '').trim();
  if (!id) return null;
  const list = Array.isArray(sedesList) ? sedesList : [];
  const exact = list.find((s) => String(s?.id ?? '').trim() === id);
  if (exact) return exact;
  const n = Number(id);
  if (Number.isFinite(n)) {
    return list.find((s) => Number(s?.id) === n) || null;
  }
  return null;
}

function normalizeTextForSearch(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sedeTieneDeporteArmar(sede, deporteKey) {
  const rows = sede.canchas_por_deporte;
  if (!Array.isArray(rows) || rows.length === 0) return true;
  return rows.some(
    (r) =>
      r.activo !== false &&
      Number(r.cantidad) > 0 &&
      String(r.deporte || '').trim().toLowerCase() === deporteKey,
  );
}

function sedeCoincideBusqueda(sede, queryNorm) {
  if (queryNorm.length < 2) return true;
  const blob = normalizeTextForSearch([sede.nombre, sede.ciudad, sede.pais].filter(Boolean).join(' '));
  return blob.includes(queryNorm);
}

function deportesOfrecidosResumen(sede) {
  const rows = sede.canchas_por_deporte;
  if (!Array.isArray(rows) || !rows.length) return 'Consultá en la sede';
  const keys = [
    ...new Set(
      rows
        .filter((r) => r.activo !== false && Number(r.cantidad) > 0)
        .map((r) => String(r.deporte || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (!keys.length) return '—';
  return keys
    .map((k) => DEPORTES_CANCHA_SEDE_OPTIONS.find((o) => o.key === k)?.label || k)
    .join(', ');
}

const SEDE_SUGGEST_MAX_VISIBLE_PX = 312;
const MAIN_MAX = 390;

function ProgressBar3({ current }) {
  const dot = (n) => {
    const done = current > n;
    const active = current === n;
    const bg = done ? ACCENT : active ? 'rgba(229, 57, 53, 0.45)' : '#9ca3af';
    return (
      <div
        key={`d${n}`}
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: bg,
          flexShrink: 0,
        }}
        aria-hidden
      />
    );
  };
  const line = (n) => (
    <div
      key={`l${n}`}
      style={{
        flex: 1,
        height: 3,
        background: current > n ? ACCENT : '#e5e7eb',
        borderRadius: 1,
        minWidth: 8,
      }}
      aria-hidden
    />
  );
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        maxWidth: MAIN_MAX,
        marginBottom: 14,
        gap: 0,
      }}
      aria-hidden
    >
      {dot(1)}
      {line(1)}
      {dot(2)}
      {line(2)}
      {dot(3)}
    </div>
  );
}

const AP = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: 18,
    boxShadow: '0 16px 34px rgba(0,0,0,0.14)',
  },
  title: { margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 20 },
  body: { color: 'var(--text-secondary)', lineHeight: 1.55 },
  errBanner: {
    background: 'rgba(229, 57, 53, 0.12)',
    color: 'var(--text-primary)',
    border: `1px solid ${ACCENT}`,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: 800,
  },
  field: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    border: '1px solid var(--border)',
    boxSizing: 'border-box',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    /* iOS: menos de 16px en inputs dispara zoom al enfocar */
    fontSize: 16,
  },
  label: { display: 'block', fontWeight: 800, color: 'var(--text-primary)', fontSize: 14 },
  sub: { color: 'var(--text-secondary)', fontSize: 12, margin: '6px 0 0' },
};

export default function ArmarPartido() {
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [searchParams] = useSearchParams();
  const { session, userProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [sedes, setSedes] = useState([]);
  const [loadingSedes, setLoadingSedes] = useState(true);
  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState('');
  const [publicado, setPublicado] = useState(null);

  const [slotsApi, setSlotsApi] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  /** Oferta { duracion_minutos, precio } desde GET disponibilidad-slots (prioridad sobre columnas legacy de sede). */
  const [duracionesApi, setDuracionesApi] = useState([]);

  const [dispCanchas, setDispCanchas] = useState([]);
  const [dispLoading, setDispLoading] = useState(false);

  const [publicarPartido, setPublicarPartido] = useState(false);

  const sedeBlurTimerRef = useRef(null);
  const [sedeBusqueda, setSedeBusqueda] = useState('');
  const [sedeDropdownOpen, setSedeDropdownOpen] = useState(false);
  const [userGeo, setUserGeo] = useState(null);
  const [geoStatus, setGeoStatus] = useState('pending');

  const [form, setForm] = useState({
    deporte: 'padbol',
    jugadoresRequeridos: 4,
    sedeId: '',
    cancha: '',
    fecha: todayISO(),
    hora: '',
    duracion: 90,
    precioTurnoBase: null,
    jugadoresConfirmados: 1,
    nivel: 'Intermedio',
  });

  useEffect(() => {
    if (step !== 1) return;
    if (!navigator.geolocation) {
      setUserGeo(null);
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('pending');
    const t = window.setTimeout(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserGeo({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setGeoStatus('granted');
        },
        () => {
          setUserGeo(null);
          setGeoStatus('denied');
        },
        { timeout: 8000, maximumAge: 600000 },
      );
    }, 0);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step !== 1) {
      setSedeDropdownOpen(false);
      return;
    }
    const s = findSedeById(sedes, form.sedeId);
    if (s) setSedeBusqueda(String(s.nombre || '').trim());
  }, [step, form.sedeId, sedes]);

  useEffect(() => {
    return () => {
      if (sedeBlurTimerRef.current) window.clearTimeout(sedeBlurTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const d = String(searchParams.get('deporte') || '').trim().toLowerCase();
    if (!d) return;
    const item = DEPORTES.find((x) => x.id === d);
    if (!item) return;
    setForm((f) => ({
      ...f,
      deporte: item.id,
      jugadoresRequeridos: item.id === 'pickleball' ? f.jugadoresRequeridos : item.jugadores,
      jugadoresConfirmados: 1,
    }));
  }, [searchParams]);

  useEffect(() => {
    fetch(`${API_BASE}/api/sedes`)
      .then((r) => r.json())
      .then((d) => setSedes(Array.isArray(d) ? d : []))
      .catch((err) => setMsg(err.message || 'No se pudieron cargar sedes'))
      .finally(() => setLoadingSedes(false));
  }, []);

  const sede = useMemo(() => findSedeById(sedes, form.sedeId), [sedes, form.sedeId]);

  const duracionesOfrecidas = useMemo(() => {
    if (duracionesApi.length > 0) {
      return duracionesApi
        .filter((x) => x && Number.isFinite(Number(x.duracion_minutos)))
        .map((x) => ({
          duracion_minutos: Number(x.duracion_minutos),
          precio: x.precio != null && Number.isFinite(Number(x.precio)) ? Number(x.precio) : null,
        }))
        .sort((a, b) => a.duracion_minutos - b.duracion_minutos);
    }
    if (!sede) {
      return RESERVA_DURACIONES_MIN.map((min) => ({ duracion_minutos: min, precio: null }));
    }
    const mins = duracionesReservaDisponibles(sede);
    const list = mins.length > 0 ? mins : RESERVA_DURACIONES_MIN;
    return list.map((min) => ({ duracion_minutos: min, precio: null }));
  }, [sede, duracionesApi]);

  useEffect(() => {
    if (!sede) return;
    const list = duracionesOfrecidas;
    if (!list.length) return;
    if (list.length === 1) {
      const only = list[0];
      setForm((f) => {
        const pb = only.precio != null && Number.isFinite(Number(only.precio)) ? Number(only.precio) : null;
        if (Number(f.duracion) === only.duracion_minutos && (f.precioTurnoBase == null ? pb == null : Number(f.precioTurnoBase) === pb)) {
          return f;
        }
        return { ...f, duracion: only.duracion_minutos, precioTurnoBase: pb, hora: '' };
      });
      return;
    }
    setForm((f) => {
      const cur = Number(f.duracion);
      const match = list.find((x) => Number(x.duracion_minutos) === cur);
      if (!match) {
        const first = list[0];
        return { ...f, duracion: first.duracion_minutos, precioTurnoBase: first.precio ?? null, hora: '' };
      }
      const p = match.precio != null && Number.isFinite(Number(match.precio)) ? Number(match.precio) : null;
      if (p != null && Number(f.precioTurnoBase) !== p) return { ...f, precioTurnoBase: p };
      if (p == null && f.precioTurnoBase != null) return { ...f, precioTurnoBase: null };
      return f;
    });
  }, [sede, duracionesOfrecidas]);

  /** Oferta de duraciones: misma API que los slots, pero sin depender de `form.duracion` (evita quedar en legacy de una sola fila). */
  useEffect(() => {
    if (!sede?.id || !form.fecha) {
      setDuracionesApi([]);
      return;
    }
    let cancelled = false;
    const url = `${API_BASE}/api/sedes/${encodeURIComponent(sede.id)}/disponibilidad-slots?${new URLSearchParams({
      fecha: form.fecha,
      duracion: '90',
      deporte: form.deporte,
    })}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (process.env.NODE_ENV === 'development') {
          console.log('[ArmarPartido] disponibilidad-slots (oferta duraciones)', {
            url,
            keys: d && typeof d === 'object' ? Object.keys(d) : [],
            duracionesRaw: d?.duraciones,
            normalizadas: normalizarDuracionesDisponibilidadSlotsPayload(d),
          });
        }
        setDuracionesApi(normalizarDuracionesDisponibilidadSlotsPayload(d));
      })
      .catch(() => {
        if (!cancelled) setDuracionesApi([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sede?.id, form.fecha, form.deporte]);

  useEffect(() => {
    if (!sede?.id || !form.fecha || !form.duracion) {
      setSlotsApi([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    const url = `${API_BASE}/api/sedes/${encodeURIComponent(sede.id)}/disponibilidad-slots?${new URLSearchParams({
      fecha: form.fecha,
      duracion: String(form.duracion),
      deporte: form.deporte,
    })}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setSlotsApi(Array.isArray(d?.slots) ? d.slots : []);
      })
      .catch(() => {
        if (!cancelled) setSlotsApi([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sede?.id, form.fecha, form.duracion, form.deporte]);

  useEffect(() => {
    if (step !== 2 || !sede?.id || !form.fecha || !form.hora || !form.duracion) {
      setDispCanchas([]);
      return;
    }
    let cancelled = false;
    setDispLoading(true);
    const horaLimpia = String(form.hora).split(' - ')[0].trim();
    const url = `${API_BASE}/api/reservas/disponibilidad?${new URLSearchParams({
      sede_id: String(sede.id),
      fecha: form.fecha,
      hora_inicio: horaLimpia,
      duracion_minutos: String(form.duracion),
      deporte: form.deporte,
    })}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setDispCanchas(Array.isArray(d?.canchas) ? d.canchas : []);
      })
      .catch(() => {
        if (!cancelled) setDispCanchas([]);
      })
      .finally(() => {
        if (!cancelled) setDispLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, sede?.id, form.fecha, form.hora, form.duracion, form.deporte]);

  const puedeVerCanchasPaso1 = useMemo(
    () =>
      Boolean(sede && String(form.fecha || '').trim() && String(form.hora || '').trim()),
    [sede, form.fecha, form.hora],
  );

  const precioBase = useMemo(() => {
    if (!sede || !form.hora) return 0;
    const baseTabla =
      form.precioTurnoBase != null && Number.isFinite(Number(form.precioTurnoBase)) && Number(form.precioTurnoBase) >= 0
        ? Number(form.precioTurnoBase)
        : null;
    return Number(precioReservaTurno(sede, form.hora, form.fecha, Number(form.duracion), precioDesdeFranjas, baseTabla) ?? 0);
  }, [sede, form.hora, form.fecha, form.duracion, form.precioTurnoBase]);

  const cargoPlataforma = useMemo(() => Math.round(precioBase * 0.03), [precioBase]);
  const precioTotal = useMemo(() => precioBase + cargoPlataforma, [precioBase, cargoPlataforma]);

  const sedesParaArmar = useMemo(() => {
    const hasAny = sedes.some((s) => Array.isArray(s.canchas_por_deporte) && s.canchas_por_deporte.length > 0);
    if (!hasAny) return sedes;
    return sedes.filter((s) => sedeTieneDeporteArmar(s, form.deporte));
  }, [sedes, form.deporte]);

  const sedeBusquedaNorm = useMemo(() => normalizeTextForSearch(sedeBusqueda), [sedeBusqueda]);

  const sedesOrdenadasParaLista = useMemo(() => {
    const base = [...sedesParaArmar];
    const granted = geoStatus === 'granted' && userGeo;
    const withKm = base.map((s) => {
      const la = Number(s.latitud);
      const lo = Number(s.longitud);
      const km = granted && [la, lo].every(Number.isFinite) ? getDistanceKm(userGeo.lat, userGeo.lon, la, lo) : null;
      return { ...s, _km: km };
    });
    if (granted) {
      return withKm.sort((a, b) => {
        if (a._km == null && b._km == null) return 0;
        if (a._km == null) return 1;
        if (b._km == null) return -1;
        return a._km - b._km;
      });
    }
    return withKm.sort((a, b) =>
      String(a.nombre || '').localeCompare(String(b.nombre || ''), undefined, { sensitivity: 'base' }),
    );
  }, [sedesParaArmar, geoStatus, userGeo]);

  const sedesListaMostrada = useMemo(() => {
    const q = sedeBusquedaNorm;
    if (q.length >= 2) return sedesOrdenadasParaLista.filter((s) => sedeCoincideBusqueda(s, q));
    return sedesOrdenadasParaLista.slice(0, 5);
  }, [sedesOrdenadasParaLista, sedeBusquedaNorm]);

  /** Hoy + 29 días (30 turnos de calendario), máx. anticipación de reserva. */
  const diasReserva = useMemo(() => nextNDaysFrom(todayISO(), 30), []);

  const onSedeInputChange = (e) => {
    const v = e.target.value;
    setSedeBusqueda(v);
    const sel = findSedeById(sedes, form.sedeId);
    if (sel) {
      const nm = normalizeTextForSearch(String(sel.nombre || '').trim());
      if (nm !== normalizeTextForSearch(v)) {
        setForm((f) => ({ ...f, sedeId: '', cancha: '', hora: '', precioTurnoBase: null }));
      }
    }
    setSedeDropdownOpen(true);
  };

  const limpiarSedeSeleccion = () => {
    setSedeBusqueda('');
    setForm((f) => ({ ...f, sedeId: '', cancha: '', hora: '', precioTurnoBase: null }));
    setSedeDropdownOpen(true);
  };

  const setDeporte = (deporte) => {
    const item = DEPORTES.find((d) => d.id === deporte) || DEPORTES[0];
    const hasAny = sedes.some((s) => Array.isArray(s.canchas_por_deporte) && s.canchas_por_deporte.length > 0);
    const cur = findSedeById(sedes, form.sedeId);
    if (hasAny && cur && !sedeTieneDeporteArmar(cur, deporte)) setSedeBusqueda('');
    setForm((f) => {
      const next = {
        ...f,
        deporte,
        jugadoresRequeridos: deporte === 'pickleball' ? f.jugadoresRequeridos : item.jugadores,
        jugadoresConfirmados: 1,
        hora: '',
        cancha: '',
      };
      if (hasAny && f.sedeId) {
        const sRow = findSedeById(sedes, f.sedeId);
        if (sRow && !sedeTieneDeporteArmar(sRow, deporte)) {
          next.sedeId = '';
          next.cancha = '';
          next.hora = '';
          next.precioTurnoBase = null;
        }
      }
      return next;
    });
  };

  const irPaso2 = () => {
    setMsg('');
    if (!String(form.sedeId || '').trim()) {
      setMsg('Seleccioná una sede.');
      return;
    }
    if (!form.fecha) {
      setMsg('Elegí una fecha.');
      return;
    }
    if (!form.hora) {
      setMsg('Elegí un horario disponible.');
      return;
    }
    setStep(2);
  };

  /** Al elegir un horario en el paso 1, avanza al paso 2 sin depender del botón (fallback). */
  const avanzarPaso2DesdeHorario = useCallback(
    (horaInicio) => {
      setMsg('');
      if (!String(form.sedeId || '').trim()) {
        setMsg('Seleccioná una sede.');
        return;
      }
      if (!form.fecha) {
        setMsg('Elegí una fecha.');
        return;
      }
      const h = String(horaInicio || '').trim();
      if (!h) return;
      if (!form.duracion) {
        setMsg('Elegí una duración.');
        return;
      }
      setForm((f) => ({ ...f, hora: h, cancha: '' }));
      setStep(2);
    },
    [form.sedeId, form.fecha, form.duracion],
  );

  const irPaso3 = () => {
    setMsg('');
    const num = parseInt(String(form.cancha), 10);
    if (!Number.isFinite(num) || num < 1) {
      setMsg('Elegí una cancha libre.');
      return;
    }
    setStep(3);
  };

  const pagarYPublicar = async () => {
    if (!session?.user) {
      navigate('/login?redirect=/armar-partido');
      return;
    }
    const sedeActual = findSedeById(sedes, form.sedeId);
    if (!sedeActual || !form.cancha || !form.fecha || !form.hora) {
      setMsg('Completá sede, cancha, fecha y horario.');
      return;
    }
    setPaying(true);
    setMsg('');
    const { data: authData } = await supabase.auth.getSession();
    const token = authData?.session?.access_token || session.access_token;
    const nombre = getDisplayName(userProfile, session) || session.user.email;
    const shareToken = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
    const reservaData = {
      tipo: 'partido_abierto',
      publicar_partido: Boolean(publicarPartido),
      share_token: shareToken,
      sede: sedeActual.nombre,
      sede_id: sedeActual.id,
      fecha: String(form.fecha).trim(),
      hora: String(form.hora).trim(),
      cancha: Number(form.cancha),
      nombre,
      email: session.user.email,
      whatsapp: userProfile?.whatsapp || userProfile?.telefono || '+540000000000',
      nivel: form.nivel,
      precio: precioTotal,
      moneda: sedeActual.moneda || 'ARS',
      duracion: Number(form.duracion),
      deporte: form.deporte,
      jugadores_requeridos: Number(form.jugadoresRequeridos),
      jugadores_confirmados_count: Number(form.jugadoresConfirmados),
      capitan_user_id: session.user.id,
      capitan_email: session.user.email,
      capitan_nombre: nombre,
      capitan_foto_url: userProfile?.foto_url || userProfile?.avatar_url || session.user.user_metadata?.avatar_url || '',
      user_id: session.user.id,
    };
    try {
      const res = await fetch(`${API_BASE}/api/crear-preferencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          titulo: `Partido abierto — ${sedeActual.nombre}`,
          precio: precioTotal,
          moneda: sedeActual.moneda || 'ARS',
          sedeNombre: sedeActual.nombre,
          sedeId: sedeActual.id,
          reservaData,
        }),
      });
      const data = await res.json();
      if (res.ok && data.init_point) {
        window.location.href = data.init_point;
        return;
      }
      if (res.ok && (data.manual_payment || data.efectivo_payment)) {
        setPublicado(data.partido || null);
        setStep(4);
        return;
      }
      if (res.ok && data.stripe_checkout_pending) {
        setMsg(
          data.message ||
            'El cobro con tarjeta para esta sede está en configuración. Probá con otra sede o contactá al club.',
        );
        return;
      }
      throw new Error(data?.error || data?.message || 'No se pudo iniciar el pago');
    } catch (err) {
      setMsg(err.message || 'Error al publicar partido');
    } finally {
      setPaying(false);
    }
  };

  const sedeNombreCancha = (num) => {
    const row = dispCanchas.find((c) => Number(c.numero) === Number(num));
    return row?.nombre || `Cancha ${num}`;
  };

  const canchaLibreSeleccionada = useMemo(() => {
    const n = parseInt(String(form.cancha), 10);
    if (!Number.isFinite(n)) return false;
    const row = dispCanchas.find((c) => Number(c.numero) === n);
    return Boolean(row?.disponible);
  }, [form.cancha, dispCanchas]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
        paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Armar partido" />
      <main style={{ width: '100%', maxWidth: MAIN_MAX, margin: '0 auto', padding: '18px 14px', boxSizing: 'border-box' }}>
        {step < 4 ? <ProgressBar3 current={step} /> : null}

        <section style={AP.card}>
          {msg ? <div style={AP.errBanner}>{msg}</div> : null}

          {step === 1 ? (
            <div style={{ paddingTop: 22 }}>
              <h1 style={AP.title}>{sede ? 'Fecha y hora' : 'Deporte y sede'}</h1>
              <p style={AP.body}>Elegí deporte y sede, después el día y el turno.</p>

              <label style={{ ...AP.label, marginTop: 14 }} htmlFor="armar-deporte-select">
                Deporte
              </label>
              <select
                id="armar-deporte-select"
                value={form.deporte}
                onChange={(e) => setDeporte(e.target.value)}
                style={{ ...AP.field, marginTop: 8 }}
              >
                {DEPORTES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} · {d.jugadores} jugadores
                  </option>
                ))}
              </select>
              {form.deporte === 'pickleball' ? (
                <label style={{ ...AP.label, marginTop: 12 }}>
                  Modalidad pickleball
                  <select
                    value={form.jugadoresRequeridos}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        jugadoresRequeridos: Number(e.target.value),
                        jugadoresConfirmados: 1,
                      }))
                    }
                    style={{ ...AP.field, marginTop: 8 }}
                  >
                    <option value={2}>Singles (2)</option>
                    <option value={4}>Dobles (4)</option>
                  </select>
                </label>
              ) : null}

              <label style={{ ...AP.label, marginTop: 14 }} htmlFor="armar-sede-busqueda">
                Sede
              </label>
              <p style={AP.sub}>
                {sedeBusquedaNorm.length >= 2
                  ? 'Resultados según tu búsqueda.'
                  : geoStatus === 'granted'
                    ? 'Mostrando las 5 sedes más cercanas.'
                    : 'Mostrando 5 sedes. Activá la ubicación para ver las más cercanas.'}
              </p>
              <div style={{ position: 'relative', marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <input
                    id="armar-sede-busqueda"
                    type="text"
                    role="combobox"
                    aria-expanded={sedeDropdownOpen}
                    autoComplete="off"
                    placeholder="Buscar sede o ciudad…"
                    value={sedeBusqueda}
                    onChange={onSedeInputChange}
                    onFocus={() => {
                      if (sedeBlurTimerRef.current) window.clearTimeout(sedeBlurTimerRef.current);
                      setSedeDropdownOpen(true);
                    }}
                    onBlur={() => {
                      if (sedeBlurTimerRef.current) window.clearTimeout(sedeBlurTimerRef.current);
                      sedeBlurTimerRef.current = window.setTimeout(() => setSedeDropdownOpen(false), 180);
                    }}
                    disabled={loadingSedes}
                    style={{ ...AP.field, flex: 1, marginTop: 0 }}
                  />
                  {sedeBusqueda.trim() || form.sedeId ? (
                    <button
                      type="button"
                      aria-label="Limpiar sede"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={limpiarSedeSeleccion}
                      style={{
                        width: 44,
                        minHeight: 44,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-page)',
                        color: 'var(--text-secondary)',
                        fontSize: 22,
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                {sedeDropdownOpen && step === 1 ? (
                  <div
                    role="listbox"
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '100%',
                      marginTop: 6,
                      zIndex: 50,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      maxHeight: SEDE_SUGGEST_MAX_VISIBLE_PX,
                      overflowY: 'auto',
                      boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                    }}
                  >
                    {loadingSedes ? (
                      <div style={{ padding: 14, fontSize: 14 }}>Cargando sedes…</div>
                    ) : sedesListaMostrada.length === 0 ? (
                      <div style={{ padding: 14, fontSize: 14, color: 'var(--text-secondary)' }}>
                        No hay sedes disponibles.
                      </div>
                    ) : (
                      sedesListaMostrada.map((s, idx) => {
                        const loc = [s.ciudad, s.pais].filter(Boolean).join(' · ');
                        const depLine = deportesOfrecidosResumen(s);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="option"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                sedeId: String(s.id),
                                cancha: '',
                                hora: '',
                                precioTurnoBase: null,
                              }));
                              setSedeBusqueda(String(s.nombre || '').trim());
                              setSedeDropdownOpen(false);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 12px',
                              border: 'none',
                              borderBottom: idx < sedesListaMostrada.length - 1 ? '1px solid var(--border)' : 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <span style={{ fontWeight: 800, display: 'block' }}>{s.nombre}</span>
                            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                              {loc || '—'} · {depLine}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>

              {sede ? (
                <>
                  {duracionesOfrecidas.length > 1 ? (
                    <>
                      <label style={{ ...AP.label, marginTop: 16 }}>Duración</label>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                          marginTop: 8,
                        }}
                      >
                        {duracionesOfrecidas.map((opt) => {
                          const d = opt.duracion_minutos;
                          const mon = sede?.moneda || 'ARS';
                          const labelPrecio =
                            opt.precio != null && Number.isFinite(Number(opt.precio))
                              ? `${mon} ${Number(opt.precio).toLocaleString('es-AR')}`
                              : null;
                          const label = labelPrecio ? `${d} min — ${labelPrecio}` : `${d} min`;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  duracion: d,
                                  precioTurnoBase: opt.precio != null ? Number(opt.precio) : null,
                                  hora: '',
                                }))
                              }
                              style={{
                                padding: '12px 16px',
                                borderRadius: 12,
                                border:
                                  Number(form.duracion) === d ? `2px solid ${ACCENT}` : '1px solid var(--border)',
                                background:
                                  Number(form.duracion) === d ? 'rgba(229, 57, 53, 0.12)' : 'var(--bg-page)',
                                fontWeight: 800,
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                fontSize: 13,
                                lineHeight: 1.25,
                                textAlign: 'left',
                                maxWidth: '100%',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p
                      style={{
                        ...AP.sub,
                        marginTop: 16,
                        marginBottom: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {(() => {
                        const only = duracionesOfrecidas[0];
                        const dm = only?.duracion_minutos ?? form.duracion;
                        const mon = sede?.moneda || 'ARS';
                        const pr =
                          only?.precio != null && Number.isFinite(Number(only.precio))
                            ? `${mon} ${Number(only.precio).toLocaleString('es-AR')}`
                            : null;
                        return pr ? `Duración: ${dm} minutos · precio base ${pr}` : `Duración: ${dm} minutos`;
                      })()}
                    </p>
                  )}

                  <label style={{ ...AP.label, marginTop: 16 }}>Día</label>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      overflowX: 'auto',
                      paddingBottom: 6,
                      marginTop: 8,
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    {diasReserva.map((iso, idx) => {
                      const active = form.fecha === iso;
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, fecha: iso, hora: '' }))}
                          style={{
                            flex: '0 0 auto',
                            minWidth: 88,
                            padding: '12px 14px',
                            borderRadius: 12,
                            border: active ? `2px solid ${ACCENT}` : '1px solid var(--border)',
                            background: active ? 'rgba(229, 57, 53, 0.12)' : 'var(--bg-page)',
                            color: 'var(--text-primary)',
                            fontWeight: 800,
                            fontSize: 13,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          {labelDiaCorta(iso, idx)}
                        </button>
                      );
                    })}
                  </div>

                  <label style={{ ...AP.label, marginTop: 16 }}>Horarios disponibles</label>
                  {slotsLoading ? (
                    <p style={{ ...AP.sub, marginTop: 8 }}>Cargando horarios…</p>
                  ) : slotsApi.length === 0 ? (
                    <p style={{ ...AP.sub, marginTop: 8 }}>
                      No hay turnos libres para esta fecha y duración. Probá otro día o duración.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      {slotsApi.map((s) => {
                        const h = s.hora_inicio || String(s.horario || '').split(' - ')[0];
                        const active = String(form.hora).split(' - ')[0].trim() === h;
                        return (
                          <button
                            key={`${h}-${s.hora_fin || ''}`}
                            type="button"
                            onClick={() => avanzarPaso2DesdeHorario(h)}
                            style={{
                              padding: '12px 8px',
                              borderRadius: 12,
                              border: active ? `2px solid ${ACCENT}` : '1px solid var(--border)',
                              background: active ? 'rgba(229, 57, 53, 0.12)' : 'var(--bg-page)',
                              fontWeight: 800,
                              fontSize: 14,
                              cursor: 'pointer',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!puedeVerCanchasPaso1}
                    onClick={irPaso2}
                    style={{
                      width: '100%',
                      marginTop: 18,
                      padding: 14,
                      border: 'none',
                      borderRadius: 12,
                      background: puedeVerCanchasPaso1 ? ACCENT : '#94a3b8',
                      color: '#fff',
                      fontWeight: 900,
                      fontSize: 16,
                      cursor: puedeVerCanchasPaso1 ? 'pointer' : 'not-allowed',
                      opacity: puedeVerCanchasPaso1 ? 1 : 0.9,
                    }}
                  >
                    Ver canchas →
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <>
              <h1 style={AP.title}>Canchas disponibles</h1>
              <p style={AP.body}>
                {sede?.nombre} · {form.fecha} · {String(form.hora).split(' - ')[0]} · {form.duracion} min
              </p>
              {dispLoading ? (
                <p style={AP.sub}>Consultando disponibilidad…</p>
              ) : dispCanchas.length === 0 ? (
                <p style={AP.sub}>No hay canchas para mostrar. Volvé al paso anterior.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  {dispCanchas.map((c) => {
                    const sel = Number(form.cancha) === Number(c.numero);
                    const ok = c.disponible;
                    return (
                      <button
                        key={c.numero}
                        type="button"
                        disabled={!ok}
                        onClick={() => ok && setForm((f) => ({ ...f, cancha: c.numero }))}
                        style={{
                          textAlign: 'left',
                          padding: 14,
                          borderRadius: 14,
                          border: sel ? `2px solid ${ACCENT}` : '1px solid var(--border)',
                          background: sel ? 'rgba(229, 57, 53, 0.1)' : 'var(--bg-page)',
                          opacity: ok ? 1 : 0.65,
                          cursor: ok ? 'pointer' : 'not-allowed',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: 16 }}>{c.nombre}</strong>
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: 8,
                            fontWeight: 900,
                            fontSize: 13,
                            color: ok ? '#16a34a' : '#dc2626',
                          }}
                        >
                          {ok ? 'Libre' : 'Ocupada'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                disabled={!canchaLibreSeleccionada}
                onClick={irPaso3}
                style={{
                  width: '100%',
                  marginTop: 18,
                  padding: 14,
                  border: 'none',
                  borderRadius: 12,
                  background: canchaLibreSeleccionada ? ACCENT : '#9ca3af',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 16,
                  cursor: canchaLibreSeleccionada ? 'pointer' : 'not-allowed',
                }}
              >
                Reservar {form.cancha ? sedeNombreCancha(form.cancha) : 'cancha'}
              </button>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h1 style={AP.title}>Confirmar y pagar</h1>
              <div
                style={{
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 14,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: 'var(--text-primary)',
                }}
              >
                <div>
                  <strong>Sede:</strong> {sede?.nombre}
                </div>
                <div>
                  <strong>Cancha:</strong> {sedeNombreCancha(form.cancha)}
                </div>
                <div>
                  <strong>Fecha:</strong> {form.fecha}
                </div>
                <div>
                  <strong>Hora:</strong> {String(form.hora).split(' - ')[0]}
                </div>
                <div>
                  <strong>Duración:</strong> {form.duracion} minutos
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />
                <div>
                  <strong>Precio del turno:</strong> {sede?.moneda || 'ARS'} {precioBase.toLocaleString('es-AR')}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.35 }}>
                  Cargo por servicio Padbol Match (3%): {sede?.moneda || 'ARS'}{' '}
                  {cargoPlataforma.toLocaleString('es-AR')}
                </div>
                <div style={{ marginTop: 8, fontWeight: 900, fontSize: 16 }}>
                  Total a pagar: {sede?.moneda || 'ARS'} {precioTotal.toLocaleString('es-AR')}
                </div>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  marginBottom: 16,
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                <input
                  type="checkbox"
                  checked={publicarPartido}
                  onChange={(e) => setPublicarPartido(e.target.checked)}
                />
                ¿Publicar este partido en «Buscar partido»?
              </label>
              <p style={{ ...AP.body, fontSize: 13, marginTop: -8 }}>
                Si lo activás, otros jugadores van a poder pedir unirse. Si no, solo queda tu reserva
                confirmada.
              </p>

              <button
                type="button"
                onClick={pagarYPublicar}
                disabled={paying}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 12,
                  padding: 14,
                  background: paying ? '#9ca3af' : `linear-gradient(135deg, ${ACCENT}, #b91c1c)`,
                  color: '#fff',
                  fontWeight: 900,
                  cursor: paying ? 'not-allowed' : 'pointer',
                }}
              >
                {paying ? 'Preparando pago…' : 'Ir a pagar'}
              </button>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h1 style={AP.title}>{publicado ? 'Partido publicado' : 'Reserva registrada'}</h1>
              <p style={AP.body}>
                {publicado
                  ? 'Tu reserva está confirmada y el partido ya está visible para que otros se sumen.'
                  : 'Tu reserva quedó registrada. Te vamos a contactar según la configuración de la sede.'}
              </p>
              {publicado ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <a
                    href={shareUrl()}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textAlign: 'center',
                      borderRadius: 12,
                      padding: 13,
                      background: '#22c55e',
                      color: '#fff',
                      fontWeight: 900,
                      textDecoration: 'none',
                    }}
                  >
                    Compartir por WhatsApp
                  </a>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => navigate('/partidos-abiertos')}
                style={{
                  marginTop: 12,
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 13,
                  background: 'var(--bg-page)',
                  color: 'var(--text-primary)',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Ir a buscar partido
              </button>
            </>
          ) : null}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
