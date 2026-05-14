import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, createSearchParams } from 'react-router-dom';
import '../styles/ReservaForm.css';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import AppHeader from '../components/AppHeader';
import ReservaCalendarioMes from '../components/ReservaCalendarioMes';
import BottomNav from '../components/BottomNav';
import ConfirmCancelReservaModal from '../components/ConfirmCancelReservaModal';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  RESERVA_FORM_RESTORE_KEY,
  RESERVA_FORM_RESTORE_VERSION,
  saveReservaFormSessionState,
  saveReservaReturnUrl,
  saveMpReservaPendingSlot,
  clearMpReservaPendingSlot,
  clearReservaFlowSessionStorage,
  clearReservaReturnLocalStorage,
} from '../utils/reservaReturnUrl';
import { authLoginRedirectPath, authUrlWithRedirect } from '../utils/authLoginRedirect';
import { getDisplayName } from '../utils/displayName';
import {
  ciudadPaisConBandera,
  getDistanceKm,
  horarioDisponibleTexto,
  precioBaseTurnoDesdeSede,
  precioDesdeCard,
  primeraFotoSede,
} from '../utils/sedeCardUi';
import { precioDesdeFranjas, nombreFranjaActiva, textoLineaTarifasReserva } from '../utils/franjasHorarias';
import { ymdHoyParaReservaSede, slotStartMsParaReservaSede } from '../utils/reservaTimezone';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { IconGeroUbicacion } from '../components/icons/GeroIcons';
import SuccessPaymentHeroCheck from '../components/SuccessPaymentHeroCheck';

// Returns the correct price for a given sede + time slot.
// Base desde `sedes` (precio_turno en Supabase, luego legacy precio_por_reserva); luego franjas o mañana/tarde.
function getPrecio(sede, hora, fecha) {
  const base = precioBaseTurnoDesdeSede(sede);
  if (!hora || !sede) return base;
  const desdeFranjas = precioDesdeFranjas(sede, hora, fecha);
  if (desdeFranjas != null) return desdeFranjas;
  const h = parseInt(hora.split(':')[0], 10);
  return h < 16
    ? Number(sede.precio_manana || base)
    : Number(sede.precio_tarde  || base);
}

/** Texto visible en el selector de país; el `value` sigue siendo el string exacto de la sede. */
function etiquetaPaisReservaSelector(paisRaw) {
  const p = String(paisRaw || '').trim();
  if (!p) return '';
  const sinEmojiInicial = p.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();
  const baseNombre = sinEmojiInicial || p;
  const lc = baseNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const compact = lc.replace(/\s+/g, '');
  if (lc === 'argentina' || lc.startsWith('argentina ')) return /^🇦🇷/.test(p) ? p : `🇦🇷 ${baseNombre}`;
  if (lc === 'españa' || lc === 'espana' || lc.startsWith('españa ') || lc.startsWith('espana ')) {
    return /^🇪🇸/.test(p) ? p : `🇪🇸 ${baseNombre}`;
  }
  if (
    compact.includes('estadosunidos') ||
    lc.includes('estados unidos') ||
    lc === 'usa' ||
    compact === 'eeuu' ||
    lc.startsWith('ee. uu')
  ) {
    return /^🇺🇸/.test(p) ? p : `🇺🇸 ${baseNombre}`;
  }
  return p;
}

function primerTelefonoCliente(c) {
  if (!c) return '';
  return String(c.whatsapp || c.telefono || '').trim();
}

function clienteTieneTelefonoGuardado(c) {
  return Boolean(primerTelefonoCliente(c));
}

/** Mínimo de dígitos (sin contar +) para considerar un teléfono válido al confirmar pago */
const MIN_DIGITOS_TELEFONO = 8;
const RESERVA_DURACIONES_MIN = [60, 90, 120];
const SLOT_STEP_MIN = 30;

/** Perfil con teléfono/WhatsApp con cantidad de dígitos suficiente (no se re-evalúa en cada tecla del resumen). */
function perfilTelefonoValido(c) {
  const raw = primerTelefonoCliente(c);
  if (!raw) return false;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= MIN_DIGITOS_TELEFONO;
}

function telefonoPagoResuelto(currentCliente, formData) {
  const desdePerfil = primerTelefonoCliente(currentCliente).replace(/[\s\-().]/g, '');
  const ingresado = `${formData.codigoPais}${formData.numeroTel.replace(/[\s\-().]/g, '')}`;
  const whatsappCompleto = formData.numeroTel.trim() ? ingresado : desdePerfil;
  const digits = String(whatsappCompleto).replace(/\D/g, '');
  if (digits.length < MIN_DIGITOS_TELEFONO) {
    return { ok: false, whatsappCompleto: '', digits: 0 };
  }
  return { ok: true, whatsappCompleto, digits };
}

