import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { getDisplayName } from '../utils/displayName';
import { precioBaseTurnoDesdeSede, getDistanceKm } from '../utils/sedeCardUi';
import { precioDesdeFranjas } from '../utils/franjasHorarias';
import { hubContentPaddingTopCss, hubMainPaddingBottomCss } from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

const DURACIONES = [60, 90, 120];
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

function horaAMin(hora) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora || '').split(' - ')[0].trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function minAHora(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function duracionReserva(r) {
  const d = parseInt(String(r?.duracion_minutos ?? r?.duracion ?? ''), 10);
  return Number.isFinite(d) && d > 0 ? d : 90;
}

function slotSolapa(reserva, inicio, fin) {
  if (String(reserva?.estado || '').toLowerCase() === 'cancelada') return false;
  const ri = horaAMin(reserva?.hora);
  if (ri == null) return false;
  const rf = ri + duracionReserva(reserva);
  return inicio < rf && fin > ri;
}

function slotsDisponibles({ sede, reservas, cancha, duracion }) {
  if (!sede || !cancha) return [];
  const apertura = horaAMin(sede.horario_apertura || '08:00') ?? 8 * 60;
  const cierre = horaAMin(sede.horario_cierre || '23:00') ?? 23 * 60;
  const out = [];
  for (let t = apertura; t + duracion <= cierre; t += 30) {
    const fin = t + duracion;
    const mismo = (reservas || []).filter((r) => Number(r.cancha) === Number(cancha) && String(r.estado || '').toLowerCase() !== 'cancelada');
    if (mismo.some((r) => slotSolapa(r, t, fin))) continue;
    const ordenadas = mismo
      .map((r) => {
        const i = horaAMin(r.hora);
        return i == null ? null : { i, f: i + duracionReserva(r) };
      })
      .filter(Boolean)
      .sort((a, b) => a.i - b.i);
    const prev = [...ordenadas].reverse().find((r) => r.f <= t);
    const next = ordenadas.find((r) => r.i >= fin);
    if (prev && t - prev.f > 0 && t - prev.f < 60) continue;
    if (next && next.i - fin > 0 && next.i - fin < 60) continue;
    out.push(minAHora(t));
  }
  return out;
}

function shareUrl(partido) {
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

function canchaFormOk(canchaRaw) {
  const n = Number(String(canchaRaw ?? '').trim());
  return Number.isFinite(n) && n >= 1;
}

function horaFormOk(horaRaw) {
  return String(horaRaw ?? '').trim().length > 0;
}

function normalizeTextForSearch(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Si la sede tiene filas en canchas_por_deporte, exige el deporte; si no hay datos, no filtra (sedes legacy). */
function sedeTieneDeporteArmar(sede, deporteKey) {
  const rows = sede.canchas_por_deporte;
  if (!Array.isArray(rows) || rows.length === 0) return true;
  return rows.some(
    (r) =>
      r.activo !== false &&
      Number(r.cantidad) > 0 &&
      String(r.deporte || '').trim().toLowerCase() === deporteKey
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
        .filter(Boolean)
    ),
  ];
  if (!keys.length) return '—';
  return keys
    .map((k) => DEPORTES_CANCHA_SEDE_OPTIONS.find((o) => o.key === k)?.label || k)
    .join(', ');
}

const SEDE_SUGGEST_MAX_VISIBLE_PX = 312;

/** Estilos alineados al design system (var(--bg-page), --bg-card, --border, --text-*, --accent)). */
const AP = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: 18,
    boxShadow: '0 16px 34px rgba(0,0,0,0.14)',
  },
  title: { margin: '0 0 12px', color: 'var(--text-primary)' },
  body: { color: 'var(--text-secondary)', lineHeight: 1.55 },
  sub: { color: 'var(--text-secondary)', fontSize: 14 },
  errBanner: {
    background: 'rgba(225, 27, 34, 0.12)',
    color: 'var(--text-primary)',
    border: '1px solid var(--accent)',
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
  },
  selectMt: {
    width: '100%',
    marginTop: 6,
    padding: 12,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
  },
  label: { display: 'block', fontWeight: 800, color: 'var(--text-primary)' },
  deporteBtn: (active) => ({
    border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
    borderRadius: 14,
    padding: 13,
    background: active ? 'rgba(225, 27, 34, 0.14)' : 'var(--bg-page)',
    textAlign: 'left',
    fontWeight: 900,
    cursor: 'pointer',
    color: 'var(--text-primary)',
  }),
  gridBtn: (active) => ({
    border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
    background: active ? 'rgba(225, 27, 34, 0.14)' : 'var(--bg-page)',
    color: 'var(--text-primary)',
    fontWeight: 900,
    cursor: 'pointer',
  }),
  gridBtnSm: (active) => ({
    border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
    borderRadius: 12,
    padding: 10,
    background: active ? 'rgba(225, 27, 34, 0.14)' : 'var(--bg-page)',
    color: 'var(--text-primary)',
    fontWeight: 900,
    cursor: 'pointer',
  }),
  resumen: {
    background: 'var(--bg-page)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    color: 'var(--text-primary)',
    fontSize: 14,
  },
  navAtrás: {
    flex: 1,
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
    fontWeight: 900,
  },
  navSig: { flex: 1, border: 'none', borderRadius: 12, padding: 12, background: 'var(--accent)', color: '#fff', fontWeight: 900 },
  pay: (disabled) => ({
    width: '100%',
    border: 'none',
    borderRadius: 12,
    padding: 14,
    background: disabled ? 'var(--text-secondary)' : 'linear-gradient(135deg, var(--accent), #b91c1c)',
    color: '#fff',
    fontWeight: 900,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.75 : 1,
  }),
  linkSec: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 13,
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
    fontWeight: 900,
  },
};

