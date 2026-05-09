import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NuevaSedeSuperBottomSheet from '../components/NuevaSedeSuperBottomSheet';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_LOGO_CLEARANCE_TOP_PX,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { clearAdminNavContext } from '../utils/adminNavContext';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import './AdminDashboard.css';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import { CATEGORIA_TORNEO_DEFAULT, TORNEO_CATEGORIA_OPTIONS } from '../constants/torneoCategoria';
import {
  TORNEO_GENERO_COMPETENCIA_DEFAULT,
  TORNEO_GENERO_COMPETENCIA_OPTIONS,
  TORNEO_CATEGORIA_EDAD_DEFAULT,
  TORNEO_CATEGORIA_EDAD_OPTIONS,
} from '../constants/torneoCompetencia';
import { categoriasNivelPorGenero } from '../constants/jugadorCategoria';
import { badgeTorneoEstadoPublico } from '../utils/torneoEstadoPublico';
import {
  FILTROS_ESTADO_TORNEO_PILLS,
  esEstadoCanceladoTorneo,
  esEstadoFinalizadoTorneo,
  esFiltroTorneoEstadoTodos,
  torneoPasaFiltroEstadoVista,
} from '../utils/torneoEstadoFiltroPills';
import {
  formatNivelTorneo,
  formatTipoTorneo,
  formatCategoriaTorneo,
  formatGeneroCompetenciaTorneo,
  formatCategoriaEdadTorneo,
  torneoTipoCompetenciaDb,
} from '../utils/torneoFormatters';
import {
  TORNEO_DEPORTE_OPTIONS,
  TORNEO_DEPORTE_PADBOL,
  TORNEO_DEPORTE_PICKLEBALL,
  TORNEO_FORMATO_DOBLES,
  TORNEO_FORMATO_PICKLE_OPTIONS,
  resumenDeporteFormatoTorneo,
} from '../utils/torneoDeporteFormato';
import { precioInscripcionTorneo } from '../utils/torneoInscripcionPago';
import { mapEstadoTorneoDesdeApiParaForm, mapEstadoTorneoFormParaApi } from '../utils/torneoEstadoAdminApi';
import {
  mensajeEstadoTorneoSoloLecturaAdmin,
  opcionesSelectEstadoTorneoAdmin,
  validarCambioEstadoTorneoAdminGuardar,
} from '../utils/torneoEstadoTransiciones';
import SorteoGruposModal, { equiposConfirmadosParaSorteo } from '../components/torneo/SorteoGruposModal';
import AdminClubOnboardingTour, { readOnboardingDone } from '../components/AdminClubOnboardingTour';
import ConfirmCancelReservaModal from '../components/ConfirmCancelReservaModal';
import { getCroppedImgBlob } from '../utils/cropImage';
import * as XLSX from 'xlsx';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const STRIPE_PUBLISHABLE_ADMIN =
  typeof process !== 'undefined' && process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
    ? String(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY).trim()
    : '';
const stripePromiseAdmin = STRIPE_PUBLISHABLE_ADMIN ? loadStripe(STRIPE_PUBLISHABLE_ADMIN) : null;

function etiquetaSuscripcionEstado(raw) {
  const v = String(raw || 'sin_suscripcion').toLowerCase();
  if (v === 'activa') return 'Activa';
  if (v === 'vencida') return 'Vencida';
  if (v === 'pendiente_pago') return 'Pendiente de pago';
  if (v === 'cancelada' || v === 'cancelado') return 'Cancelada';
  if (v === 'aviso') return 'Aviso (mora)';
  if (v === 'segundo_aviso') return 'Segundo aviso';
  if (v === 'suspendido') return 'Suspendida (mora)';
  return 'Sin suscripción';
}

const TIPO_INTERES_APROBAR_SOLICITUD_LIC = ['Club Afiliado', 'Padbol Point Franquicia', 'Master Nacional'];

function etiquetaTipoInteresSolicitudLicencia(v) {
  const s = String(v || '').trim();
  if (!s || s === 'pendiente_definicion') return 'Pendiente definición';
  return s;
}

/** Selector manual super_admin en detalle de sede (mora + operativo). */
const SUSCRIPCION_SELECTOR_SUPER_SEDE = [
  { value: 'activa', label: 'Activa' },
  { value: 'aviso', label: 'Aviso (mora)' },
  { value: 'segundo_aviso', label: 'Segundo aviso' },
  { value: 'suspendido', label: 'Suspendida' },
  { value: 'cancelado', label: 'Cancelada' },
];

const SUSCRIPCION_SELECTOR_SUPER_VALUES = new Set(SUSCRIPCION_SELECTOR_SUPER_SEDE.map((o) => o.value));

function supportWhatsAppUrlFromEnv() {
  const raw =
    typeof process !== 'undefined'
      ? String(
          process.env.REACT_APP_SUPPORT_WHATSAPP ||
            process.env.SUPPORT_WHATSAPP ||
            '',
        ).trim()
      : '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function formatProximoCobroAdmin(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function AdminSuscripcionPayInner({ clientSecret, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const pay = async () => {
    if (!stripe || !elements) return;
    setMsg('');
    setBusy(true);
    try {
      const { error: sErr } = await elements.submit();
      if (sErr) {
        setMsg(sErr.message || 'Revisá los datos');
        return;
      }
      const { error: pErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: typeof window !== 'undefined' ? `${window.location.origin}/admin` : undefined,
        },
        redirect: 'if_required',
      });
      if (pErr) {
        setMsg(pErr.message || 'No se pudo cobrar');
        return;
      }
      if (paymentIntent?.status !== 'succeeded') {
        setMsg('El pago no se completó.');
        return;
      }
      onSuccess();
    } catch (e) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: '12px' }}>
      <PaymentElement />
      {msg ? (
        <p style={{ color: '#b91c1c', fontSize: '13px', marginTop: '10px' }}>{msg}</p>
      ) : null}
      <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void pay()}
          disabled={busy || !stripe}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: busy || !stripe ? '#94a3b8' : '#635bff',
            color: '#fff',
            fontWeight: 700,
            cursor: busy || !stripe ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Procesando…' : 'Confirmar pago'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#fff',
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

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

/** Estado de formulario «Mi Sede» desde fila Supabase / API. */
function sedeDbRowToMiSedeFormState(sedeData) {
  if (!sedeData) return {};
  return {
    nombre: sedeData.nombre || '',
    direccion: sedeData.direccion || '',
    ciudad: sedeData.ciudad || '',
    provincia: sedeData.provincia != null ? String(sedeData.provincia) : '',
    pais: sedeData.pais || '',
    telefono: sedeData.telefono || '',
    email_contacto: sedeData.email_contacto || '',
    horario_apertura: sedeData.horario_apertura || '',
    horario_cierre: sedeData.horario_cierre || '',
    precio_turno: sedeData.precio_turno ?? '',
    moneda: sedeData.moneda || 'ARS',
    descripcion: sedeData.descripcion || '',
    historia: sedeData.historia != null ? String(sedeData.historia) : '',
    metodo_pago: sedeData.metodo_pago || 'mercadopago',
    stripe_account_id: sedeData.stripe_account_id || '',
    mp_access_token: sedeData.mp_access_token || '',
    pago_manual_instrucciones: sedeData.pago_manual_instrucciones || '',
    latitud: sedeData.latitud != null ? String(sedeData.latitud) : '',
    longitud: sedeData.longitud != null ? String(sedeData.longitud) : '',
    instagram: sedeData.instagram || '',
    facebook: sedeData.facebook || '',
    tiktok: sedeData.tiktok || '',
    twitter: sedeData.twitter || '',
    youtube: sedeData.youtube || '',
    website: sedeData.website || '',
    color_fondo_logo: normalizeHexSedeAdmin(sedeData.color_fondo_logo) || '#000000',
    color_hero_primario: normalizeHexSedeAdmin(sedeData.color_hero_primario) || '#4C1D95',
    color_hero_secundario: normalizeHexSedeAdmin(sedeData.color_hero_secundario) || '#7C3AED',
    color_borde_hero: normalizeHexSedeAdmin(sedeData.color_borde_hero) || '#6D28D9',
  };
}

/** Body para PATCH /api/sedes/:id (campos alineados con el panel). */
function miSedeFormToApiPatchBody(form) {
  const precioRaw = form.precio_turno;
  let precio_turno = null;
  if (precioRaw !== '' && precioRaw != null) {
    const p = parseFloat(String(precioRaw).replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(p)) precio_turno = p;
  }
  const latOk = form.latitud !== '' && form.latitud != null && Number.isFinite(parseFloat(form.latitud));
  const lngOk = form.longitud !== '' && form.longitud != null && Number.isFinite(parseFloat(form.longitud));
  const mpTrim = String(form.mp_access_token ?? '').trim();
  const stripeTrim = String(form.stripe_account_id ?? '').trim();
  const out = {
    nombre: form.nombre,
    direccion: form.direccion || null,
    ciudad: form.ciudad || null,
    provincia:
      form.provincia != null && String(form.provincia).trim() !== '' ? String(form.provincia).trim() : null,
    pais: form.pais || null,
    telefono: form.telefono || null,
    email_contacto: form.email_contacto || null,
    horario_apertura: form.horario_apertura || null,
    horario_cierre: form.horario_cierre || null,
    precio_turno,
    moneda: form.moneda || 'ARS',
    descripcion: form.descripcion || null,
    historia:
      form.historia != null && String(form.historia).trim() !== ''
        ? String(form.historia).trim().slice(0, 500)
        : null,
    metodo_pago: form.metodo_pago || 'mercadopago',
    pago_manual_instrucciones: form.pago_manual_instrucciones || null,
    latitud: latOk ? parseFloat(form.latitud) : null,
    longitud: lngOk ? parseFloat(form.longitud) : null,
    instagram: form.instagram || null,
    facebook: form.facebook || null,
    tiktok: form.tiktok || null,
    twitter: form.twitter || null,
    youtube: form.youtube || null,
    website: form.website || null,
    color_fondo_logo: normalizeHexSedeAdmin(form.color_fondo_logo) || '#000000',
    color_hero_primario: normalizeHexSedeAdmin(form.color_hero_primario) || '#4C1D95',
    color_hero_secundario: normalizeHexSedeAdmin(form.color_hero_secundario) || '#7C3AED',
    color_borde_hero: normalizeHexSedeAdmin(form.color_borde_hero) || '#6D28D9',
  };
  if (mpTrim) out.mp_access_token = mpTrim;
  if (stripeTrim) out.stripe_account_id = stripeTrim;
  return out;
}

const ADMIN_TABS_ALLOWED = new Set([
  'resumen',
  'torneos',
  'reservas',
  'validaciones',
  'mi_sede',
  'config',
  'planes',
  'roles',
  'sedes',
  'jugadores',
  'solicitudes',
]);

const SEDES_SUPER_ADMIN_PAGE_SIZE = 10;

/** Torneos que siguen “en juego” a nivel operativo (no finalizados ni cancelados). */
function torneoConsideradoActivoPanelNacional(t) {
  return !esEstadoFinalizadoTorneo(t?.estado) && !esEstadoCanceladoTorneo(t?.estado);
}

function sanitizeAdminActiveTab(raw) {
  const t0 = String(raw || '').trim();
  const t = t0 === 'sedes_pendientes' ? 'solicitudes' : t0;
  return ADMIN_TABS_ALLOWED.has(t) ? t : 'resumen';
}

/** Valor de query `estado` para GET admin (todas = sin filtro). */
function mapFiltroSolicitudesTabToApiEstado(filt) {
  const f = String(filt || '').trim().toLowerCase();
  if (f === 'todos' || f === 'todas') return 'todas';
  return f || 'pendiente';
}

function waDigitsForUrl(raw) {
  return String(raw || '').replace(/\D/g, '') || '';
}

function adminReservaJugadorWhatsappWaMeUrl(storedWhatsApp) {
  const d = waDigitsForUrl(storedWhatsApp);
  return d ? `https://wa.me/${d}` : '';
}

/** Nombre + email + WhatsApp de ficha (`jugador_whatsapp_perfil`) en listado/detalle reservas admin. */
function AdminReservaJugadorContacto({ reserva }) {
  const email = String(reserva.email || '').trim();
  const waPerfil = String(reserva.jugador_whatsapp_perfil || '').trim();
  const waUrl = adminReservaJugadorWhatsappWaMeUrl(waPerfil);
  const nombre = String(reserva.nombre || '').trim() || '—';
  return (
    <div style={{ overflow: 'hidden', minWidth: 0, lineHeight: 1.4 }}>
      <div
        style={{
          fontWeight: 600,
          color: '#0f172a',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={nombre}
      >
        {nombre}
      </div>
      {email ? (
        <div style={{ fontSize: '12px', marginTop: '2px' }}>
          <a
            href={`mailto:${encodeURIComponent(email)}`}
            onClick={(e) => e.stopPropagation()}
            style={{ color: '#4f46e5', wordBreak: 'break-all' }}
          >
            {email}
          </a>
        </div>
      ) : null}
      {waUrl ? (
        <div
          style={{
            fontSize: '12px',
            marginTop: '4px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px',
            rowGap: '4px',
          }}
        >
          <span style={{ color: '#475569', wordBreak: 'break-word' }}>{waPerfil}</span>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 8px',
              borderRadius: '6px',
              background: '#15803d',
              color: '#fff',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '11px',
              whiteSpace: 'nowrap',
            }}
          >
            📱 WhatsApp
          </a>
        </div>
      ) : null}
    </div>
  );
}

/** Pills de filtro: inactivo blanco + borde gris; activo #667eea + texto blanco (Resumen, Torneos, Reservas). */
const ADMIN_FILTER_PILL_BASE = {
  padding: '8px 14px',
  borderRadius: '999px',
  fontSize: '13px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  lineHeight: 1.25,
  boxSizing: 'border-box',
};

function adminFilterPillButtonStyle(active) {
  if (active) {
    return {
      ...ADMIN_FILTER_PILL_BASE,
      background: '#667eea',
      color: '#fff',
      border: 'none',
    };
  }
  return {
    ...ADMIN_FILTER_PILL_BASE,
    background: '#fff',
    color: '#1e293b',
    border: '1px solid #e2e8f0',
  };
}

const MS_48H = 48 * 60 * 60 * 1000;

/** `YYYY-MM-DD` → inicio del día en hora local; inválido → null */
function parseLocalDayStartFromIsoDate(iso) {
  const s = String(iso || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  if (![y, m, d].every((n) => Number.isFinite(n))) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Inscripción “cierra pronto”: primera fecha del torneo dentro de las próximas 48 h (proxy de cierre). */
function torneoCierreInscripcionDentroDe48h(torneo, now = new Date()) {
  const start = parseLocalDayStartFromIsoDate(torneo?.fecha_inicio);
  if (!start) return false;
  const ms = start.getTime() - now.getTime();
  return ms > 0 && ms <= MS_48H;
}

function torneoEstadoInscripcionAbiertaAdmin(t) {
  const e = String(t?.estado || '').toLowerCase();
  return e === 'abierto' || e === 'inscripcion_abierta';
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

function startOfWeekMondayLocal(anchorDate) {
  const t = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  const day = t.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  t.setDate(t.getDate() - diffToMonday);
  t.setHours(0, 0, 0, 0);
  return t;
}

function endOfWeekSundayEndLocal(startMonday) {
  const t = new Date(startMonday);
  t.setDate(t.getDate() + 6);
  t.setHours(23, 59, 59, 999);
  return t;
}

/** ISO week-year y número de semana ISO (etiqueta tipo "Semana 18 · 2026"). */
function isoWeekYearAndNumberLocal(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setHours(12, 0, 0, 0);
  const dayNr = (x.getDay() + 6) % 7;
  const thursday = new Date(x);
  thursday.setDate(x.getDate() + 3 - dayNr);
  const isoYear = thursday.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const jan4MonOffset = (jan4.getDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4MonOffset);
  week1Monday.setHours(0, 0, 0, 0);
  const thisMonday = new Date(thursday);
  thisMonday.setDate(thursday.getDate() - 3);
  thisMonday.setHours(0, 0, 0, 0);
  const weekNum = Math.round((thisMonday - week1Monday) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { isoYear, weekNum };
}

/** `fechaISO` = YYYY-MM-DD (reserva o fecha derivada de equipo). `anclaISO` ancla el día/semana/mes/año mostrado. */
function fechaDentroDePeriodoFinanzas(fechaISO, periodo, fechaDesde, fechaHasta, anclaISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaISO || '').trim())) return false;
  const [y, m, d] = String(fechaISO).trim().split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  if (Number.isNaN(fecha.getTime())) return false;

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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(anclaISO || '').trim())) return false;
  const [ay, am, ad] = String(anclaISO).trim().split('-').map(Number);
  const ancla = new Date(ay, am - 1, ad);
  if (Number.isNaN(ancla.getTime())) return false;

  if (periodo === 'hoy') {
    const start = new Date(ay, am - 1, ad, 0, 0, 0, 0);
    const end = new Date(ay, am - 1, ad, 23, 59, 59, 999);
    return fecha >= start && fecha <= end;
  }
  if (periodo === 'semana') {
    const start = startOfWeekMondayLocal(ancla);
    const end = endOfWeekSundayEndLocal(start);
    return fecha >= start && fecha <= end;
  }
  if (periodo === 'mes') {
    const start = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
    const end = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0, 23, 59, 59, 999);
    return fecha >= start && fecha <= end;
  }
  if (periodo === 'anio') {
    const start = new Date(ancla.getFullYear(), 0, 1);
    const end = new Date(ancla.getFullYear(), 11, 31, 23, 59, 59, 999);
    return fecha >= start && fecha <= end;
  }
  return false;
}

function labelNavegacionFinanzas(periodo, anclaISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(anclaISO || '').trim())) return '—';
  const [y, m, d] = anclaISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return '—';
  if (periodo === 'hoy') {
    return dt
      .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .replace(/^\w/, (c) => c.toUpperCase());
  }
  if (periodo === 'semana') {
    const { isoYear, weekNum } = isoWeekYearAndNumberLocal(dt);
    return `Semana ${weekNum} · ${isoYear}`;
  }
  if (periodo === 'mes') {
    const s = dt.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (periodo === 'anio') return String(y);
  return '—';
}

function addToFinanzasAncla(anclaISO, periodo, delta) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(anclaISO || '').trim())) {
    return new Date().toISOString().slice(0, 10);
  }
  const [y, m, d] = anclaISO.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  if (periodo === 'hoy') base.setDate(base.getDate() + delta);
  else if (periodo === 'semana') base.setDate(base.getDate() + 7 * delta);
  else if (periodo === 'mes') base.setMonth(base.getMonth() + delta);
  else if (periodo === 'anio') base.setFullYear(base.getFullYear() + delta);
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function SuperAdminFinanzasPeriodoNav({ periodo, anclaISO, onShift }) {
  if (periodo === 'rango' || periodo === 'hoy') return null;
  if (!['semana', 'mes', 'anio'].includes(periodo)) return null;
  const label = labelNavegacionFinanzas(periodo, anclaISO);
  const btn = {
    border: '1px solid #cbd5e1',
    background: '#fff',
    borderRadius: '8px',
    width: '36px',
    height: '34px',
    cursor: 'pointer',
    fontSize: '17px',
    lineHeight: 1,
    fontWeight: 800,
    color: '#334155',
    flexShrink: 0,
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        marginTop: '10px',
        flexWrap: 'wrap',
      }}
    >
      <button type="button" aria-label="Período anterior" onClick={() => onShift(-1)} style={btn}>
        {'<'}
      </button>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#FFFFFF',
          minWidth: '140px',
          textAlign: 'center',
        }}
      >
        {label}
      </span>
      <button type="button" aria-label="Período siguiente" onClick={() => onShift(1)} style={btn}>
        {'>'}
      </button>
    </div>
  );
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
  if (String(reserva.estado || '').toLowerCase() === 'pendiente_pago_manual') {
    return <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: 700 }}>🟡 Pago manual pendiente</span>;
  }
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

/** Pills filtro listado reservas (pestaña Reservas). */
const FILTROS_RESERVA_ADMIN_PILLS = [
  { id: 'todas', label: 'Todas' },
  { id: 'confirmadas', label: 'Confirmadas' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'canceladas', label: 'Canceladas' },
];

/** Buckets alineados con {@link EstadoBadge}: cancelada | pendientes (reservada u otro) | confirmadas (confirmada/completada). */
function bucketEstadoReservaAdmin(estadoRaw) {
  const e = String(estadoRaw || '').trim().toLowerCase();
  if (e === 'cancelada') return 'canceladas';
  if (e === 'reservada' || e === 'pendiente_pago_manual') return 'pendientes';
  if (e === 'confirmada' || e === 'completada') return 'confirmadas';
  return 'pendientes';
}

function reservaPasaFiltroEstadoPill(r, filtro) {
  if (!filtro || filtro === 'todas') return true;
  return bucketEstadoReservaAdmin(r?.estado) === filtro;
}

function sortReservasFechaHoraDesc(arr) {
  const key = (r) => {
    const f = String(r?.fecha || '').trim();
    const start = String(r?.hora || '').split(' - ')[0].trim() || '00:00';
    const hm = /^\d{1,2}:\d{2}/.test(start) ? start.slice(0, 5).padStart(5, '0') : '00:00';
    return `${f}T${hm}`;
  };
  return [...arr].sort((a, b) => key(b).localeCompare(key(a)));
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
const PAISES_SEDE_OPTIONS = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS]
  .map((p) => ({ value: `${p.bandera} ${p.nombre}`.trim(), label: `${p.bandera} ${p.nombre}`.trim() }))
  .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

/** Par U+1F1E6–U+1F1FF al inicio = bandera regional (ej. 🇦🇷 son 2 code points). */
function esIndicadorRegionalChar(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  return cp >= 0x1f1e6 && cp <= 0x1f1ff;
}

function banderaRegionalAlInicio(pais) {
  const s = String(pais || '').trim();
  if (!s) return '';
  const cps = [...s];
  if (cps.length >= 2 && esIndicadorRegionalChar(cps[0]) && esIndicadorRegionalChar(cps[1])) {
    return `${cps[0]}${cps[1]}`;
  }
  return '';
}

/** Quita el par RI inicial si existe (para mostrar solo el nombre o matchear FLAG_MAP). */
function paisTextoSinBanderaInicial(pais) {
  const s = String(pais || '').trim();
  const cps = [...s];
  if (cps.length >= 2 && esIndicadorRegionalChar(cps[0]) && esIndicadorRegionalChar(cps[1])) {
    return cps.slice(2).join('').trim();
  }
  return s;
}

/** Texto visible en `<option>` del filtro móvil: siempre bandera + nombre cuando exista en el mapa o ya venga en el valor. */
function etiquetaPaisFiltroMobile(valorRaw) {
  const raw = String(valorRaw || '').trim();
  if (!raw) return '';
  const sinBandera = paisTextoSinBanderaInicial(raw);
  const flag = banderaRegionalAlInicio(raw) || FLAG_MAP[sinBandera.toLowerCase()] || FLAG_MAP[raw.toLowerCase()] || '';
  const nombre = sinBandera || raw;
  return flag ? `${flag} ${nombre}`.trim() : nombre;
}

function sedeFlag(sede) {
  if (!sede?.pais) return '';
  const pais = sede.pais.trim();
  const regional = banderaRegionalAlInicio(pais);
  if (regional) return regional;
  return FLAG_MAP[pais.toLowerCase()] || '';
}

/** Filtro país super admin: valor del `<select>` vs `sede.pais` de la reserva. */
function mismoPaisFiltroAdmin(paisRow, paisFiltroValor) {
  const want = String(paisFiltroValor || '').trim();
  if (!want) return true;
  const p = String(paisRow || '').trim();
  if (!p) return false;
  const a = paisTextoSinBanderaInicial(p).toLowerCase();
  const b = paisTextoSinBanderaInicial(want).toLowerCase();
  if (a === b) return true;
  return p.toLowerCase() === want.toLowerCase();
}

function comisionPadbolTresPorcientoPorMoneda(ingresosPorMoneda) {
  const out = {};
  ['ARS', 'USD', 'EUR'].forEach((m) => {
    const n = Number(ingresosPorMoneda?.[m]) || 0;
    if (n > 0) out[m] = Math.round(n * 0.03 * 100) / 100;
  });
  return out;
}

function fmtIngresosSuperAdmin(obj) {
  const MONEDA_ORDEN = ['ARS', 'USD', 'EUR'];
  const keys = Object.keys(obj || {});
  const ordered = [
    ...MONEDA_ORDEN.filter((m) => keys.includes(m)),
    ...keys.filter((m) => !MONEDA_ORDEN.includes(m)),
  ];
  const parts = ordered
    .filter((m) => (Number(obj?.[m]) || 0) > 0)
    .map((m) => `${m} ${(Number(obj?.[m]) || 0).toLocaleString('es-AR')}`);
  return parts.length ? parts.join(' · ') : 'Sin ingresos en el período';
}