function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fechaMaxReservaISO() {
  const d = new Date();
  d.setDate(d.getDate() + 365);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function minutosDesdeHoraReserva(horaRaw) {
  const t = String(horaRaw || '').split(' - ')[0].trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function horaDesdeMinutosReserva(totalMin) {
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function duracionReservaSeleccionada(formData) {
  const d = parseInt(String(formData?.duracion || ''), 10);
  return RESERVA_DURACIONES_MIN.includes(d) ? d : 90;
}

function reservaBloqueaDisponibilidad(reserva) {
  const estado = String(reserva?.estado || '').trim().toLowerCase();
  return estado !== 'cancelada';
}

function duracionReservaExistenteMin(reserva) {
  const d = parseInt(String(reserva?.duracion_minutos ?? reserva?.duracion ?? ''), 10);
  return Number.isFinite(d) && d > 0 ? d : 90;
}

function reservaSolapaIntervalo(reserva, inicioMin, finMin) {
  const inicioReserva = minutosDesdeHoraReserva(reserva?.hora);
  if (inicioReserva == null) return false;
  const finReserva = inicioReserva + duracionReservaExistenteMin(reserva);
  return inicioMin < finReserva && finMin > inicioReserva;
}

/** Intento “reservar desde la sede más cercana por geo” (pantalla 1 → perfil → /reservar?sedeId=). */
const RESERVA_GEO_MAS_CERCANA_SESSION_KEY = 'reserva_geo_mas_cercana_sede_v1';
const RESERVA_GEO_MAS_CERCANA_MAX_MS = 30 * 60 * 1000;

/** Evita que Strict Mode quite la etiqueta al consumir sessionStorage dos veces. */
let reservaGeoMasCercanaAppliedStableKey = '';

function writeReservaGeoMasCercanaIntent(sedeId, pais) {
  try {
    sessionStorage.setItem(
      RESERVA_GEO_MAS_CERCANA_SESSION_KEY,
      JSON.stringify({
        sedeId: Number(sedeId),
        pais: String(pais || '').trim(),
        ts: Date.now(),
      })
    );
  } catch {
    /* ignore */
  }
}

function clearReservaGeoMasCercanaIntent() {
  try {
    sessionStorage.removeItem(RESERVA_GEO_MAS_CERCANA_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function peekReservaGeoMasCercanaIntent() {
  try {
    const raw = sessionStorage.getItem(RESERVA_GEO_MAS_CERCANA_SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o == null || o.sedeId == null || o.pais == null) return null;
    const ts = Number(o.ts) || 0;
    if (Date.now() - ts > RESERVA_GEO_MAS_CERCANA_MAX_MS) {
      sessionStorage.removeItem(RESERVA_GEO_MAS_CERCANA_SESSION_KEY);
      return null;
    }
    return { sedeId: Number(o.sedeId), pais: String(o.pais || '').trim(), ts };
  } catch {
    try {
      sessionStorage.removeItem(RESERVA_GEO_MAS_CERCANA_SESSION_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function tryConsumeReservaGeoMasCercanaIntent(sedeId, paisSede) {
  const intent = peekReservaGeoMasCercanaIntent();
  if (!intent) return false;
  const p = String(paisSede || '').trim();
  if (Number(intent.sedeId) !== Number(sedeId) || intent.pais !== p) {
    clearReservaGeoMasCercanaIntent();
    return false;
  }
  clearReservaGeoMasCercanaIntent();
  return true;
}

/** Pantalla 2 solo si `?sedeId=` está en la URL. `ultima_sede` en localStorage no abre el calendario directo (siempre elegir sede / perfil primero). */
function readPrimedSedeReserva() {
  const emptyFiltros = { pais: '', ciudad: '', sede_id: '' };
  if (typeof window === 'undefined') return { pantalla: 1, filtros: emptyFiltros };
  try {
    const params = new URLSearchParams(window.location.search);
    const sedeIdFromUrl = params.get('sedeId')?.trim() || null;
    if (!sedeIdFromUrl) {
      return { pantalla: 1, filtros: emptyFiltros };
    }
    const id = parseInt(String(sedeIdFromUrl), 10);
    if (Number.isNaN(id)) return { pantalla: 1, filtros: emptyFiltros };
    return { pantalla: 2, filtros: { ...emptyFiltros, sede_id: id } };
  } catch {
    return { pantalla: 1, filtros: emptyFiltros };
  }
}

/** Una sola base para todas las llamadas API (local: mismo origen que Rankings; override con REACT_APP_API_BASE_URL). */
const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/** Monedas sin decimales en Stripe (unidad mínima = unidad principal). */
const STRIPE_ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

function amountMainToStripeMinor(amountMain, currency) {
  const cur = String(currency || 'ars').toLowerCase();
  const n = Number(amountMain);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (STRIPE_ZERO_DECIMAL.has(cur)) return Math.round(n);
  return Math.round(n * 100);
}

function stripeMinorToMain(minor, currency) {
  const cur = String(currency || 'ars').toLowerCase();
  const m = Number(minor);
  if (!Number.isFinite(m)) return 0;
  if (STRIPE_ZERO_DECIMAL.has(cur)) return m;
  return m / 100;
}

function formatMoneyMain(amountMain, currencyCode) {
  const c = String(currencyCode || 'ARS').toUpperCase();
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: c,
      maximumFractionDigits: STRIPE_ZERO_DECIMAL.has(c.toLowerCase()) ? 0 : 2,
    }).format(amountMain);
  } catch {
    return `${Number(amountMain).toLocaleString('es-AR')} ${c}`;
  }
}

const STRIPE_PUBLISHABLE_KEY =
  typeof process !== 'undefined' && process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
    ? String(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY).trim()
    : '';

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

function ReservaStripePayInner({ clientSecret, onPaid, onFatal }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState('');

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setMsg('');
    setPaying(true);
    try {
      const { error: submitErr } = await elements.submit();
      if (submitErr) {
        setMsg(submitErr.message || 'Revisa los datos de la tarjeta');
        return;
      }
      const { error: payErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: typeof window !== 'undefined' ? `${window.location.origin}/reservar` : undefined,
        },
        redirect: 'if_required',
      });
      if (payErr) {
        setMsg(payErr.message || 'No se pudo procesar el pago');
        return;
      }
      if (paymentIntent?.status !== 'succeeded') {
        setMsg('El pago no se completó.');
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        setMsg('Sesión expirada. Inicia sesión de nuevo.');
        return;
      }
      const res = await fetch(apiUrl('/api/stripe/confirmar-pago'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payment_intent_id: paymentIntent.id }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error || 'El pago se acreditó pero no se pudo registrar la reserva. Contacta a la sede.');
        return;
      }
      onPaid(j);
    } catch (e) {
      setMsg(e.message || String(e));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <PaymentElement />
      {msg ? (
        <div className="error-message" style={{ marginTop: '12px' }}>
          {msg}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handlePay}
        disabled={paying || !stripe}
        style={{
          width: '100%',
          marginTop: '16px',
          padding: '14px',
          background: paying || !stripe ? '#aaa' : 'linear-gradient(135deg, #635bff 0%, #0a2540 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: paying || !stripe ? 'not-allowed' : 'pointer',
          boxShadow: '0 3px 12px rgba(99,91,255,0.35)',
        }}
      >
        {paying ? 'Procesando…' : 'Pagar ahora'}
      </button>
    </div>
  );
}

function ReservaStripeSection({
  sedeId,
  moneda,
  montoBaseMinor,
  descripcion,
  payload,
  disabledPrepare,
  onPaid,
}) {
  const [clientSecret, setClientSecret] = useState(null);
  const [prepErr, setPrepErr] = useState('');
  const [preparing, setPreparing] = useState(false);

  const prepare = useCallback(async () => {
    setPrepErr('');
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) {
      setPrepErr('Inicia sesión para pagar.');
      return;
    }
    setPreparing(true);
    try {
      const res = await fetch(apiUrl('/api/stripe/crear-payment-intent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sede_id: sedeId,
          monto_base: montoBaseMinor,
          moneda: String(moneda || 'ars').toLowerCase(),
          tipo: 'reserva',
          descripcion,
          payload,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'No se pudo iniciar el pago');
      if (!j.client_secret) throw new Error('Respuesta inválida del servidor');
      setClientSecret(j.client_secret);
    } catch (e) {
      setPrepErr(e.message || String(e));
    } finally {
      setPreparing(false);
    }
  }, [sedeId, montoBaseMinor, moneda, descripcion, payload]);

  if (!stripePromise) {
    return (
      <div className="error-message" role="alert">
        Falta configurar <code>REACT_APP_STRIPE_PUBLISHABLE_KEY</code> para pagos con tarjeta.
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div>
        {prepErr ? (
          <div className="error-message" style={{ marginBottom: '12px' }}>
            {prepErr}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void prepare()}
          disabled={preparing || disabledPrepare}
          style={{
            width: '100%',
            padding: '14px',
            background: preparing || disabledPrepare ? '#aaa' : 'linear-gradient(135deg, #635bff 0%, #0a2540 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: preparing || disabledPrepare ? 'not-allowed' : 'pointer',
            boxShadow: '0 3px 12px rgba(99,91,255,0.35)',
          }}
        >
          {preparing ? 'Preparando…' : 'Continuar al pago con tarjeta'}
        </button>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, locale: 'es' }}
    >
      <ReservaStripePayInner
        clientSecret={clientSecret}
        onPaid={onPaid}
      />
    </Elements>
  );
}

/** Solo se ofrecen / muestran las primeras 2 canchas en el flujo de reserva. */
const MAX_CANCHAS_RESERVA_UI = 2;

const RESERVA_CANCHA_DEPORTES = new Set(['padbol', 'padel', 'tenis', 'pickleball', 'squash', 'futbol_5', 'futbol_7']);

function normalizeReservaDeporteUrl(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || !RESERVA_CANCHA_DEPORTES.has(s)) return null;
  return s;
}

function reservaSedeApiQuery(deporteCanon) {
  return deporteCanon ? `?deporte=${encodeURIComponent(deporteCanon)}` : '';
}

/** Prioriza `canchas_activas` del GET /api/sedes/:id; si no hay catálogo, usa cantidad_canchas. Opcional: filtrar por ?deporte=. */
function slotsReservaDesdeSede(sedeData, deporteCanon) {
  const active = sedeData?.canchas_activas;
  if (Array.isArray(active) && active.length > 0) {
    let sorted = [...active].sort((a, b) => Number(a.numero) - Number(b.numero));
    if (deporteCanon && RESERVA_CANCHA_DEPORTES.has(deporteCanon)) {
      sorted = sorted.filter((x) => {
        const d = String(x.deporte || 'padbol').trim().toLowerCase();
        return d === deporteCanon;
      });
    }
    return sorted.slice(0, MAX_CANCHAS_RESERVA_UI).map((x) => ({
      numero: Number(x.numero),
      nombre: String(x.nombre || '').trim() || `Cancha ${x.numero}`,
    }));
  }
  if (deporteCanon) {
    return [];
  }
  const total = Math.max(1, Number(sedeData?.cantidad_canchas) || 2);
  const n = Math.min(total, MAX_CANCHAS_RESERVA_UI);
  return Array.from({ length: n }, (_, i) => ({
    numero: i + 1,
    nombre: `Cancha ${i + 1}`,
  }));
}

export default function ReservaForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const reservaPaddingTopCss = hubContentPaddingTopCss(location.pathname);
  const { session, loading: authLoading, userProfile } = useAuth();

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return {
      email: em,
      nombre: getDisplayName(userProfile, session),
      whatsapp: String(userProfile?.whatsapp || '').trim(),
      telefono: String(userProfile?.whatsapp || '').trim(),
    };
  }, [session, userProfile]);
  const [searchParams] = useSearchParams();

  const initialSedeId = searchParams.get('sedeId');
  const reservaDeporteUrl = useMemo(
    () => normalizeReservaDeporteUrl(searchParams.get('deporte')),
    [searchParams],
  );

  const [sedes, setSedes] = useState([]);
  const [sedesLoadError, setSedesLoadError] = useState('');
  const [ciudades, setCiudades] = useState([]);

  const [filtros, setFiltros] = useState(() => readPrimedSedeReserva().filtros);
  const [pantalla, setPantalla] = useState(() => readPrimedSedeReserva().pantalla);
  const [reservaStripeExitoOpen, setReservaStripeExitoOpen] = useState(false);

  const [formData, setFormData] = useState(() => {
    const p = readPrimedSedeReserva();
    return {
      fecha: p.pantalla === 2 ? todayLocalISO() : '',
      hora: '',
      cancha: '',
      duracion: '90',
      codigoPais: '+54',
      numeroTel: '',
    };
  });

  /** Al cambiar de paso o volver atrás, el scroll del documento puede dejar el bloque bajo el header fijo. */
  useLayoutEffect(() => {
    const base = String(location.pathname || '').split('?')[0].split('#')[0];
    if (base !== '/reservar' && !base.startsWith('/reservar/')) return;
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [pantalla, location.pathname]);

  const sedeSeleccionada = useMemo(() => {
    if (!Array.isArray(sedes) || sedes.length === 0 || filtros.sede_id === '' || filtros.sede_id == null) {
      return null;
    }
    return sedes.find((s) => Number(s.id) === Number(filtros.sede_id)) || null;
  }, [sedes, filtros.sede_id]);

  /** Geolocalización solo en pantalla de elección de sede (p. ej. etiqueta “más cercana”). */
  const [geoReserva, setGeoReserva] = useState({ status: 'idle', pos: null });

  useEffect(() => {
    if (pantalla !== 1) {
      setGeoReserva({ status: 'idle', pos: null });
      return;
    }
    setGeoReserva({ status: 'pending', pos: null });
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoReserva({ status: 'denied', pos: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeoReserva({
          status: 'granted',
          pos: { lat: pos.coords.latitude, lon: pos.coords.longitude },
        }),
      () => setGeoReserva({ status: 'denied', pos: null }),
      { timeout: 8000, maximumAge: 600000 }
    );
  }, [pantalla]);

  /** Refrescar la sede desde la API al reservar/pagar para usar precio_turno y tarifas actualizados en Supabase. */
  useEffect(() => {
    const rawId = filtros.sede_id;
    if (rawId === '' || rawId == null) return;
    if (pantalla !== 2 && pantalla !== 4) return;
    let cancelled = false;
    fetch(apiUrl(`/api/sedes/${encodeURIComponent(String(rawId))}${reservaSedeApiQuery(reservaDeporteUrl)}`))
      .then(async (res) => {
        const text = await res.text();
        if (cancelled) return;
        if (!res.ok) return;
        let sedeFresh;
        try {
          sedeFresh = JSON.parse(text);
        } catch {
          return;
        }
        if (!sedeFresh || typeof sedeFresh !== 'object') return;
        setSedes((prev) => {
          if (!Array.isArray(prev)) return prev;
          const nid = Number(rawId);
          const idx = prev.findIndex((s) => Number(s.id) === nid);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...sedeFresh };
            return next;
          }
          return [...prev, sedeFresh];
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filtros.sede_id, pantalla, reservaDeporteUrl]);

  const [mostrarEtiquetaSedeMasCercanaGeo, setMostrarEtiquetaSedeMasCercanaGeo] = useState(false);

  const sedesFiltradasPorPais = useMemo(() => {
    if (!filtros.pais) return [];
    return sedes.filter((sede) => String(sede.pais || '').trim() === String(filtros.pais).trim());
  }, [sedes, filtros.pais]);

  const sedeReservaMasCercanaId = useMemo(() => {
    if (geoReserva.status !== 'granted' || !geoReserva.pos || sedesFiltradasPorPais.length === 0) return null;
    const { lat, lon } = geoReserva.pos;
    let bestId = null;
    let bestKm = Infinity;
    for (const s of sedesFiltradasPorPais) {
      const d = getDistanceKm(lat, lon, s.latitud, s.longitud);
      if (Number.isFinite(d) && d < bestKm) {
        bestKm = d;
        bestId = s.id;
      }
    }
    return bestId;
  }, [geoReserva, sedesFiltradasPorPais]);

  useEffect(() => {
    if (pantalla !== 2 || !sedeSeleccionada) {
      if (pantalla !== 2) {
        reservaGeoMasCercanaAppliedStableKey = '';
        setMostrarEtiquetaSedeMasCercanaGeo(false);
      }
      return;
    }
    const sid = Number(sedeSeleccionada.id);
    const p = String(sedeSeleccionada.pais || '').trim();
    const stableKey = `${sid}|${p}`;
    if (tryConsumeReservaGeoMasCercanaIntent(sid, p)) {
      reservaGeoMasCercanaAppliedStableKey = stableKey;
      setMostrarEtiquetaSedeMasCercanaGeo(true);
      return;
    }
    if (reservaGeoMasCercanaAppliedStableKey === stableKey) {
      return;
    }
    setMostrarEtiquetaSedeMasCercanaGeo(false);
  }, [pantalla, sedeSeleccionada]);

  const paisesOrdenados = useMemo(
    () => [...new Set(sedes.map((s) => String(s.pais || '').trim()).filter(Boolean))].sort(),
    [sedes]
  );

  // Pre-fill phone from profile (whatsapp o teléfono) — split código país + local
  useEffect(() => {
    const raw = primerTelefonoCliente(currentCliente);
    if (!raw) return;
    const allPaises = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];
    const sorted = [...allPaises].sort((a, b) => b.codigo.length - a.codigo.length);
    const match = sorted.find(p => raw.startsWith(p.codigo));
    if (match) {
      setFormData(prev => ({ ...prev, codigoPais: match.codigo, numeroTel: raw.slice(match.codigo.length) }));
    } else {
      setFormData(prev => ({ ...prev, numeroTel: raw }));
    }
  }, [currentCliente]); // eslint-disable-line react-hooks/exhaustive-deps

  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [canchasDisponibles, setCanchasDisponibles] = useState([]);
  const [loading, setLoading] = useState(false);
  /** Evita el mensaje "No hay horarios…" un frame antes del fetch (y solo tras una consulta terminada para sede+fecha actuales). */
  const [horariosUltimaConsulta, setHorariosUltimaConsulta] = useState({ sedeId: '', fecha: '' });
  const [error, setError] = useState('');
  const [mpLoading, setMpLoading] = useState(false);
  const [cancelReservaDesdeResumenOpen, setCancelReservaDesdeResumenOpen] = useState(false);
  const duracionSeleccionadaMin = duracionReservaSeleccionada(formData);

  const irAModificarReservaDesdeResumen = useCallback(() => {
    setPantalla(2);
    setError('');
    const sid = filtros.sede_id !== '' && filtros.sede_id != null ? String(filtros.sede_id) : '';
    if (sid && formData.fecha) {
      const p = { sedeId: sid, fecha: formData.fecha };
      if (formData.hora) p.hora = formData.hora;
      if (formData.cancha != null && String(formData.cancha).trim() !== '') p.canchaId = String(formData.cancha);
      if (reservaDeporteUrl) p.deporte = reservaDeporteUrl;
      navigate({ pathname: '/reservar', search: `?${createSearchParams(p).toString()}` }, { replace: true });
    }
  }, [filtros.sede_id, formData.fecha, formData.hora, formData.cancha, reservaDeporteUrl, navigate]);

  const handleCancelarReservaDesdeResumen = useCallback(async () => {
    try {
      if (sedeSeleccionada && formData.fecha && formData.hora && formData.cancha != null) {
        const body = {
          sede: sedeSeleccionada.nombre,
          fecha: formData.fecha,
          hora: formData.hora,
          cancha: parseInt(String(formData.cancha), 10),
        };
        if (session?.user?.email) body.email = String(session.user.email).trim().toLowerCase();
        await fetch(apiUrl('/api/reservas/liberar-slot-pendiente'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
    } catch {
      /* liberar es best-effort */
    }
    clearReservaFlowSessionStorage();
    clearReservaReturnLocalStorage();
    clearMpReservaPendingSlot();
    const sidRaw = filtros.sede_id !== '' && filtros.sede_id != null ? Number(filtros.sede_id) : null;
    if (session?.user) navigate('/hub', { replace: true });
    else if (sidRaw) navigate(`/sede/${sidRaw}`, { replace: true });
    else navigate('/reservar', { replace: true });
  }, [sedeSeleccionada, formData.fecha, formData.hora, formData.cancha, filtros.sede_id, session?.user, navigate]);

  const handleReservaBack = useCallback(() => {
    if (pantalla === 1) {
      navigate('/', { replace: true });
      return;
    }
    if (pantalla === 4) {
      irAModificarReservaDesdeResumen();
      return;
    }
    const sid = filtros.sede_id !== '' && filtros.sede_id != null ? Number(filtros.sede_id) : null;
    if (sid) navigate(`/sede/${sid}`);
    else window.history.back();
  }, [pantalla, filtros.sede_id, navigate, irAModificarReservaDesdeResumen]);
  /** Número local en pantalla resumen — controlado aparte de formData para no re-disparar efectos al escribir */
  const [whatsapp, setWhatsapp] = useState('');
  const canchasBloqueRef = useRef(null);
  /** Evita re-aplicar el deep link `?sedeId=…` cuando solo cambia la referencia de `sedes` (p. ej. refresh GET /api/sedes/:id). */
  const reservaUrlBootstrapKeyRef = useRef('');
  /**
   * URL con sede+fecha+hora pero sin cancha (p. ej. chips del chat): no saltar a pago aunque solo haya una cancha libre;
   * el usuario debe tocar "Elige tu cancha" igual que en el flujo manual.
   */
  const reservaOmitirAutoCanchaUnicaRef = useRef(false);

  useEffect(() => {
    if (pantalla !== 4) return;
    setWhatsapp(formData.numeroTel || '');
  }, [pantalla]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select + auto-advance cuando solo hay una cancha libre (tras elegir horario)
  useEffect(() => {
    if (reservaOmitirAutoCanchaUnicaRef.current) return;
    if (pantalla !== 2 || !formData.hora || !canchasDisponibles.length) return;
    const libres = canchasDisponibles.filter((c) => c.libre);
    if (libres.length === 1) {
      setFormData((prev) => ({ ...prev, cancha: String(libres[0].num) }));
      setPantalla(4);
      setError('');
    }
  }, [canchasDisponibles, pantalla, formData.hora]);

  useEffect(() => {
    let cancelled = false;
    setSedesLoadError('');
    fetch(apiUrl('/api/sedes'))
      .then(async (res) => {
        const text = await res.text();
        if (cancelled) return;
        if (!res.ok) {
          setSedes([]);
          setSedesLoadError('No se pudieron cargar las sedes.');
          return;
        }
        try {
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : [];
          setSedes(arr);
        } catch {
          setSedes([]);
          setSedesLoadError('Respuesta inválida al cargar sedes.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSedes([]);
          setSedesLoadError('Error de red al cargar sedes.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Completar país/ciudad cuando hay ?sedeId= en la URL (no usar ultima_sede para saltar la selección).
  useEffect(() => {
    if (sedes.length === 0) return;

    const sedeIdFromUrl =
      initialSedeId && String(initialSedeId).trim() ? String(initialSedeId).trim() : null;
    if (!sedeIdFromUrl) {
      reservaUrlBootstrapKeyRef.current = '';
      reservaOmitirAutoCanchaUnicaRef.current = false;
      return;
    }

    const id = parseInt(String(sedeIdFromUrl), 10);
    if (Number.isNaN(id)) return;

    const sede = sedes.find((s) => Number(s.id) === id);
    if (!sede) {
      reservaUrlBootstrapKeyRef.current = '';
      reservaOmitirAutoCanchaUnicaRef.current = false;
      clearReservaGeoMasCercanaIntent();
      setFiltros({ pais: '', ciudad: '', sede_id: '' });
      setPantalla(1);
      navigate('/reservar', { replace: true });
      return;
    }

    const urlBootstrapKey = `${String(id)}|${location.search}`;
    if (reservaUrlBootstrapKeyRef.current === urlBootstrapKey) return;

    const sp = new URLSearchParams(location.search);
    const fechaQ = (sp.get('fecha') || '').trim();
    const horaQ = (sp.get('hora') || '').trim();
    const canchaQ = (sp.get('canchaId') || sp.get('cancha') || '').trim();
    const depPreserve = normalizeReservaDeporteUrl(sp.get('deporte'));

    const ciudadesDelPais = [...new Set(sedes.filter((s) => s.pais === sede.pais).map((s) => s.ciudad))].sort();
    setCiudades(ciudadesDelPais);
    setFiltros({ pais: sede.pais, ciudad: sede.ciudad, sede_id: Number(sede.id) });

    if (fechaQ && horaQ && canchaQ) {
      reservaOmitirAutoCanchaUnicaRef.current = false;
      setFormData((prev) => ({
        ...prev,
        fecha: fechaQ,
        hora: horaQ,
        cancha: canchaQ,
      }));
      setPantalla(4);
      const next = createSearchParams({
        sedeId: String(id),
        fecha: fechaQ,
        hora: horaQ,
        canchaId: canchaQ,
      });
      if (depPreserve) next.set('deporte', depPreserve);
      navigate({ pathname: '/reservar', search: `?${next.toString()}` }, { replace: true });
      setError('');
    } else {
      reservaOmitirAutoCanchaUnicaRef.current = Boolean(fechaQ && horaQ);
      setFormData((prev) => ({
        ...prev,
        fecha: fechaQ || prev.fecha || ymdHoyParaReservaSede(sede),
        hora: horaQ || '',
        cancha: canchaQ || '',
      }));
      setPantalla(2);
      if (sp.has('rw')) {
        const next = createSearchParams({ sedeId: String(id) });
        if (depPreserve) next.set('deporte', depPreserve);
        navigate({ pathname: '/reservar', search: `?${next.toString()}` }, { replace: true });
      }
    }
    reservaUrlBootstrapKeyRef.current = urlBootstrapKey;
  }, [sedes, initialSedeId, location.search, navigate]);

  // Tras login: restaurar estado guardado en sessionStorage (v2 o legacy) antes de redirigir a login.
  useEffect(() => {
    if (sedes.length < 1 || authLoading) return;
    let raw;
    try {
      raw = sessionStorage.getItem(RESERVA_FORM_RESTORE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      try {
        sessionStorage.removeItem(RESERVA_FORM_RESTORE_KEY);
      } catch (_) {
        /* ignore */
      }
      return;
    }

    const clearKey = () => {
      try {
        sessionStorage.removeItem(RESERVA_FORM_RESTORE_KEY);
      } catch (_) {
        /* ignore */
      }
    };

    const mergeFiltrosForm = (filt, fd, sedeObj) => {
      const pais = String(filt?.pais || sedeObj?.pais || '').trim();
      const ciudad = String(filt?.ciudad || sedeObj?.ciudad || '').trim();
      const ciudadesDelPais = [...new Set(sedes.filter((s) => s.pais === pais).map((s) => s.ciudad))].sort();
      setCiudades(ciudadesDelPais);
      if (sedeObj) {
        setFiltros({ pais, ciudad, sede_id: Number(sedeObj.id) });
      } else {
        setFiltros({
          pais: pais || '',
          ciudad: ciudad || '',
          sede_id: filt?.sede_id === '' || filt?.sede_id == null ? '' : filt.sede_id,
        });
      }
      setFormData((prev) => ({
        ...prev,
        ...fd,
        fecha:
          fd.fecha != null && String(fd.fecha).trim()
            ? String(fd.fecha).trim()
            : prev.fecha || ymdHoyParaReservaSede(sedeObj),
        hora: fd.hora != null ? String(fd.hora).trim() : prev.hora || '',
        cancha: fd.cancha != null && String(fd.cancha).trim() ? String(fd.cancha).trim() : prev.cancha || '',
        duracion: fd.duracion != null ? String(fd.duracion) : prev.duracion || '90',
        codigoPais: fd.codigoPais != null ? String(fd.codigoPais) : prev.codigoPais,
        numeroTel: fd.numeroTel != null ? String(fd.numeroTel) : prev.numeroTel,
      }));
    };

    if (data?.v === RESERVA_FORM_RESTORE_VERSION) {
      const filt = data.filtros && typeof data.filtros === 'object' ? data.filtros : {};
      const fd = data.formData && typeof data.formData === 'object' ? data.formData : {};
      const sid = filt.sede_id;
      const sedeObj =
        sid !== '' && sid != null && String(sid).trim() !== ''
          ? sedes.find((s) => Number(s.id) === Number(sid))
          : null;

      if (sid !== '' && sid != null && String(sid).trim() !== '' && !sedeObj) {
        clearKey();
        return;
      }

      const fecha = fd.fecha != null ? String(fd.fecha).trim() : '';
      const hora = fd.hora != null ? String(fd.hora).trim() : '';
      const cancha = fd.cancha != null ? String(fd.cancha).trim() : '';
      const full = Boolean(sedeObj && fecha && hora && cancha);

      if (full) {
        clearKey();
        mergeFiltrosForm(filt, fd, sedeObj);
        setPantalla(4);
        navigate(
          {
            pathname: '/reservar',
            search: `?${createSearchParams({
              sedeId: String(sedeObj.id),
              fecha,
              hora,
              canchaId: cancha,
            }).toString()}`,
          },
          { replace: true }
        );
        setError('');
        return;
      }

      if (sedeObj) {
        clearKey();
        mergeFiltrosForm(filt, fd, sedeObj);
        setPantalla(2);
        const params = { sedeId: String(sedeObj.id) };
        if (fecha) params.fecha = fecha;
        navigate({ pathname: '/reservar', search: `?${createSearchParams(params).toString()}` }, { replace: true });
        setError('');
        return;
      }

      clearKey();
      mergeFiltrosForm(filt, fd, null);
      setPantalla(Number(data.pantalla) === 1 ? 1 : 2);
      navigate({ pathname: '/reservar', search: '' }, { replace: true });
      setError('');
      return;
    }

    const sid = data?.filtros?.sede_id;
    const fecha = data?.fecha != null ? String(data.fecha).trim() : '';
    const hora = data?.hora != null ? String(data.hora).trim() : '';
    const cancha = data?.cancha != null ? String(data.cancha).trim() : '';

    if (sid === '' || sid == null) {
      clearKey();
      return;
    }
    const sedeObj = sedes.find((s) => Number(s.id) === Number(sid));
    if (!sedeObj) {
      clearKey();
      return;
    }
    const filt = data.filtros && typeof data.filtros === 'object' ? data.filtros : {};
    const fdLegacy = { fecha, hora, cancha };

    if (fecha && hora && cancha) {
      clearKey();
      mergeFiltrosForm(filt, fdLegacy, sedeObj);
      setPantalla(4);
      navigate(
        {
          pathname: '/reservar',
          search: `?${createSearchParams({
            sedeId: String(sedeObj.id),
            fecha,
            hora,
            canchaId: cancha,
          }).toString()}`,
        },
        { replace: true }
      );
      setError('');
      return;
    }

    clearKey();
    mergeFiltrosForm(filt, fdLegacy, sedeObj);
    setPantalla(2);
    const params = { sedeId: String(sedeObj.id) };
    if (fecha) params.fecha = fecha;
    navigate({ pathname: '/reservar', search: `?${createSearchParams(params).toString()}` }, { replace: true });
    setError('');
  }, [sedes.length, sedes, authLoading, navigate]);

  // Siempre que estemos en fecha/hora con sede, asegurar día por defecto (p. ej. flujo mobile pantalla 1 → 2).
  useEffect(() => {
    if (pantalla !== 2 || !filtros.sede_id) return;
    const sedeRow = sedes.find((s) => Number(s.id) === Number(filtros.sede_id)) || null;
    setFormData((prev) => {
      if (prev.fecha) return prev;
      return { ...prev, fecha: ymdHoyParaReservaSede(sedeRow), hora: '', cancha: '' };
    });
  }, [pantalla, filtros.sede_id, sedes]);

  // Pantalla 4 (resumen/pago): al aterrizar —p. ej. tras login— el scroll suele quedar abajo; subir al inicio.
  useEffect(() => {
    if (pantalla !== 4) return;
    const id = window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
    return () => window.clearTimeout(id);
  }, [pantalla]);

  const selectPais = useCallback((pais) => {
    clearReservaGeoMasCercanaIntent();
    setFiltros({ pais, ciudad: '', sede_id: '' });
    if (pais) {
      const ciudadesDelPais = [...new Set(sedes.filter((s) => s.pais === pais).map((s) => s.ciudad))].sort();
      setCiudades(ciudadesDelPais);
    } else {
      setCiudades([]);
    }
  }, [sedes]);

  const abrirPerfilPublicoSedeDesdeCard = useCallback(
    (sede) => {
      const esMasCercanaPorGeo =
        geoReserva.status === 'granted' &&
        sedeReservaMasCercanaId != null &&
        Number(sede.id) === Number(sedeReservaMasCercanaId) &&
        String(filtros.pais || '').trim() === String(sede.pais || '').trim();
      if (esMasCercanaPorGeo) {
        writeReservaGeoMasCercanaIntent(sede.id, sede.pais);
      } else {
        clearReservaGeoMasCercanaIntent();
      }
      navigate(`/sede/${encodeURIComponent(String(sede.id))}`);
    },
    [navigate, geoReserva.status, sedeReservaMasCercanaId, filtros.pais]
  );

  const prevPaisCardsRef = useRef(null);
  const [reservaCardsWave, setReservaCardsWave] = useState(0);

  useEffect(() => {
    const p = String(filtros.pais || '').trim();
    if (!p) {
      prevPaisCardsRef.current = null;
      return;
    }
    if (prevPaisCardsRef.current !== p) {
      prevPaisCardsRef.current = p;
      setReservaCardsWave((w) => w + 1);
    }
  }, [filtros.pais]);

  /** Si solo hay un país en datos, pre-seleccionarlo en pantalla 1.
   * No llamar a {@link selectPais} cuando ya hay `sede_id` (p. ej. `?sedeId=` en URL / estado inicial):
   * `selectPais` hace `setFiltros({ ..., sede_id: '' })` y en el mismo ciculo que el bootstrap de URL
   * borraba la sede → sin sede → horarios/canchas vacíos y sensación de “vuelta atrás” en bucle. */
  useEffect(() => {
    if (sedes.length === 0 || paisesOrdenados.length !== 1) return;
    const only = paisesOrdenados[0];
    if (filtros.sede_id !== '' && filtros.sede_id != null) return;
    if (String(filtros.pais || '').trim() !== only) selectPais(only);
  }, [sedes, paisesOrdenados, filtros.pais, filtros.sede_id, selectPais]);

  const clearPais = useCallback(() => {
    clearReservaGeoMasCercanaIntent();
    setFiltros({ pais: '', ciudad: '', sede_id: '' });
    setCiudades([]);
  }, []);

  const buscarHorariosDisponibles = useCallback(async (fecha) => {
    if (!fecha || !sedeSeleccionada) return;
    if (filtros.sede_id === '' || filtros.sede_id == null) return;

    const url = apiUrl(
      `/api/disponibilidad/${encodeURIComponent(sedeSeleccionada.nombre)}/${encodeURIComponent(fecha)}`
    );

    setLoading(true);
    const sedeIdKey = filtros.sede_id === '' || filtros.sede_id == null ? '' : String(filtros.sede_id);
    try {
      const response = await fetch(url);
      const text = await response.text();

      if (!response.ok) {
        setHorariosDisponibles([]);
        setHorariosUltimaConsulta({ sedeId: sedeIdKey, fecha });
        return;
      }

      let reservadas;
      try {
        reservadas = JSON.parse(text);
      } catch {
        setHorariosDisponibles([]);
        setHorariosUltimaConsulta({ sedeId: sedeIdKey, fecha });
        return;
      }

      if (!Array.isArray(reservadas)) {
        reservadas = [];
      }

      const sedeData = sedeSeleccionada;

      // Parse opening/closing times with defensive checks
      let horaApertura = 10; // default: 10 AM
      let horaCierre = 23;   // default: 11 PM

      try {
        if (sedeData.horario_apertura) {
          const apertura = parseInt(sedeData.horario_apertura.split(':')[0], 10);
          if (!isNaN(apertura)) horaApertura = apertura;
        }
      } catch (e) {
        /* ignore parse errors */
      }

      try {
        if (sedeData.horario_cierre) {
          const cierre = parseInt(sedeData.horario_cierre.split(':')[0], 10);
          if (!isNaN(cierre)) horaCierre = cierre;
        }
      } catch (e) {
        /* ignore parse errors */
      }

      const duracion = duracionSeleccionadaMin;
      const slotsOferta = slotsReservaDesdeSede(sedeData, reservaDeporteUrl);
      const numsSlots = slotsOferta.map((s) => s.numero);
      const hoyCalendarioNegocio = ymdHoyParaReservaSede(sedeData);
      const filtrarSlotsPasadosHoy = Boolean(hoyCalendarioNegocio && fecha === hoyCalendarioNegocio);
      const aperturaMin = horaApertura * 60;
      const cierreMin = horaCierre * 60;

      const todosLosHorarios = [];

      // Generate all possible time slots based on club schedule
      for (let startMin = aperturaMin; startMin + duracion <= cierreMin; startMin += SLOT_STEP_MIN) {
          // Check if slot fits within business hours
          const endMin = startMin + duracion;

          // Only add if slot ends by closing time
          if (endMin <= cierreMin) {
            const horaInicio = horaDesdeMinutosReserva(startMin);
            const horaFin = horaDesdeMinutosReserva(endMin);

            // Solo slots ofertados (activos): si ninguno libre, no listar el horario
            const ocupadasNums = Array.isArray(reservadas)
              ? reservadas
                .filter((r) => (
                  reservaBloqueaDisponibilidad(r) &&
                  numsSlots.includes(parseInt(String(r.cancha), 10)) &&
                  reservaSolapaIntervalo(r, startMin, endMin)
                ))
                .map((r) => parseInt(String(r.cancha), 10))
              : [];
            const ocupadas = new Set(ocupadasNums).size;
            const libres = numsSlots.length - ocupadas;

            // Add slot only if al menos un slot ofertado está libre
            if (libres > 0) {
              if (filtrarSlotsPasadosHoy) {
                const slotStartMs = slotStartMsParaReservaSede(fecha, horaInicio, sedeData);
                if (slotStartMs != null && slotStartMs <= Date.now()) {
                  continue;
                }
              }
              todosLosHorarios.push({
                horario: `${horaInicio} - ${horaFin}`,
                hora: horaInicio,
                libres,
                ocupadas,
              });
            }
          }
      }

      setHorariosDisponibles(todosLosHorarios);
      setHorariosUltimaConsulta({ sedeId: sedeIdKey, fecha });
    } catch {
      setHorariosDisponibles([]);
      setHorariosUltimaConsulta({ sedeId: sedeIdKey, fecha });
    } finally {
      setLoading(false);
    }
  }, [filtros.sede_id, sedeSeleccionada, duracionSeleccionadaMin, reservaDeporteUrl]);

  // Auto-load time slots when date is selected (pantalla 2)
  useEffect(() => {
    if (pantalla !== 2 || !formData.fecha || !sedeSeleccionada) return;
    buscarHorariosDisponibles(formData.fecha);
  }, [pantalla, formData.fecha, sedeSeleccionada, buscarHorariosDisponibles]);

  const handleSelectFecha = useCallback((fecha) => {
    setLoading(true);
    setHorariosUltimaConsulta({ sedeId: '', fecha: '' });
    setFormData((prev) => ({
      ...prev,
      fecha,
      hora: '',
      cancha: '',
    }));
    setHorariosDisponibles([]);
    setCanchasDisponibles([]);
    setError('');
  }, []);

  const handleSelectDuracion = useCallback((duracion) => {
    setLoading(true);
    setHorariosUltimaConsulta({ sedeId: '', fecha: '' });
    setFormData((prev) => ({
      ...prev,
      duracion: String(duracion),
      hora: '',
      cancha: '',
    }));
    setHorariosDisponibles([]);
    setCanchasDisponibles([]);
    setError('');
  }, []);

  const buscarCanchasDisponibles = useCallback(async (hora, fechaReserva) => {
    const fecha = fechaReserva != null && String(fechaReserva).trim() !== '' ? String(fechaReserva).trim() : formData.fecha;
    if (!hora || !fecha) return;
    if (filtros.sede_id === '' || filtros.sede_id == null) return;
    if (!sedeSeleccionada) return;

    try {
      const response = await fetch(
        apiUrl(
          `/api/disponibilidad/${encodeURIComponent(sedeSeleccionada.nombre)}/${encodeURIComponent(fecha)}`
        )
      );
      const reservadas = await response.json();

      const startMin = minutosDesdeHoraReserva(hora);
      const endMin = startMin == null ? null : startMin + duracionSeleccionadaMin;
      const ocupadas = Array.isArray(reservadas) && startMin != null && endMin != null
        ? reservadas
          .filter((r) => (
            reservaBloqueaDisponibilidad(r) &&
            reservaSolapaIntervalo(r, startMin, endMin)
          ))
          .map((r) => parseInt(String(r.cancha), 10))
        : [];
      const slots = slotsReservaDesdeSede(sedeSeleccionada, reservaDeporteUrl);

      setCanchasDisponibles(
        slots.map((s) => ({
          num: s.numero,
          label: s.nombre,
          libre: !ocupadas.includes(s.numero),
        }))
      );
    } catch {
      setError('Error al buscar canchas disponibles');
    }
  }, [formData.fecha, filtros.sede_id, sedeSeleccionada, duracionSeleccionadaMin, reservaDeporteUrl]);

  // Hora ya fijada (p. ej. deep link ?sedeId=&fecha=&hora=): cargar canchas sin retocar el botón de horario.
  useEffect(() => {
    if (pantalla !== 2) return;
    if (!formData.fecha || !formData.hora) return;
    if (filtros.sede_id === '' || filtros.sede_id == null) return;
    if (!sedeSeleccionada) return;
    void buscarCanchasDisponibles(formData.hora, formData.fecha);
  }, [
    pantalla,
    formData.fecha,
    formData.hora,
    filtros.sede_id,
    sedeSeleccionada,
    buscarCanchasDisponibles,
  ]);

  const selectHorario = useCallback(
    (hora) => {
      reservaOmitirAutoCanchaUnicaRef.current = false;
      const f = formData.fecha;
      setCanchasDisponibles([]);
      setFormData((prev) => ({
        ...prev,
        hora,
        cancha: '',
      }));
      void buscarCanchasDisponibles(hora, f);
      setError('');
    },
    [formData.fecha, buscarCanchasDisponibles]
  );

  useEffect(() => {
    if (pantalla !== 2) return;
    if (!formData.hora || canchasDisponibles.length === 0) return;
    const id = requestAnimationFrame(() => {
      canchasBloqueRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
    return () => cancelAnimationFrame(id);
  }, [pantalla, formData.hora, canchasDisponibles]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePagarConMP = async () => {
    if (authLoading) return;
    if (!session?.user) {
      saveReservaFormSessionState({
        pantalla: 4,
        filtros,
        formData,
      });
      saveReservaReturnUrl({
        sedeId: filtros.sede_id,
        fecha: formData.fecha,
        hora: formData.hora,
        cancha: formData.cancha,
      });
      navigate(authUrlWithRedirect(authLoginRedirectPath(location)));
      return;
    }
    const sesEm = session.user.email;
    const meta = session.user.user_metadata || {};
    const ccEff =
      currentCliente && String(currentCliente.email || '').trim()
        ? currentCliente
        : {
            email: sesEm,
            nombre: getDisplayName(userProfile, session),
            whatsapp: meta.whatsapp || '',
          };
    const usaWhatsappResumen = !perfilTelefonoValido(ccEff);
    const formParaTel = usaWhatsappResumen ? { ...formData, numeroTel: whatsapp } : formData;
    const { ok, whatsappCompleto } = telefonoPagoResuelto(ccEff, formParaTel);
    if (!ok) {
      setError(
        clienteTieneTelefonoGuardado(ccEff)
          ? 'El teléfono del perfil no es válido. Completa un número de contacto válido.'
          : `Ingresa un número de WhatsApp válido (al menos ${MIN_DIGITOS_TELEFONO} dígitos).`
      );
      return;
    }

    setMpLoading(true);
    setError('');

    const precio = getPrecio(sedeSeleccionada, formData.hora, formData.fecha);
    const creditoAplicado = 0;
    const precioFinal = Math.max(0, precio - creditoAplicado);
    const duracionReservaMin = duracionSeleccionadaMin;
    const reservaData = {
      sede_id: sedeSeleccionada.id,
      sede: sedeSeleccionada.nombre,
      fecha: formData.fecha,
      hora: formData.hora,
      cancha: parseInt(formData.cancha),
      nombre: ccEff.nombre,
      email: ccEff.email,
      whatsapp: whatsappCompleto,
      nivel: 'Principiante',
      precio,
      moneda: sedeSeleccionada.moneda || 'ARS',
      creditUsed: creditoAplicado,
      duracion: duracionReservaMin,
      estado: 'confirmada',
    };

    try {
      const res = await fetch(apiUrl('/api/crear-preferencia'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: `Cancha ${formData.cancha} — ${sedeSeleccionada.nombre}`,
          precio: precioFinal,
          moneda: sedeSeleccionada.moneda || 'ARS',
          sedeNombre: sedeSeleccionada.nombre,
          sedeId: sedeSeleccionada.id,
          reservaData,
        }),
      });
      const data = await res.json();
      if (res.ok && data.init_point) {
        localStorage.setItem('ultima_sede', String(filtros.sede_id));
        saveMpReservaPendingSlot({
          sede: sedeSeleccionada.nombre,
          fecha: formData.fecha,
          hora: formData.hora,
          cancha: parseInt(String(formData.cancha), 10),
          email: String(ccEff.email || '').trim().toLowerCase(),
          sedeId: sedeSeleccionada.id,
          duracion: duracionReservaMin,
        });
        window.location.href = data.init_point;
      } else if (res.ok && data.efectivo_payment) {
        alert('Esta sede acepta pago presencial. Presenta tu reserva al llegar al club.');
        setPantalla(1);
        setFormData({ fecha: '', hora: '', cancha: '', duracion: '90', nombre: '', email: '', numeroTel: '' });
        setWhatsapp('');
        setMpLoading(false);
      } else if (res.ok && data.manual_payment) {
        const msgManual = [
          'Reserva creada con estado pendiente de pago manual.',
          data.instructions ? `Instrucciones: ${data.instructions}` : null,
        ]
          .filter(Boolean)
          .join('\n\n');
        alert(msgManual);
        setPantalla(1);
        setFormData({ fecha: '', hora: '', cancha: '', duracion: '90', nombre: '', email: '', numeroTel: '' });
        setWhatsapp('');
        setMpLoading(false);
      } else if (res.ok && data.stripe_checkout_pending) {
        setError(data.message || 'Stripe Connect está en implementación para esta sede.');
        setMpLoading(false);
      } else {
        setError(data.error || 'No se pudo iniciar el pago');
        setMpLoading(false);
      }
    } catch (err) {
      setError('Error al conectar con Mercado Pago: ' + err.message);
      setMpLoading(false);
    }
  };

  const cerrarReservaStripeExito = useCallback(() => {
    setReservaStripeExitoOpen(false);
    clearMpReservaPendingSlot();
    setPantalla(1);
    setFormData({
      fecha: '',
      hora: '',
      cancha: '',
      duracion: '90',
      nombre: '',
      email: '',
      numeroTel: '',
      codigoPais: '+54',
    });
    setWhatsapp('');
    setError('');
  }, []);

  // PANTALLA 1: País + cards de sedes (rediseño)
  if (pantalla === 1) {
    return (
      <div
        className="reserva-container reserva-sede-seleccion"
        style={{
          paddingTop: reservaPaddingTopCss,
          paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
        }}
      >
        <AppHeader title="Reservar" onBack={handleReservaBack} />
        <div
          style={{
            ...hubInstagramColumnWrapStyle,
            paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
          }}
        >
        <div className="reserva-sede-inner">
          <header className="reserva-sede-hero">
            <h1 className="reserva-sede-hero-title">Reserva tu cancha</h1>
            <p className="reserva-sede-hero-sub">Elige tu sede y horario favorito</p>
          </header>

          {sedesLoadError ? (
            <div className="error-message reserva-sede-alert" role="alert">
              {sedesLoadError}
            </div>
          ) : null}

          <label className="reserva-sede-pais-question" htmlFor="reserva-pais-select">
            ¿Dónde quieres jugar?
          </label>
          <div className="reserva-sede-pais-pill-shell">
            <span className="reserva-sede-pais-pill-icon" aria-hidden>
              🌐
            </span>
            {paisesOrdenados.length === 1 ? (
              <div className="reserva-sede-pais-pill-static">
                {etiquetaPaisReservaSelector(filtros.pais || paisesOrdenados[0])}
              </div>
            ) : (
              <select
                id="reserva-pais-select"
                className="reserva-sede-pais-pill-select"
                aria-label="¿Dónde quieres jugar?"
                value={filtros.pais || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) clearPais();
                  else selectPais(v);
                }}
              >
                <option value="">Elige un país…</option>
                {paisesOrdenados.map((p) => (
                  <option key={p} value={p}>
                    {etiquetaPaisReservaSelector(p)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {filtros.pais ? (
            <div key={reservaCardsWave} className="reserva-sede-cards-root">
              {sedesFiltradasPorPais.length === 0 ? (
                <p className="reserva-sede-empty-pais">Próximamente en tu país 🌎</p>
              ) : (
                <ul className="reserva-sede-cards-list">
                  {sedesFiltradasPorPais.map((sede, idx) => {
                    const foto = primeraFotoSede(sede);
                    const { flag, linea } = ciudadPaisConBandera(sede);
                    const precio = precioDesdeCard(sede);
                    const moneda = String(sede.moneda || 'ARS').trim() || 'ARS';
                    const esMasCercana =
                      geoReserva.status === 'granted' &&
                      sedeReservaMasCercanaId != null &&
                      Number(sede.id) === Number(sedeReservaMasCercanaId);
                    return (
                      <li
                        key={sede.id}
                        className="reserva-sede-card"
                        style={{ '--reserva-stagger': `${idx * 80}ms` }}
                      >
                        <div className="reserva-sede-card-photo-wrap">
                          {foto ? (
                            <img src={foto} alt="" className="reserva-sede-card-photo" loading="lazy" />
                          ) : (
                            <div className="reserva-sede-card-photo-placeholder" aria-hidden>
                              ⚽
                            </div>
                          )}
                        </div>
                        <div className="reserva-sede-card-body">
                          <h2 className="reserva-sede-card-name">{String(sede.nombre || 'Sede').trim()}</h2>
                          {esMasCercana ? (
                            <p className="reserva-sede-card-nearby">Sede más cercana a ti</p>
                          ) : null}
                          <p className="reserva-sede-card-loc">
                            {flag ? <span className="reserva-sede-card-flag">{flag}</span> : null}
                            <span>{linea}</span>
                          </p>
                          <p className="reserva-sede-card-hours">{horarioDisponibleTexto(sede)}</p>
                          <p className="reserva-sede-card-price">
                            Desde{' '}
                            <strong>
                              {Number(precio || 0).toLocaleString('es-AR')} {moneda}
                            </strong>{' '}
                            / turno
                          </p>
                          <button
                            type="button"
                            className="reserva-sede-card-btn"
                            onClick={() => abrirPerfilPublicoSedeDesdeCard(sede)}
                          >
                            Reservar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {error ? <div className="error-message reserva-sede-alert">{error}</div> : null}
        </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // PANTALLA 2: fecha → horarios → canchas en una sola vista con scroll (revelación progresiva)
  if (pantalla === 2) {
    const hoyIso = ymdHoyParaReservaSede(sedeSeleccionada);
    return (
      <div className="reserva-container" style={{
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        paddingTop: reservaPaddingTopCss,
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        overflowX: 'hidden',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        minHeight: '100dvh',
      }}>
        <AppHeader title="Reservar" onBack={handleReservaBack} />
        <div
          style={{
            ...hubInstagramColumnWrapStyle,
            paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
          }}
        >
        <div className="reserva-card">
          <h1 style={{ margin: 0, marginBottom: mostrarEtiquetaSedeMasCercanaGeo ? '8px' : '20px' }}>
            📅 {sedeSeleccionada?.nombre || 'Cargando sede…'}
          </h1>
          {mostrarEtiquetaSedeMasCercanaGeo && sedeSeleccionada ? (
            <p
              className="reserva-p2-sede-mas-cercana"
              role="status"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <span style={{ display: 'inline-flex', flexShrink: 0, color: 'inherit' }}>
                <IconGeroUbicacion size={16} />
              </span>
              Sede más cercana a ti
            </p>
          ) : null}

          {sedeSeleccionada && (
          <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', textAlign: 'center' }}>
            {(() => {
              const { flag, linea } = ciudadPaisConBandera(sedeSeleccionada);
              return (
                <>
                  {flag ? <span style={{ marginRight: '6px' }}>{flag}</span> : null}
                  {linea}
                </>
              );
            })()}
            {textoLineaTarifasReserva(sedeSeleccionada)}
          </p>
          )}

          <form>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '10px' }}>Elige el día</label>
              <ReservaCalendarioMes
                selectedIso={formData.fecha}
                minIso={ymdHoyParaReservaSede(sedeSeleccionada)}
                maxIso={fechaMaxReservaISO()}
                todayIso={hoyIso}
                onSelectDay={handleSelectFecha}
                disabled={!sedeSeleccionada}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '10px' }}>Duración</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {RESERVA_DURACIONES_MIN.map((duracion) => {
                  const active = duracionSeleccionadaMin === duracion;
                  return (
                    <button
                      key={duracion}
                      type="button"
                      onClick={() => handleSelectDuracion(duracion)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        border: `2px solid ${active ? '#E11B22' : 'var(--border)'}`,
                        background: active ? '#E11B22' : 'var(--bg-card)',
                        color: active ? '#fff' : 'var(--text-primary)',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {duracion} min
                    </button>
                  );
                })}
              </div>
            </div>

            {horariosDisponibles.length > 0 && (
              <div className="form-group reserva-horario-bloque">
                <label style={{ display: 'block', marginBottom: '10px' }}>Horarios disponibles</label>
                <div className="reserva-horarios-wrap">
                  {horariosDisponibles.map((h) => {
                    const active = formData.hora === h.hora;
                    return (
                      <button
                        key={h.hora}
                        type="button"
                        onClick={() => selectHorario(h.hora)}
                        className={active ? 'reserva-horario-btn reserva-horario-btnActive' : 'reserva-horario-btn'}
                      >
                        <span className="reserva-horario-linea">{h.horario}</span>
                        <span className="reserva-horario-meta">
                          {h.libres} libre{h.libres === 1 ? '' : 's'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {formData.fecha &&
              sedeSeleccionada &&
              horariosDisponibles.length === 0 &&
              loading === false &&
              String(filtros.sede_id) === horariosUltimaConsulta.sedeId &&
              formData.fecha === horariosUltimaConsulta.fecha && (
              <div className="error-message">No hay horarios disponibles para esta fecha</div>
            )}

            {/* Price badge — shown as soon as a time is selected */}
            {formData.hora && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  💰 {Number(getPrecio(sedeSeleccionada, formData.hora, formData.fecha)).toLocaleString('es-AR')} {sedeSeleccionada?.moneda || 'ARS'}
                </span>
                {(() => {
                  const subEtiqueta =
                    nombreFranjaActiva(sedeSeleccionada, formData.hora, formData.fecha) ||
                    (sedeSeleccionada?.precio_manana && sedeSeleccionada?.precio_tarde
                      ? parseInt(formData.hora.split(':')[0], 10) < 16
                        ? '🌅 Tarifa mañana'
                        : '🌆 Tarifa tarde/noche'
                      : '');
                  if (!subEtiqueta) return null;
                  return (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{subEtiqueta}</span>
                  );
                })()}
              </div>
            )}

            {formData.hora && canchasDisponibles.length > 0 && (
              <div
                ref={canchasBloqueRef}
                className="reserva-canchas-bloque"
                style={{ scrollMarginTop: reservaPaddingTopCss }}
              >
                <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>Elige tu cancha:</label>
                <div className="reserva-canchas-botones">
                  {canchasDisponibles.map(c => (
                    <button
                      key={c.num}
                      type="button"
                      disabled={!c.libre}
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, cancha: String(c.num) }));
                        setPantalla(4);
                        setError('');
                      }}
                      className={`reserva-cancha-elegir-btn ${c.libre ? 'reserva-cancha-elegir-btn--libre' : 'reserva-cancha-elegir-btn--ocupada'}`}
                    >
                      {c.label || `Cancha ${c.num}`} {c.libre ? '✅ Disponible' : '🔴 Reservada'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}
          </form>
        </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // PANTALLA 4: Resumen + pago
  if (pantalla === 4) {
    const precio = getPrecio(sedeSeleccionada, formData.hora, formData.fecha);
    const moneda = sedeSeleccionada?.moneda || 'ARS';
    const creditoAplicado = 0;
    const precioFinal = Math.max(0, precio - creditoAplicado);
    const metodoPagoStripe = String(sedeSeleccionada?.metodo_pago || '').trim().toLowerCase() === 'stripe';
    const metodoPagoEfectivo = String(sedeSeleccionada?.metodo_pago || '').trim().toLowerCase() === 'efectivo';
    const stripeCuentaOk = String(sedeSeleccionada?.stripe_account_id || '').trim().startsWith('acct_');
    const montoBaseMinor = amountMainToStripeMinor(precioFinal, moneda);
    const cargoServicioMinor = Math.round(montoBaseMinor * 0.03);
    const totalMinor = montoBaseMinor + cargoServicioMinor;
    const muestraInputWhatsappResumen = !perfilTelefonoValido(currentCliente);
    const formParaTelStripe = muestraInputWhatsappResumen ? { ...formData, numeroTel: whatsapp } : formData;
    const telefonoStripe = telefonoPagoResuelto(
      currentCliente || { email: '', nombre: '', whatsapp: '' },
      formParaTelStripe
    );
    const duracionReservaMinP4 = duracionSeleccionadaMin;
    const resumenPaddingTop = reservaPaddingTopCss;
    const resumenPaddingBottomPx = Math.min(32, HUB_CONTENT_PADDING_BOTTOM_PX);

    return (
      <div
        className="reserva-container"
        style={{
          background: 'var(--bg-page)',
          color: 'var(--text-primary)',
          paddingTop: resumenPaddingTop,
          paddingBottom: `${resumenPaddingBottomPx}px`,
          margin: '16px auto 0',
          minHeight: '100dvh',
          overflowX: 'hidden',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <AppHeader title="Reservar" onBack={handleReservaBack} />
        <div
          style={{
            ...hubInstagramColumnWrapStyle,
            paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
          }}
        >
        <div className="reserva-card">
          <h1 style={{ margin: 0, marginBottom: '20px' }}>⚽ Resumen de reserva</h1>

          <div
            className="reserva-resumen-datos"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              color: 'var(--text-primary)',
            }}
          >
            <p style={{ margin: '0 0 8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ flexShrink: 0, display: 'inline-flex', marginTop: 2, color: 'inherit' }}>
                <IconGeroUbicacion size={16} />
              </span>
              <span>
                <strong>Sede:</strong> {sedeSeleccionada?.nombre || '—'}
              </span>
            </p>
            <p style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
              <strong>📅 Fecha:</strong> {formData.fecha || '—'}
            </p>
            <p style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
              <strong>🕐 Hora:</strong> {formData.hora || '—'}
            </p>
            <p style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
              <strong>⏱️ Duración:</strong> {duracionReservaMinP4} min
            </p>
            <p style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
              <strong>🏟️ Cancha:</strong>{' '}
              {(() => {
                const id = formData.cancha != null && String(formData.cancha).trim() !== '' ? String(formData.cancha) : '';
                if (!id) return '—';
                const match = Array.isArray(canchasDisponibles)
                  ? canchasDisponibles.find((c) => String(c?.num ?? c?.id ?? c?.cancha_id ?? '') === id)
                  : null;
                const rawLabel = match && (match.label || match.nombre || match.descripcion);
                if (rawLabel) return String(rawLabel).trim();
                return `Cancha ${id}`;
              })()}
            </p>
            <p style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
              <strong>👤 Jugador:</strong> {currentCliente?.nombre || '—'}
            </p>
            <p style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
              <strong>📧 Email:</strong> {currentCliente?.email || '—'}
            </p>
            {precio ? (
              metodoPagoStripe ? (
                <div style={{ margin: '12px 0 0', fontSize: '15px', lineHeight: 1.55, color: 'var(--text-primary)' }}>
                  <p style={{ margin: '0 0 4px' }}>
                    <strong>Reserva:</strong>{' '}
                    {formatMoneyMain(stripeMinorToMain(montoBaseMinor, moneda), moneda)}
                  </p>
                  <p style={{ margin: '0 0 4px' }}>
                    <strong>Cargo de servicio Padbol Match (3%):</strong>{' '}
                    {formatMoneyMain(stripeMinorToMain(cargoServicioMinor, moneda), moneda)}
                  </p>
                  <p style={{ margin: '8px 0 0', fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>
                    <strong>Total:</strong> {formatMoneyMain(stripeMinorToMain(totalMinor, moneda), moneda)}
                  </p>
                </div>
              ) : (
                <p style={{ margin: '12px 0 0', fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>
                  💰 {Number(precio).toLocaleString('es-AR')} {moneda}
                  {metodoPagoEfectivo ? (
                    <span style={{ display: 'block', marginTop: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Sin cargo del 3% de Padbol Match (cobro en sede).
                    </span>
                  ) : null}
                </p>
              )
            ) : null}
          </div>

          {muestraInputWhatsappResumen && (
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>💬 WhatsApp para confirmación *</label>
              <div className="phone-field">
                <select
                  value={formData.codigoPais}
                  onChange={(e) => setFormData((prev) => ({ ...prev, codigoPais: e.target.value }))}
                >
                  <optgroup label="Principales">
                    {PAISES_TELEFONO_PRINCIPALES.map(p => (
                      <option key={p.nombre} value={p.codigo}>{p.bandera} {p.codigo}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Otros">
                    {PAISES_TELEFONO_OTROS.map(p => (
                      <option key={p.nombre} value={p.codigo}>{p.bandera} {p.codigo} {p.nombre}</option>
                    ))}
                  </optgroup>
                </select>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="9 11 2345 6789"
                />
              </div>
              {whatsapp ? (
                <small className="phone-preview">
                  Número completo: {formData.codigoPais}{whatsapp.replace(/[\s\-().]/g, '')}
                </small>
              ) : null}
            </div>
          )}

          {metodoPagoEfectivo ? (
            <div
              style={{
                margin: '0 0 16px',
                padding: '12px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                lineHeight: 1.6,
              }}
            >
              <strong>Pago en la sede</strong>
              <br />
              Esta sede acepta pago presencial. No te redirigimos a Mercado Pago ni a tarjeta: al confirmar, la reserva
              queda pendiente hasta que abones en el club.
            </div>
          ) : null}

          <div
            style={{
              margin: '0 0 16px',
              padding: '12px 14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              lineHeight: 1.6,
            }}
          >
            <strong>📋 Política de cancelación</strong><br />
            ✅ Más de 24hs de anticipación: crédito total<br />
            ❌ Menos de 24hs de anticipación: sin devolución
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '18px',
            }}
          >
            <button
              type="button"
              onClick={irAModificarReservaDesdeResumen}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '2px solid #E11B22',
                background: 'transparent',
                color: '#E11B22',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 0 0 1px rgba(225, 27, 34, 0.15)',
              }}
            >
              Modificar reserva
            </button>
            <button
              type="button"
              onClick={() => setCancelReservaDesdeResumenOpen(true)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {metodoPagoStripe && !stripeCuentaOk ? (
            <div className="error-message" role="alert" style={{ marginBottom: '12px' }}>
              Esta sede aún no terminó de conectar Stripe. Elige otra sede o contacta al club.
            </div>
          ) : null}

          {metodoPagoStripe ? (
            <ReservaStripeSection
              sedeId={sedeSeleccionada.id}
              moneda={moneda}
              montoBaseMinor={montoBaseMinor}
              descripcion={`Reserva cancha ${formData.cancha} — ${sedeSeleccionada.nombre}`}
              payload={{
                sede: sedeSeleccionada.nombre,
                fecha: formData.fecha,
                hora: formData.hora,
                cancha: parseInt(formData.cancha, 10),
                nombre: currentCliente?.nombre,
                email: currentCliente?.email,
                whatsapp: telefonoStripe.whatsappCompleto,
                nivel: 'Principiante',
                precio: precioFinal,
                duracion: duracionReservaMinP4,
              }}
              disabledPrepare={!telefonoStripe.ok || !stripeCuentaOk}
              onPaid={() => {
                setReservaStripeExitoOpen(true);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={handlePagarConMP}
              disabled={mpLoading}
              style={{
                width: '100%',
                padding: '14px',
                background: mpLoading
                  ? '#aaa'
                  : metodoPagoEfectivo
                    ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                    : 'linear-gradient(135deg, #e11b22 0%, #b91c1c 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: mpLoading ? 'not-allowed' : 'pointer',
                boxShadow: metodoPagoEfectivo
                  ? '0 3px 12px rgba(22,163,74,0.35)'
                  : '0 3px 12px rgba(225, 27, 34, 0.35)',
                marginBottom: '12px',
              }}
            >
              {mpLoading ? 'Procesando...' : metodoPagoEfectivo ? 'Confirmar reserva (pago en sede)' : 'Pagar con Mercado Pago'}
            </button>
          )}
        </div>
        </div>
        {reservaStripeExitoOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reserva-stripe-exito-title"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 20000,
              background: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding:
                'max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))',
              boxSizing: 'border-box',
            }}
            onClick={cerrarReservaStripeExito}
          >
            <div
              role="document"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 400,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                borderRadius: 16,
                padding: '28px 22px 24px',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(2, 6, 23, 0.25)',
                border: '1px solid var(--border)',
                boxSizing: 'border-box',
              }}
            >
              <SuccessPaymentHeroCheck />
              <h2 id="reserva-stripe-exito-title" style={{ margin: '0 0 10px', fontSize: '1.35rem', fontWeight: 800 }}>
                ¡Reserva confirmada!
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                Te enviamos los detalles por WhatsApp.
              </p>
              <button
                type="button"
                onClick={cerrarReservaStripeExito}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        ) : null}
        <ConfirmCancelReservaModal
          open={cancelReservaDesdeResumenOpen}
          title="¿Cancelar la reserva y salir?"
          message="Vas a salir del flujo y se liberará el turno si estaba reservado."
          confirmLabel="Sí, cancelar reserva"
          dismissLabel="Volver al resumen"
          onDismiss={() => setCancelReservaDesdeResumenOpen(false)}
          onConfirm={() => {
            setCancelReservaDesdeResumenOpen(false);
            void handleCancelarReservaDesdeResumen();
          }}
        />
        <BottomNav />
      </div>
    );
  }
}