export default function ArmarPartido() {
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [searchParams] = useSearchParams();
  const { session, userProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [sedes, setSedes] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loadingSedes, setLoadingSedes] = useState(true);
  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState('');
  const [publicado, setPublicado] = useState(null);
  const [form, setForm] = useState({
    deporte: 'padbol',
    jugadoresRequeridos: 4,
    sedeId: '',
    cancha: '',
    fecha: todayISO(),
    hora: '',
    duracion: 90,
    jugadoresConfirmados: 1,
    nivel: 'Intermedio',
  });

  const sedeBlurTimerRef = useRef(null);
  const [sedeBusqueda, setSedeBusqueda] = useState('');
  const [sedeDropdownOpen, setSedeDropdownOpen] = useState(false);
  const [userGeo, setUserGeo] = useState(null);
  const [geoStatus, setGeoStatus] = useState('pending');

  useEffect(() => {
    if (step !== 2) return;
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
    if (step !== 2) {
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
  const canchas = useMemo(() => {
    const n = Math.max(1, Number(sede?.cantidad_canchas || sede?.canchas_activas || 2) || 2);
    return Array.from({ length: n }, (_, idx) => idx + 1);
  }, [sede]);

  useEffect(() => {
    if (!sede?.nombre || !form.fecha) {
      setReservas([]);
      return;
    }
    fetch(`${API_BASE}/api/disponibilidad/${encodeURIComponent(sede.nombre)}/${encodeURIComponent(form.fecha)}`)
      .then((r) => r.json())
      .then((d) => setReservas(Array.isArray(d) ? d : []))
      .catch(() => setReservas([]));
  }, [sede?.nombre, form.fecha]);

  const slots = useMemo(
    () => slotsDisponibles({ sede, reservas, cancha: form.cancha, duracion: Number(form.duracion) }),
    [sede, reservas, form.cancha, form.duracion]
  );
  const precio = useMemo(() => {
    if (!sede) return 0;
    return Number(precioDesdeFranjas(sede, form.hora, form.fecha) ?? precioBaseTurnoDesdeSede(sede) ?? 0);
  }, [sede, form.hora, form.fecha]);

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

  const onSedeInputChange = (e) => {
    const v = e.target.value;
    setSedeBusqueda(v);
    const sel = findSedeById(sedes, form.sedeId);
    if (sel) {
      const nm = normalizeTextForSearch(String(sel.nombre || '').trim());
      if (nm !== normalizeTextForSearch(v)) {
        setForm((f) => ({ ...f, sedeId: '', cancha: '', hora: '' }));
      }
    }
    setSedeDropdownOpen(true);
  };

  const limpiarSedeSeleccion = () => {
    setSedeBusqueda('');
    setForm((f) => ({ ...f, sedeId: '', cancha: '', hora: '' }));
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
      };
      if (hasAny && f.sedeId) {
        const sRow = findSedeById(sedes, f.sedeId);
        if (sRow && !sedeTieneDeporteArmar(sRow, deporte)) {
          next.sedeId = '';
          next.cancha = '';
          next.hora = '';
        }
      }
      return next;
    });
  };

  const validarYAvanzar = () => {
    setMsg('');
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!String(form.sedeId || '').trim()) {
        setMsg('Selecciona una sede.');
        return;
      }
      if (!canchaFormOk(form.cancha)) {
        setMsg('Selecciona una cancha.');
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!String(form.fecha || '').trim()) {
        setMsg('Indica la fecha.');
        return;
      }
      if (slots.length === 0) {
        setMsg('No hay horarios disponibles para esta cancha y duración. Cambia cancha, duración o fecha.');
        return;
      }
      if (!horaFormOk(form.hora)) {
        setMsg('Selecciona un horario en la grilla.');
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
    }
  };

  const retrocederPaso = () => {
    setMsg('');
    setStep((s) => Math.max(1, s - 1));
  };

  const pagarYPublicar = async () => {
    if (!session?.user) {
      navigate('/login?redirect=/armar-partido');
      return;
    }
    const sedeActual = findSedeById(sedes, form.sedeId);
    const fechaOk = String(form.fecha || '').trim();
    const horaOk = horaFormOk(form.hora);
    const canchaOk = canchaFormOk(form.cancha);
    // TEMP: depurar validación paso 5 (quitar tras confirmar fix)
    console.log('[ArmarPartido pagarYPublicar] form + validación', {
      sedeId: form.sedeId,
      sedeNombreResuelta: sedeActual?.nombre ?? null,
      sedeIdResuelto: sedeActual?.id ?? null,
      cancha: form.cancha,
      canchaOk,
      fecha: form.fecha,
      fechaOk: Boolean(fechaOk),
      hora: form.hora,
      horaOk,
      sedesCount: Array.isArray(sedes) ? sedes.length : 0,
    });
    if (!sedeActual || !canchaOk || !fechaOk || !horaOk) {
      setMsg('Completa sede, cancha, fecha y horario.');
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
      share_token: shareToken,
      sede: sedeActual.nombre,
      sede_id: sedeActual.id,
      fecha: fechaOk,
      hora: String(form.hora).trim(),
      cancha: Number(form.cancha),
      nombre,
      email: session.user.email,
      whatsapp: userProfile?.whatsapp || userProfile?.telefono || '+540000000000',
      nivel: form.nivel,
      precio,
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
          precio,
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
        setStep(6);
        return;
      }
      throw new Error(data?.error || data?.message || 'No se pudo iniciar el pago');
    } catch (err) {
      setMsg(err.message || 'Error al publicar partido');
    } finally {
      setPaying(false);
    }
  };

  const stepStyle = (active) => ({
    borderRadius: 999,
    padding: '7px 10px',
    background: active ? 'var(--accent)' : 'var(--bg-card)',
    color: active ? '#fff' : 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 900,
    border: active ? 'none' : '1px solid var(--border)',
  });

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-page)', color: 'var(--text-primary)', paddingTop: hubContentPaddingTopCss(location.pathname, navDock), paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock), boxSizing: 'border-box' }}>
      <AppHeader title="Armar partido" />
      <main style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '18px 16px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {[1, 2, 3, 4, 5, 6].map((n) => <span key={n} style={stepStyle(step === n)}>Paso {n}</span>)}
        </div>
        <section style={AP.card}>
          {msg ? <div style={AP.errBanner}>{msg}</div> : null}

          {step === 1 ? (
            <>
              <h1 style={AP.title}>Elige deporte</h1>
              <div style={{ display: 'grid', gap: 10 }}>
                {DEPORTES.map((d) => (
                  <button key={d.id} type="button" onClick={() => setDeporte(d.id)} style={AP.deporteBtn(form.deporte === d.id)}>
                    {d.label} · {d.jugadores} jugadores
                  </button>
                ))}
              </div>
              {form.deporte === 'pickleball' ? (
                <label style={{ ...AP.label, marginTop: 12 }}>
                  Modalidad Pickleball
                  <select value={form.jugadoresRequeridos} onChange={(e) => setForm((f) => ({ ...f, jugadoresRequeridos: Number(e.target.value), jugadoresConfirmados: 1 }))} style={AP.selectMt}>
                    <option value={2}>Singles (2)</option>
                    <option value={4}>Dobles (4)</option>
                  </select>
                </label>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h1 style={AP.title}>Elige sede y cancha</h1>
              <label style={{ ...AP.label, marginBottom: 0 }} htmlFor="armar-partido-sede-busqueda">
                Sede
              </label>
              <p style={{ ...AP.sub, margin: '6px 0 0', fontSize: 12 }}>
                {sedeBusquedaNorm.length >= 2
                  ? 'Resultados según tu búsqueda.'
                  : geoStatus === 'granted'
                    ? 'Mostrando las 5 sedes más cercanas a tu ubicación.'
                    : 'Mostrando 5 sedes (orden alfabético). Activá la ubicación para ver las más cercanas.'}
              </p>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 'min(100%, calc(100vw - 32px))',
                  marginTop: 10,
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                  <input
                    id="armar-partido-sede-busqueda"
                    type="text"
                    role="combobox"
                    aria-expanded={sedeDropdownOpen}
                    aria-autocomplete="list"
                    autoComplete="off"
                    placeholder="Buscar sede o ciudad..."
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
                    style={{ ...AP.field, flex: 1, minWidth: 0, marginTop: 0 }}
                  />
                  {sedeBusqueda.trim() || form.sedeId ? (
                    <button
                      type="button"
                      aria-label="Limpiar sede"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={limpiarSedeSeleccion}
                      style={{
                        flexShrink: 0,
                        width: 44,
                        minHeight: 44,
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-page)',
                        color: 'var(--text-secondary)',
                        fontSize: 22,
                        lineHeight: 1,
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                {sedeDropdownOpen && step === 2 ? (
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
                      WebkitOverflowScrolling: 'touch',
                      boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                      boxSizing: 'border-box',
                    }}
                  >
                    {loadingSedes ? (
                      <div style={{ padding: 14, color: 'var(--text-secondary)', fontSize: 14 }}>Cargando sedes…</div>
                    ) : sedesListaMostrada.length === 0 ? (
                      <div style={{ padding: 14, color: 'var(--text-secondary)', fontSize: 14 }}>
                        {sedeBusquedaNorm.length >= 2 ? 'No hay sedes que coincidan.' : 'No hay sedes disponibles.'}
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
                            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.35 }}>
                              {loc || '—'} · {depLine}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                {canchas.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, cancha: c, hora: '' }))}
                    disabled={!sede}
                    style={{
                      ...AP.gridBtn(Number(form.cancha) === c),
                      opacity: sede ? 1 : 0.5,
                      cursor: sede ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Cancha {c}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h1 style={AP.title}>Fecha, hora y duración</h1>
              <input type="date" min={todayISO()} value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value, hora: '' }))} style={{ ...AP.field, marginBottom: 12 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                {DURACIONES.map((d) => (
                  <button key={d} type="button" onClick={() => setForm((f) => ({ ...f, duracion: d, hora: '' }))} style={AP.gridBtnSm(Number(form.duracion) === d)}>
                    {d} min
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {slots.length ? (
                  slots.map((h) => (
                    <button key={h} type="button" onClick={() => setForm((f) => ({ ...f, hora: h }))} style={AP.gridBtnSm(form.hora === h)}>
                      {h}
                    </button>
                  ))
                ) : (
                  <p style={{ gridColumn: '1/-1', color: 'var(--text-secondary)' }}>No hay horarios disponibles para esa cancha y duración.</p>
                )}
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h1 style={AP.title}>Jugadores confirmados</h1>
              <p style={AP.sub}>El partido necesita {form.jugadoresRequeridos} jugadores. Cuenta contigo y con quienes ya tienes confirmados.</p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 22,
                  marginTop: 14,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  aria-label="Quitar jugador confirmado"
                  disabled={form.jugadoresConfirmados <= 1}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      jugadoresConfirmados: Math.max(1, Number(f.jugadoresConfirmados) - 1),
                    }))
                  }
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: 28,
                    fontWeight: 700,
                    lineHeight: 1,
                    cursor: form.jugadoresConfirmados <= 1 ? 'not-allowed' : 'pointer',
                    opacity: form.jugadoresConfirmados <= 1 ? 0.42 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(225, 27, 34, 0.35)',
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    minWidth: 52,
                    textAlign: 'center',
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                  }}
                  aria-live="polite"
                >
                  {form.jugadoresConfirmados}
                </span>
                <button
                  type="button"
                  aria-label="Agregar jugador confirmado"
                  disabled={form.jugadoresConfirmados >= form.jugadoresRequeridos}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      jugadoresConfirmados: Math.min(
                        Number(f.jugadoresRequeridos),
                        Number(f.jugadoresConfirmados) + 1,
                      ),
                    }))
                  }
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: 28,
                    fontWeight: 700,
                    lineHeight: 1,
                    cursor: form.jugadoresConfirmados >= form.jugadoresRequeridos ? 'not-allowed' : 'pointer',
                    opacity: form.jugadoresConfirmados >= form.jugadoresRequeridos ? 0.42 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(225, 27, 34, 0.35)',
                  }}
                >
                  +
                </button>
              </div>
              <p
                style={{
                  margin: '16px 0 0',
                  fontWeight: 900,
                  fontSize: 16,
                  textAlign: 'center',
                  color:
                    Math.max(0, form.jugadoresRequeridos - form.jugadoresConfirmados) === 0
                      ? 'var(--accent)'
                      : 'var(--pm-color-primary)',
                }}
              >
                {Math.max(0, form.jugadoresRequeridos - form.jugadoresConfirmados) === 0
                  ? '¡Equipo completo!'
                  : `Faltan ${Math.max(0, form.jugadoresRequeridos - form.jugadoresConfirmados)} jugadores`}
              </p>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <h1 style={AP.title}>Pagar y publicar</h1>
              <p style={AP.body}>Al pagar la reserva, el partido queda publicado automáticamente como abierto y vas a poder compartirlo por WhatsApp.</p>
              <div style={AP.resumen}>
                {sede?.nombre} · Cancha {form.cancha} · {form.fecha}
                {horaFormOk(form.hora) ? ` · ${String(form.hora).trim()}` : ' · (sin horario)'} · {form.duracion} min<br />
                Total reserva: <strong>{sede?.moneda || 'ARS'} {precio}</strong>
              </div>
              <button type="button" onClick={pagarYPublicar} disabled={paying} style={AP.pay(paying)}>
                {paying ? 'Preparando pago...' : 'Pagar reserva y publicar'}
              </button>
            </>
          ) : null}

          {step === 6 ? (
            <>
              <h1 style={AP.title}>Partido publicado</h1>
              <p style={AP.body}>Tu partido ya aparece para que otros se unan.</p>
              <div style={{ display: 'grid', gap: 10 }}>
                <a href={shareUrl(publicado)} target="_blank" rel="noreferrer" style={{ textAlign: 'center', borderRadius: 12, padding: 13, background: 'var(--pm-color-primary)', color: '#fff', fontWeight: 900, textDecoration: 'none' }}>Compartir por WhatsApp</a>
                <button type="button" onClick={() => navigate('/partidos-abiertos')} style={AP.linkSec}>Ver cupos para unirte</button>
              </div>
            </>
          ) : null}

          {step < 5 ? (
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={retrocederPaso} disabled={step === 1} style={{ ...AP.navAtrás, opacity: step === 1 ? 0.45 : 1 }}>Atrás</button>
              <button type="button" onClick={validarYAvanzar} style={AP.navSig}>Siguiente</button>
            </div>
          ) : null}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