/** Clave numérica solo para ordenar filas con varias monedas (ingresos ≈ suma nominal). */
function ingresoTotalOrdenRanking(ingresosObj) {
  return (Number(ingresosObj?.ARS) || 0) + (Number(ingresosObj?.USD) || 0) + (Number(ingresosObj?.EUR) || 0);
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

function sedeIdDesdeNombreReserva(nombreReserva, sedesMap) {
  const n = String(nombreReserva || '').trim().toLowerCase();
  if (!n) return null;
  for (const s of Object.values(sedesMap || {})) {
    if (String(s.nombre || '').trim().toLowerCase() === n) return s.id;
  }
  return null;
}

/** Fecha local YYYY-MM-DD + minutos desde medianoche en Argentina. */
function ahoraArgentinaPartes() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || '';
  const y = parseInt(get('year'), 10);
  const mo = parseInt(get('month'), 10);
  const da = parseInt(get('day'), 10);
  const hh = parseInt(get('hour'), 10);
  const mi = parseInt(get('minute'), 10);
  const hoyISO = `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  return { hoyISO, minutesNow: hh * 60 + mi };
}

function minutosInicioReserva(horaRaw) {
  const startHora = String(horaRaw || '').split(' - ')[0].trim() || '00:00';
  const m = /^(\d{1,2}):(\d{2})/.exec(startHora);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Misma fecha calendario en ART, no cancelada, hora actual ∈ [inicio, fin). */
function reservaActivaAhoraArgentina(r, ctx) {
  const fecha = String(r?.fecha || '').trim().slice(0, 10);
  if (fecha !== ctx.hoyISO) return false;
  const est = String(r?.estado || '').trim().toLowerCase();
  if (est === 'cancelada' || r?.cancelada) return false;
  const dur = parseInt(r?.duracion, 10);
  const duracion = Number.isFinite(dur) && dur > 0 ? dur : 90;
  const start = minutosInicioReserva(r?.hora);
  const end = start + duracion;
  return ctx.minutesNow >= start && ctx.minutesNow < end;
}

function sortReservasHoyAsc(arr) {
  const key = (r) => {
    const f = String(r?.fecha || '').trim();
    const start = String(r?.hora || '').split(' - ')[0].trim() || '00:00';
    const hm = /^\d{1,2}:\d{2}/.test(start) ? start.slice(0, 5).padStart(5, '0') : '00:00';
    return `${f}T${hm}`;
  };
  return [...arr].sort((a, b) => key(a).localeCompare(key(b)));
}

/** Igual criterio que en backend (`normalizeEstadoCancha`). */
function normalizeEstadoCanchaAdminDash(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'inactiva' || s === 'inactive' || s === 'false') return 'inactiva';
  return 'activa';
}

function canchasConNumeroReservaAdminDash(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => Number(a.id) - Number(b.id));
  return list.map((c, i) => {
    const o = c.orden != null && c.orden !== '' ? Number(c.orden) : NaN;
    const numero_reserva = Number.isFinite(o) && o > 0 ? o : i + 1;
    return { ...c, numero_reserva };
  });
}

function parseHorarioHoraEnteraAdminDash(raw, defaultH) {
  const s = String(raw || '').trim();
  const m = /^(\d{1,2})/.exec(s);
  if (!m) return defaultH;
  const h = parseInt(m[1], 10);
  return Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : defaultH;
}

/** Inicio "HH:MM" desde `hora` tipo "10:00 - 11:30". */
function normalizeHoraInicioReservaAdminDash(horaRaw) {
  const t = String(horaRaw || '').split(' - ')[0].trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return '';
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mi = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

function minutosDesdeMedianocheHHMMAdminDash(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function minutosInicioReservaAdminDash(r) {
  const s = normalizeHoraInicioReservaAdminDash(r?.hora);
  return minutosDesdeMedianocheHHMMAdminDash(s);
}

/** Inicios de turno posibles desde ahora hasta el cierre (ART), misma grilla que ReservaForm. */
function futureSlotStartsArtAdminDash(sedeRow, ctx) {
  const horaApertura = parseHorarioHoraEnteraAdminDash(sedeRow?.horario_apertura, 10);
  const horaCierre = parseHorarioHoraEnteraAdminDash(sedeRow?.horario_cierre, 23);
  const duracion = parseInt(sedeRow?.duracion_reserva_minutos, 10) || 90;
  const { minutesNow } = ctx;
  const out = [];
  for (let h = horaApertura; h < horaCierre; h += 1) {
    for (let m = 0; m < 60; m += duracion) {
      const slotEndMinutes = m + duracion;
      const slotEndHours = h + Math.floor(slotEndMinutes / 60);
      const slotEndMins = slotEndMinutes % 60;
      if (slotEndHours < horaCierre || (slotEndHours === horaCierre && slotEndMins === 0)) {
        const horaInicio = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const startMin = h * 60 + m;
        if (startMin >= minutesNow) out.push(horaInicio);
      }
    }
  }
  return out;
}

function torneoProximoSinEmpezar(t) {
  const e = String(t?.estado || '').toLowerCase();
  if (e === 'finalizado' || e === 'cancelado') return false;
  if (e === 'en_curso' || e === 'activo') return false;
  return true;
}

function formatoIngresosHoyMultimoneda(porMoneda) {
  const MON = ['ARS', 'USD', 'EUR'];
  const parts = MON.filter((m) => (Number(porMoneda[m]) || 0) > 0).map((m) => {
    const n = Number(porMoneda[m]) || 0;
    if (m === 'ARS') return `$ ${n.toLocaleString('es-AR')} ARS`;
    if (m === 'USD') return `US$ ${n.toLocaleString('en-US')} USD`;
    return `€ ${n.toLocaleString('de-DE')} EUR`;
  });
  return parts.length ? parts.join(' · ') : '$ 0 (sin ingresos registrados)';
}

function labelPeriodoFinanciero(periodo) {
  if (periodo === 'hoy') return 'hoy';
  if (periodo === 'semana') return 'semana';
  if (periodo === 'mes') return 'mes';
  if (periodo === 'anio') return 'anio';
  return 'rango';
}

function ymdToLabelShort(iso) {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}

function contratoBadgeData(contrato) {
  const fv = String(contrato?.fecha_vencimiento || '').trim();
  if (!fv) return { label: 'Vigente', bg: '#16a34a', color: '#fff' };
  const now = new Date();
  const venc = new Date(`${fv}T23:59:59`);
  if (Number.isNaN(venc.getTime())) return { label: 'Vigente', bg: '#16a34a', color: '#fff' };
  const days = Math.ceil((venc.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return { label: 'Vencido', bg: '#dc2626', color: '#fff' };
  if (days <= 30) return { label: 'Por vencer', bg: '#f59e0b', color: '#111827' };
  return { label: 'Vigente', bg: '#16a34a', color: '#fff' };
}

function sedeLicenciaChip(s) {
  const licActiva = s.licencia_activa === true && s.numero_licencia;
  if (licActiva) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 700,
          background: '#dcfce7',
          color: '#166534',
        }}
      >
        Activa · {String(s.numero_licencia).trim()}
      </span>
    );
  }
  if (s.numero_licencia) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 700,
          background: '#fee2e2',
          color: '#991b1b',
        }}
      >
        Inactiva
      </span>
    );
  }
  return <span style={{ color: '#64748b', fontSize: '13px' }}>Sin licencia</span>;
}

/** Panel contrato + suscripción (super admin, detalle expandido) — compartido tabla / tarjeta móvil. */
function SedeSuperDetallePanel({
  s,
  contrato,
  badge,
  suscripcionEstadoSuperSavingId,
  guardarSuscripcionEstadoSuper,
  activarSuscripcionStripeSede,
}) {
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div style={{ display: 'grid', gap: '6px' }}>
        <div style={{ fontWeight: 800, color: '#334155' }}>Contrato</div>
        <div style={{ fontSize: '13px' }}>
          <strong>Inicio:</strong> {contrato?.fecha_inicio || '—'} · <strong>Vencimiento:</strong>{' '}
          {contrato?.fecha_vencimiento || '—'} · <strong>Referencia:</strong> {contrato?.referencia || '—'}
        </div>
        <div>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: '999px',
              background: badge.bg,
              color: badge.color,
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {badge.label}
          </span>
          {contrato?.archivo_url ? (
            <a href={contrato.archivo_url} target="_blank" rel="noreferrer" style={{ marginLeft: '10px', fontSize: '13px' }}>
              Descargar contrato
            </a>
          ) : null}
        </div>
      </div>
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'grid', gap: '8px' }}>
        <div style={{ fontWeight: 800, color: '#334155' }}>Suscripción Padbol Match (Stripe)</div>
        <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
          <strong>Estado:</strong> {etiquetaSuscripcionEstado(s.suscripcion_estado)}
          <br />
          <strong>Próximo cobro:</strong> {formatProximoCobroAdmin(s.suscripcion_proximo_cobro)}
        </div>
        <div
          style={{
            marginTop: '10px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <label style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Cambiar estado (super admin)</label>
          <select
            value={(() => {
              const cur = String(s.suscripcion_estado || '').trim().toLowerCase();
              if (SUSCRIPCION_SELECTOR_SUPER_VALUES.has(cur)) return cur;
              return cur || 'activa';
            })()}
            disabled={suscripcionEstadoSuperSavingId === s.id}
            onChange={(e) => {
              const v = e.target.value;
              const prev = String(s.suscripcion_estado || '').trim().toLowerCase();
              if (v === prev) return;
              if (!window.confirm(`¿Guardar estado de suscripción como "${v}"?`)) {
                e.target.value = SUSCRIPCION_SELECTOR_SUPER_VALUES.has(prev) ? prev : SUSCRIPCION_SELECTOR_SUPER_SEDE[0].value;
                return;
              }
              void guardarSuscripcionEstadoSuper(s, v);
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              maxWidth: '100%',
            }}
          >
            {(() => {
              const cur = String(s.suscripcion_estado || '').trim().toLowerCase();
              const extra =
                cur && !SUSCRIPCION_SELECTOR_SUPER_VALUES.has(cur) ? (
                  <option key="__actual" value={cur}>
                    {etiquetaSuscripcionEstado(s.suscripcion_estado)} (actual)
                  </option>
                ) : null;
              return (
                <>
                  {extra}
                  {SUSCRIPCION_SELECTOR_SUPER_SEDE.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </>
              );
            })()}
          </select>
          {suscripcionEstadoSuperSavingId === s.id ? (
            <span style={{ fontSize: '12px', color: '#64748b' }}>Guardando…</span>
          ) : null}
        </div>
        {String(s.suscripcion_estado || '').toLowerCase() !== 'activa' &&
        String(s.suscripcion_estado || '').toLowerCase() !== 'pendiente_pago' ? (
          <button
            type="button"
            onClick={() => void activarSuscripcionStripeSede(s)}
            style={{
              justifySelf: 'start',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #635bff, #0a2540)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Activar suscripción
          </button>
        ) : String(s.suscripcion_estado || '').toLowerCase() === 'pendiente_pago' ? (
          <button
            type="button"
            onClick={() => void activarSuscripcionStripeSede(s)}
            style={{
              justifySelf: 'start',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#ca8a04',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Completar pago (tarjeta)
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminDashboard({ apiBaseUrl = 'https://padbol-backend.onrender.com', rol = null, sedeId = null }) {
  console.log('AdminDashboard montado', { rol, sedeId });
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const currentEmail = (session?.user?.email || '').trim().toLowerCase();

  const isSuperAdmin = rol === 'super_admin';
  const isAdmin =
    isSuperAdmin || rol === 'admin_nacional' || rol === 'admin_club';

  // Role-based access flags
  const esAdminNacional = rol === 'admin_nacional';
  const esAdminClub     = rol === 'admin_club';
  const puedeVerConfig  = isSuperAdmin;

  const paisAdminNacional = useMemo(() => {
    if (!esAdminNacional) return '';
    try {
      const roleData = JSON.parse(localStorage.getItem('user_role_data') || '{}');
      const raw = roleData.pais;
      return raw ? String(raw).replace(/^[\p{Emoji_Presentation}\s]*/u, '').trim() : '';
    } catch {
      return '';
    }
  }, [esAdminNacional]);

  const [jugadoresFederadosPais, setJugadoresFederadosPais] = useState([]);
  const [totalJugadoresPais, setTotalJugadoresPais] = useState(0);
  const [nacionalJugadoresLoading, setNacionalJugadoresLoading] = useState(false);
  const puedeVerSedesPendientes = isSuperAdmin;
  const puedeCrearTorneosOficiales = isSuperAdmin || (!esAdminClub);

  const ROLE_BADGE = {
    super_admin:    '👑 Super Admin',
    admin_nacional: '🌎 Admin Nacional',
    admin_club:     '🏠 Admin Club',
  };

  const [reservas, setReservas] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [filtroEstadoTorneoAdmin, setFiltroEstadoTorneoAdmin] = useState('todos');
  const [filtroPillReservas, setFiltroPillReservas] = useState('todas');
  const [sedesMap, setSedesMap] = useState({});
  const [contratosBySedeId, setContratosBySedeId] = useState({});
  const [sedeDetalleAbiertoId, setSedeDetalleAbiertoId] = useState(null);
  /** Filtros país/ciudad super_admin (tabla desktop + tarjetas móvil; paginación sobre lista filtrada). */
  const [sedeMobileFiltroPais, setSedeMobileFiltroPais] = useState('');
  const [sedeMobileFiltroCiudad, setSedeMobileFiltroCiudad] = useState('');
  /** Paginación lista sedes (super_admin), sobre resultados filtrados por país/ciudad */
  const [sedesSuperAdminPagina, setSedesSuperAdminPagina] = useState(1);
  /** Equipos de torneos en alcance (para ingresos por inscripción confirmada). */
  const [equiposInscripcionRows, setEquiposInscripcionRows] = useState([]);
  /** sede_id → { total, activas } para ocupación de canchas. */
  const [canchasResumenPorSede, setCanchasResumenPorSede] = useState({});
  /** sede_id → filas cancha (id, nombre, estado, orden, numero_reserva) para resumen admin_club. */
  const [canchasDetallePorSede, setCanchasDetallePorSede] = useState({});
  const [partidosCountByTorneoId, setPartidosCountByTorneoId] = useState({});
  /** Debe declararse antes de `dashboardFinanciero` (useMemo) — ese memo lee equipos_count por torneo. */
  const [torneoStats, setTorneoStats] = useState({});
  const [torneoStatsTick, setTorneoStatsTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [mensajeExito, setMensajeExito] = useState('');
  const [activeTab, setActiveTab] = useState(() => sanitizeAdminActiveTab(searchParams.get('tab')));
  const [nuevaSedeModalOpen, setNuevaSedeModalOpen] = useState(false);

  const [pendientes, setPendientes] = useState([]);
  const [pendientesLoading, setPendientesLoading] = useState(true);
  // keyed by player email: { open: bool, categoria: string, saving: bool }
  const [validacionState, setValidacionState] = useState({});
  /** Vista Reservas super_admin: resumen global vs ranking de clubes. */
  const [reservasSuperSubVista, setReservasSuperSubVista] = useState('principal');
  const [superReservasFiltroPais, setSuperReservasFiltroPais] = useState('');
  const [rankingFiltroCiudad, setRankingFiltroCiudad] = useState('');
  const [rankingFiltroNombreClub, setRankingFiltroNombreClub] = useState('');
  const [rankingOrden, setRankingOrden] = useState({ campo: 'reservas', dir: 'desc' });
  /** Fila del ranking con detalle expandido (mismo listado que antes "Ver detalle"). */
  const [rankingDetalleSedeKey, setRankingDetalleSedeKey] = useState(null);
  const [superAdminPeriodo, setSuperAdminPeriodo] = useState('hoy'); // hoy | semana | mes | anio | rango
  const [superAdminFechaDesde, setSuperAdminFechaDesde] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [superAdminFechaHasta, setSuperAdminFechaHasta] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  /** Día ancla para navegar semana/mes/año (e "hoy" como día concreto) en resumen y reservas super admin. */
  const [finanzasAnclaISO, setFinanzasAnclaISO] = useState(() => new Date().toISOString().slice(0, 10));

  const [sedesPendientes, setSedesPendientes] = useState([]);
  const [sedesPendientesLoading, setSedesPendientesLoading] = useState(false);
  const [solicitudesLicencia, setSolicitudesLicencia] = useState([]);
  const [solicitudesLicenciaLoading, setSolicitudesLicenciaLoading] = useState(false);
  /** Modal al aprobar solicitud web: super_admin elige tipo_interes antes de ir a Nueva sede. */
  const [licApruebaTipoModal, setLicApruebaTipoModal] = useState(null);
  const [licApruebaTipoSaving, setLicApruebaTipoSaving] = useState(false);
  /** Filtro unificado Solicitudes (tab); default pendiente para priorizar acción. */
  const [solicitudesFiltroEstado, setSolicitudesFiltroEstado] = useState('pendiente');
  const [solicitudDetalleExpandidoKey, setSolicitudDetalleExpandidoKey] = useState(null);
  /** Conteos solo con GET pendiente (alerta Resumen; no depende del filtro de la tab Solicitudes). */
  const [snapPendienteSedes, setSnapPendienteSedes] = useState(0);
  const [snapPendienteLic, setSnapPendienteLic] = useState(0);
  const [adminScopeMeta, setAdminScopeMeta] = useState(null);
  const [adminRolesRows, setAdminRolesRows] = useState([]);
  const [adminRolesLoading, setAdminRolesLoading] = useState(false);
  const [adminRoleModalOpen, setAdminRoleModalOpen] = useState(false);
  const [adminRoleAssignMobile, setAdminRoleAssignMobile] = useState(false);
  const [adminRoleSaving, setAdminRoleSaving] = useState(false);
  const [adminRoleForm, setAdminRoleForm] = useState({
    email: '',
    nombre: '',
    role: 'admin_club',
    alcance: 'sede',
    sede_id: '',
    ciudad: '',
    provincia: '',
    pais: '',
  });
  const [adminInvitacionesRows, setAdminInvitacionesRows] = useState([]);
  const [adminInvitacionesLoading, setAdminInvitacionesLoading] = useState(false);
  const [inviteClubModalOpen, setInviteClubModalOpen] = useState(false);
  const [inviteClubSaving, setInviteClubSaving] = useState(false);
  const [inviteClubForm, setInviteClubForm] = useState({ email: '', nombre_club: '', pais: '' });
  const [adminClubOnboardingOpen, setAdminClubOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!esAdminClub || loading) return;
    if (readOnboardingDone()) return;
    const t = window.setTimeout(() => setAdminClubOnboardingOpen(true), 450);
    return () => window.clearTimeout(t);
  }, [esAdminClub, loading]);

  const applyOnboardingTab = useCallback(
    (tabId) => {
      const id = sanitizeAdminActiveTab(tabId);
      setActiveTab(id);
      try {
        sessionStorage.setItem('adminActiveTab', id);
      } catch {
        /* ignore */
      }
      navigate(`/admin?tab=${encodeURIComponent(id)}`, { replace: true });
    },
    [navigate]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setAdminRoleAssignMobile(Boolean(mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const [vistaReservasAdminTarjetas, setVistaReservasAdminTarjetas] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setVistaReservasAdminTarjetas(Boolean(mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const setAdminRoleTipoMobile = useCallback((role) => {
    setAdminRoleForm((p) => {
      if (role === 'admin_club') {
        return {
          ...p,
          role,
          alcance: 'sede',
          pais: '',
          ciudad: '',
          provincia: '',
        };
      }
      return {
        ...p,
        role,
        alcance: 'pais',
        sede_id: '',
        ciudad: '',
        provincia: '',
      };
    });
  }, []);

  const cargarSedesPendientes = useCallback(
    async (estadoQuery = 'pendiente') => {
      if (!puedeVerSedesPendientes) return;
      setSedesPendientesLoading(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error('Sin sesión');
        const eq = String(estadoQuery || 'pendiente').trim().toLowerCase();
        const res = await fetch(`${apiBaseUrl}/api/admin/sedes-pendientes?estado=${encodeURIComponent(eq)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json().catch(() => []);
        if (!res.ok) throw new Error(j.error || res.statusText);
        const rows = Array.isArray(j) ? j : [];
        setSedesPendientes(rows);
        if (eq === 'pendiente') setSnapPendienteSedes(rows.length);
      } catch (e) {
        console.error('[AdminDashboard] sedes pendientes:', e);
        setSedesPendientes([]);
        if (String(estadoQuery || '').toLowerCase() === 'pendiente') setSnapPendienteSedes(0);
      } finally {
        setSedesPendientesLoading(false);
      }
    },
    [apiBaseUrl, puedeVerSedesPendientes]
  );

  const cargarSolicitudesLicencia = useCallback(
    async (estadoQuery = 'pendiente') => {
      if (!isSuperAdmin) return;
      setSolicitudesLicenciaLoading(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error('Sin sesión');
        const eq = String(estadoQuery || 'pendiente').trim().toLowerCase();
        const res = await fetch(`${apiBaseUrl}/api/admin/solicitudes-licencia?estado=${encodeURIComponent(eq)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json().catch(() => []);
        if (!res.ok) throw new Error(j?.error || res.statusText);
        const rows = Array.isArray(j) ? j : [];
        setSolicitudesLicencia(rows);
        if (eq === 'pendiente') setSnapPendienteLic(rows.length);
      } catch (e) {
        console.error('[AdminDashboard] solicitudes licencia:', e);
        setSolicitudesLicencia([]);
        if (String(estadoQuery || '').toLowerCase() === 'pendiente') setSnapPendienteLic(0);
      } finally {
        setSolicitudesLicenciaLoading(false);
      }
    },
    [apiBaseUrl, isSuperAdmin]
  );

  const refreshSnapPendientesOnly = useCallback(async () => {
    if (!puedeVerSedesPendientes || !isSuperAdmin) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return;
      const [r1, r2] = await Promise.all([
        fetch(`${apiBaseUrl}/api/admin/sedes-pendientes?estado=pendiente`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBaseUrl}/api/admin/solicitudes-licencia?estado=pendiente`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const j1 = await r1.json().catch(() => []);
      const j2 = await r2.json().catch(() => []);
      setSnapPendienteSedes(Array.isArray(j1) ? j1.length : 0);
      setSnapPendienteLic(Array.isArray(j2) ? j2.length : 0);
    } catch {
      /* noop */
    }
  }, [apiBaseUrl, isSuperAdmin, puedeVerSedesPendientes]);

  const refetchSolicitudesTabLists = useCallback(() => {
    if (!isSuperAdmin || activeTab !== 'solicitudes') return;
    const apiEst = mapFiltroSolicitudesTabToApiEstado(solicitudesFiltroEstado);
    void cargarSedesPendientes(apiEst);
    void cargarSolicitudesLicencia(apiEst);
  }, [activeTab, isSuperAdmin, solicitudesFiltroEstado, cargarSedesPendientes, cargarSolicitudesLicencia]);

  const rechazarSolicitudLicencia = useCallback(
    async (id) => {
      const motivo = window.prompt('Motivo del rechazo (opcional):');
      if (motivo == null) return;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error('Sin sesión');
        const res = await fetch(`${apiBaseUrl}/api/admin/solicitudes-licencia/${id}/rechazar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo: motivo || '' }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || res.statusText);
        setMensajeExito('Solicitud rechazada');
        setTimeout(() => setMensajeExito(''), 3000);
        void refreshSnapPendientesOnly();
        refetchSolicitudesTabLists();
      } catch (e) {
        alert(e?.message || 'No se pudo rechazar la solicitud');
      }
    },
    [apiBaseUrl, refetchSolicitudesTabLists, refreshSnapPendientesOnly]
  );

  const abrirModalAprobarLicenciaWeb = useCallback((rawLicencia) => {
    const rawTipo = String(rawLicencia?.tipo_interes || '').trim();
    const pickDefault = TIPO_INTERES_APROBAR_SOLICITUD_LIC.includes(rawTipo) ? rawTipo : 'Club Afiliado';
    setLicApruebaTipoModal({ rawLicencia, tipoInteresSeleccionado: pickDefault });
  }, []);

  const confirmarTipoYContinuarAprobarLicenciaWeb = useCallback(async () => {
    if (!licApruebaTipoModal?.rawLicencia) return;
    const id = licApruebaTipoModal.rawLicencia.id;
    const tipo = licApruebaTipoModal.tipoInteresSeleccionado;
    setLicApruebaTipoSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Sin sesión');
      const res = await fetch(`${apiBaseUrl}/api/admin/solicitudes-licencia/${id}/tipo-interes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_interes: tipo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setLicApruebaTipoModal(null);
      navigate('/admin/nueva-sede', { state: { prefillSolicitud: j } });
    } catch (e) {
      alert(e?.message || 'No se pudo guardar el tipo de interés');
    } finally {
      setLicApruebaTipoSaving(false);
    }
  }, [apiBaseUrl, licApruebaTipoModal, navigate]);

  const cargarRolesAdmin = useCallback(async () => {
    if (!isSuperAdmin) return;
    setAdminRolesLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Sin sesión');
      const res = await fetch(`${apiBaseUrl}/api/admin/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => []);
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setAdminRolesRows(Array.isArray(j) ? j : []);
    } catch (e) {
      console.error('[AdminDashboard] roles admin:', e);
      setAdminRolesRows([]);
    } finally {
      setAdminRolesLoading(false);
    }
  }, [apiBaseUrl, isSuperAdmin]);

  const abrirModalAsignarRol = useCallback(() => {
    setAdminRoleForm({
      email: '',
      nombre: '',
      role: 'admin_club',
      alcance: 'sede',
      sede_id: '',
      ciudad: '',
      provincia: '',
      pais: '',
    });
    setAdminRoleModalOpen(true);
  }, []);

  const guardarRolAdmin = useCallback(async () => {
    if (!isSuperAdmin) return;
    if (!String(adminRoleForm.email || '').trim()) {
      alert('Email obligatorio');
      return;
    }
    setAdminRoleSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Sin sesión');
      const res = await fetch(`${apiBaseUrl}/api/admin/roles`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...adminRoleForm,
          email: String(adminRoleForm.email || '').trim().toLowerCase(),
          sede_id: adminRoleForm.sede_id ? Number(adminRoleForm.sede_id) : null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setAdminRoleModalOpen(false);
      setMensajeExito('✅ Rol asignado/actualizado');
      setTimeout(() => setMensajeExito(''), 3500);
      void cargarRolesAdmin();
      void fetchData();
    } catch (e) {
      alert(e?.message || 'No se pudo guardar el rol');
    } finally {
      setAdminRoleSaving(false);
    }
  }, [adminRoleForm, apiBaseUrl, isSuperAdmin, cargarRolesAdmin]);

  const cargarInvitacionesAdmin = useCallback(async () => {
    if (!isSuperAdmin) return;
    setAdminInvitacionesLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Sin sesión');
      const res = await fetch(`${apiBaseUrl}/api/admin/invitaciones-admin?estado=pendiente`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => []);
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setAdminInvitacionesRows(Array.isArray(j) ? j : []);
    } catch (e) {
      console.error('[AdminDashboard] invitaciones admin:', e);
      setAdminInvitacionesRows([]);
    } finally {
      setAdminInvitacionesLoading(false);
    }
  }, [apiBaseUrl, isSuperAdmin]);

  const enviarInvitacionClub = useCallback(async () => {
    if (!isSuperAdmin) return;
    const email = String(inviteClubForm.email || '').trim().toLowerCase();
    const pais = String(inviteClubForm.pais || '').trim();
    if (!email) {
      alert('Email obligatorio');
      return;
    }
    if (!pais) {
      alert('País obligatorio');
      return;
    }
    setInviteClubSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Sin sesión');
      const res = await fetch(`${apiBaseUrl}/api/admin/invitaciones-admin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          pais,
          nombre_club: String(inviteClubForm.nombre_club || '').trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setInviteClubModalOpen(false);
      setInviteClubForm({ email: '', nombre_club: '', pais: '' });
      if (j.email_sent === false) {
        setMensajeExito('Invitación creada (no se pudo enviar el email; configura RESEND o reenvía desde la lista).');
      } else {
        setMensajeExito('✉️ Invitación enviada');
      }
      setTimeout(() => setMensajeExito(''), 4000);
      void cargarInvitacionesAdmin();
    } catch (e) {
      alert(e?.message || 'No se pudo crear la invitación');
    } finally {
      setInviteClubSaving(false);
    }
  }, [apiBaseUrl, cargarInvitacionesAdmin, inviteClubForm, isSuperAdmin]);

  const reenviarInvitacionClub = useCallback(
    async (id) => {
      if (!isSuperAdmin || !id) return;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error('Sin sesión');
        const res = await fetch(`${apiBaseUrl}/api/admin/invitaciones-admin/${encodeURIComponent(id)}/reenviar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || res.statusText);
        if (j.email_sent === false) {
          alert('No se pudo enviar el email (revisá RESEND).');
        } else {
          setMensajeExito('✉️ Invitación reenviada');
          setTimeout(() => setMensajeExito(''), 3500);
        }
        void cargarInvitacionesAdmin();
      } catch (e) {
        alert(e?.message || 'No se pudo reenviar');
      }
    },
    [apiBaseUrl, cargarInvitacionesAdmin, isSuperAdmin],
  );

  const revocarRolAdmin = useCallback(async (email) => {
    if (!isSuperAdmin) return;
    if (!window.confirm(`¿Revocar rol de ${email}?`)) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Sin sesión');
      const res = await fetch(`${apiBaseUrl}/api/admin/roles/${encodeURIComponent(String(email || '').trim())}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setMensajeExito('Rol revocado');
      setTimeout(() => setMensajeExito(''), 3500);
      void cargarRolesAdmin();
      void fetchData();
    } catch (e) {
      alert(e?.message || 'No se pudo revocar el rol');
    }
  }, [apiBaseUrl, isSuperAdmin, cargarRolesAdmin]);

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
        void fetchData();
        void refreshSnapPendientesOnly();
        refetchSolicitudesTabLists();
        setTimeout(() => setMensajeExito(''), 4000);
      } catch (e) {
        alert(e.message || String(e));
      }
    },
    // fetchData se declara más abajo; se invoca solo al hacer clic (no incluir en deps).
    [apiBaseUrl, refetchSolicitudesTabLists, refreshSnapPendientesOnly]
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
        void refreshSnapPendientesOnly();
        refetchSolicitudesTabLists();
        setTimeout(() => setMensajeExito(''), 4000);
      } catch (e) {
        alert(e.message || String(e));
      }
    },
    [apiBaseUrl, refetchSolicitudesTabLists, refreshSnapPendientesOnly]
  );

  useEffect(() => {
    if (!puedeVerSedesPendientes) return;
    if (activeTab === 'resumen') {
      void cargarSedesPendientes('pendiente');
    } else if (activeTab === 'solicitudes') {
      void cargarSedesPendientes(mapFiltroSolicitudesTabToApiEstado(solicitudesFiltroEstado));
    }
  }, [activeTab, puedeVerSedesPendientes, cargarSedesPendientes, solicitudesFiltroEstado]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (activeTab === 'resumen') {
      void cargarSolicitudesLicencia('pendiente');
    } else if (activeTab === 'solicitudes') {
      void cargarSolicitudesLicencia(mapFiltroSolicitudesTabToApiEstado(solicitudesFiltroEstado));
    }
  }, [activeTab, isSuperAdmin, cargarSolicitudesLicencia, solicitudesFiltroEstado]);

  const solicitudesUnificadas = useMemo(() => {
    const rows = [];
    for (const sp of sedesPendientes || []) {
      const estado = String(sp?.estado || 'pendiente').toLowerCase();
      rows.push({
        kind: 'sede_nacional',
        id: sp.id,
        idKey: `sn-${sp.id}`,
        estado,
        created_at: sp.created_at,
        clubNombre: String(sp.nombre || '').trim() || '—',
        pais: String(sp.pais || '').trim() || '—',
        ciudad: String(sp.ciudad || '').trim() || '—',
        responsableNombre: String(sp.licenciatario_nombre || '').trim() || '—',
        email: String(sp.licenciatario_email || '').trim() || '—',
        whatsapp: String(sp.licenciatario_telefono || sp.whatsapp || '').trim() || '',
        rawNacional: sp,
      });
    }
    for (const s of solicitudesLicencia || []) {
      const estado = String(s?.estado || 'pendiente').toLowerCase();
      rows.push({
        kind: 'licencia_web',
        id: s.id,
        idKey: `lw-${s.id}`,
        estado,
        created_at: s.created_at,
        clubNombre: String(s.nombre_club || s.club_nombre || '').trim() || '—',
        pais: String(s.pais || '').trim() || '—',
        ciudad: String(s.ciudad || '').trim() || '—',
        responsableNombre: String(s.responsable_nombre || '').trim() || '—',
        email: String(s.email || '').trim() || '—',
        whatsapp: String(s.whatsapp || '').trim() || '',
        tipoInteres: s.tipo_interes,
        cantidadCanchas: s.cantidad_canchas,
        mensaje: s.mensaje,
        rawLicencia: s,
      });
    }
    return rows.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
  }, [sedesPendientes, solicitudesLicencia]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (activeTab === 'roles' || activeTab === 'resumen') {
      void cargarRolesAdmin();
    }
    if (activeTab === 'roles') {
      void cargarInvitacionesAdmin();
    }
  }, [activeTab, isSuperAdmin, cargarInvitacionesAdmin, cargarRolesAdmin]);

  useEffect(() => {
    console.log('[AdminDashboard] fetchData triggered — rol:', rol, 'sedeId:', sedeId);
    fetchData();
    fetchPendientes();
  }, [apiBaseUrl, rol, sedeId, session?.access_token]); // token: alcance correcto en GET torneos/reservas

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

  useEffect(() => {
    if (activeTab !== 'reservas') {
      setReservasSuperSubVista('principal');
      setRankingDetalleSedeKey(null);
    }
  }, [activeTab]);

  const shiftFinanzasPeriodo = useCallback(
    (delta) => {
      setFinanzasAnclaISO((prev) => addToFinanzasAncla(prev, superAdminPeriodo, delta));
    },
    [superAdminPeriodo]
  );

  const cifrasFinanzasResumen = useMemo(() => {
    const inP = (iso) =>
      fechaDentroDePeriodoFinanzas(
        iso,
        superAdminPeriodo,
        superAdminFechaDesde,
        superAdminFechaHasta,
        finanzasAnclaISO
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
    finanzasAnclaISO,
    isSuperAdmin,
    currentEmail,
    esAdminClub,
    sedeId,
    sedesMap,
  ]);

  const dashboardFinanciero = useMemo(() => {
    const inP = (iso) =>
      fechaDentroDePeriodoFinanzas(
        iso,
        superAdminPeriodo,
        superAdminFechaDesde,
        superAdminFechaHasta,
        finanzasAnclaISO
      );
    const torneoById = {};
    torneos.forEach((t) => {
      torneoById[t.id] = t;
    });
    const sedeByNombreLower = {};
    Object.values(sedesMap || {}).forEach((s) => {
      const k = String(s?.nombre || '').trim().toLowerCase();
      if (k) sedeByNombreLower[k] = s;
    });
    const reservasPeriodo = reservas.filter((r) => inP(String(r?.fecha || '').slice(0, 10)));
    const fechaInscripcionEquipo = (eq) => String(eq?.updated_at || eq?.created_at || '').slice(0, 10);
    const inscripcionesPeriodo = equiposInscripcionRows.filter(
      (eq) => String(eq?.inscripcion_estado || '').toLowerCase() === 'confirmado' && inP(fechaInscripcionEquipo(eq))
    );
    const porDia = {};
    const addDay = (iso, mon, amount) => {
      const d = String(iso || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      if (!porDia[d]) porDia[d] = { ARS: 0, USD: 0, EUR: 0 };
      porDia[d][mon] = (porDia[d][mon] || 0) + (Number(amount) || 0);
    };
    const reservasDetalle = reservasPeriodo.map((r) => {
      const sedeRow = sedeByNombreLower[String(r?.sede || '').trim().toLowerCase()] || null;
      const mon = bucketMonedaAdmin(sedeRow?.moneda || r?.moneda || 'ARS');
      const precio = Number(r?.precio) || 0;
      addDay(String(r?.fecha || '').slice(0, 10), mon, precio);
      return { ...r, moneda_calc: mon, precio_calc: precio };
    });
    const torneosDetalle = inscripcionesPeriodo.map((eq) => {
      const t = torneoById[eq?.torneo_id] || null;
      const mon = bucketMonedaAdmin(t?.moneda || 'ARS');
      const ingreso = precioInscripcionTorneo(t);
      addDay(fechaInscripcionEquipo(eq), mon, ingreso);
      return {
        torneo_id: eq?.torneo_id,
        nombre: t?.nombre || `Torneo #${eq?.torneo_id ?? ''}`,
        fecha: t?.fecha_inicio || '',
        equipos: torneoStats[t?.id]?.equipos_count ?? 0,
        ingreso,
        moneda: mon,
        estado: t?.estado || '',
      };
    });
    const totalTx = reservasDetalle.length + torneosDetalle.length;
    const totalMontoBase = isSuperAdmin
      ? ['ARS', 'USD', 'EUR'].reduce((acc, k) => acc + (Number(cifrasFinanzasResumen?.total?.[k]) || 0), 0)
      : Number(cifrasFinanzasResumen?.total) || 0;
    const ticketPromedio = totalTx > 0 ? Math.round(totalMontoBase / totalTx) : 0;
    const dailyRows = Object.keys(porDia)
      .sort((a, b) => a.localeCompare(b))
      .map((d) => ({
        fecha: d,
        total:
          (Number(porDia[d].ARS) || 0) +
          (Number(porDia[d].USD) || 0) +
          (Number(porDia[d].EUR) || 0),
      }));
    const maxDaily = dailyRows.reduce((m, r) => Math.max(m, r.total), 0);
    return {
      reservasDetalle,
      torneosDetalle,
      totalTransacciones: totalTx,
      ticketPromedio,
      dailyRows,
      maxDaily,
    };
  }, [
    reservas,
    torneos,
    sedesMap,
    equiposInscripcionRows,
    superAdminPeriodo,
    superAdminFechaDesde,
    superAdminFechaHasta,
    finanzasAnclaISO,
    torneoStats,
    isSuperAdmin,
    cifrasFinanzasResumen,
  ]);

  const exportarFinanzasExcel = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();
      const periodoNombre = labelPeriodoFinanciero(superAdminPeriodo);
      const resumenRows = isSuperAdmin
        ? [
            {
              periodo: periodoNombre,
              total_ars: Number(cifrasFinanzasResumen?.total?.ARS) || 0,
              total_usd: Number(cifrasFinanzasResumen?.total?.USD) || 0,
              total_eur: Number(cifrasFinanzasResumen?.total?.EUR) || 0,
              reservas_ars: Number(cifrasFinanzasResumen?.porFuente?.reservas?.ARS) || 0,
              reservas_usd: Number(cifrasFinanzasResumen?.porFuente?.reservas?.USD) || 0,
              reservas_eur: Number(cifrasFinanzasResumen?.porFuente?.reservas?.EUR) || 0,
              torneos_ars: Number(cifrasFinanzasResumen?.porFuente?.inscripciones?.ARS) || 0,
              torneos_usd: Number(cifrasFinanzasResumen?.porFuente?.inscripciones?.USD) || 0,
              torneos_eur: Number(cifrasFinanzasResumen?.porFuente?.inscripciones?.EUR) || 0,
              transacciones: dashboardFinanciero.totalTransacciones,
              ticket_promedio: Math.round(Number(dashboardFinanciero.ticketPromedio) || 0),
            },
          ]
        : [
            {
              periodo: periodoNombre,
              moneda: cifrasFinanzasResumen?.moneda || 'ARS',
              total: Number(cifrasFinanzasResumen?.total) || 0,
              reservas: Number(cifrasFinanzasResumen?.reservas) || 0,
              torneos: Number(cifrasFinanzasResumen?.inscripciones) || 0,
              transacciones: dashboardFinanciero.totalTransacciones,
              ticket_promedio: Math.round(Number(dashboardFinanciero.ticketPromedio) || 0),
            },
          ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), 'Resumen');

      const reservasRows = dashboardFinanciero.reservasDetalle.map((r) => ({
        fecha: String(r?.fecha || '').slice(0, 10),
        hora: horaRango(r?.hora, r?.duracion),
        cancha: r?.cancha ?? '',
        jugador: r?.nombre || '',
        monto: Number(r?.precio_calc) || 0,
        moneda: r?.moneda_calc || 'ARS',
        estado: r?.estado || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reservasRows), 'Reservas');

      const torneosRows = dashboardFinanciero.torneosDetalle.map((t) => ({
        nombre: t.nombre,
        fecha: String(t.fecha || '').slice(0, 10),
        equipos: t.equipos ?? 0,
        ingresos: Number(t.ingreso) || 0,
        moneda: t.moneda || 'ARS',
        estado: t.estado || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(torneosRows), 'Torneos');

      const nombre = `financiero_${periodoNombre}_${String(finanzasAnclaISO || '').slice(0, 10) || 'reporte'}.xlsx`;
      XLSX.writeFile(wb, nombre);
    } catch (e) {
      console.error('[AdminDashboard] exportarFinanzasExcel:', e);
      alert('No se pudo generar el Excel.');
    }
  }, [superAdminPeriodo, isSuperAdmin, cifrasFinanzasResumen, dashboardFinanciero, finanzasAnclaISO]);

  const resumenPanelDiario = useMemo(() => {
    const ctx = ahoraArgentinaPartes();
    const hoyISO = ctx.hoyISO;
    const now = new Date();
    const torneoById = {};
    torneos.forEach((t) => {
      torneoById[t.id] = t;
    });

    const reservasHoyLista = reservas.filter((r) => String(r?.fecha || '').trim().slice(0, 10) === hoyISO);
    const reservasHoy = reservasHoyLista.length;
    const reservasHoyOrdenadas = sortReservasHoyAsc(reservasHoyLista);

    const ingresosHoyPorMoneda = { ARS: 0, USD: 0, EUR: 0 };
    for (const r of reservasHoyLista) {
      const est = String(r?.estado || '').trim().toLowerCase();
      if (est === 'cancelada') continue;
      const sid = sedeIdDesdeNombreReserva(r.sede, sedesMap);
      const sedeRow = sid != null ? sedesMap[String(sid)] : null;
      const mon = bucketMonedaAdmin(sedeRow?.moneda || 'ARS');
      ingresosHoyPorMoneda[mon] += Number(r.precio) || 0;
    }
    const ingresosHoyTexto = formatoIngresosHoyMultimoneda(ingresosHoyPorMoneda);

    const ocupadasPorSede = {};
    for (const r of reservasHoyLista) {
      if (!reservaActivaAhoraArgentina(r, ctx)) continue;
      const sid = sedeIdDesdeNombreReserva(r.sede, sedesMap);
      if (sid == null) continue;
      const ck = String(r.cancha != null ? r.cancha : '').trim();
      if (!ck) continue;
      const sk = String(sid);
      if (!ocupadasPorSede[sk]) ocupadasPorSede[sk] = new Set();
      ocupadasPorSede[sk].add(ck);
    }

    const ocupacionSedes = [];
    const sedeKeys = new Set([...Object.keys(canchasResumenPorSede || {}), ...Object.keys(ocupadasPorSede || {})]);
    for (const sk of sedeKeys) {
      const stats = canchasResumenPorSede[sk] || { total: 0, activas: 0 };
      const setO = ocupadasPorSede[sk] || new Set();
      const ocupadas = setO.size;
      const totalActivas = stats.activas ?? 0;
      const disponibles = Math.max(0, totalActivas - ocupadas);
      const sedeRow = sedesMap[sk];
      ocupacionSedes.push({
        sedeId: sk,
        nombre: String(sedeRow?.nombre || '').trim() || `Sede ${sk}`,
        ocupadas,
        disponibles,
        totalActivas,
        sinCanchasRegistradas: totalActivas === 0 && stats.total === 0,
      });
    }
    ocupacionSedes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const canchasOcupacionGlobal = ocupacionSedes.reduce(
      (acc, row) => ({
        ocupadas: acc.ocupadas + (Number(row.ocupadas) || 0),
        totalActivas: acc.totalActivas + (Number(row.totalActivas) || 0),
      }),
      { ocupadas: 0, totalActivas: 0 }
    );

    const equiposPendientePago = equiposInscripcionRows.filter((eq) => {
      if (String(eq?.inscripcion_estado || '').toLowerCase() === 'confirmado') return false;
      const t = torneoById[eq.torneo_id];
      if (!t) return false;
      return precioInscripcionTorneo(t) > 0;
    });

    const pendientesSinConfirmarPorTorneo = {};
    for (const eq of equiposInscripcionRows) {
      if (String(eq?.inscripcion_estado || '').toLowerCase() === 'confirmado') continue;
      const t = torneoById[eq.torneo_id];
      if (!t || !torneoEstadoInscripcionAbiertaAdmin(t)) continue;
      if (!torneoCierreInscripcionDentroDe48h(t, now)) continue;
      const tid = Number(eq.torneo_id);
      if (!Number.isFinite(tid)) continue;
      pendientesSinConfirmarPorTorneo[tid] = (pendientesSinConfirmarPorTorneo[tid] || 0) + 1;
    }
    const alertasEquiposSinConfirmarCierre48h = Object.entries(pendientesSinConfirmarPorTorneo)
      .map(([tidStr, count]) => {
        const tid = Number(tidStr);
        const t = torneoById[tid];
        return {
          torneoId: tid,
          nombre: String(t?.nombre || 'Torneo').trim() || 'Torneo',
          count: Number(count) || 0,
        };
      })
      .filter((a) => a.count > 0);

    const sinConfirmProximos = {};
    for (const eq of equiposInscripcionRows) {
      if (String(eq?.inscripcion_estado || '').toLowerCase() === 'confirmado') continue;
      const t = torneoById[eq.torneo_id];
      if (!t || !torneoProximoSinEmpezar(t)) continue;
      const tid = Number(eq.torneo_id);
      if (!Number.isFinite(tid)) continue;
      sinConfirmProximos[tid] = (sinConfirmProximos[tid] || 0) + 1;
    }
    const alertasEquiposTorneoProximoSinConfirmar = Object.entries(sinConfirmProximos)
      .map(([tidStr, count]) => {
        const tid = Number(tidStr);
        const t = torneoById[tid];
        return {
          torneoId: tid,
          nombre: String(t?.nombre || 'Torneo').trim() || 'Torneo',
          count: Number(count) || 0,
        };
      })
      .filter((a) => a.count > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const confirmadosPorTorneo = {};
    for (const eq of equiposInscripcionRows) {
      if (String(eq?.inscripcion_estado || '').toLowerCase() !== 'confirmado') continue;
      confirmadosPorTorneo[eq.torneo_id] = (confirmadosPorTorneo[eq.torneo_id] || 0) + 1;
    }
    const alertasTorneosMenosDosConfirmados = [];
    for (const t of torneos) {
      if (!torneoEstadoInscripcionAbiertaAdmin(t)) continue;
      const c = confirmadosPorTorneo[t.id] || 0;
      if (c < 2) {
        alertasTorneosMenosDosConfirmados.push({
          torneoId: t.id,
          nombre: String(t.nombre || '').trim() || 'Torneo',
          confirmados: c,
        });
      }
    }
    alertasTorneosMenosDosConfirmados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const alertasTorneoSinSorteo48h = [];
    for (const t of torneos) {
      const inicio = parseLocalDayStartFromIsoDate(t.fecha_inicio);
      if (!inicio) continue;
      const ms = inicio.getTime() - now.getTime();
      if (ms <= 0 || ms > MS_48H) continue;
      const pc =
        partidosCountByTorneoId[t.id] ??
        partidosCountByTorneoId[String(t.id)] ??
        0;
      if (pc < 1) {
        alertasTorneoSinSorteo48h.push({
          torneoId: t.id,
          nombre: String(t.nombre || '').trim() || 'Torneo',
          fecha_inicio: t.fecha_inicio,
        });
      }
    }
    alertasTorneoSinSorteo48h.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return {
      hoyISO,
      fechaLabelHoy: formatFechaDia(hoyISO),
      reservasHoy,
      reservasHoyOrdenadas,
      ingresosHoyTexto,
      ocupacionSedes,
      canchasOcupacionGlobal,
      equiposPendientePagoCount: equiposPendientePago.length,
      alertasEquiposSinConfirmarCierre48h,
      alertasEquiposTorneoProximoSinConfirmar,
      alertasTorneosMenosDosConfirmados,
      alertasTorneoSinSorteo48h,
    };
  }, [
    reservas,
    torneos,
    equiposInscripcionRows,
    sedesMap,
    canchasResumenPorSede,
    partidosCountByTorneoId,
  ]);

  /** Vista cancha por cancha (admin_club): solo datos ya en `reservas`, `sedesMap` y `canchasDetallePorSede`. */
  const misCanchasHoyAdminClub = useMemo(() => {
    if (!esAdminClub || sedeId == null || sedeId === '') return null;
    const ctx = ahoraArgentinaPartes();
    const hoyISO = ctx.hoyISO;
    const sid = String(sedeId);
    const sedeRow = sedesMap[sid];
    if (!sedeRow) return null;

    const reservasHoySede = reservas.filter((r) => {
      if (String(r?.fecha || '').trim().slice(0, 10) !== hoyISO) return false;
      const rSid = sedeIdDesdeNombreReserva(r.sede, sedesMap);
      if (rSid == null || String(rSid) !== sid) return false;
      return true;
    });
    const reservasHoyActivas = reservasHoySede.filter(
      (r) => String(r?.estado || '').trim().toLowerCase() !== 'cancelada'
    );

    const stats = canchasResumenPorSede[sid] || { total: 0, activas: 0 };
    const detalleRaw = canchasDetallePorSede[sid] || [];
    let filasCancha = detalleRaw
      .filter((c) => normalizeEstadoCanchaAdminDash(c.estado) !== 'inactiva')
      .map((c) => ({
        id: c.id,
        numero: Number(c.numero_reserva),
        nombre: String(c.nombre || '').trim() || `Cancha ${c.numero_reserva}`,
      }))
      .sort((a, b) => a.numero - b.numero);
    if (!filasCancha.length && stats.activas > 0) {
      filasCancha = Array.from({ length: stats.activas }, (_, i) => ({
        id: null,
        numero: i + 1,
        nombre: `Cancha ${i + 1}`,
      }));
    }

    const futureSlots = futureSlotStartsArtAdminDash(sedeRow, ctx);

    const rows = filasCancha.map((fc) => {
      const n = fc.numero;
      const listCancha = reservasHoyActivas.filter((r) => parseInt(String(r.cancha), 10) === n);
      const ocupados = listCancha.length;
      let disponibles = null;
      if (futureSlots.length) {
        const takenStarts = new Set(
          listCancha.map((r) => normalizeHoraInicioReservaAdminDash(r.hora)).filter(Boolean)
        );
        disponibles = futureSlots.filter((hhmm) => !takenStarts.has(hhmm)).length;
      }

      const proximas = listCancha
        .map((r) => {
          const mm = minutosInicioReservaAdminDash(r);
          return { r, mm };
        })
        .filter((x) => x.mm != null && x.mm >= ctx.minutesNow)
        .sort((a, b) => a.mm - b.mm);
      const prox = proximas[0]?.r;
      let proximaTexto = 'Sin reservas hoy';
      if (prox) {
        proximaTexto = `${horaRango(prox.hora, prox.duracion)} · ${String(prox.nombre || '').trim() || String(prox.email || '').trim() || 'Reserva'}`;
      } else if (ocupados > 0) {
        proximaTexto = 'Sin próximas reservas hoy';
      }

      return {
        ...fc,
        ocupados,
        disponibles,
        proximaTexto,
      };
    });

    return {
      fechaLabel: formatFechaDia(hoyISO),
      nombreSede: String(sedeRow.nombre || '').trim() || 'Mi sede',
      sinCanchasActivas: filasCancha.length === 0,
      rows,
      totalReservasHoySede: reservasHoyActivas.length,
    };
  }, [esAdminClub, sedeId, reservas, sedesMap, canchasDetallePorSede, canchasResumenPorSede]);

  const resumenOperativoSecciones = useMemo(() => {
    const p = resumenPanelDiario;
    const alertasContratosPorVencer = isSuperAdmin
      ? Object.values(contratosBySedeId || {})
          .map((c) => {
            const fv = String(c?.fecha_vencimiento || '').trim();
            if (!fv) return null;
            const venc = new Date(`${fv}T23:59:59`);
            if (Number.isNaN(venc.getTime())) return null;
            const days = Math.ceil((venc.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            if (days < 0 || days > 30) return null;
            const sede = sedesMap[String(c.sede_id)] || {};
            return {
              sedeId: c.sede_id,
              sedeNombre: String(sede?.nombre || `Sede ${c.sede_id}`),
              fecha_vencimiento: fv,
              days,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.days - b.days)
      : [];
    const MS_7D = 7 * 24 * 60 * 60 * 1000;
    const alertasSuscripcionBilling = isSuperAdmin
      ? Object.values(sedesMap || {}).flatMap((sedeRow) => {
          const est = String(sedeRow?.suscripcion_estado || 'sin_suscripcion').toLowerCase();
          const prox = sedeRow?.suscripcion_proximo_cobro
            ? new Date(sedeRow.suscripcion_proximo_cobro).getTime()
            : NaN;
          const now = Date.now();
          if (est === 'vencida') {
            return [
              {
                tipo: 'vencida',
                sedeNombre: String(sedeRow?.nombre || `Sede ${sedeRow?.id}`).trim(),
                sedeId: sedeRow?.id,
              },
            ];
          }
          if (est === 'activa' && Number.isFinite(prox)) {
            const ms = prox - now;
            if (ms >= 0 && ms <= MS_7D) {
              return [
                {
                  tipo: 'proxima',
                  sedeNombre: String(sedeRow?.nombre || `Sede ${sedeRow?.id}`).trim(),
                  sedeId: sedeRow?.id,
                  fecha: sedeRow.suscripcion_proximo_cobro,
                },
              ];
            }
          }
          return [];
        })
      : [];
    const btnTorneo = {
      marginTop: '8px',
      padding: '6px 12px',
      fontSize: '12px',
      fontWeight: 700,
      border: 'none',
      borderRadius: '8px',
      background: '#4f46e5',
      color: '#fff',
      cursor: 'pointer',
    };
    const alertBox = (bg, border, color) => ({
      padding: '10px 14px',
      borderRadius: '10px',
      background: bg,
      border: `1px solid ${border}`,
      color,
      fontSize: '13px',
      fontWeight: 700,
      marginBottom: '8px',
    });
    const tieneAlertaOperativa =
      (p.equiposPendientePagoCount || 0) > 0 ||
      (p.alertasEquiposSinConfirmarCierre48h || []).length > 0 ||
      (p.alertasEquiposTorneoProximoSinConfirmar || []).length > 0 ||
      (p.alertasTorneosMenosDosConfirmados || []).length > 0 ||
      (p.alertasTorneoSinSorteo48h || []).length > 0 ||
      alertasContratosPorVencer.length > 0 ||
      alertasSuscripcionBilling.length > 0 ||
      (isSuperAdmin && snapPendienteSedes + snapPendienteLic > 0);

    return (
      <>
        <div className="section" style={{ marginBottom: '18px', color: '#1e293b' }}>
          <h2 style={{ marginTop: 0, color: '#334155' }}>Hoy</h2>
          <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '14px' }}>{p.fechaLabelHoy}</p>
          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Reservas ({p.reservasHoy})
              </div>
              {p.reservasHoyOrdenadas.length === 0 ? (
                <p style={{ margin: '8px 0 0', color: '#94a3b8' }}>No hay reservas para hoy.</p>
              ) : (
                <ul
                  style={{
                    margin: '8px 0 0',
                    padding: '0 0 0 18px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    fontSize: '14px',
                    lineHeight: 1.45,
                  }}
                >
                  {p.reservasHoyOrdenadas.map((r) => (
                    <li key={r.id ?? `${r.fecha}-${r.hora}-${r.cancha}-${r.email}`} style={{ marginBottom: '6px' }}>
                      <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                        <span>
                          <strong>{horaRango(r.hora, r.duracion)}</strong>
                          {' · '}
                          Cancha {r.cancha}
                          {' · '}
                          {String(r.nombre || '').trim() || '—'}
                        </span>
                        <EstadoBadge reserva={r} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Ingresos del día (por moneda de cada sede)
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{p.ingresosHoyTexto}</p>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Suma de precios de reservas de hoy no canceladas.
              </p>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Canchas ahora (hora Argentina)
              </div>
              {p.ocupacionSedes.length === 0 ? (
                <p style={{ margin: '8px 0 0', color: '#94a3b8' }}>Sin sedes en tu alcance.</p>
              ) : isSuperAdmin ? (
                <p style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: 800, color: '#0f172a', lineHeight: 1.4 }}>
                  {p.canchasOcupacionGlobal.ocupadas === 1
                    ? `1 cancha ocupada de ${p.canchasOcupacionGlobal.totalActivas} totales activas`
                    : `${p.canchasOcupacionGlobal.ocupadas} canchas ocupadas de ${p.canchasOcupacionGlobal.totalActivas} totales activas`}
                </p>
              ) : (
                <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', fontSize: '14px' }}>
                  {p.ocupacionSedes.map((row) => (
                    <li
                      key={row.sedeId}
                      style={{
                        marginBottom: '10px',
                        padding: '10px 12px',
                        background: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <strong>{row.nombre}</strong>
                      {row.sinCanchasRegistradas ? (
                        <div style={{ marginTop: '6px', color: '#b45309', fontSize: '13px' }}>
                          Sin canchas cargadas en el sistema. Registralas en «Mi sede» para ver ocupación vs disponibles.
                        </div>
                      ) : (
                        <div style={{ marginTop: '6px', color: '#334155' }}>
                          Ocupadas ahora: <strong>{row.ocupadas}</strong> · Disponibles:{' '}
                          <strong>{row.disponibles}</strong> · Total canchas activas: <strong>{row.totalActivas}</strong>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="section" style={{ marginBottom: '18px', color: '#1e293b' }}>
          <h2 style={{ marginTop: 0, color: '#334155' }}>Alertas</h2>
          {!tieneAlertaOperativa ? (
            <p style={{ margin: 0, color: '#94a3b8' }}>Sin alertas prioritarias.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {isSuperAdmin && snapPendienteSedes + snapPendienteLic > 0 ? (
                <div role="alert" style={alertBox('#fee2e2', '#f87171', '#991b1b')}>
                  {snapPendienteSedes + snapPendienteLic === 1
                    ? '1 solicitud pendiente'
                    : `${snapPendienteSedes + snapPendienteLic} solicitudes pendientes`}{' '}
                  (alta nacional o interés web). Revisalas en «Solicitudes».
                  <button
                    type="button"
                    style={{ ...btnTorneo, marginLeft: '10px' }}
                    onClick={() => {
                      setSolicitudesFiltroEstado('pendiente');
                      setActiveTab('solicitudes');
                      sessionStorage.setItem('adminActiveTab', 'solicitudes');
                      navigate('/admin?tab=solicitudes', { replace: true });
                    }}
                  >
                    Ir a Solicitudes
                  </button>
                </div>
              ) : null}

              {p.alertasEquiposTorneoProximoSinConfirmar.length > 0
                ? p.alertasEquiposTorneoProximoSinConfirmar.map((a) => (
                    <div key={`prox-${a.torneoId}`} role="alert" style={alertBox('#ffedd5', '#fb923c', '#9a3412')}>
                      <strong>Torneo próximo:</strong> {a.count} equipo{a.count === 1 ? '' : 's'} sin inscripción confirmada en «
                      {a.nombre}».
                      <button
                        type="button"
                        style={btnTorneo}
                        onClick={() => navigate(`/torneo/${a.torneoId}`, { state: { fromAdmin: true } })}
                      >
                        Ver torneo
                      </button>
                    </div>
                  ))
                : null}

              {p.alertasTorneosMenosDosConfirmados.length > 0
                ? p.alertasTorneosMenosDosConfirmados.map((a) => (
                    <div key={`menos2-${a.torneoId}`} role="alert" style={alertBox('#fef3c7', '#fbbf24', '#92400e')}>
                      <strong>Inscripción abierta:</strong> «{a.nombre}» tiene solo {a.confirmados} equipo
                      {a.confirmados === 1 ? '' : 's'} confirmado{a.confirmados === 1 ? '' : 's'} (mínimo 2 para iniciar con
                      validaciones actuales).
                      <button
                        type="button"
                        style={btnTorneo}
                        onClick={() => navigate(`/torneo/${a.torneoId}`, { state: { fromAdmin: true } })}
                      >
                        Ver torneo
                      </button>
                    </div>
                  ))
                : null}

              {p.alertasTorneoSinSorteo48h.length > 0
                ? p.alertasTorneoSinSorteo48h.map((a) => (
                    <div key={`sorteo-${a.torneoId}`} role="alert" style={alertBox('#fce7f3', '#f472b6', '#9d174d')}>
                      <strong>Arranca pronto:</strong> «{a.nombre}» ({formatFecha(a.fecha_inicio)}) — sin partidos generados
                      (sorteo/fixture pendiente) y el inicio es en menos de 48 horas.
                      <button
                        type="button"
                        style={btnTorneo}
                        onClick={() => navigate(`/torneo/${a.torneoId}`, { state: { fromAdmin: true } })}
                      >
                        Ver torneo
                      </button>
                    </div>
                  ))
                : null}

              {p.equiposPendientePagoCount > 0 ? (
                <div role="alert" style={alertBox('#fef3c7', '#fbbf24', '#92400e')}>
                  Hay {p.equiposPendientePagoCount} equipo{p.equiposPendientePagoCount === 1 ? '' : 's'} con inscripción{' '}
                  <strong>pendiente de pago</strong> en torneos con costo.
                </div>
              ) : null}

              {p.alertasEquiposSinConfirmarCierre48h.map((a) => (
                <div key={`cierre-${a.torneoId}`} role="alert" style={alertBox('#ffedd5', '#fb923c', '#9a3412')}>
                  {a.count} equipo{a.count === 1 ? '' : 's'} sin confirmar en «{a.nombre}» — inscripción cierra en menos de
                  48h (fecha de inicio del torneo).
                  <button
                    type="button"
                    style={btnTorneo}
                    onClick={() => navigate(`/torneo/${a.torneoId}`, { state: { fromAdmin: true } })}
                  >
                    Ver torneo
                  </button>
                </div>
              ))}
              {alertasContratosPorVencer.map((a) => (
                <div key={`contr-${a.sedeId}`} role="alert" style={alertBox('#fef3c7', '#fbbf24', '#92400e')}>
                  <strong>Contrato por vencer:</strong> {a.sedeNombre} vence el {formatFecha(a.fecha_vencimiento)} (
                  {a.days} día{a.days === 1 ? '' : 's'}).
                </div>
              ))}
              {alertasSuscripcionBilling.map((a) =>
                a.tipo === 'vencida' ? (
                  <div key={`sub-v-${a.sedeId}`} role="alert" style={alertBox('#fee2e2', '#f87171', '#991b1b')}>
                    <strong>Suscripción vencida:</strong> {a.sedeNombre} — revisá el pago en Stripe o reactivá desde Sedes.
                    <button
                      type="button"
                      style={btnTorneo}
                      onClick={() => {
                        setActiveTab('sedes');
                        sessionStorage.setItem('adminActiveTab', 'sedes');
                        navigate(`/admin?tab=sedes`, { replace: true });
                      }}
                    >
                      Ir a Sedes
                    </button>
                  </div>
                ) : (
                  <div key={`sub-p-${a.sedeId}`} role="alert" style={alertBox('#e0e7ff', '#818cf8', '#3730a3')}>
                    <strong>Suscripción por cobrar:</strong> {a.sedeNombre} — próximo cobro{' '}
                    {formatProximoCobroAdmin(a.fecha)}.
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </>
    );
  }, [
    resumenPanelDiario,
    contratosBySedeId,
    sedesMap,
    isSuperAdmin,
    navigate,
    setActiveTab,
    puedeVerSedesPendientes,
    isSuperAdmin,
    snapPendienteSedes,
    snapPendienteLic,
    setSolicitudesFiltroEstado,
  ]);

  const fetchPendientes = async () => {
    setPendientesLoading(true);
    const { data, error } = await supabase
      .from('jugadores_perfil')
      .select('email, nombre, pais, nivel, genero')
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
  /** Modal sorteo grupos (lista torneos): { torneo, equipos } */
  const [sorteoGruposCtx, setSorteoGruposCtx] = useState(null);

  const abrirModalSorteoGrupos = useCallback(async (torneoRow) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/torneos/${torneoRow.id}/equipos`);
      const equipos = res.ok ? await res.json() : [];
      setSorteoGruposCtx({
        torneo: torneoRow,
        equipos: Array.isArray(equipos) ? equipos : [],
      });
    } catch (e) {
      alert(e?.message || 'No se pudieron cargar los equipos');
    }
  }, [apiBaseUrl]);

  /** Sorteo de grupos solo con torneo en inscripción / abierto (antes de `en_curso`). */
  const torneoEstadoPermiteSorteoGrupos = (est) => {
    const e = String(est || '').toLowerCase();
    return e === 'abierto' || e === 'inscripcion_abierta';
  };

  const torneosFiltradosAdminEstado = useMemo(() => {
    if (esFiltroTorneoEstadoTodos(filtroEstadoTorneoAdmin)) return torneos;
    return torneos.filter((t) => torneoPasaFiltroEstadoVista(t, filtroEstadoTorneoAdmin));
  }, [torneos, filtroEstadoTorneoAdmin]);

  const torneosActivosNacionalCount = useMemo(
    () => torneos.filter((t) => torneoConsideradoActivoPanelNacional(t)).length,
    [torneos]
  );

  const sedesNacionalLista = useMemo(() => {
    if (!esAdminNacional) return [];
    return Object.values(sedesMap || {}).sort((a, b) =>
      String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' })
    );
  }, [esAdminNacional, sedesMap]);

  const sedesSuperAdminLista = useMemo(() => {
    if (!isSuperAdmin) return [];
    return Object.values(sedesMap || {}).sort((a, b) =>
      String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' })
    );
  }, [isSuperAdmin, sedesMap]);

  const sedesSuperAdminPaisesUnicos = useMemo(() => {
    if (!isSuperAdmin) return [];
    const set = new Set();
    for (const s of sedesSuperAdminLista) {
      const p = String(s?.pais || '').trim();
      if (p) set.add(p);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [isSuperAdmin, sedesSuperAdminLista]);

  const sedesSuperAdminCiudadesOpciones = useMemo(() => {
    if (!isSuperAdmin) return [];
    const base = sedeMobileFiltroPais
      ? sedesSuperAdminLista.filter((s) => String(s?.pais || '').trim() === sedeMobileFiltroPais)
      : sedesSuperAdminLista;
    const set = new Set();
    for (const s of base) {
      const c = String(s?.ciudad || '').trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [isSuperAdmin, sedesSuperAdminLista, sedeMobileFiltroPais]);

  const sedesSuperAdminListaFiltrada = useMemo(() => {
    if (!isSuperAdmin) return sedesSuperAdminLista;
    return sedesSuperAdminLista.filter((s) => {
      if (sedeMobileFiltroPais && String(s?.pais || '').trim() !== sedeMobileFiltroPais) return false;
      if (sedeMobileFiltroCiudad && String(s?.ciudad || '').trim() !== sedeMobileFiltroCiudad) return false;
      return true;
    });
  }, [isSuperAdmin, sedesSuperAdminLista, sedeMobileFiltroPais, sedeMobileFiltroCiudad]);

  const sedesSuperAdminPaginacion = useMemo(() => {
    if (!isSuperAdmin) {
      return { slice: [], totalPages: 1, page: 1, total: 0 };
    }
    const list = sedesSuperAdminListaFiltrada;
    const total = list.length;
    const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / SEDES_SUPER_ADMIN_PAGE_SIZE));
    const page = Math.min(Math.max(1, sedesSuperAdminPagina), totalPages);
    const start = (page - 1) * SEDES_SUPER_ADMIN_PAGE_SIZE;
    const slice = list.slice(start, start + SEDES_SUPER_ADMIN_PAGE_SIZE);
    return { slice, totalPages, page, total };
  }, [isSuperAdmin, sedesSuperAdminListaFiltrada, sedesSuperAdminPagina]);

  useEffect(() => {
    setSedesSuperAdminPagina(1);
  }, [sedeMobileFiltroPais, sedeMobileFiltroCiudad]);

  useEffect(() => {
    if (!esAdminNacional) {
      setJugadoresFederadosPais([]);
      setTotalJugadoresPais(0);
      return;
    }
    if (!paisAdminNacional) {
      setJugadoresFederadosPais([]);
      setTotalJugadoresPais(0);
      return;
    }
    let cancelled = false;
    setNacionalJugadoresLoading(true);
    (async () => {
      try {
        const pat = `%${paisAdminNacional}%`;
        const { data, error } = await supabase
          .from('jugadores_perfil')
          .select('email, nombre, apellido, alias, pais, nivel, foto_url, es_federado')
          .ilike('pais', pat)
          .order('nombre');
        if (cancelled) return;
        if (error) {
          setJugadoresFederadosPais([]);
          setTotalJugadoresPais(0);
          return;
        }
        const rows = Array.isArray(data) ? data : [];
        const inCountry = rows.filter(
          (j) => j?.pais && String(j.pais).includes(paisAdminNacional)
        );
        setTotalJugadoresPais(inCountry.length);
        setJugadoresFederadosPais(
          inCountry.filter((j) => j.es_federado === true)
        );
      } catch {
        if (!cancelled) {
          setJugadoresFederadosPais([]);
          setTotalJugadoresPais(0);
        }
      } finally {
        if (!cancelled) setNacionalJugadoresLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [esAdminNacional, paisAdminNacional, session?.access_token]);

  useEffect(() => {
    if (!esAdminNacional) return;
    const permitidas = new Set(['resumen', 'torneos', 'sedes', 'jugadores']);
    if (permitidas.has(activeTab)) return;
    setActiveTab('resumen');
    navigate('/admin?tab=resumen', { replace: true });
  }, [esAdminNacional, activeTab, navigate]);

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
  const [planPricingRows, setPlanPricingRows] = useState([]);
  const [planPricingLoading, setPlanPricingLoading] = useState(false);
  const [planPricingEditId, setPlanPricingEditId] = useState(null);
  const [planPricingEditValue, setPlanPricingEditValue] = useState('');
  const [planPricingSavingId, setPlanPricingSavingId] = useState(null);

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
    if (!isSuperAdmin || activeTab !== 'planes') return;
    let cancelled = false;
    setPlanPricingLoading(true);
    fetch(`${apiBaseUrl}/api/plan-pricing`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPlanPricingRows(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setPlanPricingRows([]);
      })
      .finally(() => {
        if (!cancelled) setPlanPricingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, activeTab, apiBaseUrl]);

  const guardarPrecioPlanPricing = useCallback(
    async (id, precioStr) => {
      if (!session?.access_token) {
        alert('Inicia sesión para guardar.');
        return;
      }
      setPlanPricingSavingId(id);
      try {
        const res = await fetch(`${apiBaseUrl}/api/plan-pricing/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ precio_usd: precioStr }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'No se pudo guardar');
        const plan = j.plan;
        if (plan?.id != null) {
          setPlanPricingRows((prev) =>
            prev.map((r) => (Number(r.id) === Number(plan.id) ? { ...r, ...plan } : r)),
          );
        }
        setPlanPricingEditId(null);
        setPlanPricingEditValue('');
      } catch (e) {
        alert(e.message || String(e));
      } finally {
        setPlanPricingSavingId(null);
      }
    },
    [apiBaseUrl, session?.access_token],
  );

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
            const tiene_gruposPorPartido = partidos.some(
              (p) => p && p.grupo != null && String(p.grupo).trim() !== ''
            );
            const tiene_gruposPorEquipo = (Array.isArray(equipos) ? equipos : []).some(
              (eq) => eq && eq.grupo != null && String(eq.grupo).trim() !== ''
            );
            const tiene_grupos = tiene_gruposPorPartido || tiene_gruposPorEquipo;
            const equipos_confirmados_sorteo = equiposConfirmadosParaSorteo(equipos).length;
            // winner: equipo with highest puntos_ranking (finalizado) or puntos_totales (en_curso)
            const sorted = [...equipos].sort((a, b) =>
              t.estado === 'finalizado'
                ? (b.puntos_ranking || 0) - (a.puntos_ranking || 0)
                : (b.puntos_totales || 0) - (a.puntos_totales || 0)
            );
            return {
              id: t.id,
              equipos_count: equipos.length,
              partidos_jugados: jugados,
              total_partidos: partidos.length,
              winner: sorted[0] || null,
              tiene_grupos,
              equipos_confirmados_sorteo,
            };
          } catch {
            return {
              id: t.id,
              equipos_count: 0,
              partidos_jugados: 0,
              total_partidos: 0,
              winner: null,
              tiene_grupos: false,
              equipos_confirmados_sorteo: 0,
            };
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
  }, [activeTab, torneos.length, apiBaseUrl, torneoStatsTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirEditTorneo = (torneo) => {
    setEditandoTorneoId(torneo.id);
    setEditTorneoForm({
      nombre:       torneo.nombre       || '',
      nivel_torneo: torneo.nivel_torneo || '',
      categoria:    torneo.categoria    || CATEGORIA_TORNEO_DEFAULT,
      tipo_competencia: torneoTipoCompetenciaDb(torneo) || TORNEO_GENERO_COMPETENCIA_DEFAULT,
      categoria_edad: torneo.categoria_edad || TORNEO_CATEGORIA_EDAD_DEFAULT,
      tipo_torneo:  torneo.tipo_torneo  || '',
      estado:       mapEstadoTorneoDesdeApiParaForm(torneo.estado),
      fecha_inicio: torneo.fecha_inicio || '',
      fecha_fin:    torneo.fecha_fin    || '',
      sede_id:      torneo.sede_id      != null ? String(torneo.sede_id) : '',
      cupos_maximos:
        torneo.cupos_maximos != null && torneo.cupos_maximos !== '' ? String(torneo.cupos_maximos) : '',
      horas_revelar_equipos:
        torneo.horas_revelar_equipos != null && torneo.horas_revelar_equipos !== ''
          ? String(torneo.horas_revelar_equipos)
          : '48',
      deporte: torneo.deporte || TORNEO_DEPORTE_PADBOL,
      formato_equipo: torneo.formato_equipo || TORNEO_FORMATO_DOBLES,
    });
  };

  const guardarTorneo = async (torneoId) => {
    if (!String(editTorneoForm.categoria || '').trim()) {
      alert('Selecciona la categoría del torneo');
      return;
    }
    const origRow = torneos.find((t) => t.id === torneoId);
    const errEstado = validarCambioEstadoTorneoAdminGuardar({
      estadoApiTorneoActual: origRow?.estado,
      estadoFormNuevo: editTorneoForm.estado,
      isSuperAdmin,
    });
    if (errEstado) {
      alert(errEstado);
      return;
    }
    setSavingTorneo(true);
    try {
      const body = {
        ...editTorneoForm,
        sede_id: editTorneoForm.sede_id ? parseInt(editTorneoForm.sede_id) : null,
        categoria: String(editTorneoForm.categoria || '').trim() || CATEGORIA_TORNEO_DEFAULT,
        estado: mapEstadoTorneoFormParaApi(editTorneoForm.estado || 'proximo'),
      };
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch(`${apiBaseUrl}/api/torneos/${torneoId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        const row0 = Array.isArray(updated) ? updated[0] : updated;
        setTorneos((prev) => prev.map((t) => (t.id === torneoId ? { ...t, ...(row0 || body) } : t)));
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
      let sedesAlcance = [];
      let scopeMeta = null;
      try {
        if (isSuperAdmin) {
          const sedesRes = await fetch(`${apiBaseUrl}/api/sedes/todas`, { headers: { ...listAuthHeaders } });
          const sedesJson = await sedesRes.json().catch(() => []);
          if (!sedesRes.ok) throw new Error(sedesJson?.error || sedesRes.statusText);
          allSedesRows = Array.isArray(sedesJson) ? sedesJson : [];
          sedesAlcance = allSedesRows;
          scopeMeta = { rol: 'super_admin', alcance: 'global', sedes: allSedesRows };
        } else {
          const { data: sedesRows, error: sedesErr } = await supabase
            .from('sedes')
            .select(
              'id, nombre, ciudad, pais, moneda, licencia_activa, numero_licencia, horario_apertura, horario_cierre, duracion_reserva_minutos'
            );
          if (!sedesErr) {
            allSedesRows = sedesRows || [];
          }
          try {
            const scopeRes = await fetch(`${apiBaseUrl}/api/admin/sedes-alcance`, { headers: { ...listAuthHeaders } });
            const scopeJson = await scopeRes.json().catch(() => ({}));
            if (scopeRes.ok && Array.isArray(scopeJson?.sedes)) {
              sedesAlcance = scopeJson.sedes;
              scopeMeta = scopeJson;
            }
          } catch {
            /* noop */
          }
        }
      } catch { /* sedes opcionales */ }
      setAdminScopeMeta(scopeMeta);
      if (!isSuperAdmin && sedesAlcance.length === 0 && esAdminClub && sedeId != null && sedeId !== '') {
        sedesAlcance = allSedesRows.filter((s) => mismoIdSede(s.id, sedeId));
      }

      /** Mapa de sedes: super ve todas las sedes (nombres en torneos de cualquier sede); el resto solo su alcance. */
      const sedesParaMapa = isSuperAdmin ? allSedesRows : sedesAlcance;
      const nextSedesMap = {};
      sedesParaMapa.forEach((s) => {
        nextSedesMap[s.id] = s;
      });
      setSedesMap(nextSedesMap);
      if (isSuperAdmin) {
        const sidList = Object.keys(nextSedesMap).map((k) => Number(k)).filter((n) => Number.isFinite(n));
        if (sidList.length > 0) {
          try {
            const contratosRes = await fetch(
              `${apiBaseUrl}/api/contratos-sedes?sede_ids=${encodeURIComponent(sidList.join(','))}`,
              { headers: { ...listAuthHeaders } }
            );
            const contratosJson = await contratosRes.json().catch(() => []);
            if (contratosRes.ok && Array.isArray(contratosJson)) {
              const map = {};
              for (const c of contratosJson) {
                const sid = Number(c?.sede_id);
                if (!Number.isFinite(sid)) continue;
                if (!map[sid]) map[sid] = c;
              }
              setContratosBySedeId(map);
            }
          } catch {
            /* noop */
          }
        } else {
          setContratosBySedeId({});
        }
      }
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

      const torneoIds =
        tornData.length > 0
          ? tornData.map((t) => t.id).filter((id) => Number.isFinite(Number(id)))
          : [];

      let eqIns = [];
      if (torneoIds.length > 0) {
        const { data: eqd, error: eqErr } = await supabase
          .from('equipos')
          .select('torneo_id, inscripcion_estado, updated_at, created_at')
          .in('torneo_id', torneoIds);
        if (!eqErr && Array.isArray(eqd)) eqIns = eqd;
      }
      setEquiposInscripcionRows(eqIns);

      const canchasMap = {};
      const detallePorSede = {};
      if (sedesAlcance.length > 0) {
        const sidList = sedesAlcance.map((s) => s.id).filter((id) => id != null && id !== '');
        if (sidList.length > 0) {
          const { data: canRows } = await supabase
            .from('canchas')
            .select('id, sede_id, nombre, estado, orden')
            .in('sede_id', sidList)
            .order('id', { ascending: true });
          const bySede = {};
          for (const row of canRows || []) {
            const sid = String(row.sede_id);
            if (!bySede[sid]) bySede[sid] = [];
            bySede[sid].push(row);
          }
          for (const sid of Object.keys(bySede)) {
            const enriched = canchasConNumeroReservaAdminDash(bySede[sid]);
            detallePorSede[sid] = enriched;
            canchasMap[sid] = {
              total: enriched.length,
              activas: enriched.filter((c) => normalizeEstadoCanchaAdminDash(c.estado) !== 'inactiva').length,
            };
          }
        }
      }
      setCanchasResumenPorSede(canchasMap);
      setCanchasDetallePorSede(detallePorSede);

      const partidosCnt = {};
      if (torneoIds.length > 0) {
        const { data: prows } = await supabase.from('partidos').select('torneo_id').in('torneo_id', torneoIds);
        for (const row of prows || []) {
          const tid = row.torneo_id;
          partidosCnt[tid] = (partidosCnt[tid] || 0) + 1;
        }
      }
      setPartidosCountByTorneoId(partidosCnt);

      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setLoading(false);
    }
  };

  const abrirNuevaSedeModal = useCallback(() => {
    setNuevaSedeModalOpen(true);
  }, []);

  const cerrarNuevaSedeModal = useCallback(() => {
    setNuevaSedeModalOpen(false);
  }, []);

  const onNuevaSedeCreada = (j) => {
    setSedesMap((prev) => ({ ...prev, [j.id]: j }));
    setMensajeExito(`✅ Sede "${String(j.nombre || '').trim() || 'nueva sede'}" creada`);
    setTimeout(() => setMensajeExito(''), 4000);
    void fetchData();
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

  const confirmarPagoManualReserva = async (reservaId) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'confirmada' }),
      });
      if (response.ok) {
        setMensajeExito('✅ Pago manual confirmado');
        setTimeout(() => {
          fetchData();
          setMensajeExito('');
        }, 900);
      } else {
        const j = await response.json().catch(() => ({}));
        alert(j.error || 'No se pudo confirmar el pago manual');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const ejecutarCancelarReservaAdmin = async (reservaId) => {
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
  const [suscripcionEstadoSuperSavingId, setSuscripcionEstadoSuperSavingId] = useState(null);
  const [stripeOnboardingLoading, setStripeOnboardingLoading] = useState(false);
  const [cancelReservaModalId, setCancelReservaModalId] = useState(null);
  const [suscripcionModal, setSuscripcionModal] = useState({
    open: false,
    clientSecret: null,
    sedeNombre: '',
    sedeId: null,
  });
  const [miSedeMsg,     setMiSedeMsg]     = useState('');
  const [pagosMpPanelAbierto, setPagosMpPanelAbierto] = useState(false);
  const [pagosStripePanelAbierto, setPagosStripePanelAbierto] = useState(false);
  const [pagosParcialSaving, setPagosParcialSaving] = useState(false);
  const [editarSedeModalOpen, setEditarSedeModalOpen] = useState(false);
  const [editarSedeDraft, setEditarSedeDraft] = useState({});
  const [editarSedeModalMsg, setEditarSedeModalMsg] = useState('');
  const [canchas,       setCanchas]       = useState([]);
  const [canchaModalOpen, setCanchaModalOpen] = useState(false);
  const [canchaModalMode, setCanchaModalMode] = useState('add');
  const [canchaEditId, setCanchaEditId] = useState(null);
  const [canchaModalDraft, setCanchaModalDraft] = useState({ nombre: '', estado: 'activa', descripcion: '' });
  const [canchaModalMsg, setCanchaModalMsg] = useState('');
  const [canchaApiBusy, setCanchaApiBusy] = useState(false);
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
  const adminTabsStripRef = useRef(null);
  const adminMainScrollRef = useRef(null);
  const [miSedeNavActive, setMiSedeNavActive] = useState('info');
  const miSedeNavItems = useMemo(() => {
    const items = [
      { id: 'info', label: 'Info del club' },
      { id: 'canchas', label: 'Canchas' },
      { id: 'horarios', label: 'Horarios' },
    ];
    if (esAdminClub || isSuperAdmin) items.push({ id: 'pagos', label: 'Configuración de pagos' });
    items.push({ id: 'contrato', label: 'Contrato' });
    return items;
  }, [esAdminClub, isSuperAdmin]);
  const scrollToMiSedeSection = useCallback((sectionId) => {
    if (typeof document === 'undefined') return;
    document.getElementById(`admin-mi-sede-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
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
    if (loading) return;
    const el = adminTabsStripRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [loading]);

  useEffect(() => {
    if (activeTab !== 'mi_sede' || !miSede || miSedeLoading) return;
    const root = adminMainScrollRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const elements = miSedeNavItems
      .map((x) => document.getElementById(`admin-mi-sede-${x.id}`))
      .filter(Boolean);
    if (!elements.length) return;
    const pickActive = (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting && e.target?.id)
        .map((e) => ({
          key: String(e.target.id).replace(/^admin-mi-sede-/, ''),
          ratio: e.intersectionRatio,
          top: e.boundingClientRect.top,
        }));
      if (!visible.length) return;
      visible.sort((a, b) => b.ratio - a.ratio || a.top - b.top);
      setMiSedeNavActive(visible[0].key);
    };
    const obs = new IntersectionObserver(pickActive, {
      root,
      rootMargin: '-10% 0px -52% 0px',
      threshold: [0, 0.08, 0.2, 0.35, 0.55],
    });
    elements.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [activeTab, miSede, miSedeLoading, miSedeNavItems]);

  useEffect(() => {
    if (activeTab !== 'mi_sede' || !sedeId) return;
    setMiSedeLoading(true);
    const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    Promise.all([
      supabase.from('sedes').select('*').eq('id', sedeId).maybeSingle(),
      session?.access_token
        ? fetch(`${apiBaseUrl}/api/sedes/${sedeId}/canchas`, { headers }).then(async (r) => {
            const j = await r.json().catch(() => ({}));
            return { ok: r.ok, j };
          })
        : Promise.resolve({ ok: false, j: {} }),
    ])
      .then(([{ data: sedeData }, canRes]) => {
        if (sedeData) {
          setMiSede(sedeData);
          setMiSedeForm(sedeDbRowToMiSedeFormState(sedeData));
          setLicenciaForm({
            numero_licencia: sedeData.numero_licencia || '',
            fecha_licencia: sedeData.fecha_licencia || '',
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
        const list = canRes.ok && Array.isArray(canRes.j?.canchas) ? canRes.j.canchas : [];
        setCanchas(list);
        setMiSedeLoading(false);
      })
      .catch(() => setMiSedeLoading(false));
  }, [activeTab, sedeId, apiBaseUrl, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!sedeId || !session?.access_token) {
      setMiSedeMsg('⚠️ Inicia sesión de nuevo.');
      setTimeout(() => setMiSedeMsg(''), 4000);
      return;
    }
    setMiSedeSaving(true);
    setMiSedeMsg('');
    const prev = miSede;
    const body = miSedeFormToApiPatchBody(miSedeForm);
    let errorMsg = null;
    let updated = null;
    try {
      const res = await fetch(`${apiBaseUrl}/api/sedes/${sedeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorMsg = data.error || res.statusText || 'Error al guardar';
      } else {
        updated = data.sede;
      }
    } catch (e) {
      errorMsg = e?.message || String(e);
    }
    setMiSedeSaving(false);
    setMiSedeMsg(errorMsg ? `⚠️ ${errorMsg}` : '✅ Sede actualizada');
    setTimeout(() => setMiSedeMsg(''), errorMsg ? 5000 : 3000);
    if (!errorMsg && updated && prev) {
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
      setMiSede(updated);
      setMiSedeForm((f) => ({ ...f, ...sedeDbRowToMiSedeFormState(updated) }));
      setSedesMap((m) => ({ ...m, [String(updated.id)]: { ...(m[String(updated.id)] || {}), ...updated } }));
    }
  };

  const guardarSedeCamposPagosParcial = useCallback(
    async (partial) => {
      if (!sedeId || !session?.access_token) {
        setMiSedeMsg('⚠️ Inicia sesión de nuevo.');
        setTimeout(() => setMiSedeMsg(''), 4000);
        return false;
      }
      setPagosParcialSaving(true);
      setMiSedeMsg('');
      try {
        const res = await fetch(`${apiBaseUrl}/api/sedes/${sedeId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(partial),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
        const updated = data.sede;
        if (updated) {
          setMiSede(updated);
          setMiSedeForm((f) => ({ ...f, ...sedeDbRowToMiSedeFormState(updated) }));
          setSedesMap((m) => ({ ...m, [String(updated.id)]: { ...(m[String(updated.id)] || {}), ...updated } }));
        }
        setMiSedeMsg('✅ Pagos actualizados');
        setTimeout(() => setMiSedeMsg(''), 3000);
        return true;
      } catch (e) {
        setMiSedeMsg(`⚠️ ${e?.message || String(e)}`);
        setTimeout(() => setMiSedeMsg(''), 5000);
        return false;
      } finally {
        setPagosParcialSaving(false);
      }
    },
    [apiBaseUrl, sedeId, session?.access_token]
  );

  const abrirModalEditarSede = useCallback(() => {
    setEditarSedeDraft({ ...miSedeForm });
    setEditarSedeModalMsg('');
    setEditarSedeModalOpen(true);
  }, [miSedeForm]);

  const guardarEditarSedeModal = async () => {
    if (!sedeId || !session?.access_token) {
      setEditarSedeModalMsg('Inicia sesión de nuevo.');
      return;
    }
    setMiSedeSaving(true);
    setEditarSedeModalMsg('');
    const prev = miSede;
    const body = miSedeFormToApiPatchBody(editarSedeDraft);
    try {
      const res = await fetch(`${apiBaseUrl}/api/sedes/${sedeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setMiSedeSaving(false);
      if (!res.ok) {
        setEditarSedeModalMsg(data.error || res.statusText || 'Error al guardar');
        return;
      }
      const updated = data.sede;
      if (updated) {
        setMiSede(updated);
        setMiSedeForm((f) => ({ ...f, ...sedeDbRowToMiSedeFormState(updated) }));
        setSedesMap((m) => ({ ...m, [String(updated.id)]: { ...(m[String(updated.id)] || {}), ...updated } }));
        if (prev) {
          const secret =
            typeof import.meta !== 'undefined' ? import.meta.env?.VITE_PADBOL_SEDE_CRITICO_NOTIFY_SECRET : '';
          const pushCambio = (campo, a, b) => {
            const sa = a == null || a === '' ? '' : String(a);
            const sb = b == null || b === '' ? '' : String(b);
            if (sa !== sb) return { campo, anterior: sa || '—', nuevo: sb || '—' };
            return null;
          };
          const cambios = [
            pushCambio('nombre', prev.nombre, editarSedeDraft.nombre),
            pushCambio('dirección / ubicación', prev.direccion, editarSedeDraft.direccion),
            pushCambio(
              'latitud',
              prev.latitud != null && prev.latitud !== '' ? String(prev.latitud) : '',
              editarSedeDraft.latitud !== '' && Number.isFinite(parseFloat(editarSedeDraft.latitud))
                ? String(parseFloat(editarSedeDraft.latitud))
                : ''
            ),
            pushCambio(
              'longitud',
              prev.longitud != null && prev.longitud !== '' ? String(prev.longitud) : '',
              editarSedeDraft.longitud !== '' && Number.isFinite(parseFloat(editarSedeDraft.longitud))
                ? String(parseFloat(editarSedeDraft.longitud))
                : ''
            ),
            pushCambio('email de contacto / admin', prev.email_contacto, editarSedeDraft.email_contacto),
          ].filter(Boolean);
          if (secret && cambios.length) {
            const sedeNombre =
              String(editarSedeDraft.nombre || prev.nombre || '').trim() || '(sede)';
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
        }
        setEditarSedeModalOpen(false);
        setMiSedeMsg('✅ Sede actualizada');
        setTimeout(() => setMiSedeMsg(''), 3000);
      }
    } catch (e) {
      setMiSedeSaving(false);
      setEditarSedeModalMsg(e?.message || String(e));
    }
  };

  const iniciarStripeOnboarding = useCallback(async () => {
    if (!sedeId || !session?.access_token) {
      alert('Inicia sesión de nuevo para conectar Stripe.');
      return;
    }
    setStripeOnboardingLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/stripe/onboarding/${sedeId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'No se pudo iniciar el enlace de Stripe');
      if (j.url) {
        window.location.href = j.url;
        return;
      }
      throw new Error('Respuesta sin URL de onboarding');
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setStripeOnboardingLoading(false);
    }
  }, [apiBaseUrl, sedeId, session?.access_token]);

  const activarSuscripcionStripeSede = useCallback(
    async (sedeRow) => {
      if (!isSuperAdmin || !session?.access_token || !sedeRow?.id) return;
      if (!STRIPE_PUBLISHABLE_ADMIN) {
        alert('Falta REACT_APP_STRIPE_PUBLISHABLE_KEY en el frontend.');
        return;
      }
      try {
        const res = await fetch(`${apiBaseUrl}/api/stripe/suscripcion/crear`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ sede_id: sedeRow.id }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(j.error || 'No se pudo iniciar la suscripción');
          return;
        }
        if (!j.client_secret) {
          alert('Stripe no devolvió client_secret. Revisá el precio y la suscripción en el dashboard de Stripe.');
          return;
        }
        setSuscripcionModal({
          open: true,
          clientSecret: j.client_secret,
          sedeNombre: String(sedeRow.nombre || '').trim(),
          sedeId: sedeRow.id,
        });
      } catch (e) {
        alert(e.message || String(e));
      }
    },
    [apiBaseUrl, isSuperAdmin, session?.access_token]
  );

  const guardarSuscripcionEstadoSuper = useCallback(
    async (sedeRow, nuevoValor) => {
      if (!isSuperAdmin || !session?.access_token || !sedeRow?.id) return;
      const id = sedeRow.id;
      setSuscripcionEstadoSuperSavingId(id);
      try {
        const res = await fetch(`${apiBaseUrl}/api/sedes/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ suscripcion_estado: nuevoValor }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(j.error || 'No se pudo actualizar el estado');
          return;
        }
        await fetchData();
      } catch (e) {
        alert(e.message || String(e));
      } finally {
        setSuscripcionEstadoSuperSavingId(null);
      }
    },
    [apiBaseUrl, fetchData, isSuperAdmin, session?.access_token]
  );

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
      setLogoMsg('⚠️ Elige una imagen');
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
      setFotosMsg(`Solo puedes agregar ${espacio} ${espacio === 1 ? 'foto más' : 'fotos más'}.`);
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
          setFotosDestacadasMsg('Ya tienes 4 fotos en el carrusel. Quita una para agregar otra');
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

  const abrirModalCanchaNueva = useCallback(() => {
    setCanchaModalMode('add');
    setCanchaEditId(null);
    setCanchaModalDraft({ nombre: '', estado: 'activa', descripcion: '' });
    setCanchaModalMsg('');
    setCanchaModalOpen(true);
  }, []);

  const abrirModalCanchaEditar = useCallback((c) => {
    setCanchaModalMode('edit');
    setCanchaEditId(c.id);
    setCanchaModalDraft({
      nombre: c.nombre || '',
      estado: c.estado === 'inactiva' ? 'inactiva' : 'activa',
      descripcion: c.descripcion || '',
    });
    setCanchaModalMsg('');
    setCanchaModalOpen(true);
  }, []);

  const guardarCanchaModal = async () => {
    if (!sedeId || !session?.access_token) {
      setCanchaModalMsg('Inicia sesión de nuevo.');
      return;
    }
    const nombre = String(canchaModalDraft.nombre || '').trim();
    if (!nombre) {
      setCanchaModalMsg('El nombre es obligatorio.');
      return;
    }
    setCanchaApiBusy(true);
    setCanchaModalMsg('');
    try {
      if (canchaModalMode === 'add') {
        const res = await fetch(`${apiBaseUrl}/api/sedes/${sedeId}/canchas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            nombre,
            estado: canchaModalDraft.estado === 'inactiva' ? 'inactiva' : 'activa',
            descripcion: String(canchaModalDraft.descripcion || '').trim() || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        setCanchaApiBusy(false);
        if (!res.ok) {
          setCanchaModalMsg(data.error || res.statusText || 'Error al crear');
          return;
        }
        if (data.cancha) setCanchas((prev) => [...prev, data.cancha].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
        setCanchaModalOpen(false);
        return;
      }
      const cid = canchaEditId;
      if (!cid) {
        setCanchaApiBusy(false);
        return;
      }
      const res = await fetch(`${apiBaseUrl}/api/canchas/${cid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nombre,
          estado: canchaModalDraft.estado === 'inactiva' ? 'inactiva' : 'activa',
          descripcion: String(canchaModalDraft.descripcion || '').trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setCanchaApiBusy(false);
      if (!res.ok) {
        setCanchaModalMsg(data.error || res.statusText || 'Error al guardar');
        return;
      }
      if (data.cancha) {
        setCanchas((prev) =>
          prev.map((c) => (c.id === data.cancha.id ? { ...c, ...data.cancha } : c))
        );
      }
      setCanchaModalOpen(false);
    } catch (e) {
      setCanchaApiBusy(false);
      setCanchaModalMsg(e?.message || String(e));
    }
  };

  const toggleCanchaEstado = async (canchaRow) => {
    if (!session?.access_token) return;
    const nuevoEstado = canchaRow.estado === 'activa' ? 'inactiva' : 'activa';
    try {
      const res = await fetch(`${apiBaseUrl}/api/canchas/${canchaRow.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'No se pudo cambiar el estado');
        return;
      }
      if (data.cancha) {
        setCanchas((prev) => prev.map((c) => (c.id === canchaRow.id ? { ...c, ...data.cancha } : c)));
      }
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  const handleVolverHubDesdeAdmin = () => {
    clearAdminNavContext();
    navigate('/');
  };

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '100%',
          overflowY: 'auto',
          padding: `${hubContentPaddingTopCss(location.pathname)} 20px calc(${HUB_CONTENT_PADDING_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`,
          textAlign: 'center',
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

  const TABS = esAdminNacional
    ? [
        { id: 'resumen', label: 'Resumen' },
        { id: 'torneos', label: 'Torneos' },
        { id: 'sedes', label: 'Sedes' },
        { id: 'jugadores', label: 'Jugadores' },
      ]
    : [
        { id: 'resumen', label: '📊 Resumen' },
        ...(isSuperAdmin ? [{ id: 'sedes', label: '🏟️ Sedes' }] : []),
        ...(isSuperAdmin ? [{ id: 'solicitudes', label: '📝 Solicitudes' }] : []),
        { id: 'torneos', label: '🏆 Torneos' },
        { id: 'reservas', label: '⚽ Reservas' },
        { id: 'validaciones', label: '⏳ Validaciones', badge: pendientes.length },
        ...(puedeVerMiSede ? [{ id: 'mi_sede', label: '🏟️ Mi Sede' }] : []),
        ...(puedeVerConfig
          ? [
              { id: 'config', label: '⚙️ Config' },
              { id: 'planes', label: '💳 Planes' },
              { id: 'roles', label: '👥 Roles' },
            ]
          : []),
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
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="" showBack={false} adminPanelMinimalHeader />
      <div
        ref={adminMainScrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          paddingTop: hubContentPaddingTopCss(location.pathname),
          paddingBottom: `calc(12px + ${HUB_CONTENT_PADDING_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`,
          boxSizing: 'border-box',
        }}
      >
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
              marginTop: HUB_LOGO_CLEARANCE_TOP_PX,
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
      {isSuperAdmin && ['resumen', 'sedes'].includes(activeTab) && (
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
            onClick={abrirNuevaSedeModal}
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
            ➕ Nueva sede
          </button>
        </div>
      )}

      {/* Tab navigation — rueda vertical desplaza scroll horizontal */}
      <div ref={adminTabsStripRef} style={{ display: 'flex', gap: '4px', marginTop: '8px', marginBottom: '24px', borderBottom: '2px solid rgba(255,255,255,0.3)', paddingTop: 0, paddingBottom: '0', overflowX: 'auto', overflowY: 'hidden', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch', position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#667eea' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            data-admin-tour-tab={tab.id}
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

      {esAdminClub && !isSuperAdmin && miSede
        ? (() => {
            const se = String(miSede.suscripcion_estado || '').toLowerCase();
            const waSupport = supportWhatsAppUrlFromEnv();
            const btnSoporte = (bg) =>
              waSupport ? (
                <a
                  href={waSupport}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-block',
                    marginTop: '10px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: bg,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '13px',
                    textDecoration: 'none',
                  }}
                >
                  WhatsApp soporte
                </a>
              ) : null;
            if (se === 'aviso') {
              return (
                <div
                  role="alert"
                  style={{
                    marginBottom: '18px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: '#fef9c3',
                    border: '1px solid #eab308',
                    color: '#713f12',
                    fontWeight: 700,
                    fontSize: '14px',
                    lineHeight: 1.45,
                  }}
                >
                  ⚠️ Tu suscripción venció. Regularizá el pago para evitar interrupciones.
                </div>
              );
            }
            if (se === 'segundo_aviso') {
              return (
                <div
                  role="alert"
                  style={{
                    marginBottom: '18px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: '#ffedd5',
                    border: '1px solid #ea580c',
                    color: '#9a3412',
                    fontWeight: 700,
                    fontSize: '14px',
                    lineHeight: 1.45,
                  }}
                >
                  🔴 Segundo aviso: tu cuenta será suspendida en breve si no regularizás.
                </div>
              );
            }
            if (se === 'suspendido') {
              return (
                <div
                  role="alert"
                  style={{
                    marginBottom: '18px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: '#fee2e2',
                    border: '1px solid #dc2626',
                    color: '#991b1b',
                    fontWeight: 700,
                    fontSize: '14px',
                    lineHeight: 1.45,
                  }}
                >
                  🚫 Cuenta suspendida. Los jugadores no pueden reservar. Contacta soporte.
                  <div>{btnSoporte('#dc2626')}</div>
                </div>
              );
            }
            if (se === 'cancelado' || se === 'cancelada') {
              return (
                <div
                  role="alert"
                  style={{
                    marginBottom: '18px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: '#450a0a',
                    border: '1px solid #7f1d1d',
                    color: '#fecaca',
                    fontWeight: 700,
                    fontSize: '14px',
                    lineHeight: 1.45,
                  }}
                >
                  ❌ Cuenta cancelada. Contacta soporte para reactivar.
                  <div>{btnSoporte('#b91c1c')}</div>
                </div>
              );
            }
            return null;
          })()
        : null}

      {activeTab === 'resumen' && (esAdminNacional ? (
        <>
          <div
            style={{
              marginBottom: '14px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.92)',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {`Alcance: ${String(adminScopeMeta?.alcance || 'pais')}${
              adminScopeMeta?.ciudad ? ` · Ciudad: ${adminScopeMeta.ciudad}` : ''
            }${adminScopeMeta?.provincia ? ` · Provincia: ${adminScopeMeta.provincia}` : ''}${
              adminScopeMeta?.pais ? ` · País: ${adminScopeMeta.pais}` : ''
            }`}
          </div>
          <>
            <div className="dashboard-grid">
              <div className="card reservas">
                <h2>Total sedes</h2>
                <p className="count">{sedesNacionalLista.length}</p>
                <p style={{ color: '#888', marginTop: '8px', fontSize: '0.9rem' }}>Clubes dentro de tu alcance</p>
              </div>
              <div className="card torneos">
                <h2>Total jugadores</h2>
                <p className="count">{nacionalJugadoresLoading ? '…' : totalJugadoresPais}</p>
                <p style={{ color: '#888', marginTop: '8px', fontSize: '0.9rem' }}>Fichas en tu alcance</p>
              </div>
              <div className="card torneos">
                <h2>Torneos activos</h2>
                <p className="count">{torneosActivosNacionalCount}</p>
                <p style={{ color: '#888', marginTop: '8px', fontSize: '0.9rem' }}>Excluye finalizados y cancelados</p>
              </div>
            </div>
            {resumenOperativoSecciones}
          </>
        </>
      ) : (
        <>
        {resumenOperativoSecciones}
        {esAdminClub && misCanchasHoyAdminClub ? (
          <div
            className="section"
            style={{
              marginBottom: '18px',
              background: '#fff',
              borderRadius: '14px',
              padding: '16px 18px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              color: '#1e293b',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '6px', color: '#334155', fontSize: '18px' }}>Mis canchas hoy</h2>
            <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
              {misCanchasHoyAdminClub.nombreSede} · {misCanchasHoyAdminClub.fechaLabel}
            </p>
            {misCanchasHoyAdminClub.sinCanchasActivas ? (
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>
                Sin canchas activas cargadas. Configuralas en «Mi sede».
              </p>
            ) : misCanchasHoyAdminClub.totalReservasHoySede === 0 ? (
              <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '14px', fontWeight: 700 }}>Sin reservas hoy</p>
            ) : null}
            {!misCanchasHoyAdminClub.sinCanchasActivas ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {misCanchasHoyAdminClub.rows.map((row) => (
                  <li
                    key={row.id != null ? `c-${row.id}` : `c-num-${row.numero}`}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px', marginBottom: '6px' }}>
                      {row.nombre}
                      <span style={{ color: '#64748b', fontWeight: 700, fontSize: '13px', marginLeft: '8px' }}>
                        (n.º {row.numero})
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                      <span style={{ color: '#64748b', fontWeight: 700 }}>Slots ocupados hoy:</span> {row.ocupados}
                      <span style={{ margin: '0 10px', color: '#cbd5e1' }}>|</span>
                      <span style={{ color: '#64748b', fontWeight: 700 }}>Slots disponibles hoy:</span>{' '}
                      {row.disponibles == null ? '—' : row.disponibles}
                    </div>
                    <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px', fontWeight: 600 }}>
                      <span style={{ color: '#64748b', fontWeight: 700 }}>Próxima reserva:</span> {row.proximaTexto}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
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
                onClick={() => {
                  setSuperAdminPeriodo(opt.id);
                  if (opt.id !== 'rango') {
                    setFinanzasAnclaISO(new Date().toISOString().slice(0, 10));
                  }
                }}
                style={adminFilterPillButtonStyle(superAdminPeriodo === opt.id)}
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
          ) : (
            <SuperAdminFinanzasPeriodoNav
              periodo={superAdminPeriodo}
              anclaISO={finanzasAnclaISO}
              onShift={shiftFinanzasPeriodo}
            />
          )}
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
      <div
        className="section"
        style={{
          marginTop: '16px',
          background: '#fff',
          borderRadius: '14px',
          padding: '16px',
          boxShadow: '0 10px 26px rgba(15,23,42,0.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: '#0f172a' }}>💰 Financiero</h2>
          <button
            type="button"
            onClick={exportarFinanzasExcel}
            style={{
              border: 'none',
              borderRadius: '10px',
              padding: '10px 14px',
              background: '#0f766e',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Exportar
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '10px', marginTop: '12px' }}>
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>Transacciones</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{dashboardFinanciero.totalTransacciones}</div>
          </div>
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>Ticket promedio</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
              {isSuperAdmin
                ? Math.round(Number(dashboardFinanciero.ticketPromedio) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
                : `$ ${Math.round(Number(dashboardFinanciero.ticketPromedio) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ${cifrasFinanzasResumen.moneda || 'ARS'}`}
            </div>
          </div>
        </div>
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Ingresos por día</div>
          {dashboardFinanciero.dailyRows.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>Sin movimientos en el período seleccionado.</div>
          ) : (
            <div style={{ display: 'grid', gap: '6px' }}>
              {dashboardFinanciero.dailyRows.map((row) => {
                const pct = dashboardFinanciero.maxDaily > 0 ? Math.max(4, (row.total / dashboardFinanciero.maxDaily) * 100) : 0;
                return (
                  <div key={row.fecha} style={{ display: 'grid', gridTemplateColumns: '50px 1fr auto', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 700 }}>{ymdToLabelShort(row.fecha)}</span>
                    <div style={{ height: '12px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#0ea5e9)' }} />
                    </div>
                    <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 700 }}>{Number(row.total).toLocaleString('es-AR')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
        </>
      ))}

      {activeTab === 'torneos' && <>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', marginBottom: '8px' }}>
            Estado del torneo
          </div>
          <div
            role="group"
            aria-label="Estado del torneo"
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
            {FILTROS_ESTADO_TORNEO_PILLS.map(({ id, label }) => {
              const active = filtroEstadoTorneoAdmin === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFiltroEstadoTorneoAdmin(id)}
                  style={adminFilterPillButtonStyle(active)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      <div className="section">
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
        ) : torneosFiltradosAdminEstado.length === 0 ? (
          <p style={{ color: '#999' }}>No hay torneos con este estado.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {torneosFiltradosAdminEstado.map(torneo => {
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
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Deporte</label>
                          <select
                            style={inp}
                            value={editTorneoForm.deporte || TORNEO_DEPORTE_PADBOL}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEditTorneoForm((p) => ({
                                ...p,
                                deporte: v,
                                formato_equipo:
                                  v === TORNEO_DEPORTE_PICKLEBALL ? p.formato_equipo || TORNEO_FORMATO_DOBLES : TORNEO_FORMATO_DOBLES,
                              }));
                            }}
                          >
                            {TORNEO_DEPORTE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>
                            Modalidad (jugadores)
                          </label>
                          {editTorneoForm.deporte === TORNEO_DEPORTE_PICKLEBALL ? (
                            <select
                              style={inp}
                              value={editTorneoForm.formato_equipo || TORNEO_FORMATO_DOBLES}
                              onChange={(e) => setEditTorneoForm((p) => ({ ...p, formato_equipo: e.target.value }))}
                            >
                              {TORNEO_FORMATO_PICKLE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select style={{ ...inp, opacity: 0.92, cursor: 'not-allowed' }} value={TORNEO_FORMATO_DOBLES} disabled>
                              <option value={TORNEO_FORMATO_DOBLES}>Dobles (2v2)</option>
                            </select>
                          )}
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
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Tipo de torneo (M / F / Mixto)</label>
                          <select
                            style={inp}
                            value={editTorneoForm.tipo_competencia || TORNEO_GENERO_COMPETENCIA_DEFAULT}
                            onChange={(e) => setEditTorneoForm((p) => ({ ...p, tipo_competencia: e.target.value }))}
                          >
                            {TORNEO_GENERO_COMPETENCIA_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Categoría de edad</label>
                          <select
                            style={inp}
                            value={editTorneoForm.categoria_edad || TORNEO_CATEGORIA_EDAD_DEFAULT}
                            onChange={(e) => setEditTorneoForm((p) => ({ ...p, categoria_edad: e.target.value }))}
                          >
                            {TORNEO_CATEGORIA_EDAD_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
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
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>
                            {isSuperAdmin ? 'Estado (manual)' : 'Estado'}
                          </label>
                          {(() => {
                            const opts = opcionesSelectEstadoTorneoAdmin(torneo.estado, isSuperAdmin);
                            const soloLecturaMsg = mensajeEstadoTorneoSoloLecturaAdmin(torneo.estado, isSuperAdmin);
                            if (opts) {
                              return (
                                <>
                                  <select
                                    style={inp}
                                    value={editTorneoForm.estado || 'proximo'}
                                    onChange={(e) => setEditTorneoForm((p) => ({ ...p, estado: e.target.value }))}
                                  >
                                    {opts.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                  {!isSuperAdmin && opts.length === 2 ? (
                                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                                      Desde «Próximo» solo puedes pasar a «Inscripción abierta». Lo demás se hace desde la vista del torneo.
                                    </div>
                                  ) : null}
                                </>
                              );
                            }
                            return (
                              <div
                                style={{
                                  ...inp,
                                  background: '#f9fafb',
                                  color: '#374151',
                                  fontSize: '12px',
                                  lineHeight: 1.35,
                                  padding: '8px 10px',
                                }}
                              >
                                {soloLecturaMsg || 'Estado sin edición manual.'}
                              </div>
                            );
                          })()}
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Fecha inicio</label>
                          <input type="date" style={inp} value={editTorneoForm.fecha_inicio} onChange={e => setEditTorneoForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Fecha fin</label>
                          <input type="date" style={inp} value={editTorneoForm.fecha_fin} onChange={e => setEditTorneoForm(p => ({ ...p, fecha_fin: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>Cupos máx. equipos</label>
                          <input
                            type="number"
                            style={inp}
                            min="1"
                            placeholder="Vacío = sin tope en card pública"
                            value={editTorneoForm.cupos_maximos ?? ''}
                            onChange={(e) => setEditTorneoForm((p) => ({ ...p, cupos_maximos: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '3px' }}>
                            Horas revelar equipos
                          </label>
                          <input
                            type="number"
                            style={inp}
                            min="0"
                            placeholder="48"
                            value={editTorneoForm.horas_revelar_equipos ?? '48'}
                            onChange={(e) => setEditTorneoForm((p) => ({ ...p, horas_revelar_equipos: e.target.value }))}
                          />
                          <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                            Vista pública: oculta la lista hasta esta cantidad de horas antes del inicio (admins ven siempre).
                          </div>
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
                        <span style={badge('#ede9fe', '#5b21b6')}>{resumenDeporteFormatoTorneo(torneo)}</span>
                        <span style={badge('#f0fdf4', '#166534')}>{formatCategoriaTorneo(torneo.categoria)}</span>
                        <span style={badge('#fef9c3', '#854d0e')}>{formatGeneroCompetenciaTorneo(torneoTipoCompetenciaDb(torneo))}</span>
                        <span style={badge('#e0f2fe', '#0369a1')}>{formatCategoriaEdadTorneo(torneo.categoria_edad)}</span>
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
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', marginLeft: 'auto', flexWrap: 'wrap' }}>
                        {(() => {
                          const st = torneoStats[torneo.id];
                          const mostrarSorteo =
                            isAdmin &&
                            torneo.tipo_torneo === 'grupos_knockout' &&
                            torneoEstadoPermiteSorteoGrupos(torneo.estado) &&
                            st &&
                            !st.tiene_grupos &&
                            (st.equipos_confirmados_sorteo ?? 0) >= 2;
                          return mostrarSorteo ? (
                            <button
                              type="button"
                              onClick={() => void abrirModalSorteoGrupos(torneo)}
                              style={{
                                padding: '6px 12px',
                                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                              }}
                              title="Sorteo manual de grupos"
                            >
                              Sorteo grupos
                            </button>
                          ) : null;
                        })()}
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
      </div>
      <SorteoGruposModal
        open={Boolean(sorteoGruposCtx)}
        onClose={() => setSorteoGruposCtx(null)}
        torneo={sorteoGruposCtx?.torneo}
        equipos={sorteoGruposCtx?.equipos ?? []}
        apiBaseUrl={apiBaseUrl}
        accessToken={session?.access_token}
        onConfirmed={() => {
          const tid = sorteoGruposCtx?.torneo?.id;
          setSorteoGruposCtx(null);
          if (tid != null) {
            setTorneos((prev) =>
              prev.map((t) => (t.id === tid ? { ...t, estado: 'en_curso' } : t))
            );
          }
          setTorneoStatsTick((n) => n + 1);
        }}
      />
      </>}

      {activeTab === 'sedes' && (esAdminNacional || isSuperAdmin) && (
        <div className="section">
          <h2>{isSuperAdmin ? 'Sedes registradas' : 'Sedes en tu país'}</h2>
          {(isSuperAdmin ? sedesSuperAdminLista : sedesNacionalLista).length === 0 ? (
            <p style={{ color: '#999' }}>
              {isSuperAdmin
                ? 'No hay sedes creadas todavía.'
                : 'No hay sedes que coincidan con tu alcance nacional.'}
            </p>
          ) : (
            <>
              {isSuperAdmin ? (
                <div className="sedes-admin-filters-toolbar">
                  <label className="sedes-admin-filter-field">
                    <span className="sedes-admin-filter-label">País</span>
                    <select
                      value={sedeMobileFiltroPais}
                      onChange={(e) => {
                        setSedeMobileFiltroPais(e.target.value);
                        setSedeMobileFiltroCiudad('');
                      }}
                      className="sedes-admin-filter-select"
                      aria-label="Filtrar sedes por país"
                    >
                      <option value="">Todos</option>
                      {sedesSuperAdminPaisesUnicos.map((p) => (
                        <option key={p} value={p}>
                          {etiquetaPaisFiltroMobile(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="sedes-admin-filter-field">
                    <span className="sedes-admin-filter-label">Ciudad</span>
                    <select
                      value={sedeMobileFiltroCiudad}
                      onChange={(e) => setSedeMobileFiltroCiudad(e.target.value)}
                      className="sedes-admin-filter-select"
                      aria-label="Filtrar sedes por ciudad"
                    >
                      <option value="">Todos</option>
                      {sedesSuperAdminCiudadesOpciones.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              {isSuperAdmin && sedesSuperAdminListaFiltrada.length > 0 ? (
                <div
                  className="sedes-admin-sedes-pagination"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '14px',
                    margin: '12px 0 14px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#334155',
                  }}
                >
                  <button
                    type="button"
                    disabled={sedesSuperAdminPaginacion.page <= 1}
                    onClick={() => setSedesSuperAdminPagina((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: sedesSuperAdminPaginacion.page <= 1 ? '#f1f5f9' : '#fff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: sedesSuperAdminPaginacion.page <= 1 ? 'not-allowed' : 'pointer',
                      color: '#0f172a',
                    }}
                  >
                    Anterior
                  </button>
                  <span style={{ minWidth: '120px', textAlign: 'center' }}>
                    Página {sedesSuperAdminPaginacion.page} de {sedesSuperAdminPaginacion.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={sedesSuperAdminPaginacion.page >= sedesSuperAdminPaginacion.totalPages}
                    onClick={() =>
                      setSedesSuperAdminPagina((p) => Math.min(sedesSuperAdminPaginacion.totalPages, p + 1))
                    }
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background:
                        sedesSuperAdminPaginacion.page >= sedesSuperAdminPaginacion.totalPages ? '#f1f5f9' : '#fff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor:
                        sedesSuperAdminPaginacion.page >= sedesSuperAdminPaginacion.totalPages
                          ? 'not-allowed'
                          : 'pointer',
                      color: '#0f172a',
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              ) : null}
              <div className="sedes-admin-table-wrap" style={{ overflowX: 'auto' }}>
                <table className="reservas-table sedes-admin-sedes-table">
                  <thead>
                    <tr>
                      <th>Sede</th>
                      <th>Ciudad</th>
                      {isSuperAdmin ? <th>País</th> : null}
                      {isSuperAdmin ? <th>Contacto</th> : null}
                      <th>Licencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isSuperAdmin &&
                    sedesSuperAdminListaFiltrada.length === 0 &&
                    sedesSuperAdminLista.length > 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: '#64748b', padding: '14px 12px' }}>
                          No hay sedes que coincidan con el filtro.
                        </td>
                      </tr>
                    ) : (
                      (isSuperAdmin ? sedesSuperAdminPaginacion.slice : sedesNacionalLista).map((s) => {
                      const flagS = sedeFlag(s);
                      const open = Number(sedeDetalleAbiertoId) === Number(s.id);
                      const contrato = contratosBySedeId[Number(s.id)] || null;
                      const badge = contratoBadgeData(contrato);
                      return (
                        <React.Fragment key={s.id}>
                          <tr>
                            <td style={{ fontWeight: 700 }}>
                              {flagS ? `${flagS} ` : ''}
                              {String(s.nombre || '').trim() || '—'}
                              {isSuperAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => setSedeDetalleAbiertoId((prev) => (Number(prev) === Number(s.id) ? null : s.id))}
                                  style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '11px' }}
                                >
                                  {open ? 'Ocultar' : 'Detalle'}
                                </button>
                              ) : null}
                            </td>
                            <td>{String(s.ciudad || '').trim() || '—'}</td>
                            {isSuperAdmin ? <td>{String(s.pais || '').trim() || '—'}</td> : null}
                            {isSuperAdmin ? (
                              <td style={{ fontSize: '12px' }}>
                                {String(s.email_contacto || '').trim() || '—'}
                                {' · '}
                                {String(s.telefono || '').trim() || '—'}
                              </td>
                            ) : null}
                            <td>{sedeLicenciaChip(s)}</td>
                          </tr>
                          {isSuperAdmin && open ? (
                            <tr>
                              <td colSpan={5} style={{ background: '#f8fafc', padding: '10px 12px' }}>
                                <SedeSuperDetallePanel
                                  s={s}
                                  contrato={contrato}
                                  badge={badge}
                                  suscripcionEstadoSuperSavingId={suscripcionEstadoSuperSavingId}
                                  guardarSuscripcionEstadoSuper={guardarSuscripcionEstadoSuper}
                                  activarSuscripcionStripeSede={activarSuscripcionStripeSede}
                                />
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="sedes-admin-mobile-cards">
                {(isSuperAdmin ? sedesSuperAdminListaFiltrada : sedesNacionalLista).length === 0 &&
                (isSuperAdmin ? sedesSuperAdminLista : sedesNacionalLista).length > 0 ? (
                  <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>
                    No hay sedes que coincidan con el filtro.
                  </p>
                ) : null}
                {(isSuperAdmin ? sedesSuperAdminPaginacion.slice : sedesNacionalLista).map((s) => {
                  const flagS = sedeFlag(s);
                  const open = Number(sedeDetalleAbiertoId) === Number(s.id);
                  const contrato = contratosBySedeId[Number(s.id)] || null;
                  const badge = contratoBadgeData(contrato);
                  const email = String(s.email_contacto || '').trim();
                  const pais = String(s.pais || '').trim();
                  const ciudad = String(s.ciudad || '').trim();
                  const locLine = [pais || null, ciudad || null].filter(Boolean).join(' · ') || '—';
                  return (
                    <div key={s.id} className="sede-admin-card">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ fontSize: '1.35rem', lineHeight: 1.2, flexShrink: 0 }} aria-hidden>
                          {flagS || ''}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '15px', color: '#111827', wordBreak: 'break-word' }}>
                            {String(s.nombre || '').trim() || '—'}
                          </div>
                          <div style={{ marginTop: '4px', fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                            {locLine}
                          </div>
                          {email ? (
                            <div style={{ marginTop: '6px', fontSize: '13px' }}>
                              <a href={`mailto:${email}`} style={{ color: '#4f46e5', wordBreak: 'break-all' }}>
                                {email}
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div style={{ marginTop: '10px' }}>{sedeLicenciaChip(s)}</div>
                      {isSuperAdmin ? (
                        <button
                          type="button"
                          onClick={() => setSedeDetalleAbiertoId((prev) => (Number(prev) === Number(s.id) ? null : s.id))}
                          style={{
                            marginTop: '10px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            cursor: 'pointer',
                          }}
                        >
                          {open ? 'Ocultar detalle' : 'Detalle'}
                        </button>
                      ) : null}
                      {isSuperAdmin && open ? (
                        <div
                          style={{
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            marginLeft: '-4px',
                            marginRight: '-4px',
                            paddingLeft: '12px',
                            paddingRight: '12px',
                            paddingBottom: '12px',
                            borderRadius: '0 0 8px 8px',
                          }}
                        >
                          <SedeSuperDetallePanel
                            s={s}
                            contrato={contrato}
                            badge={badge}
                            suscripcionEstadoSuperSavingId={suscripcionEstadoSuperSavingId}
                            guardarSuscripcionEstadoSuper={guardarSuscripcionEstadoSuper}
                            activarSuscripcionStripeSede={activarSuscripcionStripeSede}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'jugadores' && esAdminNacional && (
        <div className="section">
          <h2>Jugadores federados en tu país</h2>
          {nacionalJugadoresLoading ? (
            <p style={{ color: '#999' }}>Cargando…</p>
          ) : jugadoresFederadosPais.length === 0 ? (
            <p style={{ color: '#999' }}>No hay jugadores marcados como federados en tu país.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="reservas-table">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Email</th>
                    <th>Categoría</th>
                    <th>País (ficha)</th>
                  </tr>
                </thead>
                <tbody>
                  {jugadoresFederadosPais.map((j) => {
                    const nom = [String(j.nombre || '').trim(), String(j.apellido || '').trim()]
                      .filter(Boolean)
                      .join(' ')
                      .trim();
                    return (
                      <tr key={j.email || `${j.nombre}-${j.apellido}`}>
                        <td style={{ fontWeight: 700 }}>{nom || String(j.alias || '').trim() || '—'}</td>
                        <td style={{ fontSize: '13px' }}>{String(j.email || '').trim() || '—'}</td>
                        <td>{String(j.nivel || '').trim() || '—'}</td>
                        <td>{String(j.pais || '').trim() || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>
                      Género: {String(jugador.genero || '').trim() || '—'}
                    </div>
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
                          {categoriasNivelPorGenero(jugador.genero).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
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

      {activeTab === 'reservas' && <>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', marginBottom: '8px' }}>
            Estado de la reserva
          </div>
          <div
            role="group"
            aria-label="Estado de la reserva"
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
            {FILTROS_RESERVA_ADMIN_PILLS.map(({ id, label }) => {
              const active = filtroPillReservas === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFiltroPillReservas(id)}
                  style={adminFilterPillButtonStyle(active)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="section">
        {(() => {
          if (isSuperAdmin) {
            const getMonedaCanonica = (reserva) => {
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
              return (
                Object.values(sedesMap || {}).find((s) => {
                  const nombreSede = String(s?.nombre || '').trim();
                  if (!nombreSede) return false;
                  const nombreSedeLower = nombreSede.toLowerCase();
                  return nombreSedeLower.includes(sedeReservaLower) || sedeReservaLower.includes(nombreSedeLower);
                }) || null
              );
            };
            const isInPeriodo = (fechaISO) =>
              fechaDentroDePeriodoFinanzas(
                fechaISO,
                superAdminPeriodo,
                superAdminFechaDesde,
                superAdminFechaHasta,
                finanzasAnclaISO
              );
            const reservasPeriodo = reservas.filter((r) => isInPeriodo(String(r?.fecha || '').trim()));
            const reservasPeriodoFiltradas = reservasPeriodo.filter((r) =>
              reservaPasaFiltroEstadoPill(r, filtroPillReservas)
            );

            const ingresosMes = {};
            const porSede = new Map();
            reservasPeriodoFiltradas.forEach((r) => {
              const sedeNombre = String(r?.sede || 'Sin sede').trim() || 'Sin sede';
              const sedeInfo = resolveSedeDesdeReserva(r) || {};
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

            const reservasResumenPais = reservasPeriodoFiltradas.filter((r) => {
              const sedeInfo = resolveSedeDesdeReserva(r);
              return mismoPaisFiltroAdmin(sedeInfo?.pais, superReservasFiltroPais);
            });
            const ingresosResumenPais = {};
            reservasResumenPais.forEach((r) => {
              const sedeInfo = resolveSedeDesdeReserva(r) || {};
              const moneda = getMonedaCanonica({ moneda: sedeInfo?.moneda || r?.moneda });
              const precio = Number(r?.precio) || 0;
              ingresosResumenPais[moneda] = (ingresosResumenPais[moneda] || 0) + precio;
            });
            const comisionPmResumen = comisionPadbolTresPorcientoPorMoneda(ingresosResumenPais);

            const paisesOpts = [
              ...new Set(
                Object.values(sedesMap || {})
                  .map((s) => String(s.pais || '').trim())
                  .filter(Boolean)
              ),
            ].sort((a, b) => a.localeCompare(b, 'es'));

            const qClub = rankingFiltroNombreClub.trim().toLowerCase();
            const qCiudad = rankingFiltroCiudad.trim().toLowerCase();
            let sedesRanking = [...porSede.values()].filter((g) => {
              if (!mismoPaisFiltroAdmin(g.pais, superReservasFiltroPais)) return false;
              if (qCiudad && !String(g.ciudad || '').toLowerCase().includes(qCiudad)) return false;
              if (qClub && !String(g.sede || '').toLowerCase().includes(qClub)) return false;
              return true;
            });
            const dirMul = rankingOrden.dir === 'asc' ? 1 : -1;
            sedesRanking = [...sedesRanking].sort((a, b) => {
              if (rankingOrden.campo === 'ingresos') {
                return (ingresoTotalOrdenRanking(a.ingresos) - ingresoTotalOrdenRanking(b.ingresos)) * dirMul;
              }
              return (a.reservasCount - b.reservasCount) * dirMul;
            });

            const rankingGrupoDetalle =
              rankingDetalleSedeKey != null ? porSede.get(rankingDetalleSedeKey) : null;

            const periodoReservasSuperRow = (
              <div style={{ display: 'grid', gap: '8px' }}>
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
                    { id: 'semana', label: 'Esta semana' },
                    { id: 'mes', label: 'Este mes' },
                    { id: 'anio', label: 'Este año' },
                    { id: 'rango', label: 'Rango' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSuperAdminPeriodo(opt.id);
                        if (opt.id !== 'rango') {
                          setFinanzasAnclaISO(new Date().toISOString().slice(0, 10));
                        }
                      }}
                      style={adminFilterPillButtonStyle(superAdminPeriodo === opt.id)}
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
                ) : (
                  <SuperAdminFinanzasPeriodoNav
                    periodo={superAdminPeriodo}
                    anclaISO={finanzasAnclaISO}
                    onShift={shiftFinanzasPeriodo}
                  />
                )}
              </div>
            );

            const sortHeaderBtn = (campo, label) => {
              const active = rankingOrden.campo === campo;
              const arrow = active ? (rankingOrden.dir === 'desc' ? ' ↓' : ' ↑') : '';
              return (
                <button
                  type="button"
                  onClick={() =>
                    setRankingOrden((prev) =>
                      prev.campo !== campo
                        ? { campo, dir: 'desc' }
                        : { campo, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
                    )
                  }
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    margin: 0,
                    font: 'inherit',
                    fontWeight: 800,
                    color: '#475569',
                    cursor: 'pointer',
                    textDecoration: active ? 'underline' : 'none',
                  }}
                >
                  {label}
                  {arrow}
                </button>
              );
            };

            if (reservasSuperSubVista === 'ranking') {
              return (
                <div style={{ display: 'grid', gap: '16px', minWidth: 0, maxWidth: '100%' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setReservasSuperSubVista('principal');
                      setRankingDetalleSedeKey(null);
                    }}
                    style={{
                      justifySelf: 'start',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    ← Volver
                  </button>
                  <h2 style={{ margin: 0, fontSize: '22px', color: '#f8fafc', fontWeight: 900 }}>
                    Ranking de clubes
                  </h2>
                  {periodoReservasSuperRow}
                  <div
                    style={{
                      display: 'grid',
                      gap: '12px',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                    }}
                  >
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'rgba(255,255,255,0.92)' }}>
                      País
                      <select
                        value={superReservasFiltroPais}
                        onChange={(e) => setSuperReservasFiltroPais(e.target.value)}
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '15px',
                          color: '#334155',
                          background: '#fff',
                        }}
                      >
                        <option value="">Todos los países</option>
                        {paisesOpts.map((p) => (
                          <option key={p} value={p}>
                            {etiquetaPaisFiltroMobile(p)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'rgba(255,255,255,0.92)' }}>
                      Ciudad
                      <input
                        type="text"
                        value={rankingFiltroCiudad}
                        onChange={(e) => setRankingFiltroCiudad(e.target.value)}
                        placeholder="Filtrar por ciudad"
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '15px',
                          color: '#334155',
                          background: '#fff',
                        }}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'rgba(255,255,255,0.92)' }}>
                      Nombre del club
                      <input
                        type="text"
                        value={rankingFiltroNombreClub}
                        onChange={(e) => setRankingFiltroNombreClub(e.target.value)}
                        placeholder="Buscar sede"
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '15px',
                          color: '#334155',
                          background: '#fff',
                        }}
                      />
                    </label>
                  </div>

                  {sedesRanking.length === 0 ? (
                    <p style={{ color: '#94a3b8', padding: '10px 0', margin: 0 }}>Sin datos para estos filtros.</p>
                  ) : (
                    <div
                      style={{
                        background: 'white',
                        borderRadius: '10px',
                        border: '1px solid #e5e7eb',
                        overflow: 'auto',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>
                              Sede
                            </th>
                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>
                              País
                            </th>
                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>
                              Ciudad
                            </th>
                            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>
                              {sortHeaderBtn('reservas', 'Reservas')}
                            </th>
                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>
                              {sortHeaderBtn('ingresos', 'Ingresos')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sedesRanking.map((g) => {
                            const sel = rankingDetalleSedeKey === g.sede;
                            return (
                              <tr
                                key={g.sede}
                                onClick={() =>
                                  setRankingDetalleSedeKey((k) => (k === g.sede ? null : g.sede))
                                }
                                style={{
                                  borderTop: '1px solid #f1f5f9',
                                  cursor: 'pointer',
                                  background: sel ? '#eef2ff' : undefined,
                                }}
                              >
                                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{g.sede}</td>
                                <td style={{ padding: '10px 12px', color: '#475569' }}>
                                  {(() => {
                                    const flag = sedeFlag({ pais: g.pais });
                                    return flag ? `${flag} ${g.pais}` : g.pais;
                                  })()}
                                </td>
                                <td style={{ padding: '10px 12px', color: '#475569' }}>{g.ciudad}</td>
                                <td
                                  style={{
                                    padding: '10px 12px',
                                    textAlign: 'right',
                                    color: '#0f172a',
                                    fontWeight: 700,
                                  }}
                                >
                                  {g.reservasCount}
                                </td>
                                <td
                                  style={{
                                    padding: '10px 12px',
                                    color: '#334155',
                                    fontWeight: 600,
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {fmtIngresosSuperAdmin(g.ingresos)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {rankingGrupoDetalle ? (
                    <div
                      style={{
                        background: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        padding: '12px',
                      }}
                    >
                      <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                        Detalle · {rankingGrupoDetalle.sede}
                      </div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {sortReservasFechaHoraDesc(rankingGrupoDetalle.rows).map((r) => (
                          <div
                            key={r.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '100px 130px 52px minmax(140px, 1fr) 120px 92px',
                              gap: '8px',
                              alignItems: 'start',
                              fontSize: '12px',
                              color: '#334155',
                              background: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '6px 8px',
                            }}
                          >
                            <span style={{ paddingTop: '2px' }}>{r.fecha || '—'}</span>
                            <span style={{ paddingTop: '2px' }}>{horaRango(r.hora, r.duracion)}</span>
                            <span style={{ textAlign: 'center', paddingTop: '2px' }}>{r.cancha ?? '—'}</span>
                            <div style={{ minWidth: 0 }}>
                              <AdminReservaJugadorContacto reserva={r} />
                            </div>
                            <span style={{ paddingTop: '2px' }}>
                              <EstadoBadge reserva={r} />
                            </span>
                            <span style={{ textAlign: 'right', fontWeight: 700, paddingTop: '2px' }}>
                              ${(Number(r.precio) || 0).toLocaleString('es-AR')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <div style={{ display: 'grid', gap: '16px', minWidth: 0, maxWidth: '100%' }}>
                {periodoReservasSuperRow}
                <label style={{ display: 'grid', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'rgba(255,255,255,0.92)' }}>
                  País
                  <select
                    value={superReservasFiltroPais}
                    onChange={(e) => setSuperReservasFiltroPais(e.target.value)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '15px',
                      color: '#334155',
                      background: '#fff',
                      maxWidth: '400px',
                    }}
                  >
                    <option value="">Todos los países</option>
                    {paisesOpts.map((p) => (
                      <option key={p} value={p}>
                        {etiquetaPaisFiltroMobile(p)}
                      </option>
                    ))}
                  </select>
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                    gap: '10px',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      background: 'white',
                      borderRadius: '10px',
                      padding: '14px',
                      border: '1px solid #e5e7eb',
                      minWidth: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>
                      Total reservas del período
                    </div>
                    <div
                      style={{
                        color: '#0f172a',
                        fontSize: '26px',
                        fontWeight: 900,
                        marginTop: '6px',
                      }}
                    >
                      {reservasResumenPais.length}
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'white',
                      borderRadius: '10px',
                      padding: '14px',
                      border: '1px solid #e5e7eb',
                      minWidth: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>
                      Total facturado (reservas)
                    </div>
                    <div
                      style={{
                        color: '#0f172a',
                        fontSize: '14px',
                        fontWeight: 800,
                        marginTop: '8px',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                      }}
                    >
                      {fmtIngresosSuperAdmin(ingresosResumenPais)}
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'white',
                      borderRadius: '10px',
                      padding: '14px',
                      border: '1px solid #e5e7eb',
                      minWidth: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>
                      Padbol Match (3% comisión)
                    </div>
                    <div
                      style={{
                        color: '#0f172a',
                        fontSize: '14px',
                        fontWeight: 800,
                        marginTop: '8px',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                      }}
                    >
                      {fmtIngresosSuperAdmin(comisionPmResumen)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReservasSuperSubVista('ranking');
                    setRankingDetalleSedeKey(null);
                  }}
                  style={{
                    padding: '14px 20px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '16px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  }}
                >
                  📊 Ver ranking de clubes
                </button>

                {reservasResumenPais.length === 0 ? (
                  <p style={{ color: '#94a3b8', padding: '4px 0', margin: 0 }}>
                    Sin reservas en este período para el filtro elegido.
                  </p>
                ) : null}
              </div>
            );
          }

          const isInPeriodoClub = (fechaISO) =>
            fechaDentroDePeriodoFinanzas(
              fechaISO,
              superAdminPeriodo,
              superAdminFechaDesde,
              superAdminFechaHasta,
              finanzasAnclaISO
            );
          const sortedRows = sortReservasFechaHoraDesc(
            reservas.filter(
              (r) =>
                reservaPasaFiltroEstadoPill(r, filtroPillReservas) &&
                isInPeriodoClub(String(r?.fecha || '').trim())
            )
          );

          const BTN = (extra) => ({
            padding: '4px 10px', border: 'none', borderRadius: '3px',
            cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', color: 'white', ...extra,
          });

          const mostrarResumenClubNacional = esAdminClub || esAdminNacional;
          const periodoNavClubReservas = (
            <div style={{ display: 'grid', gap: '8px', marginBottom: mostrarResumenClubNacional ? '14px' : 0 }}>
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
                  { id: 'semana', label: 'Esta semana' },
                  { id: 'mes', label: 'Este mes' },
                  { id: 'anio', label: 'Este año' },
                  { id: 'rango', label: 'Rango' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSuperAdminPeriodo(opt.id);
                      if (opt.id !== 'rango') {
                        setFinanzasAnclaISO(new Date().toISOString().slice(0, 10));
                      }
                    }}
                    style={adminFilterPillButtonStyle(superAdminPeriodo === opt.id)}
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
              ) : (
                <SuperAdminFinanzasPeriodoNav
                  periodo={superAdminPeriodo}
                  anclaISO={finanzasAnclaISO}
                  onShift={shiftFinanzasPeriodo}
                />
              )}
            </div>
          );

          const totalFactResClub = sortedRows.reduce((acc, r) => acc + (Number(r?.precio) || 0), 0);
          const monResClub = bucketMonedaAdmin(
            (cifrasFinanzasResumen && cifrasFinanzasResumen.moneda) ||
              (sedeId != null && sedeId !== '' ? sedesMap[String(sedeId)]?.moneda : null) ||
              'ARS'
          );
          const comisClubPm = Math.round(totalFactResClub * 0.03 * 100) / 100;
          const usarTarjetasReservasClub = vistaReservasAdminTarjetas && editandoId == null;

          const tarjetasClubReservas = mostrarResumenClubNacional ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                gap: '10px',
                marginBottom: '16px',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: '10px',
                  padding: '14px',
                  border: '1px solid #e5e7eb',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>
                  Total reservas del período
                </div>
                <div style={{ color: '#0f172a', fontSize: '26px', fontWeight: 900, marginTop: '6px' }}>
                  {sortedRows.length}
                </div>
              </div>
              <div
                style={{
                  background: 'white',
                  borderRadius: '10px',
                  padding: '14px',
                  border: '1px solid #e5e7eb',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>
                  Total facturado (reservas)
                </div>
                <div style={{ color: '#0f172a', fontSize: '16px', fontWeight: 800, marginTop: '8px' }}>
                  {monResClub}{' '}
                  {totalFactResClub.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div
                style={{
                  background: 'white',
                  borderRadius: '10px',
                  padding: '14px',
                  border: '1px solid #e5e7eb',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>
                  Padbol Match (3% comisión)
                </div>
                <div style={{ color: '#0f172a', fontSize: '16px', fontWeight: 800, marginTop: '8px' }}>
                  {monResClub}{' '}
                  {comisClubPm.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          ) : null;

          if (sortedRows.length === 0) {
            return (
              <>
                {mostrarResumenClubNacional ? periodoNavClubReservas : null}
                {tarjetasClubReservas}
                <p style={{ color: '#aaa', padding: '10px 0' }}>Sin reservas en este período</p>
              </>
            );
          }

          const accionesReservaRow = (r) => (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {String(r.estado || '').toLowerCase() === 'pendiente_pago_manual' && (esAdminClub || isSuperAdmin) ? (
                <button type="button" onClick={() => confirmarPagoManualReserva(r.id)} style={BTN({ background: '#f59e0b' })}>
                  Confirmar pago
                </button>
              ) : null}
              <button type="button" onClick={() => iniciarEdicion(r)} style={BTN({ background: '#667eea' })}>
                ✏️ Editar
              </button>
              <button type="button" onClick={() => setCancelReservaModalId(r.id)} style={BTN({ background: '#d32f2f' })}>
                🗑️
              </button>
            </div>
          );

          return (
            <>
              {mostrarResumenClubNacional ? periodoNavClubReservas : null}
              {tarjetasClubReservas}
              {usarTarjetasReservasClub ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {sortedRows.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        background: '#fff',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#475569' }}>
                        <div>
                          <span style={{ color: '#64748b', fontWeight: 700 }}>Fecha</span> · {formatFecha(r.fecha) || '—'}
                        </div>
                        <div>
                          <span style={{ color: '#64748b', fontWeight: 700 }}>Horario</span> · {horaRango(r.hora, r.duracion)}
                        </div>
                        <div>
                          <span style={{ color: '#64748b', fontWeight: 700 }}>Cancha</span> · {r.cancha ?? '—'}
                        </div>
                        {esAdminNacional ? (
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>Sede</span> · {String(r.sede || '').trim() || '—'}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <AdminReservaJugadorContacto reserva={r} />
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                        <EstadoBadge reserva={r} />
                        <span style={{ marginLeft: 'auto', fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>
                          ${(r.precio || 30000).toLocaleString('es-AR')}
                        </span>
                      </div>
                      <div style={{ marginTop: '10px' }}>{accionesReservaRow(r)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="reservas-table-wrap">
                  <table
                    className="reservas-table"
                    style={{ tableLayout: 'fixed', width: '100%', minWidth: esAdminNacional ? '920px' : '780px', marginTop: 0 }}
                  >
                    <thead>
                      <tr>
                        <th style={{ padding: '10px 8px' }}>Fecha</th>
                        <th style={{ padding: '10px 8px' }}>Horario</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Cancha</th>
                        {esAdminNacional ? <th style={{ padding: '10px 8px' }}>Sede</th> : null}
                        <th style={{ padding: '10px 8px' }}>Jugador</th>
                        <th style={{ padding: '10px 8px' }}>Estado</th>
                        <th style={{ padding: '10px 8px' }}>Monto</th>
                        <th style={{ padding: '10px 8px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((r) =>
                        editandoId === r.id ? (
                          <tr key={r.id}>
                            <td style={{ padding: '6px 8px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{formatFecha(editFormData.fecha) || '—'}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                <input
                                  type="time"
                                  value={editFormData.hora || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, hora: e.target.value })}
                                  style={{ padding: '4px', flex: 1, minWidth: 0 }}
                                />
                                <input
                                  type="number"
                                  placeholder="min"
                                  value={editFormData.duracion || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, duracion: e.target.value })}
                                  style={{ padding: '4px', width: '46px' }}
                                  title="Duración en minutos"
                                />
                              </div>
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                value={editFormData.cancha || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, cancha: parseInt(e.target.value, 10) })}
                                style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }}
                              />
                            </td>
                            {esAdminNacional ? (
                              <td style={{ padding: '6px 8px' }}>
                                <input
                                  type="text"
                                  value={editFormData.sede || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, sede: e.target.value })}
                                  style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }}
                                />
                              </td>
                            ) : null}
                            <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                              <input
                                type="text"
                                value={editFormData.nombre || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, nombre: e.target.value })}
                                style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box', marginBottom: '4px' }}
                              />
                              <input
                                type="email"
                                value={editFormData.email || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box', fontSize: '11px' }}
                                placeholder="Email"
                              />
                              {(() => {
                                const w = adminReservaJugadorWhatsappWaMeUrl(String(editFormData.jugador_whatsapp_perfil || '').trim());
                                const label = String(editFormData.jugador_whatsapp_perfil || '').trim();
                                return w && label ? (
                                  <div style={{ marginTop: '6px', fontSize: '11px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#475569', wordBreak: 'break-word' }}>{label}</span>
                                    <a
                                      href={w}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: 'inline-flex',
                                        padding: '3px 7px',
                                        borderRadius: '5px',
                                        background: '#15803d',
                                        color: '#fff',
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                        fontSize: '10px',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      📱 WhatsApp
                                    </a>
                                  </div>
                                ) : null;
                              })()}
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <select
                                value={editFormData.estado || 'reservada'}
                                onChange={(e) => setEditFormData({ ...editFormData, estado: e.target.value })}
                                style={{ padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', width: '100%' }}
                              >
                                <option value="reservada">📋 Reservada</option>
                                <option value="pendiente_pago_manual">🟡 Pendiente pago manual</option>
                                <option value="confirmada">🟢 Confirmada</option>
                                <option value="completada">✅ Completada</option>
                                <option value="cancelada">❌ Cancelada</option>
                              </select>
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <input
                                type="number"
                                value={editFormData.precio || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, precio: parseInt(e.target.value, 10) })}
                                style={{ width: '100%', padding: '4px 6px', boxSizing: 'border-box' }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button type="button" onClick={() => guardarEdicion(r.id)} style={BTN({ background: '#4caf50' })}>
                                  ✅ Guardar
                                </button>
                                <button type="button" onClick={cancelarEdicion} style={BTN({ background: '#999' })}>
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={r.id}>
                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{formatFecha(r.fecha) || '—'}</td>
                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{horaRango(r.hora, r.duracion)}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>{r.cancha ?? '—'}</td>
                            {esAdminNacional ? (
                              <td style={{ padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sede}</td>
                            ) : null}
                            <td style={{ padding: '6px 8px', verticalAlign: 'top', overflow: 'hidden' }}>
                              <AdminReservaJugadorContacto reserva={r} />
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <EstadoBadge reserva={r} />
                            </td>
                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>${(r.precio || 30000).toLocaleString('es-AR')}</td>
                            <td style={{ padding: '6px 8px' }}>{accionesReservaRow(r)}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        })()}
        </div>
      </>}

      {activeTab === 'config' && puedeVerConfig && <div className="section">
        <h2 style={{ marginBottom: '10px', paddingBottom: '10px' }}>⚙️ Configuración de Puntos</h2>
        {/* Niveles de torneo + tipos custom unificados — título pegado a la tabla (nota “Mi Sede” abajo) */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'rgba(255,255,255,0.9)', marginTop: 0, marginBottom: '10px', fontSize: '16px' }}>
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

        <div
          style={{
            marginBottom: '24px',
            padding: '14px 16px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.12)',
            maxWidth: '640px',
          }}
        >
          <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.92)', lineHeight: 1.5 }}>
            <strong>Datos de la sede:</strong> si tienes la pestaña <strong>«Mi Sede»</strong>, usa el botón{' '}
            <strong>«Editar sede»</strong> para nombre, ubicación, contacto, precios y método de pago. Los cambios
            se guardan vía API y se reflejan en el perfil público. En la misma pestaña, la sección{' '}
            <strong>«Mis Canchas»</strong> permite dar de alta canchas, activarlas o desactivarlas; las inactivas no
            se ofrecen en el flujo de reservas público.
          </p>
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

      {activeTab === 'planes' && puedeVerConfig && (
        <div className="section">
          <h2 style={{ marginBottom: '10px', paddingBottom: '10px' }}>💳 Planes y Precios</h2>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
            Precio mensual en USD según la cantidad de canchas del club. Solo super admin puede editar.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                maxWidth: '640px',
                borderCollapse: 'collapse',
                background: 'white',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <thead>
                <tr style={{ background: '#312e81', color: '#fff' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Nombre</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Canchas</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>Precio USD/mes</th>
                  <th style={{ padding: '10px 16px', width: '96px' }} />
                </tr>
              </thead>
              <tbody>
                {planPricingLoading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>
                      Cargando…
                    </td>
                  </tr>
                ) : planPricingRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>
                      No hay planes. Ejecuta el SQL <code style={{ fontSize: '12px' }}>plan_pricing.sql</code> en Supabase.
                    </td>
                  </tr>
                ) : (
                  planPricingRows.map((p, idx) => {
                    const maxV = p.canchas_max;
                    const rango =
                      maxV == null || maxV === ''
                        ? `${p.canchas_min}+`
                        : Number(p.canchas_min) === Number(maxV)
                          ? `${p.canchas_min}`
                          : `${p.canchas_min}–${maxV}`;
                    const isEditing = Number(planPricingEditId) === Number(p.id);
                    const precioNum = Number(p.precio_usd);
                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: idx === planPricingRows.length - 1 ? 'none' : '1px solid #eee',
                          background: idx % 2 === 0 ? '#fafafa' : '#fff',
                        }}
                      >
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#1e293b' }}>{p.nombre}</td>
                        <td style={{ padding: '10px 16px', color: '#334155', fontSize: '14px' }}>{rango}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
                          {isEditing ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={planPricingEditValue}
                                onChange={(e) => setPlanPricingEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void guardarPrecioPlanPricing(p.id, planPricingEditValue);
                                }}
                                style={{
                                  width: '104px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '14px',
                                }}
                              />
                              <button
                                type="button"
                                disabled={planPricingSavingId === p.id}
                                onClick={() => void guardarPrecioPlanPricing(p.id, planPricingEditValue)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: planPricingSavingId === p.id ? '#94a3b8' : '#16a34a',
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  cursor: planPricingSavingId === p.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {planPricingSavingId === p.id ? '…' : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                disabled={planPricingSavingId === p.id}
                                onClick={() => {
                                  setPlanPricingEditId(null);
                                  setPlanPricingEditValue('');
                                }}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#f8fafc',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: planPricingSavingId === p.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontWeight: 700, color: '#312e81', fontSize: '15px' }}>
                              {Number.isFinite(precioNum) ? precioNum.toFixed(2) : '—'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          {!isEditing ? (
                            <button
                              type="button"
                              title="Editar precio"
                              aria-label="Editar precio"
                              onClick={() => {
                                setPlanPricingEditId(p.id);
                                setPlanPricingEditValue(
                                  p.precio_usd != null && p.precio_usd !== '' ? String(p.precio_usd) : '',
                                );
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #c4b5fd',
                                background: '#eef2ff',
                                cursor: 'pointer',
                                fontSize: '14px',
                              }}
                            >
                              ✏️
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roles' && puedeVerConfig && (
        <div className="section">
          <h2 style={{ marginBottom: '10px', paddingBottom: '10px' }}>👥 Roles</h2>
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '12px', fontSize: '16px' }}>
              Invitaciones a nuevos clubes
            </h3>
            <p style={{ color: 'rgba(226,232,240,0.95)', fontSize: '13px', margin: '0 0 10px', maxWidth: '720px', lineHeight: 1.45 }}>
              Enviá un enlace al futuro admin para que cargue su sede. Hasta que complete el formulario verás el estado{' '}
              <strong>Invitado - pendiente de alta</strong>.
            </p>
            <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setInviteClubForm({ email: '', nombre_club: '', pais: '' });
                  setInviteClubModalOpen(true);
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #4338ca)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✉️ Invitar nuevo club
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#312e81', color: '#fff' }}>
                    <th style={{ padding: '8px' }}>Email</th>
                    <th style={{ padding: '8px' }}>Club (sugerido)</th>
                    <th style={{ padding: '8px' }}>País</th>
                    <th style={{ padding: '8px' }}>Estado</th>
                    <th style={{ padding: '8px' }}>Vence</th>
                    <th style={{ padding: '8px' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {adminInvitacionesLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '10px', textAlign: 'center' }}>
                        Cargando…
                      </td>
                    </tr>
                  ) : adminInvitacionesRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>
                        No hay invitaciones pendientes
                      </td>
                    </tr>
                  ) : (
                    adminInvitacionesRows.map((inv) => {
                      const estadoLabel =
                        inv.estado === 'pendiente'
                          ? 'Invitado - pendiente de alta'
                          : inv.estado === 'completada'
                            ? 'Completada'
                            : inv.estado === 'expirada'
                              ? 'Expirada'
                              : inv.estado === 'cancelada'
                                ? 'Cancelada'
                                : inv.estado || '—';
                      let venceTxt = '—';
                      try {
                        if (inv.expires_at) {
                          venceTxt = new Date(inv.expires_at).toLocaleString('es-AR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          });
                        }
                      } catch {
                        venceTxt = '—';
                      }
                      return (
                        <tr key={inv.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px', fontSize: '12px' }}>{inv.email}</td>
                          <td style={{ padding: '8px' }}>{inv.nombre_club || '—'}</td>
                          <td style={{ padding: '8px', fontSize: '12px' }}>{inv.pais || '—'}</td>
                          <td style={{ padding: '8px', fontSize: '12px', fontWeight: 600 }}>{estadoLabel}</td>
                          <td style={{ padding: '8px', fontSize: '12px' }}>{venceTxt}</td>
                          <td style={{ padding: '8px' }}>
                            {inv.estado === 'pendiente' ? (
                              <button
                                type="button"
                                onClick={() => void reenviarInvitacionClub(inv.id)}
                                style={{
                                  padding: '4px 9px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  background: '#4f46e5',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                }}
                              >
                                Reenviar email
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '12px', fontSize: '16px' }}>
              Gestión de Administradores
            </h3>
            <div style={{ marginBottom: '10px' }}>
              <button
                type="button"
                onClick={abrirModalAsignarRol}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #22c55e, #15803d)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Asignar rol
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#312e81', color: '#fff' }}>
                    <th style={{ padding: '8px' }}>Nombre</th>
                    <th style={{ padding: '8px' }}>Email</th>
                    <th style={{ padding: '8px' }}>Rol</th>
                    <th style={{ padding: '8px' }}>Alcance</th>
                    <th style={{ padding: '8px' }}>Asignación</th>
                    <th style={{ padding: '8px' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {adminRolesLoading ? (
                    <tr><td colSpan={6} style={{ padding: '10px', textAlign: 'center' }}>Cargando…</td></tr>
                  ) : adminRolesRows.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>Sin administradores registrados</td></tr>
                  ) : (
                    adminRolesRows.map((row) => (
                      <tr key={row.email} style={{ borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px' }}>{row.nombre || '—'}</td>
                        <td style={{ padding: '8px', fontSize: '12px' }}>{row.email}</td>
                        <td style={{ padding: '8px' }}>{row.role || '—'}</td>
                        <td style={{ padding: '8px' }}>{row.alcance || '—'}</td>
                        <td style={{ padding: '8px', fontSize: '12px' }}>
                          {row.alcance === 'sede' ? row.sede_nombre || `Sede ${row.sede_id || '—'}` : null}
                          {row.alcance === 'ciudad' ? row.ciudad || '—' : null}
                          {row.alcance === 'provincia' ? row.provincia || '—' : null}
                          {row.alcance === 'pais' ? row.pais || '—' : null}
                          {row.alcance === 'global' ? 'Global' : null}
                        </td>
                        <td style={{ padding: '8px' }}>
                          {row.role === 'super_admin' ? (
                            <span style={{ color: '#64748b', fontSize: '12px' }}>—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void revocarRolAdmin(row.email)}
                              style={{ padding: '4px 9px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', cursor: 'pointer' }}
                            >
                              Revocar rol
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Solicitudes (super admin): altas nacionales + interés web, unificado ── */}
      {activeTab === 'solicitudes' && isSuperAdmin && (
        <div className="section" style={{ maxWidth: '980px', margin: '0 auto' }}>
          <h2 style={{ color: '#fff', textAlign: 'center', marginBottom: '8px' }}>📝 Solicitudes</h2>
          <p style={{ color: '#e2e8f0', textAlign: 'center', marginBottom: '16px', fontSize: '14px' }}>
            Altas enviadas por admin nacional e interés desde la web. Filtra por estado; las aprobadas y rechazadas siguen
            visibles.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              justifyContent: 'center',
              marginBottom: '18px',
            }}
          >
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'pendiente', label: 'Pendiente' },
              { id: 'aprobada', label: 'Aprobada' },
              { id: 'rechazada', label: 'Rechazada' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSolicitudesFiltroEstado(opt.id)}
                style={adminFilterPillButtonStyle(solicitudesFiltroEstado === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {sedesPendientesLoading || solicitudesLicenciaLoading ? (
            <p style={{ color: '#e2e8f0', textAlign: 'center' }}>Cargando…</p>
          ) : solicitudesUnificadas.length === 0 ? (
            <p style={{ color: '#e2e8f0', textAlign: 'center' }}>No hay solicitudes con este filtro.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {solicitudesUnificadas.map((row) => {
                const pendiente = row.estado === 'pendiente';
                const wa = waDigitsForUrl(row.whatsapp);
                const estadoLabel =
                  row.estado === 'aprobada' ? 'Aprobada' : row.estado === 'rechazada' ? 'Rechazada' : 'Pendiente';
                const estadoChipBg =
                  row.estado === 'aprobada' ? '#dcfce7' : row.estado === 'rechazada' ? '#fee2e2' : '#fef9c3';
                const estadoChipColor =
                  row.estado === 'aprobada' ? '#166534' : row.estado === 'rechazada' ? '#991b1b' : '#854d0e';
                const origenLabel = row.kind === 'sede_nacional' ? 'Alta nacional' : 'Interés web';
                const sp = row.kind === 'sede_nacional' ? row.rawNacional : null;
                return (
                  <div
                    key={row.idKey}
                    style={{
                      background: '#fff',
                      borderRadius: '14px',
                      padding: '16px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      color: '#1e293b',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '18px', flex: '1 1 200px' }}>{row.clubNombre}</span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: '999px',
                          background: estadoChipBg,
                          color: estadoChipColor,
                        }}
                      >
                        {estadoLabel}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '999px',
                          background: '#e0e7ff',
                          color: '#3730a3',
                        }}
                      >
                        {origenLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: 1.65, color: '#475569' }}>
                      <div>
                        <strong>País:</strong> {row.pais} · <strong>Ciudad:</strong> {row.ciudad}
                      </div>
                      <div>
                        <strong>Responsable:</strong> {row.responsableNombre}
                      </div>
                      <div>
                        <strong>Email:</strong>{' '}
                        {row.email && row.email !== '—' ? (
                          <a href={`mailto:${encodeURIComponent(row.email)}`} style={{ color: '#4f46e5' }}>
                            {row.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </div>
                      <div>
                        <strong>WhatsApp:</strong> {row.whatsapp || '—'}
                      </div>
                      {row.kind === 'licencia_web' ? (
                        <div>
                          <strong>Tipo interés:</strong> {etiquetaTipoInteresSolicitudLicencia(row.tipoInteres)} ·{' '}
                          <strong>Canchas:</strong>{' '}
                          {row.cantidadCanchas ?? '—'}
                        </div>
                      ) : null}
                      {row.kind === 'licencia_web' && row.mensaje ? (
                        <div>
                          <strong>Mensaje:</strong> {row.mensaje}
                        </div>
                      ) : null}
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                        #{row.id} · {row.created_at ? new Date(row.created_at).toLocaleString('es-AR') : '—'}
                      </div>
                    </div>
                    {row.kind === 'sede_nacional' && sp ? (
                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setSolicitudDetalleExpandidoKey((k) => (k === row.idKey ? null : row.idKey))
                          }
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            cursor: 'pointer',
                          }}
                        >
                          {solicitudDetalleExpandidoKey === row.idKey ? 'Ocultar detalle' : 'Más datos (alta nacional)'}
                        </button>
                        {solicitudDetalleExpandidoKey === row.idKey ? (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '12px',
                              background: '#f8fafc',
                              borderRadius: '10px',
                              fontSize: '13px',
                              lineHeight: 1.6,
                              color: '#475569',
                            }}
                          >
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
                            <div>
                              <strong>Licenciatario país:</strong> {sp.licenciatario_pais || '—'}
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                              Enviada por {sp.created_by || '—'}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {pendiente && row.kind === 'sede_nacional' ? (
                        <button
                          type="button"
                          onClick={() => void aprobarSedePendiente(row.id)}
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
                      ) : null}
                      {pendiente && row.kind === 'licencia_web' ? (
                        <button
                          type="button"
                          onClick={() => abrirModalAprobarLicenciaWeb(row.rawLicencia)}
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
                          ✅ Aprobar (crear sede)
                        </button>
                      ) : null}
                      {pendiente ? (
                        <button
                          type="button"
                          onClick={() =>
                            row.kind === 'sede_nacional'
                              ? void rechazarSedePendiente(row.id)
                              : void rechazarSolicitudLicencia(row.id)
                          }
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
                      ) : null}
                      {wa ? (
                        <a
                          href={`https://wa.me/${wa}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: '10px 16px',
                            borderRadius: '10px',
                            background: '#0f766e',
                            color: '#fff',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'inline-block',
                          }}
                        >
                          💬 Contactar
                        </a>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sin número para WhatsApp</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Mi Sede tab ── */}
      {activeTab === 'mi_sede' && puedeVerMiSede && <div className="section admin-mi-sede-form">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '8px',
          }}
        >
          <h2 style={{ margin: 0 }}>🏟️ Mi Sede</h2>
          {!miSedeLoading && miSede ? (
            <button
              type="button"
              onClick={abrirModalEditarSede}
              style={{
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(14,165,233,0.35)',
              }}
            >
              ✏️ Editar sede
            </button>
          ) : null}
        </div>

        {miSedeLoading ? (
          <p style={{ color: '#999' }}>Cargando datos de la sede...</p>
        ) : !miSede ? (
          <p style={{ color: '#f87171' }}>No se encontró información de la sede.</p>
        ) : (<>
          {editarSedeModalOpen ? (
            <div
              role="presentation"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10050,
                background: 'rgba(15,23,42,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                boxSizing: 'border-box',
              }}
              onClick={() => {
                if (!miSedeSaving) setEditarSedeModalOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="editar-sede-modal-titulo"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  maxWidth: '540px',
                  width: '100%',
                  maxHeight: 'min(90vh, 760px)',
                  overflowY: 'auto',
                  padding: '22px 20px',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
                  boxSizing: 'border-box',
                }}
              >
                <h3 id="editar-sede-modal-titulo" style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>
                  Editar sede
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
                  Datos del perfil público. Al guardar se actualizan en la base y se ven al entrar de nuevo a{' '}
                  <strong>/sede/…</strong>.
                </p>
                {[
                  { label: 'Nombre del club', k: 'nombre' },
                  { label: 'Dirección', k: 'direccion' },
                  { label: 'Ciudad', k: 'ciudad' },
                  { label: 'Provincia / Estado', k: 'provincia' },
                  { label: 'País', k: 'pais' },
                  { label: 'Horario apertura', k: 'horario_apertura', ph: 'Ej: 08:00' },
                  { label: 'Horario cierre', k: 'horario_cierre', ph: 'Ej: 23:00' },
                  { label: 'WhatsApp del club', k: 'telefono', ph: 'Sin 0 ni 15' },
                  { label: 'Email de contacto', k: 'email_contacto' },
                  { label: 'Latitud', k: 'latitud', ph: '-34.6037' },
                  { label: 'Longitud', k: 'longitud', ph: '-58.3816' },
                ].map(({ label, k, ph }) => (
                  <div key={k} style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      {label}
                    </label>
                    <input
                      type="text"
                      value={editarSedeDraft[k] || ''}
                      placeholder={ph || ''}
                      onChange={(e) => setEditarSedeDraft((p) => ({ ...p, [k]: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Moneda
                  </label>
                  <select
                    value={editarSedeDraft.moneda || 'ARS'}
                    onChange={(e) => setEditarSedeDraft((p) => ({ ...p, moneda: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="BRL">BRL</option>
                    <option value="CLP">CLP</option>
                    <option value="UYU">UYU</option>
                  </select>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Precio por turno (90 min)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      editarSedeDraft.precio_turno !== '' && editarSedeDraft.precio_turno != null
                        ? Number(String(editarSedeDraft.precio_turno).replace(/\./g, '')).toLocaleString('es-AR')
                        : ''
                    }
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                      setEditarSedeDraft((p) => ({ ...p, precio_turno: digits }));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Descripción del club
                  </label>
                  <textarea
                    rows={4}
                    maxLength={300}
                    value={editarSedeDraft.descripcion || ''}
                    onChange={(e) => setEditarSedeDraft((p) => ({ ...p, descripcion: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Historia / Sobre el club
                  </label>
                  <textarea
                    rows={5}
                    maxLength={500}
                    value={editarSedeDraft.historia || ''}
                    onChange={(e) =>
                      setEditarSedeDraft((p) => ({ ...p, historia: e.target.value.slice(0, 500) }))
                    }
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Método de pago
                  </label>
                  <select
                    value={editarSedeDraft.metodo_pago || 'mercadopago'}
                    onChange={(e) => setEditarSedeDraft((p) => ({ ...p, metodo_pago: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="mercadopago">Mercado Pago</option>
                    <option value="stripe">Stripe</option>
                    <option value="manual">Pago manual</option>
                  </select>
                </div>
                {String(editarSedeDraft.metodo_pago || '') === 'mercadopago' ? (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Access token MP (opcional)
                    </label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={editarSedeDraft.mp_access_token || ''}
                      onChange={(e) => setEditarSedeDraft((p) => ({ ...p, mp_access_token: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ) : null}
                {String(editarSedeDraft.metodo_pago || '') === 'stripe' ? (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Stripe Connect account ID
                    </label>
                    <input
                      type="text"
                      value={editarSedeDraft.stripe_account_id || ''}
                      onChange={(e) => setEditarSedeDraft((p) => ({ ...p, stripe_account_id: e.target.value }))}
                      placeholder="acct_…"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ) : null}
                {String(editarSedeDraft.metodo_pago || '') === 'manual' ? (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Instrucciones de pago manual
                    </label>
                    <textarea
                      rows={3}
                      value={editarSedeDraft.pago_manual_instrucciones || ''}
                      onChange={(e) =>
                        setEditarSedeDraft((p) => ({ ...p, pago_manual_instrucciones: e.target.value }))
                      }
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                ) : null}
                {editarSedeModalMsg ? (
                  <p style={{ color: '#b91c1c', fontSize: '13px', fontWeight: 600, margin: '0 0 12px' }}>{editarSedeModalMsg}</p>
                ) : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => !miSedeSaving && setEditarSedeModalOpen(false)}
                    disabled={miSedeSaving}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontWeight: 700,
                      cursor: miSedeSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void guardarEditarSedeModal()}
                    disabled={miSedeSaving}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      background: miSedeSaving ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: miSedeSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {miSedeSaving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {canchaModalOpen ? (
            <div
              role="presentation"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10020,
                background: 'rgba(15, 23, 42, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                boxSizing: 'border-box',
              }}
              onClick={() => !canchaApiBusy && setCanchaModalOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancha-modal-title"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: '420px',
                  background: '#fff',
                  borderRadius: '14px',
                  padding: '22px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                  boxSizing: 'border-box',
                }}
              >
                <h3 id="cancha-modal-title" style={{ margin: '0 0 16px', fontSize: '17px', color: '#0f172a' }}>
                  {canchaModalMode === 'add' ? 'Agregar cancha' : 'Editar cancha'}
                </h3>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Nombre
                </label>
                <input
                  type="text"
                  value={canchaModalDraft.nombre}
                  onChange={(e) => setCanchaModalDraft((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder='Ej: Cancha 1'
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    marginBottom: '14px',
                    boxSizing: 'border-box',
                  }}
                />
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Estado
                </label>
                <select
                  value={canchaModalDraft.estado === 'inactiva' ? 'inactiva' : 'activa'}
                  onChange={(e) => setCanchaModalDraft((p) => ({ ...p, estado: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    marginBottom: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="activa">Activa (visible en reservas)</option>
                  <option value="inactiva">Inactiva (no reservable)</option>
                </select>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Descripción (opcional)
                </label>
                <textarea
                  rows={3}
                  value={canchaModalDraft.descripcion}
                  onChange={(e) => setCanchaModalDraft((p) => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Notas internas o para el equipo…"
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical',
                    marginBottom: '12px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
                {canchaModalMsg ? (
                  <p style={{ color: '#b91c1c', fontSize: '13px', fontWeight: 600, margin: '0 0 12px' }}>{canchaModalMsg}</p>
                ) : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => !canchaApiBusy && setCanchaModalOpen(false)}
                    disabled={canchaApiBusy}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontWeight: 700,
                      cursor: canchaApiBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void guardarCanchaModal()}
                    disabled={canchaApiBusy}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      background: canchaApiBusy ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: canchaApiBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {canchaApiBusy ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="admin-mi-sede-layout">
            <aside className="admin-mi-sede-sidebar" aria-label="Secciones Mi Sede">
              {miSedeNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    miSedeNavActive === item.id
                      ? 'admin-mi-sede-nav-btn admin-mi-sede-nav-btn--active'
                      : 'admin-mi-sede-nav-btn'
                  }
                  onClick={() => scrollToMiSedeSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </aside>
            <div className="admin-mi-sede-main">
              <nav className="admin-mi-sede-nav-mobile" aria-label="Secciones Mi Sede">
                {miSedeNavItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      miSedeNavActive === item.id
                        ? 'admin-mi-sede-nav-pill admin-mi-sede-nav-pill--active'
                        : 'admin-mi-sede-nav-pill'
                    }
                    onClick={() => scrollToMiSedeSection(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

          <div id="admin-mi-sede-info">
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
              <p style={{ margin: '14px 0 0', fontSize: '12px', color: '#94a3b8' }}>Guarda los cambios con «Guardar cambios» en Información general.</p>
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
                { label: 'Provincia / Estado',     field: 'provincia' },
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
              <div className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: '#555', paddingTop: '8px' }}>
                  Historia del club
                </label>
                <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                  <textarea
                    rows={8}
                    maxLength={500}
                    value={miSedeForm.historia || ''}
                    placeholder="Contá la historia del club, servicios, valores… Se muestra en la sección «Sobre el club» del perfil público."
                    onChange={(e) =>
                      setMiSedeForm((p) => ({ ...p, historia: e.target.value.slice(0, 500) }))
                    }
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      padding: '7px 10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      color: '#333',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div
                    style={{
                      textAlign: 'right',
                      fontSize: '12px',
                      color: (miSedeForm.historia || '').length >= 480 ? '#dc2626' : '#9ca3af',
                      marginTop: '3px',
                    }}
                  >
                    {(miSedeForm.historia || '').length}/500
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#9ca3af', lineHeight: 1.45 }}>
                    Visible debajo de las fotos en <strong>/sede/…</strong>. La descripción corta de arriba sigue siendo la frase del hero.
                  </p>
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
          </div>

          {/* ── 2. Precios ── */}
          <div id="admin-mi-sede-horarios" style={{ marginBottom: '32px' }}>
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

          {/* ── 3. Configuración de pagos (MP / Stripe por sede) ── */}
          {(esAdminClub || isSuperAdmin) && (
            <div id="admin-mi-sede-pagos" style={{ marginBottom: '32px' }}>
              <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>💳 Configuración de pagos</h3>
              <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '520px' }}>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                  Cada sede cobra con su propia cuenta. Mercado Pago usa el Access Token de tu aplicación MP; Stripe usa el
                  Account ID (acct_…) para cuentas internacionales.
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Mercado Pago
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                      {Boolean(String(miSede?.mp_access_token || '').trim()) ? 'Conectado ✅' : 'Sin configurar ⚠️'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPagosMpPanelAbierto((v) => !v)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    {pagosMpPanelAbierto ? 'Ocultar' : 'Conectar Mercado Pago'}
                  </button>
                </div>
                {pagosMpPanelAbierto ? (
                  <div style={{ marginBottom: '18px', paddingLeft: '4px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>
                      Access Token de Mercado Pago
                    </label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={miSedeForm.mp_access_token || ''}
                      placeholder={Boolean(String(miSede?.mp_access_token || '').trim()) ? 'Token actual guardado — ingresa uno nuevo para reemplazar' : 'APP_USR-...'}
                      onChange={(e) => setMiSedeForm((p) => ({ ...p, mp_access_token: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#333',
                        boxSizing: 'border-box',
                        fontFamily: 'monospace',
                        marginBottom: '10px',
                      }}
                    />
                    <button
                      type="button"
                      disabled={pagosParcialSaving || !String(miSedeForm.mp_access_token || '').trim()}
                      onClick={() =>
                        void guardarSedeCamposPagosParcial({
                          mp_access_token: String(miSedeForm.mp_access_token || '').trim(),
                        }).then((ok) => {
                          if (ok) setPagosMpPanelAbierto(false);
                        })
                      }
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        background:
                          pagosParcialSaving || !String(miSedeForm.mp_access_token || '').trim() ? '#94a3b8' : '#16a34a',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: pagosParcialSaving || !String(miSedeForm.mp_access_token || '').trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {pagosParcialSaving ? 'Guardando…' : 'Guardar token Mercado Pago'}
                    </button>
                  </div>
                ) : null}

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Stripe
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                      {String(miSede?.stripe_account_id || '')
                        .trim()
                        .startsWith('acct_')
                        ? 'Conectado ✅'
                        : 'Sin configurar ⚠️'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPagosStripePanelAbierto((v) => !v)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    {pagosStripePanelAbierto ? 'Ocultar' : 'Conectar Stripe'}
                  </button>
                </div>
                {pagosStripePanelAbierto ? (
                  <div style={{ marginBottom: '18px', paddingLeft: '4px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>
                      Stripe Account ID
                    </label>
                    <input
                      value={miSedeForm.stripe_account_id || ''}
                      placeholder="acct_..."
                      onChange={(e) => setMiSedeForm((p) => ({ ...p, stripe_account_id: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#333',
                        boxSizing: 'border-box',
                        marginBottom: '10px',
                        fontFamily: 'monospace',
                      }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                      <button
                        type="button"
                        disabled={pagosParcialSaving || !String(miSedeForm.stripe_account_id || '').trim()}
                        onClick={() =>
                          void guardarSedeCamposPagosParcial({
                            stripe_account_id: String(miSedeForm.stripe_account_id || '').trim(),
                          }).then((ok) => {
                            if (ok) setPagosStripePanelAbierto(false);
                          })
                        }
                        style={{
                          padding: '8px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          background:
                            pagosParcialSaving || !String(miSedeForm.stripe_account_id || '').trim()
                              ? '#94a3b8'
                              : '#16a34a',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor:
                            pagosParcialSaving || !String(miSedeForm.stripe_account_id || '').trim()
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        {pagosParcialSaving ? 'Guardando…' : 'Guardar Stripe Account ID'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void iniciarStripeOnboarding()}
                        disabled={stripeOnboardingLoading}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: stripeOnboardingLoading ? '#94a3b8' : 'linear-gradient(135deg, #635bff, #0a2540)',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: stripeOnboardingLoading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {stripeOnboardingLoading ? 'Abriendo Stripe…' : 'Onboarding Stripe (alternativa)'}
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                      Podés pegar manualmente el <code style={{ fontSize: '11px' }}>acct_…</code> o usar el onboarding; al volver, comprobá que el ID quedó guardado.
                    </p>
                  </div>
                ) : null}

                <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '18px 0' }} />
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>
                  Método de cobro para reservas y torneos
                </label>
                <select
                  value={miSedeForm.metodo_pago || 'mercadopago'}
                  onChange={(e) => setMiSedeForm((p) => ({ ...p, metodo_pago: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#333',
                    boxSizing: 'border-box',
                    marginBottom: '12px',
                  }}
                >
                  <option value="mercadopago">Mercado Pago</option>
                  <option value="stripe">Stripe</option>
                  <option value="manual">Manual (transferencia o efectivo)</option>
                </select>
                {String(miSedeForm.metodo_pago || '') === 'manual' ? (
                  <>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px' }}>
                      Instrucciones para el jugador
                    </label>
                    <textarea
                      rows={4}
                      value={miSedeForm.pago_manual_instrucciones || ''}
                      onChange={(e) => setMiSedeForm((p) => ({ ...p, pago_manual_instrucciones: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#333',
                        boxSizing: 'border-box',
                        marginBottom: '14px',
                        resize: 'vertical',
                      }}
                    />
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    void guardarSedeCamposPagosParcial({
                      metodo_pago: miSedeForm.metodo_pago || 'mercadopago',
                      pago_manual_instrucciones: String(miSedeForm.pago_manual_instrucciones || '').trim() || null,
                    })
                  }
                  disabled={pagosParcialSaving}
                  style={{
                    padding: '8px 20px',
                    background: pagosParcialSaving ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #3730a3)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: pagosParcialSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px',
                  }}
                >
                  {pagosParcialSaving ? '⏳ Guardando...' : '💾 Guardar método e instrucciones'}
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

          {/* ── 5. Mis Canchas ── */}
          <div id="admin-mi-sede-canchas" style={{ marginBottom: '32px' }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '16px' }}>⚽ Mis Canchas</h3>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '640px' }}>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                Las canchas <strong>inactivas</strong> no aparecen como opción en las reservas públicas. El número en
                la primera columna es el que usa el sistema de reservas para esa cancha.
              </p>
              {canchas.length === 0 ? (
                <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '16px' }}>No hay canchas registradas para esta sede.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#555', width: '48px' }}>#</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#555' }}>Nombre</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#555' }}>Nota</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#555', width: '100px' }}>Estado</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#555' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {canchas.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 10px', fontSize: '13px', color: '#64748b', fontWeight: 700 }}>{c.orden ?? '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: '14px', color: '#333' }}>{c.nombre}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b', maxWidth: '180px' }}>
                          {c.descripcion ? (
                            <span title={c.descripcion}>{c.descripcion.length > 48 ? `${c.descripcion.slice(0, 48)}…` : c.descripcion}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: c.estado === 'activa' ? '#dcfce7' : '#fee2e2',
                              color: c.estado === 'activa' ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {c.estado === 'activa' ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => abrirModalCanchaEditar(c)}
                            style={{
                              padding: '4px 10px',
                              marginRight: '6px',
                              background: '#e0e7ff',
                              color: '#3730a3',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCanchaEstado(c)}
                            style={{
                              padding: '4px 10px',
                              background: c.estado === 'activa' ? '#fee2e2' : '#dcfce7',
                              color: c.estado === 'activa' ? '#dc2626' : '#16a34a',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            {c.estado === 'activa' ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button
                type="button"
                onClick={abrirModalCanchaNueva}
                style={{
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                + Agregar cancha
              </button>
            </div>
          </div>

            </div>
          </div>

        </>)}

        {/* ── 4. Fotos ── always visible when tab is active */}
        {!miSedeLoading && <div id="admin-mi-sede-contrato" style={{ marginBottom: '32px' }}>
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
              Marca hasta 4 fotos con ★ para el carrusel de la página pública (orden 1–4). Guarda con el botón inferior.
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
              Imágenes · máx. 2MB por archivo · hasta {MAX_FOTOS_SEDE} fotos. En iPhone, si varias a la vez no suben, usa «+ Agregar una foto».
            </p>
          </div>
        </div>}

      </div>}
      </div>
      </div>

      {licApruebaTipoModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Asignar tipo de interés"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 18960,
            background: 'rgba(15, 23, 42, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget && !licApruebaTipoSaving) setLicApruebaTipoModal(null);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              background: '#fff',
              borderRadius: 16,
              padding: '22px 20px',
              boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
              color: '#0f172a',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>Tipo de interés</h3>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
              El club no eligió el modelo en el formulario público. Asigná el tipo antes de crear la sede.
            </p>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: 8 }}>
              Modelo de licencia
            </label>
            <select
              value={licApruebaTipoModal.tipoInteresSeleccionado}
              onChange={(e) =>
                setLicApruebaTipoModal((p) => (p ? { ...p, tipoInteresSeleccionado: e.target.value } : p))
              }
              disabled={licApruebaTipoSaving}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 15,
                marginBottom: 18,
                boxSizing: 'border-box',
              }}
            >
              {TIPO_INTERES_APROBAR_SOLICITUD_LIC.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={licApruebaTipoSaving}
                onClick={() => setLicApruebaTipoModal(null)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontWeight: 700,
                  cursor: licApruebaTipoSaving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={licApruebaTipoSaving}
                onClick={() => void confirmarTipoYContinuarAprobarLicenciaWeb()}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: licApruebaTipoSaving ? '#94a3b8' : '#16a34a',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: licApruebaTipoSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {licApruebaTipoSaving ? 'Guardando…' : 'Continuar a crear sede'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adminRoleModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Asignar rol admin"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 18950,
            background: 'rgba(15, 23, 42, 0.72)',
            display: 'flex',
            alignItems: adminRoleAssignMobile ? 'flex-end' : 'center',
            justifyContent: 'center',
            padding: adminRoleAssignMobile ? 0 : '16px',
          }}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget && !adminRoleSaving) setAdminRoleModalOpen(false);
          }}
        >
          {adminRoleAssignMobile ? (
            <div
              style={{
                width: '100%',
                height: '85vh',
                maxHeight: '85vh',
                background: '#fff',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 -8px 32px rgba(15, 23, 42, 0.2)',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  padding: '16px 16px 8px',
                }}
              >
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>Asignar rol</h3>
                <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#64748b', lineHeight: 1.4 }}>
                  Email del usuario y alcance según el tipo de admin.
                </p>
                <div style={{ display: 'grid', gap: '14px' }}>
                  <label style={{ display: 'grid', gap: '6px', margin: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Email</span>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="correo@ejemplo.com"
                      value={adminRoleForm.email}
                      onChange={(e) => setAdminRoleForm((p) => ({ ...p, email: e.target.value }))}
                      style={{
                        minHeight: 48,
                        fontSize: 16,
                        padding: '0 14px',
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '6px', margin: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Nombre (opcional)</span>
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Nombre"
                      value={adminRoleForm.nombre}
                      onChange={(e) => setAdminRoleForm((p) => ({ ...p, nombre: e.target.value }))}
                      style={{
                        minHeight: 48,
                        fontSize: 16,
                        padding: '0 14px',
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>
                  <div>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Rol</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[
                        { value: 'admin_club', title: 'Admin club', hint: 'admin_club' },
                        { value: 'admin_nacional', title: 'Admin nacional', hint: 'admin_nacional' },
                      ].map((opt) => {
                        const sel = adminRoleForm.role === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setAdminRoleTipoMobile(opt.value)}
                            style={{
                              flex: 1,
                              minHeight: 52,
                              padding: '10px 12px',
                              borderRadius: 12,
                              border: sel ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                              background: sel ? 'linear-gradient(180deg, #eef2ff 0%, #e0e7ff 100%)' : '#f8fafc',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 2,
                            }}
                          >
                            <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{opt.title}</span>
                            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{opt.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {adminRoleForm.role === 'admin_club' ? (
                    <div>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Sede</span>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {sedesSuperAdminLista.map((s) => {
                          const flag = sedeFlag(s);
                          const sel = String(adminRoleForm.sede_id || '') === String(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setAdminRoleForm((p) => ({ ...p, sede_id: String(s.id) }))}
                              style={{
                                minHeight: 56,
                                padding: '12px 14px',
                                borderRadius: 12,
                                border: sel ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                                background: sel ? '#eef2ff' : '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                textAlign: 'left',
                                width: '100%',
                                boxSizing: 'border-box',
                              }}
                            >
                              <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>{flag || '🏢'}</span>
                              <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', flex: 1 }}>{s.nombre || `Sede ${s.id}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {adminRoleForm.role === 'admin_nacional' ? (
                    <div>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: 8 }}>País</span>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {PAISES_SEDE_OPTIONS.map((opt) => {
                          const sel = adminRoleForm.pais === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setAdminRoleForm((p) => ({ ...p, pais: opt.value }))}
                              style={{
                                minHeight: 56,
                                padding: '12px 14px',
                                borderRadius: 12,
                                border: sel ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                                background: sel ? '#eef2ff' : '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                textAlign: 'left',
                                width: '100%',
                                boxSizing: 'border-box',
                              }}
                            >
                              <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>{banderaRegionalAlInicio(opt.label) || '🇺🇳'}</span>
                              <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', flex: 1 }}>{paisTextoSinBanderaInicial(opt.label)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div
                style={{
                  flexShrink: 0,
                  padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: 12,
                  background: '#fff',
                }}
              >
                <button
                  type="button"
                  onClick={() => setAdminRoleModalOpen(false)}
                  disabled={adminRoleSaving}
                  style={{
                    flex: 1,
                    minHeight: 52,
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: 12,
                    border: '2px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    cursor: adminRoleSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void guardarRolAdmin()}
                  disabled={adminRoleSaving}
                  style={{
                    flex: 1,
                    minHeight: 52,
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: 12,
                    border: 'none',
                    background: adminRoleSaving ? '#86efac' : '#16a34a',
                    color: '#fff',
                    cursor: adminRoleSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {adminRoleSaving ? 'Guardando…' : 'Guardar rol'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: '540px', background: '#fff', borderRadius: '14px', padding: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '19px', color: '#0f172a' }}>Asignar rol</h3>
              <p style={{ margin: '6px 0 12px', fontSize: '13px', color: '#64748b' }}>Buscar usuario por email y definir alcance geográfico.</p>
              <div style={{ display: 'grid', gap: '10px' }}>
                <input type="email" placeholder="Email del usuario" value={adminRoleForm.email} onChange={(e) => setAdminRoleForm((p) => ({ ...p, email: e.target.value }))} />
                <input type="text" placeholder="Nombre (opcional)" value={adminRoleForm.nombre} onChange={(e) => setAdminRoleForm((p) => ({ ...p, nombre: e.target.value }))} />
                <select value={adminRoleForm.role} onChange={(e) => setAdminRoleForm((p) => ({ ...p, role: e.target.value }))}>
                  <option value="admin_club">admin_club</option>
                  <option value="admin_nacional">admin_nacional</option>
                </select>
                <select value={adminRoleForm.alcance} onChange={(e) => setAdminRoleForm((p) => ({ ...p, alcance: e.target.value }))}>
                  <option value="sede">sede</option>
                  <option value="ciudad">ciudad</option>
                  <option value="provincia">provincia</option>
                  <option value="pais">pais</option>
                </select>
                {adminRoleForm.alcance === 'sede' ? (
                  <select value={adminRoleForm.sede_id} onChange={(e) => setAdminRoleForm((p) => ({ ...p, sede_id: e.target.value }))}>
                    <option value="">Seleccionar sede</option>
                    {Object.values(sedesMap || {}).map((s) => (
                      <option key={s.id} value={s.id}>{sedeFlag(s) ? `${sedeFlag(s)} ` : ''}{s.nombre}</option>
                    ))}
                  </select>
                ) : null}
                {adminRoleForm.alcance === 'ciudad' ? (
                  <input type="text" placeholder="Ciudad" value={adminRoleForm.ciudad} onChange={(e) => setAdminRoleForm((p) => ({ ...p, ciudad: e.target.value }))} />
                ) : null}
                {adminRoleForm.alcance === 'provincia' ? (
                  <input type="text" placeholder="Provincia / Estado" value={adminRoleForm.provincia} onChange={(e) => setAdminRoleForm((p) => ({ ...p, provincia: e.target.value }))} />
                ) : null}
                {adminRoleForm.alcance === 'pais' ? (
                  <select value={adminRoleForm.pais} onChange={(e) => setAdminRoleForm((p) => ({ ...p, pais: e.target.value }))}>
                    <option value="">Seleccionar país</option>
                    {PAISES_SEDE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : null}
              </div>
              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setAdminRoleModalOpen(false)} disabled={adminRoleSaving}>Cancelar</button>
                <button type="button" onClick={() => void guardarRolAdmin()} disabled={adminRoleSaving} style={{ padding: '8px 14px', border: 'none', borderRadius: '7px', background: '#16a34a', color: '#fff' }}>
                  {adminRoleSaving ? 'Guardando…' : 'Guardar rol'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {inviteClubModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invitar nuevo club"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 18940,
            background: 'rgba(15, 23, 42, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget && !inviteClubSaving) setInviteClubModalOpen(false);
          }}
        >
          <div style={{ width: '100%', maxWidth: '480px', background: '#fff', borderRadius: '14px', padding: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>✉️ Invitar nuevo club</h3>
            <p style={{ margin: '8px 0 14px', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
              Se enviará un email con un enlace para completar el alta de la sede (48 hs).
            </p>
            <div style={{ display: 'grid', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '6px', margin: 0, fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                Email del futuro admin *
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={inviteClubForm.email}
                  onChange={(e) => setInviteClubForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="admin@club.com"
                  style={{ padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </label>
              <label style={{ display: 'grid', gap: '6px', margin: 0, fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                Nombre del club (opcional)
                <input
                  type="text"
                  value={inviteClubForm.nombre_club}
                  onChange={(e) => setInviteClubForm((p) => ({ ...p, nombre_club: e.target.value }))}
                  placeholder="Ej: Club Padbol Norte"
                  style={{ padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </label>
              <label style={{ display: 'grid', gap: '6px', margin: 0, fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                País *
                <select
                  value={inviteClubForm.pais}
                  onChange={(e) => setInviteClubForm((p) => ({ ...p, pais: e.target.value }))}
                  style={{ padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">Seleccionar país</option>
                  {PAISES_SEDE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => !inviteClubSaving && setInviteClubModalOpen(false)}
                disabled={inviteClubSaving}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: inviteClubSaving ? 'not-allowed' : 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void enviarInvitacionClub()}
                disabled={inviteClubSaving}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  background: inviteClubSaving ? '#94a3b8' : '#4f46e5',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: inviteClubSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {inviteClubSaving ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {nuevaSedeModalOpen ? (
        <NuevaSedeSuperBottomSheet
          open={nuevaSedeModalOpen}
          onClose={cerrarNuevaSedeModal}
          apiBaseUrl={apiBaseUrl}
          accessToken={session?.access_token}
          onSuccess={(j) => onNuevaSedeCreada(j)}
        />
      ) : null}

      <ConfirmCancelReservaModal
        open={cancelReservaModalId != null}
        title="¿Cancelar esta reserva?"
        dismissLabel="Volver al panel"
        onDismiss={() => setCancelReservaModalId(null)}
        onConfirm={() => {
          const id = cancelReservaModalId;
          setCancelReservaModalId(null);
          if (id != null) void ejecutarCancelarReservaAdmin(id);
        }}
      />

      {suscripcionModal.open && suscripcionModal.clientSecret && stripePromiseAdmin ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pago suscripción Padbol Match"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 19999,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) {
              setSuscripcionModal({ open: false, clientSecret: null, sedeNombre: '', sedeId: null });
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#fff',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
              boxSizing: 'border-box',
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              Suscripción Padbol Match
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#64748b', lineHeight: 1.45 }}>
              {String(suscripcionModal.sedeNombre || '').trim() || 'Sede'} — carga la tarjeta para el débito mensual automático.
            </p>
            <Elements
              stripe={stripePromiseAdmin}
              options={{ clientSecret: suscripcionModal.clientSecret, locale: 'es' }}
            >
              <AdminSuscripcionPayInner
                clientSecret={suscripcionModal.clientSecret}
                onSuccess={() => {
                  setSuscripcionModal({ open: false, clientSecret: null, sedeNombre: '', sedeId: null });
                  void fetchData();
                  alert(
                    'Pago procesado. El estado «Activa» y la fecha de próximo cobro se actualizarán cuando Stripe envíe el webhook (unos segundos).'
                  );
                }}
                onClose={() =>
                  setSuscripcionModal({ open: false, clientSecret: null, sedeNombre: '', sedeId: null })
                }
              />
            </Elements>
          </div>
        </div>
      ) : null}

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
                Mueve y haz zoom para encuadrar el logo. Se guardará como JPG en buena calidad.
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

      {esAdminClub ? (
        <AdminClubOnboardingTour
          open={adminClubOnboardingOpen}
          onClose={() => setAdminClubOnboardingOpen(false)}
          applyTab={applyOnboardingTab}
          tabsStripRef={adminTabsStripRef}
          puedeVerMiSede={puedeVerMiSede}
        />
      ) : null}
    </div>
  );
}