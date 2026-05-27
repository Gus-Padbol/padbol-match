import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NuevaSedeSuperBottomSheet from '../components/NuevaSedeSuperBottomSheet';
import SedeSearchInput from '../components/SedeSearchInput';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX,
  HUB_LOGO_CLEARANCE_TOP_PX,
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
  hubMainPaddingBottomCss,
} from '../constants/hubLayout';
import { clearAdminNavContext } from '../utils/adminNavContext';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import SportIcon from '../components/common/SportIcon';
import './AdminDashboard.css';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { useTheme } from '../context/ThemeContext';
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
  DEFAULT_SPONSOR_CUPOS,
  maxPorSedeSegunNombrePlan,
  resolveSedeCommercialPlanNombre,
} from '../utils/sponsorQuotaShared';
import { pathJugadorPerfilPublico } from '../utils/jugadorPerfilPublicoUrl';
import {
  SEDE_AMENITY_DEFINITIONS,
  amenitiesArrayToSelectionSet,
  normalizeSedeAmenities,
} from '../constants/sedeAmenities.js';
import {
  getFiltrosEstadoTorneoPills,
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
  TORNEO_DEPORTE_FUTBOL5,
  TORNEO_DEPORTE_FUTBOL7,
  TORNEO_FORMATO_DOBLES,
  TORNEO_FORMATO_SINGLES_DOBLES_OPTIONS,
  TORNEO_FORMATO_EQUIPO_5,
  TORNEO_FORMATO_EQUIPO_7,
  torneoDeportePermiteSinglesDobles,
  formatoEquipoDefaultParaDeporte,
  formatoEquipoPayloadParaApi,
  resumenDeporteFormatoTorneo,
  normalizeTorneoDeporte,
} from '../utils/torneoDeporteFormato';
import { precioInscripcionTorneo } from '../utils/torneoInscripcionPago';
import { mapEstadoTorneoDesdeApiParaForm, mapEstadoTorneoFormParaApi } from '../utils/torneoEstadoAdminApi';
import {
  mensajeEstadoTorneoSoloLecturaAdmin,
  opcionesSelectEstadoTorneoAdmin,
  validarCambioEstadoTorneoAdminGuardar,
} from '../utils/torneoEstadoTransiciones';
import SorteoGruposModal, { equiposConfirmadosParaSorteo } from '../components/torneo/SorteoGruposModal';
import TorneoPuntosDistribucionModal from '../components/torneo/TorneoPuntosDistribucionModal';
import AdminClubOnboardingTour, { readOnboardingDone } from '../components/AdminClubOnboardingTour';
import AdminHubPersonalizarSection from '../components/AdminHubPersonalizarSection';
import AdminSponsorsSection from '../components/AdminSponsorsSection';
import AdminHubPromoSedeSection from '../components/AdminHubPromoSedeSection';
import AdminSedeExtrasSection from '../components/AdminSedeExtrasSection';
import AdminSedeExtrasPendientesSuper from '../components/AdminSedeExtrasPendientesSuper';
import AdminModuloClasesSection from '../components/AdminModuloClasesSection';
import AdminProfesoresSuperSection from '../components/AdminProfesoresSuperSection';
import ConfirmCancelReservaModal from '../components/ConfirmCancelReservaModal';
import TorneoCrear from './TorneoCrear';
import { IconGeroNotificacionesNav } from '../components/icons/GeroIcons';
import { fetchAdminCampanitaAlertas } from '../utils/adminCampanitaApi';
import { getCroppedImgBlob } from '../utils/cropImage';
import {
  preciosDuracionToApiPatch,
  parsePrecioDuracionField,
  miSedeFormPreciosFromSedeRow,
} from '../utils/sedePreciosDuracion';
import { generarIniciosMinutosSlotReserva, minutosAHoraReserva } from '../utils/reservaSlotsHorarios';
import * as XLSX from 'xlsx';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import i18n from '../i18n';

const STRIPE_PUBLISHABLE_ADMIN =
  typeof process !== 'undefined' && process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
    ? String(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY).trim()
    : '';
const stripePromiseAdmin = STRIPE_PUBLISHABLE_ADMIN ? loadStripe(STRIPE_PUBLISHABLE_ADMIN) : null;

function etiquetaSuscripcionEstado(raw) {
  const v = String(raw || 'sin_suscripcion').toLowerCase();
  if (v === 'activa') return i18n.t('admin.sedes.subscriptionActive');
  if (v === 'vencida') return i18n.t('admin.sedes.subscriptionExpired');
  if (v === 'pendiente_pago') return i18n.t('admin.sedes.paymentPending');
  if (v === 'cancelada' || v === 'cancelado') return i18n.t('admin.sedes.subscriptionCancelled');
  if (v === 'aviso') return i18n.t('admin.sedes.noticeOverdue');
  if (v === 'segundo_aviso') return i18n.t('admin.sedes.secondNotice');
  if (v === 'suspendido') return i18n.t('admin.sedes.suspendedOverdue');
  return i18n.t('admin.notif.noSubscription');
}

const TIPO_INTERES_APROBAR_SOLICITUD_LIC = [
  i18n.t('admin.sedes.affiliateClub'),
  i18n.t('admin.sedes.padbolPointFranchise'),
  i18n.t('admin.sedes.masterNational'),
];

function etiquetaTipoInteresSolicitudLicencia(v) {
  const s = String(v || '').trim();
  if (!s || s === 'pendiente_definicion') return i18n.t('admin.notif.pendingDefinition');
  return s;
}

/** Selector manual super_admin en detalle de sede (mora + operativo). */
const SUSCRIPCION_SELECTOR_SUPER_SEDE = [
  { value: 'activa', label: i18n.t('admin.sedes.subscriptionActive') },
  { value: 'aviso', label: i18n.t('admin.sedes.noticeOverdue') },
  { value: 'segundo_aviso', label: i18n.t('admin.sedes.secondNotice') },
  { value: 'suspendido', label: 'Suspendida' },
  { value: 'cancelado', label: i18n.t('admin.sedes.subscriptionCancelled') },
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
  const { t } = useTranslation();
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
        setMsg(sErr.message || t('admin.formularios.checkData'));
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
        setMsg(t('admin.notif.paymentNotCompleted'));
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
          {busy ? t('admin.metricas.processing') : t('admin.metricas.confirmPayment')}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: 'var(--bg-card)',
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
const DIAS_SEMANA_FRANJA = [
  { id: 'lun' },
  { id: 'mar' },
  { id: 'mie' },
  { id: 'jue' },
  { id: 'vie' },
  { id: 'sab' },
  { id: 'dom' },
];
const DIAS_SEMANA_DEFAULT_FRANJA = DIAS_SEMANA_FRANJA.map((d) => d.id);
const ADMIN_NOTIFICACIONES_READ_LS_KEY = 'admin_notificaciones_leidas_v1';

function newFranjaId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fj-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeFranjasHorarias(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((f) => ({
    id: String(f?.id || '').trim() || newFranjaId(),
    tipo: String(f?.tipo || '').trim() === 'fecha_especial' ? 'fecha_especial' : 'semanal',
    nombre: String(f?.nombre ?? '').trim(),
    fecha: String(f?.fecha ?? '').trim().slice(0, 10),
    dias: Array.isArray(f?.dias)
      ? f.dias.map((d) => String(d).trim()).filter((d) => DIAS_SEMANA_DEFAULT_FRANJA.includes(d))
      : DIAS_SEMANA_DEFAULT_FRANJA,
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
    const tipo = String(r.tipo || '').trim() === 'fecha_especial' ? 'fecha_especial' : 'semanal';
    return {
      id: String(r.id || '').trim() || newFranjaId(),
      tipo,
      nombre: String(r.nombre || '').trim(),
      fecha: String(r.fecha || '').trim().slice(0, 10) || null,
      dias:
        tipo === 'fecha_especial'
          ? []
          : Array.isArray(r.dias) && r.dias.length
            ? r.dias.map((d) => String(d).trim()).filter((d) => DIAS_SEMANA_DEFAULT_FRANJA.includes(d))
            : DIAS_SEMANA_DEFAULT_FRANJA,
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
    precio_60min: sedeData.precio_60min ?? '',
    precio_90min: sedeData.precio_90min ?? sedeData.precio_turno ?? '',
    precio_120min: sedeData.precio_120min ?? '',
    precio_turno: sedeData.precio_turno ?? sedeData.precio_90min ?? '',
    moneda: sedeData.moneda || 'ARS',
    descripcion: sedeData.descripcion || '',
    slogan: sedeData.slogan != null ? String(sedeData.slogan) : '',
    historia: sedeData.historia != null ? String(sedeData.historia) : '',
    anio_fundacion:
      sedeData.anio_fundacion != null && String(sedeData.anio_fundacion).trim() !== ''
        ? String(sedeData.anio_fundacion).trim()
        : '',
    metodo_pago: sedeData.metodo_pago || 'mercadopago',
    stripe_account_id: sedeData.stripe_account_id || '',
    mp_access_token: sedeData.mp_access_token || '',
    mp_public_key: sedeData.mp_public_key || '',
    pago_manual_instrucciones: sedeData.pago_manual_instrucciones || '',
    latitud: sedeData.latitud != null ? String(sedeData.latitud) : '',
    longitud: sedeData.longitud != null ? String(sedeData.longitud) : '',
    instagram: sedeData.instagram || '',
    facebook: sedeData.facebook || '',
    tiktok: sedeData.tiktok || '',
    twitter: sedeData.twitter || '',
    youtube: sedeData.youtube || '',
    website: sedeData.website || '',
    color_hero_primario: normalizeHexSedeAdmin(sedeData.color_hero_primario) || '#4C1D95',
    color_hero_secundario: normalizeHexSedeAdmin(sedeData.color_hero_secundario) || '#7C3AED',
    color_borde_hero: normalizeHexSedeAdmin(sedeData.color_borde_hero) || '#6D28D9',
    amenities: normalizeSedeAmenities(sedeData.amenities),
  };
}


function precioDuracionInputDisplay(raw) {
  if (raw === '' || raw == null) return '';
  const n = parsePrecioDuracionField(raw);
  return n != null ? Number(n).toLocaleString('es-AR') : '';
}

/** Body para PATCH /api/sedes/:id (campos alineados con el panel). */
function miSedeFormToApiPatchBody(form) {
  const duracionPrecios = preciosDuracionToApiPatch(form);
  const latOk = form.latitud !== '' && form.latitud != null && Number.isFinite(parseFloat(form.latitud));
  const lngOk = form.longitud !== '' && form.longitud != null && Number.isFinite(parseFloat(form.longitud));
  const mpTrim = String(form.mp_access_token ?? '').trim();
  const mpPublicTrim = String(form.mp_public_key ?? '').trim();
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
    ...duracionPrecios,
    moneda: form.moneda || 'ARS',
    descripcion: form.descripcion || null,
    slogan:
      form.slogan != null && String(form.slogan).trim() !== ''
        ? String(form.slogan).trim().slice(0, 80)
        : null,
    historia:
      form.historia != null && String(form.historia).trim() !== ''
        ? String(form.historia).trim().slice(0, 500)
        : null,
    anio_fundacion: (() => {
      const s = String(form.anio_fundacion ?? '').trim();
      if (!s) return null;
      const y = parseInt(s, 10);
      return Number.isFinite(y) && y >= 1800 && y <= 2100 ? y : null;
    })(),
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
    color_hero_primario: normalizeHexSedeAdmin(form.color_hero_primario) || '#4C1D95',
    color_hero_secundario: normalizeHexSedeAdmin(form.color_hero_secundario) || '#7C3AED',
    color_borde_hero: normalizeHexSedeAdmin(form.color_borde_hero) || '#6D28D9',
    amenities: normalizeSedeAmenities(form.amenities),
  };
  if (mpTrim) out.mp_access_token = mpTrim;
  if (mpPublicTrim) out.mp_public_key = mpPublicTrim;
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
  'profesores',
  'personalizar_hub',
  'sponsors',
]);

const EDITOR_CONTENIDO_TABS_ALLOWED = new Set(['personalizar_hub', 'sponsors']);

const SEDES_SUPER_ADMIN_PAGE_SIZE = 10;

/** Torneos que siguen “en juego” a nivel operativo (no finalizados ni cancelados). */
function torneoConsideradoActivoPanelNacional(t) {
  return !esEstadoFinalizadoTorneo(t?.estado) && !esEstadoCanceladoTorneo(t?.estado);
}

function sanitizeAdminActiveTab(raw, rolUsuario = null) {
  if (rolUsuario === 'editor_contenido') {
    const t0 = String(raw || '').trim();
    return EDITOR_CONTENIDO_TABS_ALLOWED.has(t0) ? t0 : 'personalizar_hub';
  }
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

function hrefPerfilPublicoDesdeReservaAdmin(reserva) {
  const slug = String(reserva?.jugador_perfil_public_slug || '').trim();
  if (slug) return `/jugador/${encodeURIComponent(slug)}`;
  return pathJugadorPerfilPublico({ user_id: reserva?.user_id });
}

/** Nombre + email + WhatsApp de ficha (`jugador_whatsapp_perfil`) en listado/detalle reservas admin. */
function AdminReservaJugadorContacto({ reserva }) {
  const email = String(reserva.email || '').trim();
  const waPerfil = String(reserva.jugador_whatsapp_perfil || '').trim();
  const waUrl = adminReservaJugadorWhatsappWaMeUrl(waPerfil);
  const nombre = String(reserva.nombre || '').trim() || '—';
  const perfilHref = hrefPerfilPublicoDesdeReservaAdmin(reserva);
  return (
    <div style={{ overflow: 'hidden', minWidth: 0, lineHeight: 1.4 }}>
      <div
        style={{
          fontWeight: 600,
          color: 'var(--text-primary)',
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
            style={{ color: '#E11B22', wordBreak: 'break-all' }}
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
          <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{waPerfil}</span>
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
              background: '#E11B22',
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
      {perfilHref ? (
        <div style={{ fontSize: '12px', marginTop: '6px' }}>
          <a
            href={perfilHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ color: '#E11B22', fontWeight: 700, textDecoration: 'underline' }}
          >
            Ver perfil
          </a>
        </div>
      ) : null}
    </div>
  );
}

/** Pills de filtro: inactivo blanco + borde gris; activo #E11B22 + texto blanco (Resumen, Torneos, Reservas). */
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

/** inactiveSurface `lightMuted`: chips sobre fondo claro (p. ej. período Semana/Mes en resumen super admin). */
function adminFilterPillButtonStyle(active, inactiveSurface = 'default') {
  if (active) {
    return {
      ...ADMIN_FILTER_PILL_BASE,
      background: 'var(--accent)',
      color: '#fff',
      border: 'none',
    };
  }
  if (inactiveSurface === 'lightMuted') {
    return {
      ...ADMIN_FILTER_PILL_BASE,
      background: 'var(--bg-input)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border)',
    };
  }
  return {
    ...ADMIN_FILTER_PILL_BASE,
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
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

/** YYYY-MM-DD desde reserva.fecha (date, timestamptz u otros formatos). */
function fechaReservaDiaISO(fechaRaw) {
  const s = String(fechaRaw ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** `fechaISO` = YYYY-MM-DD (reserva o fecha derivada de equipo). `anclaISO` ancla el día/semana/mes/año mostrado. */
function fechaDentroDePeriodoFinanzas(fechaISO, periodo, fechaDesde, fechaHasta, anclaISO) {
  const dia = fechaReservaDiaISO(fechaISO);
  if (!dia) return false;
  const [y, m, d] = dia.split('-').map(Number);
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
  const { t } = useTranslation();
  if (periodo === 'rango' || periodo === 'hoy') return null;
  if (!['semana', 'mes', 'anio'].includes(periodo)) return null;
  const label = labelNavegacionFinanzas(periodo, anclaISO);
  const btn = {
    border: '1px solid #cbd5e1',
    background: 'var(--bg-card)',
    borderRadius: '8px',
    width: '36px',
    height: '34px',
    cursor: 'pointer',
    fontSize: '17px',
    lineHeight: 1,
    fontWeight: 800,
    color: 'var(--text-primary)',
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
      <button type="button" aria-label={t('admin.notif.periodPrevAria')} onClick={() => onShift(-1)} style={btn}>
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
      <button type="button" aria-label={t('admin.notif.periodNextAria')} onClick={() => onShift(1)} style={btn}>
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

// ISO timestamptz → fecha y hora local (listado historial reservas)
function formatReservaHistorialFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function etiquetaQuienReservaHistorial(changedBy) {
  const s = String(changedBy || 'sistema').trim();
  if (s === 'sistema') return 'Sistema';
  if (s.startsWith('admin:')) return 'Admin';
  if (s.startsWith(i18n.t('admin.reservas.playerLabel'))) return i18n.t('admin.reservas.player');
  return s;
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

function duracionReservaAdmin(r) {
  const d = parseInt(String(r?.duracion_minutos ?? r?.duracion ?? ''), 10);
  return Number.isFinite(d) && d > 0 ? d : 90;
}

function horarioReservaAdmin(r) {
  const duracion = duracionReservaAdmin(r);
  return `${horaRango(r?.hora, duracion)} (${duracion} min)`;
}

// Returns a JSX status badge for a reserva
function EstadoBadge({ reserva }) {
  const { t } = useTranslation();
  const est = String(reserva.estado || '').toLowerCase();
  if (est === 'pendiente_pago_manual') {
    return <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: 700 }}>{t('admin.reservas.badgeManualPaymentPending')}</span>;
  }
  if (est === 'pendiente_pago_efectivo') {
    return <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: 700 }}>{t('admin.reservas.badgeVenuePaymentPending')}</span>;
  }
  if (reserva.estado === 'cancelada' || reserva.cancelada) {
    return <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>❌ Cancelada</span>;
  }
  if (reserva.estado === 'reservada') {
    return <span style={{ background: '#f1f5f9', color: 'var(--text-secondary)', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>📋 Reservada</span>;
  }
  if (reserva.estado === 'completada' || !esFutura(reserva)) {
    return <span style={{ background: '#e2e8f0', color: 'var(--text-secondary)', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>{t('admin.reservas.badgeCompleted')}</span>;
  }
  return <span style={{ background: '#fef2f2', color: 'var(--text-primary)', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}>{t('admin.reservas.badgeConfirmed')}</span>;
}

/** Pills filtro listado reservas (pestaña Reservas). */
const FILTROS_RESERVA_ADMIN_PILLS = [
  { id: 'todas', label: i18n.t('admin.reservas.all') },
  { id: 'confirmadas', label: 'Confirmadas' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'canceladas', label: 'Canceladas' },
];

/** Buckets alineados con {@link EstadoBadge}: cancelada | pendientes (reservada u otro) | confirmadas (confirmada/completada). */
function bucketEstadoReservaAdmin(estadoRaw) {
  const e = String(estadoRaw || '').trim().toLowerCase();
  if (e === 'cancelada') return 'canceladas';
  if (e === 'reservada' || e === 'pendiente_pago_manual' || e === 'pendiente_pago_efectivo') return 'pendientes';
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
[...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].forEach((p) => {
  FLAG_MAP[p.nombre.toLowerCase()] = p.bandera;
});
for (const p of [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS]) {
  const nk = normalizePaisKeyAdmin(p.nombre);
  if (nk) FLAG_MAP[nk] = p.bandera;
}

/** Sin acentos, minúsculas — para matchear variantes de país en datos. */
function normalizePaisKeyAdmin(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Variantes comunes en datos → nombre canónico del catálogo de banderas. */
const PAISES_BANDERA_ALIASES = {
  espana: 'España',
  spain: 'España',
  usa: 'Estados Unidos',
  eeuu: 'Estados Unidos',
  'eeuu': 'Estados Unidos',
  'ee.uu': 'Estados Unidos',
  'ee. uu': 'Estados Unidos',
  'estados unidos de america': 'Estados Unidos',
  uk: 'Reino Unido',
};

/** Bandera emoji a partir del texto de país (sede, analytics, roles). */
function banderaEmojiDesdeNombrePais(paisRaw) {
  const raw = String(paisRaw || '').trim();
  if (!raw) return '';
  const rif = banderaRegionalAlInicio(raw);
  if (rif) return rif;
  const sin = paisTextoSinBanderaInicial(raw);
  const lk = sin.toLowerCase();
  const nk = normalizePaisKeyAdmin(sin);
  if (FLAG_MAP[lk]) return FLAG_MAP[lk];
  if (FLAG_MAP[nk]) return FLAG_MAP[nk];
  const aliasTarget = PAISES_BANDERA_ALIASES[nk] || PAISES_BANDERA_ALIASES[lk];
  if (aliasTarget && FLAG_MAP[aliasTarget.toLowerCase()]) return FLAG_MAP[aliasTarget.toLowerCase()];
  return '';
}
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
  const flag = banderaEmojiDesdeNombrePais(raw);
  const nombre = sinBandera || raw;
  return flag ? `${flag} ${nombre}`.trim() : nombre;
}

function sedeFlag(sede) {
  if (!sede?.pais) return '';
  return banderaEmojiDesdeNombrePais(sede.pais);
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

function monetarioObjTodoCero(obj) {
  return ['ARS', 'USD', 'EUR'].every((k) => (Number(obj?.[k]) || 0) === 0);
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
  return parts.length ? parts.join(' · ') : i18n.t('admin.notif.noRevenuePeriod');
}

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

const CANCHA_DEPORTE_ADMIN_VALUES = [
  'padbol',
  'padel',
  'tenis',
  'pickleball',
  'squash',
  'futbol_5',
  'futbol_7',
];

function getCanchaDeporteAdminOptions(tr) {
  return CANCHA_DEPORTE_ADMIN_VALUES.map((value) => ({
    value,
    label:
      value === 'padbol'
        ? 'Padbol'
        : tr(`torneos.deporte.${value}`, { defaultValue: value.replace(/_/g, ' ') }),
  }));
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

function horaDesdeMinutosAdminDash(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function minutosInicioReservaAdminDash(r) {
  const s = normalizeHoraInicioReservaAdminDash(r?.hora);
  return minutosDesdeMedianocheHHMMAdminDash(s);
}

function reservaBloqueaSlotAdminDash(r) {
  const est = String(r?.estado || '').trim().toLowerCase();
  return est !== 'cancelada' && !r?.cancelada;
}

function reservaSolapaSlotAdminDash(r, startMin, endMin) {
  const rStart = minutosInicioReservaAdminDash(r);
  if (rStart == null) return false;
  const rEnd = rStart + duracionReservaAdmin(r);
  return startMin < rEnd && endMin > rStart;
}

function slotsReservaManualDisponiblesAdminDash({ sedeRow, reservas, fecha, cancha, duracion, ctx }) {
  if (!sedeRow || !fecha || !cancha) return [];
  const dur = parseInt(String(duracion), 10);
  const duracionMin = [60, 90, 120].includes(dur) ? dur : 90;
  const canchaNum = parseInt(String(cancha), 10);
  if (!Number.isFinite(canchaNum)) return [];

  const sedeNombre = String(sedeRow?.nombre || '').trim().toLowerCase();
  const fechaISO = String(fecha || '').trim().slice(0, 10);
  const ocupadas = (Array.isArray(reservas) ? reservas : []).filter((r) => {
    if (!reservaBloqueaSlotAdminDash(r)) return false;
    if (String(r?.fecha || '').trim().slice(0, 10) !== fechaISO) return false;
    if (parseInt(String(r?.cancha), 10) !== canchaNum) return false;
    return String(r?.sede || '').trim().toLowerCase() === sedeNombre;
  });

  const filtraPasadosHoy = ctx?.hoyISO && fechaISO === ctx.hoyISO;
  const inicios = generarIniciosMinutosSlotReserva(sedeRow, fechaISO, duracionMin, 30);
  const out = [];
  for (const start of inicios) {
    if (filtraPasadosHoy && start < ctx.minutesNow) continue;
    const end = start + duracionMin;
    const solapada = ocupadas.some((r) => reservaSolapaSlotAdminDash(r, start, end));
    if (!solapada) out.push(minutosAHoraReserva(start));
  }
  return out;
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
  if (days <= 30) return { label: 'Por vencer', bg: '#f59e0b', color: 'var(--text-primary)' };
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
  return (
    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>{i18n.t('admin.sedes.noLicense')}</span>
  );
}

/** Búsqueda en vivo (nombre o número de licencia) sobre la lista en memoria. */
function sedeMatchesSuperAdminBusqueda(s, queryRaw) {
  const raw = String(queryRaw || '').trim();
  if (!raw) return true;
  const q = raw.toLowerCase();
  const nombre = String(s?.nombre || '').toLowerCase();
  if (nombre.includes(q)) return true;
  const lic = String(s?.numero_licencia ?? '').trim().toLowerCase();
  if (!lic) return false;
  if (lic.includes(q)) return true;
  const qCompact = q.replace(/[\s\-_.]/g, '');
  const licCompact = lic.replace(/[\s\-_.]/g, '');
  return Boolean(qCompact && licCompact && licCompact.includes(qCompact));
}

/** Duraciones sedes_duraciones — edición super admin (alta/baja) en modal detalle sede. */
function SedeSuperDuracionesSection({ apiBaseUrl, accessToken, sedeId, moneda }) {
  const { t } = useTranslation();
  const sid = Number(sedeId);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [nueva, setNueva] = useState({ duracion_minutos: '', precio: '', activo: true });
  const [guardandoId, setGuardandoId] = useState(null);
  const [agregando, setAgregando] = useState(false);

  const cargar = useCallback(async () => {
    if (!accessToken || !Number.isFinite(sid) || sid <= 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/sedes/${sid}/duraciones`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      setRows(Array.isArray(j.duraciones) ? j.duraciones : []);
    } catch (e) {
      setMsg(e?.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, accessToken, sid]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const mon = moneda || 'ARS';

  return (
    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '4px' }}>
      <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>{t('admin.sedes.durationsPricesTable')}</div>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        Solo super admin puede agregar o quitar duraciones. Los clubes editan precio y activo desde su panel.
      </p>
      {msg ? (
        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: '#b91c1c' }}>{msg}</p>
      ) : null}
      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</p>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-page)',
              }}
            >
              <span style={{ fontWeight: 800, minWidth: '72px' }}>{row.duracion_minutos} min</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {mon} {Number(row.precio ?? 0).toLocaleString('es-AR')} · {row.activo ? t('admin.sedes.subscriptionActive') : 'Inactiva'}
              </span>
              <button
                type="button"
                disabled={guardandoId === row.id}
                onClick={() => {
                  if (!window.confirm(t('admin.notif.deleteDurationConfirm', { minutes: row.duracion_minutos }))) return;
                  void (async () => {
                    setGuardandoId(row.id);
                    setMsg('');
                    try {
                      const res = await fetch(`${apiBaseUrl}/api/sedes/${sid}/duraciones/${row.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${accessToken}` },
                      });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(j.error || res.statusText);
                      await cargar();
                    } catch (e) {
                      setMsg(e?.message || String(e));
                    } finally {
                      setGuardandoId(null);
                    }
                  })();
                }}
                style={{
                  marginLeft: 'auto',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#991b1b',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: guardandoId === row.id ? 'not-allowed' : 'pointer',
                }}
              >
                Eliminar
              </button>
            </div>
          ))}
          <div
            style={{
              padding: '12px',
              borderRadius: '10px',
              border: '1px dashed #cbd5e1',
              display: 'grid',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{t('admin.notif.addDuration')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                inputMode="numeric"
                min={15}
                max={480}
                placeholder={t('admin.formularios.minutesPh')}
                value={nueva.duracion_minutos}
                onChange={(e) => setNueva((p) => ({ ...p, duracion_minutos: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                style={{ width: '100px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder={`Precio (${mon})`}
                value={nueva.precio}
                onChange={(e) => setNueva((p) => ({ ...p, precio: e.target.value.replace(/[^\d]/g, '') }))}
                style={{ flex: '1 1 120px', minWidth: '120px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={nueva.activo}
                  onChange={(e) => setNueva((p) => ({ ...p, activo: e.target.checked }))}
                />
                Activa
              </label>
              <button
                type="button"
                disabled={agregando}
                onClick={() => {
                  void (async () => {
                    const dm = parseInt(String(nueva.duracion_minutos), 10);
                    const pr = parseInt(String(nueva.precio).replace(/\D/g, ''), 10);
                    if (!Number.isFinite(dm) || dm < 15 || dm > 480) {
                      setMsg(t('admin.formularios.durationRange'));
                      return;
                    }
                    if (!Number.isFinite(pr) || pr < 0) {
                      setMsg(t('admin.formularios.validPriceRequired'));
                      return;
                    }
                    setAgregando(true);
                    setMsg('');
                    try {
                      const res = await fetch(`${apiBaseUrl}/api/sedes/${sid}/duraciones`, {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${accessToken}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ duracion_minutos: dm, precio: pr, activo: nueva.activo }),
                      });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(j.error || res.statusText);
                      setNueva({ duracion_minutos: '', precio: '', activo: true });
                      await cargar();
                    } catch (e) {
                      setMsg(e?.message || String(e));
                    } finally {
                      setAgregando(false);
                    }
                  })();
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: agregando ? '#94a3b8' : 'linear-gradient(135deg, #E11B22, #991b1b)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: agregando ? 'not-allowed' : 'pointer',
                }}
              >
                {agregando ? '…' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Panel contrato + suscripción (super admin) — modal detalle sede en listado; mismo bloque que antes en fila expandida. */
function SedeSuperDetallePanel({
  s,
  contrato,
  badge,
  suscripcionEstadoSuperSavingId,
  guardarSuscripcionEstadoSuper,
  activarSuscripcionStripeSede,
}) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div style={{ display: 'grid', gap: '6px' }}>
        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t('admin.sedes.contract')}</div>
        <div style={{ fontSize: '13px' }}>
          <strong>{t('admin.sedes.startLabel')}</strong> {contrato?.fecha_inicio || '—'} · <strong>{t('admin.sedes.expiryLabel')}</strong>{' '}
          {contrato?.fecha_vencimiento || '—'} · <strong>{t('admin.sedes.referenceLabel')}</strong> {contrato?.referencia || '—'}
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
        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t('admin.notif.stripeSubscription')}</div>
        <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
          <strong>{t('admin.sedes.statusLabel')}</strong> {etiquetaSuscripcionEstado(s.suscripcion_estado)}
          <br />
          <strong>{t('admin.sedes.nextChargeLabel')}</strong> {formatProximoCobroAdmin(s.suscripcion_proximo_cobro)}
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
          <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>{t('admin.sedes.changeSubscriptionStatus')}</label>
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
              if (!window.confirm(t('admin.notif.saveSubscriptionConfirm', { status: v }))) {
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
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('admin.metricas.saving')}</span>
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

function labelInvitacionAdminTipo(inv) {
  const role = String(inv?.invited_role || 'admin_club').toLowerCase();
  const alc = String(inv?.invited_alcance || '').toLowerCase();
  if (role === 'admin_nacional' && alc === 'pais') return i18n.t('admin.formularios.nationalAdminRole');
  if (role === 'admin_nacional' && (alc === 'provincia' || alc === 'ciudad')) return i18n.t('admin.sedes.adminCityRegion');
  if (role === 'empleado') return '👤 Empleado';
  return i18n.t('admin.sedes.adminClub');
}

function inviteAdminTipoToRol(tipo) {
  const t = String(tipo || 'club').trim().toLowerCase();
  if (t === 'nacional' || t === 'ciudad_region') return 'admin_nacional';
  return 'admin_club';
}

/** HH:00 desde hora de reserva (inicio del turno). */
function horaFranjaReservaAdmin(horaRaw) {
  const start = String(horaRaw || '').split(' - ')[0].trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(start);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  return `${String(h).padStart(2, '0')}:00`;
}

function fechaReservaDiaOCreatedISO(r) {
  return fechaReservaDiaISO(r?.fecha) || fechaReservaDiaISO(r?.created_at);
}

function diaCalendarioEnRangoLocal(diaISO, start, end) {
  if (!diaISO || !/^\d{4}-\d{2}-\d{2}$/.test(diaISO)) return false;
  const [y, m, d] = diaISO.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  if (Number.isNaN(fecha.getTime())) return false;
  return fecha >= start && fecha <= end;
}

function pctCambioSemana(actual, anterior) {
  const a = Number(actual) || 0;
  const p = Number(anterior) || 0;
  if (p === 0) return a > 0 ? 100 : 0;
  return Math.round(((a - p) / p) * 100);
}

function cancelacionBadgeClass(pct) {
  const n = Number(pct) || 0;
  if (n < 10) return 'admin-cancelacion-badge admin-cancelacion-badge--ok';
  if (n <= 20) return 'admin-cancelacion-badge admin-cancelacion-badge--warn';
  return 'admin-cancelacion-badge admin-cancelacion-badge--danger';
}

function deporteLabelAdminDash(deporteKey, tr) {
  const k = String(deporteKey || '').trim().toLowerCase() || 'padbol';
  if (k === 'padbol') return 'Padbol';
  return tr(`torneos.deporte.${k}`, { defaultValue: k.replace(/_/g, ' ') });
}

function resolveDeporteKeyReservaAdmin(r, sedeIdKey, canchasDetallePorSede) {
  const raw = r?.deporte != null && String(r.deporte).trim() !== '' ? String(r.deporte).trim().toLowerCase() : '';
  if (raw) return raw;
  const canchas = canchasDetallePorSede?.[String(sedeIdKey)] || [];
  const num = parseInt(String(r?.cancha), 10);
  if (!Number.isFinite(num)) return null;
  const row = canchas.find((c) => Number(c.numero_reserva) === num);
  if (row?.deporte) return String(row.deporte).trim().toLowerCase();
  return null;
}

function AdminClubMetricasExtras({ metricas, moneda }) {
  const { ocupacionHoraria, semanaCompare, cancelacion, deportesTop, periodoLabel } = metricas;
  const mon = String(moneda || 'ARS').trim().toUpperCase();

  return (
    <div className="admin-club-metricas-extras">
      <div className="admin-stat-card">
        <h3 className="admin-stat-card__title">Ocupación por horario</h3>
        <p className="admin-stat-card__hint">
          Reservas confirmadas · {periodoLabel}
        </p>
        {ocupacionHoraria.rows.length === 0 ? (
          <p className="admin-stat-card__empty">Sin reservas confirmadas en el período.</p>
        ) : (
          <div className="admin-stat-bars" role="list">
            {ocupacionHoraria.rows.map((row) => (
              <div className="admin-stat-bar" key={row.hora} role="listitem">
                <span className="admin-stat-bar__label">{row.hora}</span>
                <div className="admin-stat-bar__track" aria-hidden>
                  <div className="admin-stat-bar__fill" style={{ width: `${row.pct}%` }} />
                </div>
                <span className="admin-stat-bar__meta">
                  {row.count} ({row.pct}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-stat-card">
        <h3 className="admin-stat-card__title">Semana actual vs semana anterior</h3>
        <p className="admin-stat-card__hint">Lunes a domingo · por fecha de reserva</p>
        <div className="admin-week-compare">
          <div className="admin-week-compare__col">
            <div className="admin-week-compare__kicker">Reservas</div>
            <div className="admin-week-compare__values">
              <span className="admin-week-compare__current">{semanaCompare.reservasActual}</span>
              <span className="admin-week-compare__vs">vs</span>
              <span className="admin-week-compare__prev">{semanaCompare.reservasAnterior}</span>
            </div>
            <SemanaCompareDelta pct={semanaCompare.reservasPct} />
          </div>
          <div className="admin-week-compare__col">
            <div className="admin-week-compare__kicker">Ingresos ({mon})</div>
            <div className="admin-week-compare__values">
              <span className="admin-week-compare__current">
                $ {semanaCompare.ingresosActual.toLocaleString('es-AR')}
              </span>
              <span className="admin-week-compare__vs">vs</span>
              <span className="admin-week-compare__prev">
                $ {semanaCompare.ingresosAnterior.toLocaleString('es-AR')}
              </span>
            </div>
            <SemanaCompareDelta pct={semanaCompare.ingresosPct} />
          </div>
        </div>
      </div>

      <div className="admin-stat-card admin-stat-card--inline-metrics">
        <h3 className="admin-stat-card__title">Tasa de cancelación</h3>
        <p className="admin-stat-card__hint">{periodoLabel}</p>
        <div className="admin-stat-card__metrics-row">
          <div>
            <div className="admin-stat-card__metric-label">Total reservas</div>
            <div className="admin-stat-card__metric-value">{cancelacion.total}</div>
          </div>
          <div>
            <div className="admin-stat-card__metric-label">Canceladas</div>
            <div className="admin-stat-card__metric-value">{cancelacion.canceladas}</div>
          </div>
          <div>
            <div className="admin-stat-card__metric-label">Tasa</div>
            <span className={cancelacionBadgeClass(cancelacion.pct)}>{cancelacion.pct}%</span>
          </div>
        </div>
      </div>

      <div className="admin-stat-card">
        <h3 className="admin-stat-card__title">Deporte más reservado</h3>
        <p className="admin-stat-card__hint">Top 3 · reservas no canceladas · {periodoLabel}</p>
        {deportesTop.length === 0 ? (
          <p className="admin-stat-card__empty">Sin reservas en el período.</p>
        ) : (
          <div className="admin-stat-bars">
            {deportesTop.map((row) => (
              <div className="admin-stat-bar" key={row.key}>
                <span className="admin-stat-bar__label">{row.label}</span>
                <div className="admin-stat-bar__track" aria-hidden>
                  <div className="admin-stat-bar__fill" style={{ width: `${row.pct}%` }} />
                </div>
                <span className="admin-stat-bar__meta">
                  {row.count} ({row.pct}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SemanaCompareDelta({ pct }) {
  const n = Number(pct) || 0;
  if (n === 0) {
    return <span className="admin-week-compare__delta admin-week-compare__delta--neutral">— 0%</span>;
  }
  const up = n > 0;
  return (
    <span
      className={
        up ? 'admin-week-compare__delta admin-week-compare__delta--up' : 'admin-week-compare__delta admin-week-compare__delta--down'
      }
    >
      {up ? '↑' : '↓'} {Math.abs(n)}%
    </span>
  );
}

export default function AdminDashboard({ apiBaseUrl = 'https://padbol-backend.onrender.com', rol = null, sedeId = null }) {
  const { t, i18n } = useTranslation();
  console.log('AdminDashboard montado', { rol, sedeId });
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [searchParams] = useSearchParams();
  const { session, refreshSession } = useAuth();
  const { theme } = useTheme();
  const currentEmail = (session?.user?.email || '').trim().toLowerCase();
  const adminPillInactiveSurface = theme === 'light' ? 'lightMuted' : 'default';

  const isSuperAdmin = rol === 'super_admin';
  const esEmpleado = rol === 'empleado';
  const esEditorContenido = rol === 'editor_contenido';
  const isAdmin =
    isSuperAdmin || rol === 'admin_nacional' || rol === 'admin_club' || esEmpleado;

  // Role-based access flags
  const esAdminNacional = rol === 'admin_nacional';
  const esAdminClub     = rol === 'admin_club';
  const puedeVerConfig  = isSuperAdmin;
  const puedeVerFinanzas = !esEmpleado;

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
    super_admin:    `👑 ${t('admin.role.super')}`,
    admin_nacional: `🌎 ${t('admin.role.national')}`,
    admin_club:     `🏠 ${t('admin.role.club')}`,
    empleado:       `👤 ${t('admin.role.employee')}`,
    editor_contenido: `📝 ${t('admin.role.editor')}`,
  };

  const [reservas, setReservas] = useState([]);
  const [torneos, setTorneos] = useState([]);
  const [crearTorneoEmbedOpen, setCrearTorneoEmbedOpen] = useState(false);
  const [filtroEstadoTorneoAdmin, setFiltroEstadoTorneoAdmin] = useState('todos');
  const [filtroDeporteTorneoAdmin, setFiltroDeporteTorneoAdmin] = useState('todos');
  const filtrosEstadoTorneoPillsAdmin = useMemo(() => getFiltrosEstadoTorneoPills(t), [t, i18n.language]);
  const filtrosDeporteTorneoPillsAdmin = useMemo(
    () => [
      { id: 'todos', label: t('admin.sponsors.allSports') },
      ...TORNEO_DEPORTE_OPTIONS.map((o) => ({ id: o.value, label: o.label })),
    ],
    [t, i18n.language]
  );
  const canchaDeporteAdminOptions = useMemo(() => getCanchaDeporteAdminOptions(t), [t, i18n.language]);
  const [filtroPillReservas, setFiltroPillReservas] = useState('todas');
  const [sedesMap, setSedesMap] = useState({});
  const [contratosBySedeId, setContratosBySedeId] = useState({});
  const [sedeDetalleAbiertoId, setSedeDetalleAbiertoId] = useState(null);
  /** Filtros país/ciudad super_admin (tabla desktop + tarjetas móvil; paginación sobre lista filtrada). */
  const [sedeMobileFiltroPais, setSedeMobileFiltroPais] = useState('');
  const [sedeMobileFiltroCiudad, setSedeMobileFiltroCiudad] = useState('');
  /** Búsqueda por nombre de sede o número de licencia (super_admin, lista registradas). */
  const [sedesSuperAdminBusquedaTexto, setSedesSuperAdminBusquedaTexto] = useState('');
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
  const [reservaManualOpen, setReservaManualOpen] = useState(false);
  const [reservaManualSaving, setReservaManualSaving] = useState(false);
  const [reservaManualError, setReservaManualError] = useState('');
  const [reservaManualForm, setReservaManualForm] = useState(() => ({
    sede_id: sedeId != null && sedeId !== '' ? String(sedeId) : '',
    cancha: '',
    fecha: new Date().toISOString().slice(0, 10),
    hora: '',
    duracion: '90',
    nombre: '',
    telefono: '',
    estado: 'confirmada',
  }));
  /** reserva id → { open, loading, rows, error } */
  const [reservaHistorialUi, setReservaHistorialUi] = useState({});
  const [mensajeExito, setMensajeExito] = useState('');
  const [notificacionesOpen, setNotificacionesOpen] = useState(false);
  const [campanitaData, setCampanitaData] = useState(null);
  const [campanitaLoading, setCampanitaLoading] = useState(false);
  const [notificacionesLeidas, setNotificacionesLeidas] = useState(() => {
    try {
      const raw = localStorage.getItem(ADMIN_NOTIFICACIONES_READ_LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState(() => sanitizeAdminActiveTab(searchParams.get('tab'), rol));
  const [nuevaSedeModalOpen, setNuevaSedeModalOpen] = useState(false);
  const [editorContenidoEmail, setEditorContenidoEmail] = useState('');
  const [editorContenidoNombre, setEditorContenidoNombre] = useState('');
  const [editorContenidoSaving, setEditorContenidoSaving] = useState(false);
  /** Formulario «Asignar editor»: colapsado hasta que el usuario pulse agregar. */
  const [editorContenidoFormAbierto, setEditorContenidoFormAbierto] = useState(false);

  const [pendientes, setPendientes] = useState([]);
  const [pendientesLoading, setPendientesLoading] = useState(true);
  const [busquedaValidaciones, setBusquedaValidaciones] = useState('');
  const [busquedaRolesAdmin, setBusquedaRolesAdmin] = useState('');
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
  const [snapPendienteProfesores, setSnapPendienteProfesores] = useState(0);
  const [adminScopeMeta, setAdminScopeMeta] = useState(null);
  const [adminRolesRows, setAdminRolesRows] = useState([]);
  const [adminRolesLoading, setAdminRolesLoading] = useState(false);
  const [adminInvitacionesRows, setAdminInvitacionesRows] = useState([]);
  const [adminInvitacionesLoading, setAdminInvitacionesLoading] = useState(false);
  /** GET /api/admin/analytics-globales (solo super_admin, mismo ciclo que fetchData). */
  const [analyticsGlobales, setAnalyticsGlobales] = useState(null);
  const [inviteClubModalOpen, setInviteClubModalOpen] = useState(false);
  const [inviteAdminModalStep, setInviteAdminModalStep] = useState('tipo');
  const [inviteAdminTipo, setInviteAdminTipo] = useState(null);
  const [inviteClubSaving, setInviteClubSaving] = useState(false);
  const [inviteClubForm, setInviteClubForm] = useState({
    email: '',
    nombre_club: '',
    pais: '',
    provincia: '',
    ciudad: '',
  });
  /** Magic link Supabase Auth (fallback si el backend no lo devolvió al crear invitación). */
  const [inviteMagicLinkModal, setInviteMagicLinkModal] = useState(null);
  const [adminClubOnboardingOpen, setAdminClubOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!esAdminClub || loading) return;
    if (readOnboardingDone()) return;
    const t = window.setTimeout(() => setAdminClubOnboardingOpen(true), 450);
    return () => window.clearTimeout(t);
  }, [esAdminClub, loading]);

  const applyOnboardingTab = useCallback(
    (tabId) => {
      const id = sanitizeAdminActiveTab(tabId, rol);
      setActiveTab(id);
      try {
        sessionStorage.setItem('adminActiveTab', id);
      } catch {
        /* ignore */
      }
      navigate(`/admin?tab=${encodeURIComponent(id)}`, { replace: true });
    },
    [navigate, rol]
  );

  const [vistaReservasAdminTarjetas, setVistaReservasAdminTarjetas] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setVistaReservasAdminTarjetas(Boolean(mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  /** Tab Gestión de administradores: filas compactas en pantallas estrechas (~390px). */
  const [rolesTabViewportNarrow, setRolesTabViewportNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => setRolesTabViewportNarrow(Boolean(mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const cargarSedesPendientes = useCallback(
    async (estadoQuery = 'pendiente') => {
      if (!puedeVerSedesPendientes) return;
      setSedesPendientesLoading(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error(t('admin.formularios.noSession'));
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
        if (!token) throw new Error(t('admin.formularios.noSession'));
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

  const refreshSnapProfesoresPendientes = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return;
      const res = await fetch(`${apiBaseUrl}/api/admin/profesores-todos?estado=pendiente`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => []);
      setSnapPendienteProfesores(Array.isArray(j) ? j.length : 0);
    } catch {
      /* noop */
    }
  }, [apiBaseUrl, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) void refreshSnapProfesoresPendientes();
  }, [isSuperAdmin, refreshSnapProfesoresPendientes]);

  useEffect(() => {
    if (isSuperAdmin && activeTab === 'profesores') void refreshSnapProfesoresPendientes();
  }, [activeTab, isSuperAdmin, refreshSnapProfesoresPendientes]);

  const puedeUsarCampanita =
    isSuperAdmin || (esAdminClub && sedeId != null && sedeId !== '');

  const refreshCampanitaAlertas = useCallback(async () => {
    if (!puedeUsarCampanita) return;
    setCampanitaLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return;
      const data = await fetchAdminCampanitaAlertas({ accessToken: token });
      setCampanitaData(data);
      if (isSuperAdmin) {
        setSnapPendienteProfesores(data.instructoresPendientes);
        setSnapPendienteSedes(data.sedesPendientes);
      }
    } catch (e) {
      console.warn('[AdminDashboard] campanita:', e?.message || e);
    } finally {
      setCampanitaLoading(false);
    }
  }, [puedeUsarCampanita, isSuperAdmin]);

  useEffect(() => {
    if (!puedeUsarCampanita) return undefined;
    void refreshCampanitaAlertas();
    const id = window.setInterval(() => void refreshCampanitaAlertas(), 3 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [puedeUsarCampanita, refreshCampanitaAlertas]);

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
        if (!token) throw new Error(t('admin.formularios.noSession'));
        const res = await fetch(`${apiBaseUrl}/api/admin/solicitudes-licencia/${id}/rechazar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo: motivo || '' }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || res.statusText);
        setMensajeExito(t('admin.notif.requestRejected'));
        setTimeout(() => setMensajeExito(''), 3000);
        void refreshSnapPendientesOnly();
        refetchSolicitudesTabLists();
      } catch (e) {
        alert(e?.message || t('admin.alerts.rejectRequest'));
      }
    },
    [apiBaseUrl, refetchSolicitudesTabLists, refreshSnapPendientesOnly]
  );

  const abrirModalAprobarLicenciaWeb = useCallback((rawLicencia) => {
    const rawTipo = String(rawLicencia?.tipo_interes || '').trim();
    const pickDefault = TIPO_INTERES_APROBAR_SOLICITUD_LIC.includes(rawTipo) ? rawTipo : t('admin.sedes.affiliateClub');
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
      if (!token) throw new Error(t('admin.formularios.noSession'));
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
      alert(e?.message || t('admin.alerts.saveInterestType'));
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
      if (!token) throw new Error(t('admin.formularios.noSession'));
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

  const solicitarMagicLinkAdmin = useCallback(
    async ({ email, rol, nombre, sede_id }) => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error(t('admin.formularios.noSession'));
      const res = await fetch(`${apiBaseUrl}/api/admin/invite-magic-link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          rol,
          nombre: nombre || null,
          sede_id: sede_id ?? undefined,
          assign_role: rol === 'editor_contenido',
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      if (!j?.magic_link) throw new Error(t('admin.formularios.noMagicLink'));
      return j.magic_link;
    },
    [apiBaseUrl],
  );

  const asignarEditorContenido = useCallback(async () => {
    if (!isSuperAdmin) return;
    const email = String(editorContenidoEmail || '').trim().toLowerCase();
    if (!email) {
      alert(t('admin.alerts.emailRequired'));
      return;
    }
    setEditorContenidoSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error(t('admin.formularios.noSession'));
      const nombre = String(editorContenidoNombre || '').trim() || null;
      const res = await fetch(`${apiBaseUrl}/api/admin/roles`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: 'editor_contenido',
          nombre,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      let magicLink = j.magic_link || null;
      if (!magicLink) {
        try {
          magicLink = await solicitarMagicLinkAdmin({
            email,
            rol: 'editor_contenido',
            nombre,
          });
        } catch (mlErr) {
          console.warn('[AdminDashboard] magic link editor:', mlErr);
        }
      }
      if (magicLink) {
        setInviteMagicLinkModal({ email, magic_link: magicLink, contexto: 'editor_contenido' });
      }
      setMensajeExito(t('admin.notif.editorAssigned', { email }));
      setEditorContenidoEmail('');
      setEditorContenidoNombre('');
      setEditorContenidoFormAbierto(false);
      setTimeout(() => setMensajeExito(''), 4000);
      void cargarRolesAdmin();
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setEditorContenidoSaving(false);
    }
  }, [
    apiBaseUrl,
    cargarRolesAdmin,
    editorContenidoEmail,
    editorContenidoNombre,
    isSuperAdmin,
    solicitarMagicLinkAdmin,
  ]);

  const cargarInvitacionesAdmin = useCallback(async () => {
    if (!isSuperAdmin) return;
    setAdminInvitacionesLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error(t('admin.formularios.noSession'));
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
    const tipo = inviteAdminTipo || 'club';
    if (!email) {
      alert(t('admin.alerts.emailRequired'));
      return;
    }
    if (!pais) {
      alert(t('admin.alerts.countryRequired'));
      return;
    }
    if (tipo === 'ciudad_region') {
      const prov = String(inviteClubForm.provincia || '').trim();
      if (!prov) {
        alert(t('admin.alerts.provinceRequired'));
        return;
      }
    }
    setInviteClubSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error(t('admin.formularios.noSession'));
      const body = {
        tipo_invitacion: tipo,
        email,
        pais,
        nombre_club: String(inviteClubForm.nombre_club || '').trim() || null,
        provincia: String(inviteClubForm.provincia || '').trim() || undefined,
        ciudad: String(inviteClubForm.ciudad || '').trim() || undefined,
      };
      const res = await fetch(`${apiBaseUrl}/api/admin/invitaciones-admin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      let magicLink = j.magic_link || null;
      if (!magicLink) {
        try {
          magicLink = await solicitarMagicLinkAdmin({
            email,
            rol: inviteAdminTipoToRol(tipo),
            nombre: String(inviteClubForm.nombre_club || '').trim() || null,
          });
        } catch (mlErr) {
          console.warn('[AdminDashboard] magic link invitación:', mlErr);
        }
      }
      setInviteClubModalOpen(false);
      setInviteAdminModalStep('tipo');
      setInviteAdminTipo(null);
      setInviteClubForm({ email: '', nombre_club: '', pais: '', provincia: '', ciudad: '' });
      if (magicLink) {
        setInviteMagicLinkModal({ email, magic_link: magicLink, invite_url: j.invite_url || null, contexto: 'invitacion_admin' });
      }
      if (j.email_sent === false) {
        setMensajeExito(t('admin.notif.inviteCreatedNoEmail'));
      } else {
        setMensajeExito(t('admin.notif.inviteSent'));
      }
      setTimeout(() => setMensajeExito(''), 4000);
      void cargarInvitacionesAdmin();
    } catch (e) {
      alert(e?.message || t('admin.alerts.createInvite'));
    } finally {
      setInviteClubSaving(false);
    }
  }, [
    apiBaseUrl,
    cargarInvitacionesAdmin,
    inviteAdminTipo,
    inviteClubForm,
    isSuperAdmin,
    solicitarMagicLinkAdmin,
  ]);

  const reenviarInvitacionClub = useCallback(
    async (id) => {
      if (!isSuperAdmin || !id) return;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error(t('admin.formularios.noSession'));
        const res = await fetch(`${apiBaseUrl}/api/admin/invitaciones-admin/${encodeURIComponent(id)}/reenviar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || res.statusText);
        if (j.email_sent === false) {
          alert(t('admin.alerts.emailSendFailed'));
        } else {
          setMensajeExito(t('admin.notif.inviteResent'));
          setTimeout(() => setMensajeExito(''), 3500);
        }
        void cargarInvitacionesAdmin();
      } catch (e) {
        alert(e?.message || t('admin.alerts.resendInvite'));
      }
    },
    [apiBaseUrl, cargarInvitacionesAdmin, isSuperAdmin],
  );

  const revocarRolAdmin = useCallback(async (email) => {
    if (!isSuperAdmin) return;
    if (!window.confirm(t('admin.notif.revokeRoleConfirm', { email }))) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error(t('admin.formularios.noSession'));
      const res = await fetch(`${apiBaseUrl}/api/admin/roles/${encodeURIComponent(String(email || '').trim())}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setMensajeExito(t('admin.notif.roleRevoked'));
      setTimeout(() => setMensajeExito(''), 3500);
      void cargarRolesAdmin();
      void fetchData();
    } catch (e) {
      alert(e?.message || t('admin.alerts.revokeRole'));
    }
  }, [apiBaseUrl, isSuperAdmin, cargarRolesAdmin]);

  const aprobarSedePendiente = useCallback(
    async (id) => {
      if (!window.confirm(t('admin.notif.approveVenueConfirm'))) return;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error(t('admin.formularios.noSession'));
        const res = await fetch(`${apiBaseUrl}/api/admin/sedes-pendientes/${id}/aprobar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || res.statusText);
        setMensajeExito(t('admin.notif.venueApproved'));
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
      const motivo = window.prompt(t('admin.confirmaciones.rejectReasonPrompt'));
      if (motivo == null) return;
      const m = String(motivo).trim();
      if (!m) {
        alert(t('admin.alerts.rejectReasonRequired'));
        return;
      }
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error(t('admin.formularios.noSession'));
        const res = await fetch(`${apiBaseUrl}/api/admin/sedes-pendientes/${id}/rechazar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo: m }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || res.statusText);
        setMensajeExito(t('admin.notif.requestRejectedDot'));
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

  const pendientesFiltradosValidaciones = useMemo(() => {
    const q = String(busquedaValidaciones || '').trim().toLowerCase();
    if (!q) return pendientes;
    return pendientes.filter((j) => {
      const bits = [j.nombre, j.apellido, j.email].map((x) => String(x || '').trim().toLowerCase());
      return bits.some((b) => b.includes(q));
    });
  }, [pendientes, busquedaValidaciones]);

  const adminRolesRowsFiltrados = useMemo(() => {
    const legacyTemporal = (row) => {
      const em = String(row?.email || '').trim().toLowerCase();
      if (em === 'admin@padbol.com') return false;
      const nom = String(row?.nombre || '').trim().toLowerCase();
      if (nom.includes('admin temporal')) return false;
      return true;
    };
    const base = adminRolesRows.filter(legacyTemporal);
    const q = String(busquedaRolesAdmin || '').trim().toLowerCase();
    if (!q) return base;
    return base.filter((row) => {
      const bits = [row.nombre, row.email].map((x) => String(x || '').trim().toLowerCase());
      return bits.some((b) => b.includes(q));
    });
  }, [adminRolesRows, busquedaRolesAdmin]);

  const editorContenidoAsignado = useMemo(() => {
    const hit = adminRolesRows.find((r) => String(r?.role || '').trim().toLowerCase() === 'editor_contenido');
    return hit || null;
  }, [adminRolesRows]);

  const asignacionGestionAdminTexto = useCallback((row) => {
    if (String(row?.role || '').trim().toLowerCase() === 'editor_contenido') return t('admin.roles.editorScopeLabel');
    const ac = String(row?.alcance || '').trim().toLowerCase();
    if (ac === 'sede') return row.sede_nombre || `Sede ${row.sede_id || '—'}`;
    if (ac === 'ciudad') return row.ciudad || '—';
    if (ac === 'provincia') return row.provincia || '—';
    if (ac === 'pais') {
      const p = String(row.pais || '').trim();
      if (!p) return '—';
      const f = banderaEmojiDesdeNombrePais(p);
      const nombre = paisTextoSinBanderaInicial(p) || p;
      return f ? `${f} ${nombre}`.trim() : nombre;
    }
    if (ac === 'global') return t('admin.sponsors.scopeGlobal');
    return row?.alcance ? String(row.alcance) : '—';
  }, [t]);

  const textoRolGestionAdminCompleto = useCallback(
    (row) => {
      const badge = ROLE_BADGE[row.role] || row.role || '—';
      const alc = row.alcance || '—';
      const asig = asignacionGestionAdminTexto(row);
      return `${badge} · Alcance: ${alc} · ${asig}`;
    },
    [asignacionGestionAdminTexto],
  );

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
    if (esEditorContenido) {
      setLoading(false);
      return;
    }
    fetchData();
    fetchPendientes();
  }, [apiBaseUrl, rol, sedeId, session?.access_token, esEditorContenido]); // token: alcance correcto en GET torneos/reservas

  useEffect(() => {
    const raw = searchParams.get('tab');
    if (raw == null || String(raw).trim() === '') {
      setActiveTab(esEmpleado ? 'reservas' : esEditorContenido ? 'personalizar_hub' : 'resumen');
      return;
    }
    const t = sanitizeAdminActiveTab(raw, rol);
    setActiveTab((prev) => {
      if (prev === t) return prev;
      sessionStorage.setItem('adminActiveTab', t);
      return t;
    });
  }, [searchParams, esEmpleado, esEditorContenido, rol]);

  useEffect(() => {
    if (activeTab !== 'reservas') {
      setReservasSuperSubVista('principal');
      setRankingDetalleSedeKey(null);
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_NOTIFICACIONES_READ_LS_KEY, JSON.stringify(notificacionesLeidas.slice(-200)));
    } catch {
      /* noop */
    }
  }, [notificacionesLeidas]);

  useEffect(() => {
    if (!esAdminClub || sedeId == null || sedeId === '') return;
    setReservaManualForm((prev) => ({ ...prev, sede_id: String(sedeId) }));
  }, [esAdminClub, sedeId]);

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

    const reservasFiltradas = reservas.filter((r) => inP(fechaReservaDiaISO(r?.fecha)));

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
    const reservasPeriodo = reservas.filter((r) => inP(fechaReservaDiaISO(r?.fecha)));
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
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), t('nav.admin.resumen'));

      const reservasRows = dashboardFinanciero.reservasDetalle.map((r) => ({
        fecha: String(r?.fecha || '').slice(0, 10),
        hora: horarioReservaAdmin(r),
        cancha: r?.cancha ?? '',
        jugador: r?.nombre || '',
        monto: Number(r?.precio_calc) || 0,
        moneda: r?.moneda_calc || 'ARS',
        estado: r?.estado || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reservasRows), t('nav.admin.reservas'));

      const torneosRows = dashboardFinanciero.torneosDetalle.map((t) => ({
        nombre: t.nombre,
        fecha: String(t.fecha || '').slice(0, 10),
        equipos: t.equipos ?? 0,
        ingresos: Number(t.ingreso) || 0,
        moneda: t.moneda || 'ARS',
        estado: t.estado || '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(torneosRows), t('torneos.titulo'));

      const nombre = `financiero_${periodoNombre}_${String(finanzasAnclaISO || '').slice(0, 10) || 'reporte'}.xlsx`;
      XLSX.writeFile(wb, nombre);
    } catch (e) {
      console.error('[AdminDashboard] exportarFinanzasExcel:', e);
      alert(t('admin.alerts.excelFailed'));
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
          nombre: String(t?.nombre || t('admin.formularios.tournament')).trim() || t('admin.formularios.tournament'),
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
          nombre: String(t?.nombre || t('admin.formularios.tournament')).trim() || t('admin.formularios.tournament'),
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
          nombre: String(t.nombre || '').trim() || t('admin.formularios.tournament'),
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
          nombre: String(t.nombre || '').trim() || t('admin.formularios.tournament'),
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

  /** Métricas extra admin_club: ocupación horaria, semana vs semana, cancelación, deportes (solo `reservas` cargadas). */
  const adminClubMetricasExtra = useMemo(() => {
    if (!esAdminClub && !isSuperAdmin) return null;
    if (esAdminClub && (sedeId == null || sedeId === '')) return null;

    const inPeriodo = (r) =>
      fechaDentroDePeriodoFinanzas(
        fechaReservaDiaOCreatedISO(r),
        superAdminPeriodo,
        superAdminFechaDesde,
        superAdminFechaHasta,
        finanzasAnclaISO
      );

    const reservasPeriodo = reservas.filter(inPeriodo);
    const confirmadasPeriodo = reservasPeriodo.filter(
      (r) => String(r?.estado || '').trim().toLowerCase() === 'confirmada'
    );
    const activasPeriodo = reservasPeriodo.filter(
      (r) => String(r?.estado || '').trim().toLowerCase() !== 'cancelada'
    );

    const byHora = {};
    confirmadasPeriodo.forEach((r) => {
      const slot = horaFranjaReservaAdmin(r?.hora);
      if (!slot) return;
      byHora[slot] = (byHora[slot] || 0) + 1;
    });
    const totalConfirmadas = confirmadasPeriodo.length;
    const ocupacionHoraria = {
      rows: Object.keys(byHora)
        .sort((a, b) => a.localeCompare(b))
        .map((hora) => {
          const count = byHora[hora];
          const pct = totalConfirmadas > 0 ? Math.round((count / totalConfirmadas) * 100) : 0;
          return { hora, count, pct };
        }),
    };

    const hoy = new Date();
    const semActualStart = startOfWeekMondayLocal(hoy);
    const semActualEnd = endOfWeekSundayEndLocal(semActualStart);
    const semAnteriorStart = new Date(semActualStart);
    semAnteriorStart.setDate(semAnteriorStart.getDate() - 7);
    const semAnteriorEnd = endOfWeekSundayEndLocal(semAnteriorStart);

    const enSemana = (r, start, end) => diaCalendarioEnRangoLocal(fechaReservaDiaOCreatedISO(r), start, end);
    const activasNoCancel = (r) => String(r?.estado || '').trim().toLowerCase() !== 'cancelada';

    const resActual = reservas.filter((r) => enSemana(r, semActualStart, semActualEnd) && activasNoCancel(r));
    const resAnterior = reservas.filter((r) => enSemana(r, semAnteriorStart, semAnteriorEnd) && activasNoCancel(r));
    const ingresosActual = resActual.reduce((s, r) => s + (Number(r?.precio) || 0), 0);
    const ingresosAnterior = resAnterior.reduce((s, r) => s + (Number(r?.precio) || 0), 0);

    const canceladas = reservasPeriodo.filter(
      (r) => String(r?.estado || '').trim().toLowerCase() === 'cancelada'
    ).length;
    const totalPeriodo = reservasPeriodo.length;
    const cancelPct = totalPeriodo > 0 ? Math.round((canceladas / totalPeriodo) * 100) : 0;

    const depMap = {};
    activasPeriodo.forEach((r) => {
      const sidRes =
        esAdminClub && sedeId != null && sedeId !== ''
          ? String(sedeId)
          : (() => {
              const id = sedeIdDesdeNombreReserva(r?.sede, sedesMap);
              return id != null ? String(id) : '';
            })();
      const sedeNombre =
        (sidRes && String(sedesMap[sidRes]?.nombre || '').trim()) ||
        String(r?.sede || '').trim() ||
        'Sin sede';
      const dk =
        resolveDeporteKeyReservaAdmin(r, sidRes, canchasDetallePorSede) || `sede:${sedeNombre}`;
      depMap[dk] = (depMap[dk] || 0) + 1;
    });
    const depTotal = activasPeriodo.length;
    const deportesTop = Object.entries(depMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, count]) => {
        const label = key.startsWith('sede:')
          ? sedeNombre
          : deporteLabelAdminDash(key, t);
        const pct = depTotal > 0 ? Math.round((count / depTotal) * 100) : 0;
        return { key, label, count, pct };
      });

    const periodoLabel = labelNavegacionFinanzas(superAdminPeriodo, finanzasAnclaISO);

    return {
      periodoLabel,
      ocupacionHoraria,
      semanaCompare: {
        reservasActual: resActual.length,
        reservasAnterior: resAnterior.length,
        reservasPct: pctCambioSemana(resActual.length, resAnterior.length),
        ingresosActual,
        ingresosAnterior,
        ingresosPct: pctCambioSemana(ingresosActual, ingresosAnterior),
      },
      cancelacion: {
        total: totalPeriodo,
        canceladas,
        pct: cancelPct,
      },
      deportesTop,
    };
  }, [
    esAdminClub,
    isSuperAdmin,
    sedeId,
    reservas,
    superAdminPeriodo,
    superAdminFechaDesde,
    superAdminFechaHasta,
    finanzasAnclaISO,
    canchasDetallePorSede,
    sedesMap,
    t,
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
      let proximaTexto = t('admin.reservas.noBookingsToday');
      if (prox) {
        proximaTexto = `${horarioReservaAdmin(prox)} · ${String(prox.nombre || '').trim() || String(prox.email || '').trim() || 'Reserva'}`;
      } else if (ocupados > 0) {
        proximaTexto = t('admin.notif.noUpcomingToday');
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

  const adminNotificaciones = useMemo(() => {
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
    const items = [];
    const irATab = (tabId) => {
      setActiveTab(tabId);
      sessionStorage.setItem('adminActiveTab', tabId);
      navigate(`/admin?tab=${encodeURIComponent(tabId)}`, { replace: true });
    };
    const campanitaTs = campanitaData?.updatedAt ? new Date(campanitaData.updatedAt) : new Date();
    const campanitaTimeLabel = Number.isNaN(campanitaTs.getTime())
      ? ''
      : campanitaTs.toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    if (puedeUsarCampanita && campanitaData) {
      const pushCampanita = (id, category, categoryLabel, count, labelKey, onNavigate, tone = 'danger') => {
        if (!count || count <= 0) return;
        items.push({
          id,
          category,
          categoryLabel,
          tone,
          title: `${count} ${t(labelKey)}`,
          timestamp: campanitaTimeLabel,
          actionLabel: '→',
          onClick: onNavigate,
        });
      };
      const irAInstructoresClub = () => {
        irATab('mi_sede');
        window.setTimeout(() => {
          document.getElementById('admin-mi-sede-clases')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      };
      pushCampanita(
        `campanita-instructores-${campanitaData.instructoresPendientes}`,
        'instructores',
        t('admin.profesores.tab'),
        campanitaData.instructoresPendientes,
        'campanita.instructoresPendientes',
        isSuperAdmin ? () => irATab('profesores') : irAInstructoresClub,
      );
      if (isSuperAdmin) {
        pushCampanita(
          `campanita-sedes-${campanitaData.sedesPendientes}`,
          'sedes',
          t('admin.tabs.sedes'),
          campanitaData.sedesPendientes,
          'campanita.sedesPendientes',
          () => irATab('sedes'),
        );
      }
      pushCampanita(
        `campanita-pagos-${campanitaData.pagosFallidos}`,
        'pagos',
        t('admin.tabs.reservas'),
        campanitaData.pagosFallidos,
        'campanita.pagosFallidos',
        () => irATab('reservas'),
        'warning',
      );
      pushCampanita(
        `campanita-cancel-${campanitaData.cancelaciones24h}`,
        'cancelaciones',
        t('admin.tabs.reservas'),
        campanitaData.cancelaciones24h,
        'campanita.cancelaciones',
        () => irATab('reservas'),
        'info',
      );
    }
    if (isSuperAdmin && snapPendienteLic > 0) {
      const count = snapPendienteLic;
      items.push({
        id: `solicitudes-licencia-${count}`,
        tone: 'danger',
        title:
          count === 1
            ? t('admin.notif.pendingRequestsTitleOne')
            : t('admin.notif.pendingRequestsTitleMany', { count }),
        body: t('admin.notif.pendingRequestsBody'),
        actionLabel: t('admin.notif.goToRequests'),
        onClick: () => {
          setSolicitudesFiltroEstado('pendiente');
          irATab('solicitudes');
        },
      });
    }
    (p.alertasEquiposTorneoProximoSinConfirmar || []).forEach((a) => {
      items.push({
        id: `torneo-proximo-${a.torneoId}-${a.count}`,
        tone: 'warning',
        title: t('admin.notif.tournamentSoonTitle'),
        body: t('admin.notif.tournamentSoonBody', { count: a.count, name: a.nombre }),
        actionLabel: t('admin.notif.viewTournament'),
        onClick: () => navigate(`/torneo/${a.torneoId}`, { state: { fromAdmin: true } }),
      });
    });
    (p.alertasTorneosMenosDosConfirmados || []).forEach((a) => {
      items.push({
        id: `torneo-menos2-${a.torneoId}-${a.confirmados}`,
        tone: 'warning',
        title: t('admin.notif.registrationOpenTitle'),
        body: t('admin.notif.registrationOpenBody', { name: a.nombre, confirmed: a.confirmados }),
        actionLabel: t('admin.notif.viewTournament'),
        onClick: () => navigate(`/torneo/${a.torneoId}`, { state: { fromAdmin: true } }),
      });
    });
    (p.alertasTorneoSinSorteo48h || []).forEach((a) => {
      items.push({
        id: `torneo-sin-sorteo-${a.torneoId}`,
        tone: 'danger',
        title: t('admin.notif.startsSoonTitle'),
        body: t('admin.notif.startsSoonBody', { name: a.nombre, date: formatFecha(a.fecha_inicio) }),
        actionLabel: t('admin.notif.viewTournament'),
        onClick: () => navigate(`/torneo/${a.torneoId}`, { state: { fromAdmin: true } }),
      });
    });
    if ((p.equiposPendientePagoCount || 0) > 0) {
      items.push({
        id: `equipos-pago-pendiente-${p.equiposPendientePagoCount}`,
        tone: 'warning',
        title: t('admin.notif.pendingRegistrationsTitle'),
        body: t('admin.notif.pendingRegistrationsBody', { count: p.equiposPendientePagoCount }),
        actionLabel: t('admin.notif.goToTournaments'),
        onClick: () => irATab('torneos'),
      });
    }
    (p.alertasEquiposSinConfirmarCierre48h || []).forEach((a) => {
      items.push({
        id: `cierre-inscripcion-${a.torneoId}-${a.count}`,
        tone: 'warning',
        title: t('admin.notif.registrationClosingTitle'),
        body: t('admin.notif.registrationClosingBody', { count: a.count, name: a.nombre }),
        actionLabel: t('admin.notif.viewTournament'),
        onClick: () => navigate(`/torneo/${a.torneoId}`, { state: { fromAdmin: true } }),
      });
    });
    if (puedeVerFinanzas) {
      alertasContratosPorVencer.forEach((a) => {
        items.push({
          id: `contrato-vencer-${a.sedeId}-${a.fecha_vencimiento}`,
          tone: 'warning',
          title: t('admin.notif.contractExpiringTitle'),
          body: t('admin.notif.contractExpiringBody', {
            venue: a.sedeNombre,
            date: formatFecha(a.fecha_vencimiento),
            days: a.days,
          }),
        });
      });
      alertasSuscripcionBilling.forEach((a) => {
        if (a.tipo === 'vencida') {
          items.push({
            id: `suscripcion-vencida-${a.sedeId}`,
            tone: 'danger',
            title: t('admin.notif.subscriptionExpiredTitle'),
            body: t('admin.notif.subscriptionExpiredBody', { venue: a.sedeNombre }),
            actionLabel: t('admin.notif.goToVenues'),
            onClick: () => irATab(t('admin.metricas.venuesCount')),
          });
        } else {
          items.push({
            id: `suscripcion-proxima-${a.sedeId}-${a.fecha}`,
            tone: 'info',
            title: t('admin.notif.subscriptionDueTitle'),
            body: t('admin.notif.subscriptionDueBody', {
              venue: a.sedeNombre,
              date: formatProximoCobroAdmin(a.fecha),
            }),
          });
        }
      });
    }
    return items;
  }, [
    resumenPanelDiario,
    contratosBySedeId,
    sedesMap,
    isSuperAdmin,
    navigate,
    puedeVerFinanzas,
    snapPendienteSedes,
    snapPendienteLic,
    campanitaData,
    puedeUsarCampanita,
    esAdminClub,
    setSolicitudesFiltroEstado,
    t,
  ]);

  const adminNotificacionesAgrupadas = useMemo(() => {
    const groups = new Map();
    const otros = [];
    for (const n of adminNotificaciones) {
      if (n.category) {
        const key = n.category;
        if (!groups.has(key)) {
          groups.set(key, { key, label: n.categoryLabel || key, items: [] });
        }
        groups.get(key).items.push(n);
      } else {
        otros.push(n);
      }
    }
    const ordered = [];
    for (const k of ['instructores', 'sedes', 'pagos', 'cancelaciones']) {
      if (groups.has(k)) ordered.push(groups.get(k));
    }
    for (const [k, g] of groups) {
      if (!['instructores', 'sedes', 'pagos', 'cancelaciones'].includes(k)) ordered.push(g);
    }
    if (otros.length) {
      ordered.push({ key: 'otros', label: t('admin.notifications.title'), items: otros });
    }
    return ordered;
  }, [adminNotificaciones, t]);

  const notificacionesNoLeidas = useMemo(() => {
    const leidas = new Set(notificacionesLeidas);
    return adminNotificaciones.filter((n) => !leidas.has(String(n.id))).length;
  }, [adminNotificaciones, notificacionesLeidas]);

  const marcarNotificacionLeida = useCallback((id) => {
    const key = String(id || '');
    if (!key) return;
    setNotificacionesLeidas((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const resumenOperativoSecciones = useMemo(() => {
    const p = resumenPanelDiario;
    return (
      <>
        <div className="section admin-resumen-hoy" style={{ marginBottom: '18px', color: 'var(--text-primary)' }}>
          <h2 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Hoy</h2>
          <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '14px' }}>{p.fechaLabelHoy}</p>
          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <div className="admin-resumen-hoy-kicker" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Reservas ({p.reservasHoy})
              </div>
              {p.reservasHoyOrdenadas.length === 0 ? (
                <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>{t('admin.metrics.noBookingsToday')}</p>
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
                          <strong>{horarioReservaAdmin(r)}</strong>
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
            {puedeVerFinanzas ? <div>
              <div className="admin-resumen-hoy-kicker" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Ingresos del día (por moneda de cada sede)
              </div>
              <p className="admin-resumen-hoy-ingresos-valor" style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{p.ingresosHoyTexto}</p>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Suma de precios de reservas de hoy no canceladas.
              </p>
            </div> : null}
            <div>
              <div className="admin-resumen-hoy-kicker" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Canchas ahora (hora Argentina)
              </div>
              {p.ocupacionSedes.length === 0 ? (
                <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>{t('admin.metrics.noVenuesScope')}</p>
              ) : isSuperAdmin ? (
                <p className="admin-resumen-hoy-canchas-copy" style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.4 }}>
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
                        background: 'var(--bg-card)',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <strong style={{ color: 'var(--text-primary)' }}>{row.nombre}</strong>
                      {row.sinCanchasRegistradas ? (
                        <div style={{ marginTop: '6px', color: '#b45309', fontSize: '13px' }}>
                          Sin canchas cargadas en el sistema. Registralas en «Mi sede» para ver ocupación vs disponibles.
                        </div>
                      ) : (
                        <div style={{ marginTop: '6px', color: 'var(--text-primary)' }}>
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
      </>
    );
  }, [
    resumenPanelDiario,
    puedeVerFinanzas,
    isSuperAdmin,
  ]);

  const fetchPendientes = async () => {
    setPendientesLoading(true);
    const { data, error } = await supabase
      .from('jugadores_perfil')
      .select('email, nombre, apellido, alias, user_id, pais, nivel, genero')
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
    if (!window.confirm(t('admin.notif.deleteTournamentConfirm', { name: torneoNombre }))) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/torneos/${torneoId}`, { method: 'DELETE' });
      if (res.ok) {
        setTorneos(prev => prev.filter(t => t.id !== torneoId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(t('admin.alerts.deleteTournament') + ' ' + (data.error || res.statusText));
      }
    } catch (err) {
      alert(t('admin.alerts.genericError') + ' ' + err.message);
    }
  };

  const [editandoTorneoId, setEditandoTorneoId] = useState(null);
  const [editTorneoForm, setEditTorneoForm] = useState({});
  const [savingTorneo, setSavingTorneo] = useState(false);
  const [puntosDistribucionTorneo, setPuntosDistribucionTorneo] = useState(null);
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
      alert(e?.message || t('admin.alerts.loadTeams'));
    }
  }, [apiBaseUrl]);

  /** Sorteo de grupos solo con torneo en inscripción / abierto (antes de `en_curso`). */
  const torneoEstadoPermiteSorteoGrupos = (est) => {
    const e = String(est || '').toLowerCase();
    return e === 'abierto' || e === 'inscripcion_abierta';
  };

  const torneosFiltradosAdminEstado = useMemo(() => {
    let list = torneos;
    if (!esFiltroTorneoEstadoTodos(filtroEstadoTorneoAdmin)) {
      list = list.filter((tr) => torneoPasaFiltroEstadoVista(tr, filtroEstadoTorneoAdmin));
    }
    const dep = String(filtroDeporteTorneoAdmin || '').trim().toLowerCase();
    if (dep && dep !== 'todos') {
      list = list.filter((tr) => normalizeTorneoDeporte(tr.deporte) === dep);
    }
    return list;
  }, [torneos, filtroEstadoTorneoAdmin, filtroDeporteTorneoAdmin]);

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
      if (!sedeMatchesSuperAdminBusqueda(s, sedesSuperAdminBusquedaTexto)) return false;
      return true;
    });
  }, [isSuperAdmin, sedesSuperAdminLista, sedeMobileFiltroPais, sedeMobileFiltroCiudad, sedesSuperAdminBusquedaTexto]);

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
  }, [sedeMobileFiltroPais, sedeMobileFiltroCiudad, sedesSuperAdminBusquedaTexto]);

  const sedeSuperAdminDetalleModal = useMemo(() => {
    if (!isSuperAdmin || sedeDetalleAbiertoId == null) return null;
    const id = Number(sedeDetalleAbiertoId);
    return sedesSuperAdminLista.find((x) => Number(x.id) === id) || null;
  }, [isSuperAdmin, sedeDetalleAbiertoId, sedesSuperAdminLista]);

  useEffect(() => {
    if (activeTab !== t('admin.metricas.venuesCount')) setSedeDetalleAbiertoId(null);
  }, [activeTab]);

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
          .select('email, nombre, apellido, alias, user_id, pais, nivel, foto_url, es_federado')
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
    const permitidas = new Set(['resumen', 'torneos', t('admin.metricas.venuesCount'), 'jugadores']);
    if (permitidas.has(activeTab)) return;
    setActiveTab('resumen');
    navigate('/admin?tab=resumen', { replace: true });
  }, [esAdminNacional, activeTab, navigate]);

  useEffect(() => {
    if (!esEmpleado) return;
    const permitidas = new Set(['reservas', 'torneos']);
    if (permitidas.has(activeTab)) return;
    setActiveTab('reservas');
    navigate('/admin?tab=reservas', { replace: true });
  }, [esEmpleado, activeTab, navigate]);

  useEffect(() => {
    if (isSuperAdmin || esEditorContenido) return;
    if (activeTab !== 'personalizar_hub' && activeTab !== 'sponsors') return;
    setActiveTab('resumen');
    navigate('/admin?tab=resumen', { replace: true });
  }, [isSuperAdmin, esEditorContenido, activeTab, navigate]);

  useEffect(() => {
    if (!esEditorContenido) return;
    if (EDITOR_CONTENIDO_TABS_ALLOWED.has(activeTab)) return;
    setActiveTab('personalizar_hub');
    navigate('/admin?tab=personalizar_hub', { replace: true });
  }, [esEditorContenido, activeTab, navigate]);

  // ── Config puntos (superAdmin only) ──
  const CONFIG_NIVELES_DEFAULT       = { club_no_oficial: 10, club_oficial: 30, nacional: 100, internacional: 300, mundial: 1000 };
  const CONFIG_POSICIONES_DEFAULT    = { 1: 30, 2: 20, 3: 15, 4: 12, 5: 8, 6: 6, 7: 4, 8: 3, 9: 1, 10: 1 };
  const CONFIG_NIVELES_LABELS_DEFAULT = { club_no_oficial: t('admin.sedes.unofficialClub'), club_oficial: t('admin.sedes.officialClub'), nacional: t('admin.sedes.national'), internacional: t('admin.sedes.international'), mundial: t('admin.sedes.world') };
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
      if (res.ok) { setConfigMsg(t('admin.metricas.configSaved')); }
      else        { setConfigMsg(t('admin.metricas.localSaveServerError')); }
    } catch {
      setConfigMsg(t('admin.metricas.offlineLocalOnly'));
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
        alert(t('admin.alerts.loginToSave'));
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
        if (!res.ok) throw new Error(j.error || t('admin.metricas.saveFailed'));
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
      inscripcion_monto:
        torneo.inscripcion_monto != null && torneo.inscripcion_monto !== ''
          ? String(torneo.inscripcion_monto)
          : torneo.costo_inscripcion != null && Number(torneo.costo_inscripcion) > 0
            ? String(torneo.costo_inscripcion)
            : '',
      inscripcion_moneda:
        ['ARS', 'USD', 'EUR'].includes(String(torneo.inscripcion_moneda || torneo.moneda || 'ARS').toUpperCase())
          ? String(torneo.inscripcion_moneda || torneo.moneda || 'ARS').toUpperCase()
          : 'ARS',
      premios_descripcion: torneo.premios_descripcion || '',
      puntos_total:
        torneo.puntos_total != null && torneo.puntos_total !== '' ? String(torneo.puntos_total) : '',
      deporte: normalizeTorneoDeporte(torneo.deporte) || TORNEO_DEPORTE_PADBOL,
      formato_equipo: torneo.formato_equipo || TORNEO_FORMATO_DOBLES,
    });
  };

  const guardarTorneo = async (torneoId) => {
    if (!String(editTorneoForm.categoria || '').trim()) {
      alert(t('admin.alerts.selectCategory'));
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
      const dep = normalizeTorneoDeporte(String(editTorneoForm.deporte || TORNEO_DEPORTE_PADBOL).trim()) || TORNEO_DEPORTE_PADBOL;
      const body = {
        ...editTorneoForm,
        sede_id: editTorneoForm.sede_id ? parseInt(editTorneoForm.sede_id) : null,
        categoria: String(editTorneoForm.categoria || '').trim() || CATEGORIA_TORNEO_DEFAULT,
        estado: mapEstadoTorneoFormParaApi(editTorneoForm.estado || 'proximo'),
        deporte: dep,
        formato_equipo: formatoEquipoPayloadParaApi(dep, editTorneoForm.formato_equipo),
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
      alert(t('admin.alerts.genericError') + ' ' + err.message);
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
            .from(t('admin.metricas.venuesCount'))
            .select(
              'id, nombre, ciudad, pais, moneda, licencia_activa, numero_licencia, horario_apertura, horario_cierre, duracion_reserva_minutos, cantidad_canchas'
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
      if (!Array.isArray(resData)) {
        console.warn('[Admin] GET /api/reservas: respuesta no es array', resData);
        resData = [];
      }

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

      if (isSuperAdmin && session?.access_token) {
        try {
          const ar = await fetch(`${apiBaseUrl}/api/admin/analytics-globales`, {
            headers: { ...listAuthHeaders },
          });
          const j = await ar.json().catch(() => null);
          if (ar.ok && j && typeof j === 'object' && !Array.isArray(j)) {
            setAnalyticsGlobales(j);
          } else {
            setAnalyticsGlobales(null);
          }
        } catch {
          setAnalyticsGlobales(null);
        }
      } else {
        setAnalyticsGlobales(null);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setAnalyticsGlobales(null);
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
    setMensajeExito(
      t('admin.notif.venueCreated', {
        name: String(j.nombre || '').trim() || t('admin.sedes.newVenueFallback'),
      }),
    );
    setTimeout(() => setMensajeExito(''), 4000);
    void fetchData();
  };

  const iniciarEdicion = (reserva) => {
    setEditandoId(reserva.id);
    setEditFormData({ ...reserva, duracion: duracionReservaAdmin(reserva), estado: reserva.estado || 'reservada' });
    setMensajeExito('');
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditFormData({});
  };

  const invalidateReservaHistorialCache = useCallback((reservaId) => {
    setReservaHistorialUi((p) => {
      const next = { ...p };
      delete next[reservaId];
      return next;
    });
  }, []);

  const abrirHistorialReserva = useCallback(
    async (reservaId) => {
      setReservaHistorialUi((p) => ({
        ...p,
        [reservaId]: { open: true, loading: true, rows: [], error: null },
      }));
      try {
        if (!session?.access_token) throw new Error(t('admin.formularios.noSession'));
        const res = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}/historial`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || res.statusText);
        const rows = Array.isArray(json) ? json : [];
        setReservaHistorialUi((p) => ({
          ...p,
          [reservaId]: { open: true, loading: false, rows, error: null },
        }));
      } catch (err) {
        setReservaHistorialUi((p) => ({
          ...p,
          [reservaId]: {
            open: true,
            loading: false,
            rows: [],
            error: err.message || String(err),
          },
        }));
      }
    },
    [apiBaseUrl, session?.access_token],
  );

  const cerrarHistorialReserva = useCallback((reservaId) => {
    setReservaHistorialUi((p) => ({
      ...p,
      [reservaId]: { ...(p[reservaId] || {}), open: false },
    }));
  }, []);

  const guardarEdicion = async (reservaId) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const response = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        invalidateReservaHistorialCache(reservaId);
        setMensajeExito(t('admin.reservas.bookingUpdated'));
        setEditandoId(null);
        setTimeout(() => {
          fetchData();
          setMensajeExito('');
        }, 1500);
      } else {
        alert(t('admin.alerts.updateError'));
      }
    } catch (err) {
      alert(t('admin.alerts.genericError') + ' ' + err.message);
    }
  };

  const confirmarPagoManualReserva = async (reservaId) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const response = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ estado: 'confirmada' }),
      });
      if (response.ok) {
        invalidateReservaHistorialCache(reservaId);
        setMensajeExito(t('admin.reservas.inPersonPaymentConfirmed'));
        setTimeout(() => {
          fetchData();
          setMensajeExito('');
        }, 900);
      } else {
        const j = await response.json().catch(() => ({}));
        alert(j.error || t('admin.reservas.paymentConfirmFailed'));
      }
    } catch (err) {
      alert(t('admin.alerts.genericError') + ' ' + err.message);
    }
  };

  const mostrarQrReservaAdmin = async (r) => {
    const rid = r?.id;
    if (rid == null) return;
    const est = String(r?.estado || '').trim().toLowerCase();
    if (est !== 'confirmada' && est !== 'completada') return;
    setReservaQrModal({ reserva: r, qr_token: null, error: null });
    setReservaQrModalLoading(true);
    try {
      const headers = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const response = await fetch(`${apiBaseUrl}/api/reservas/${encodeURIComponent(rid)}/generar-qr`, {
        method: 'POST',
        headers,
      });
      const j = await response.json().catch(() => ({}));
      if (!response.ok) {
        setReservaQrModal({ reserva: r, qr_token: null, error: j?.error || 'No se pudo generar el QR' });
        return;
      }
      setReservaQrModal({
        reserva: r,
        qr_token: String(j?.qr_token || '').trim() || null,
        error: null,
      });
    } catch (err) {
      setReservaQrModal({ reserva: r, qr_token: null, error: err.message || 'Error de red' });
    } finally {
      setReservaQrModalLoading(false);
    }
  };

  const descargarQrReservaAdmin = () => {
    const canvas = reservaQrCanvasRef.current?.querySelector('canvas');
    const token = reservaQrModal?.qr_token;
    if (!canvas || !token) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `checkin-reserva-${reservaQrModal?.reserva?.id || 'qr'}.png`;
    a.click();
  };

  const resetReservaManualForm = () => {
    setReservaManualForm({
      sede_id: esAdminClub && sedeId != null && sedeId !== '' ? String(sedeId) : '',
      cancha: '',
      fecha: new Date().toISOString().slice(0, 10),
      hora: '',
      duracion: '90',
      nombre: '',
      telefono: '',
      estado: 'confirmada',
    });
    setReservaManualError('');
  };

  const crearReservaManual = async (ev) => {
    ev.preventDefault();
    setReservaManualError('');
    if (!session?.access_token) {
      setReservaManualError(t('admin.formularios.loginAgainAgain'));
      return;
    }
    const payload = {
      sede_id: reservaManualForm.sede_id,
      cancha: reservaManualForm.cancha,
      fecha: reservaManualForm.fecha,
      hora: reservaManualForm.hora,
      duracion: reservaManualForm.duracion,
      nombre: String(reservaManualForm.nombre || '').trim(),
      telefono: String(reservaManualForm.telefono || '').trim() || null,
      estado: reservaManualForm.estado || 'confirmada',
    };
    if (!payload.sede_id || !payload.cancha || !payload.fecha || !payload.hora || !payload.nombre) {
      setReservaManualError(t('admin.reservas.completeManualBookingFields'));
      return;
    }
    setReservaManualSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/reservas/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t('admin.reservas.manualBookingFailed'));
      setMensajeExito(t('admin.reservas.manualBookingCreated'));
      setReservaManualOpen(false);
      resetReservaManualForm();
      await fetchData();
      setTimeout(() => setMensajeExito(''), 3500);
    } catch (err) {
      setReservaManualError(err.message || String(err));
    } finally {
      setReservaManualSaving(false);
    }
  };

  const ejecutarCancelarReservaAdmin = async (reservaId) => {
    try {
      const headers = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const response = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        setMensajeExito(t('admin.reservas.bookingCancelled'));
        setTimeout(() => {
          fetchData();
          setMensajeExito('');
        }, 1500);
      } else {
        alert('Error al cancelar');
      }
    } catch (err) {
      alert(t('admin.alerts.genericError') + ' ' + err.message);
    }
  };

  // ── Mi Sede (admin_club + admin_nacional only) ──
  const puedeVerMiSede = (esAdminClub || esAdminNacional || isSuperAdmin) && sedeId;
  const [miSede,        setMiSede]        = useState(null);
  const [miSedeLoading, setMiSedeLoading] = useState(false);
  const [miSedeForm,    setMiSedeForm]    = useState({});
  const [miSedeSaving,  setMiSedeSaving]  = useState(false);
  const [miSedeInstalacionesSaving, setMiSedeInstalacionesSaving] = useState(false);
  const [miSedeInstalacionesMsg, setMiSedeInstalacionesMsg] = useState('');
  const [miSedePreciosSaving, setMiSedePreciosSaving] = useState(false);
  const [miSedePreciosMsg, setMiSedePreciosMsg] = useState('');
  const [miSedeDuraciones, setMiSedeDuraciones] = useState([]);
  const [miSedeDuracionesLoading, setMiSedeDuracionesLoading] = useState(false);
  const [miSedeDuracionesMsg, setMiSedeDuracionesMsg] = useState('');
  const [miSedeDuracionDrafts, setMiSedeDuracionDrafts] = useState({});
  const [miSedeDuracionGuardandoId, setMiSedeDuracionGuardandoId] = useState(null);
  const [suscripcionEstadoSuperSavingId, setSuscripcionEstadoSuperSavingId] = useState(null);
  const [stripeOnboardingLoading, setStripeOnboardingLoading] = useState(false);
  const [cancelReservaModalId, setCancelReservaModalId] = useState(null);
  const [reservaQrModal, setReservaQrModal] = useState(null);
  const [reservaQrModalLoading, setReservaQrModalLoading] = useState(false);
  const reservaQrCanvasRef = useRef(null);
  const [suscripcionModal, setSuscripcionModal] = useState({
    open: false,
    clientSecret: null,
    sedeNombre: '',
    sedeId: null,
  });
  const [miSedeMsg,     setMiSedeMsg]     = useState('');
  const [pagosMpPanelAbierto, setPagosMpPanelAbierto] = useState(false);
  const [pagosMpAccessTokenVisible, setPagosMpAccessTokenVisible] = useState(false);
  const [pagosMpPublicKeyVisible, setPagosMpPublicKeyVisible] = useState(false);
  const [pagosStripePanelAbierto, setPagosStripePanelAbierto] = useState(false);
  const [pagosParcialSaving, setPagosParcialSaving] = useState(false);
  const [editarSedeModalOpen, setEditarSedeModalOpen] = useState(false);
  const [editarSedeDraft, setEditarSedeDraft] = useState({});
  const [editarSedeModalMsg, setEditarSedeModalMsg] = useState('');
  const [canchas,       setCanchas]       = useState([]);
  const [canchaModalOpen, setCanchaModalOpen] = useState(false);
  const [canchaModalMode, setCanchaModalMode] = useState('add');
  const [canchaEditId, setCanchaEditId] = useState(null);
  const [canchaModalDraft, setCanchaModalDraft] = useState({ nombre: '', estado: 'activa', descripcion: '', deporte: 'padbol' });
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
  const adminTabsStripRef = useRef(null);
  const adminMainScrollRef = useRef(null);
  const [miSedeNavActive, setMiSedeNavActive] = useState('info');
  const miSedeNavItems = useMemo(() => {
    const items = [
      { id: 'info', label: t('admin.sedes.clubInfo') },
      { id: 'precios', label: t('admin.sedes.pricesByDuration') },
      { id: 'canchas', label: t('admin.formularios.courtsCol') },
      { id: 'horarios', label: t('admin.franjas.slotsAndPricesTitle') },
    ];
    if (esAdminClub || isSuperAdmin) items.push({ id: 'extras', label: t('admin.sedes.halftimeExtras') });
    if (esAdminClub || isSuperAdmin) items.push({ id: 'clases', label: t('admin.profesores.clasesYInstructores') });
    if (esAdminClub || isSuperAdmin) items.push({ id: 'pagos', label: t('admin.sedes.paymentSettings') });
    items.push({ id: 'contrato', label: t('admin.sedes.images') });
    return items;
  }, [esAdminClub, isSuperAdmin, t]);
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
  const [heroToast, setHeroToast] = useState('');
  /** Cupos de sponsors con scope sede (Mi Sede, lectura). */
  const [miSedeSponsorSlots, setMiSedeSponsorSlots] = useState({
    loading: false,
    used: 0,
    max: 0,
    planLabel: '',
    usedConfigFallback: false,
    error: null,
  });

  useEffect(() => {
    if (loading) return;
    const el = adminTabsStripRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;
      const nextLeft = el.scrollLeft + e.deltaY;
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft >= maxScroll - 1;
      if ((e.deltaY < 0 && atStart && nextLeft <= 0) || (e.deltaY > 0 && atEnd && nextLeft >= maxScroll)) {
        return;
      }
      e.preventDefault();
      el.scrollLeft = nextLeft;
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
      supabase.from(t('admin.metricas.venuesCount')).select('*').eq('id', sedeId).maybeSingle(),
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
    if (activeTab !== 'mi_sede' || !sedeId || !session?.access_token) {
      setMiSedeDuraciones([]);
      setMiSedeDuracionesLoading(false);
      return;
    }
    let cancelled = false;
    setMiSedeDuracionesLoading(true);
    setMiSedeDuracionesMsg('');
    fetch(`${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/duraciones`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || r.statusText);
        return Array.isArray(j.duraciones) ? j.duraciones : [];
      })
      .then((list) => {
        if (cancelled) return;
        setMiSedeDuraciones(list);
      })
      .catch((e) => {
        if (!cancelled) {
          setMiSedeDuraciones([]);
          setMiSedeDuracionesMsg(e?.message || t('admin.sedes.durationsLoadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setMiSedeDuracionesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, sedeId, apiBaseUrl, session?.access_token]);

  useEffect(() => {
    const next = {};
    for (const r of miSedeDuraciones) {
      next[r.id] = {
        precio: r.precio != null ? String(r.precio) : '',
        activo: !!r.activo,
      };
    }
    setMiSedeDuracionDrafts(next);
  }, [miSedeDuraciones]);

  useEffect(() => {
    if (activeTab !== 'mi_sede' || !sedeId || !miSede) {
      setMiSedeSponsorSlots((p) => ({ ...p, loading: false }));
      return;
    }
    if (!puedeVerMiSede || esEditorContenido) {
      setMiSedeSponsorSlots((p) => ({ ...p, loading: false }));
      return;
    }

    let cancelled = false;
    setMiSedeSponsorSlots((p) => ({ ...p, loading: true, error: null, usedConfigFallback: false }));

    (async () => {
      try {
        const [cfgRes, plansRes, spRes] = await Promise.all([
          supabase
            .from('sponsor_config')
            .select('max_por_sede_starter, max_por_sede_pro, max_por_sede_elite')
            .eq('id', 1)
            .maybeSingle(),
          supabase
            .from('plan_pricing')
            .select('nombre, canchas_min, canchas_max')
            .eq('activo', true)
            .order('canchas_min', { ascending: true }),
          supabase
            .from('sponsors')
            .select('id')
            .eq('scope', 'sede')
            .eq('sede_id', Number(sedeId))
            .eq('activo', true)
            .eq('aprobado', true),
        ]);
        if (cancelled) return;

        const usedConfigFallback = Boolean(cfgRes.error) || !cfgRes.data;
        const base = { ...DEFAULT_SPONSOR_CUPOS };
        if (cfgRes.data) {
          base.max_por_sede_starter =
            Number(cfgRes.data.max_por_sede_starter) || DEFAULT_SPONSOR_CUPOS.max_por_sede_starter;
          base.max_por_sede_pro = Number(cfgRes.data.max_por_sede_pro) || DEFAULT_SPONSOR_CUPOS.max_por_sede_pro;
          base.max_por_sede_elite =
            Number(cfgRes.data.max_por_sede_elite) || DEFAULT_SPONSOR_CUPOS.max_por_sede_elite;
        }

        const plans = !plansRes.error && Array.isArray(plansRes.data) ? plansRes.data : [];
        const planLabel = resolveSedeCommercialPlanNombre(miSede, plans);
        const max = Math.max(0, maxPorSedeSegunNombrePlan(planLabel, base));
        const used = Array.isArray(spRes.data) ? spRes.data.length : 0;

        if (spRes.error) {
          setMiSedeSponsorSlots({
            loading: false,
            used: 0,
            max: 0,
            planLabel: '',
            usedConfigFallback,
            error: spRes.error.message || String(spRes.error),
          });
          return;
        }

        setMiSedeSponsorSlots({
          loading: false,
          used,
          max,
          planLabel,
          usedConfigFallback,
          error: null,
        });
      } catch (e) {
        if (!cancelled) {
          setMiSedeSponsorSlots({
            loading: false,
            used: 0,
            max: 0,
            planLabel: '',
            usedConfigFallback: true,
            error: e?.message || String(e),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, sedeId, miSede, puedeVerMiSede, esEditorContenido]);

  useEffect(() => {
    if (!sedeId || !esAdminClub) return;
    supabase.from(t('admin.metricas.venuesCount'))
      .select('numero_licencia, licencia_activa')
      .eq('id', sedeId)
      .maybeSingle()
      .then(({ data }) => { if (data) setSedeStatus(data); });
  }, [sedeId, esAdminClub]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarMiSede = async () => {
    if (!sedeId || !session?.access_token) {
      setMiSedeMsg(`⚠️ ${t('admin.formularios.loginAgainAlt')}`);
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
        errorMsg = data.error || res.statusText || t('admin.metricas.saveError');
      } else {
        updated = data.sede;
      }
    } catch (e) {
      errorMsg = e?.message || String(e);
    }
    setMiSedeSaving(false);
    setMiSedeMsg(errorMsg ? `⚠️ ${errorMsg}` : t('admin.sedes.venueUpdated'));
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
        pushCambio(t('admin.sedes.addressLocation'), prev.direccion, miSedeForm.direccion),
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
        pushCambio(t('admin.sedes.contactEmail'), prev.email_contacto, miSedeForm.email_contacto),
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


  const guardarInstalacionesMiSede = async (amenitiesOverride) => {
    if (!sedeId || !session?.access_token) {
      setMiSedeInstalacionesMsg('⚠️ Inicia sesión de nuevo');
      setTimeout(() => setMiSedeInstalacionesMsg(''), 4000);
      return;
    }
    setMiSedeInstalacionesSaving(true);
    setMiSedeInstalacionesMsg('');
    const amenities = normalizeSedeAmenities(
      amenitiesOverride != null ? amenitiesOverride : miSedeForm.amenities
    );
    let errorMsg = null;
    let updated = null;
    try {
      const res = await fetch(`${apiBaseUrl}/api/sedes/${sedeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amenities }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorMsg = data.error || res.statusText || t('admin.metricas.saveError');
      } else {
        updated = data.sede;
      }
    } catch (e) {
      errorMsg = e?.message || String(e);
    }
    setMiSedeInstalacionesSaving(false);
    setMiSedeInstalacionesMsg(errorMsg ? `⚠️ ${errorMsg}` : '✅ Instalaciones guardadas');
    setTimeout(() => setMiSedeInstalacionesMsg(''), errorMsg ? 5000 : 3000);
    if (!errorMsg && updated) {
      setMiSede(updated);
      setMiSedeForm((f) => ({ ...f, amenities: normalizeSedeAmenities(updated.amenities) }));
    }
  };


  const guardarPreciosDuracion = async () => {
    if (!sedeId || !session?.access_token) {
      setMiSedePreciosMsg(`⚠️ ${t('admin.formularios.loginAgainAlt')}`);
      setTimeout(() => setMiSedePreciosMsg(''), 4000);
      return;
    }
    setMiSedePreciosSaving(true);
    setMiSedePreciosMsg('');
    const body = preciosDuracionToApiPatch(miSedeForm);
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
        errorMsg = data.error || res.statusText || t('admin.metricas.saveError');
      } else {
        updated = data.sede ?? data;
      }
    } catch (e) {
      errorMsg = e?.message || String(e);
    }
    setMiSedePreciosSaving(false);
    if (errorMsg) {
      setMiSedePreciosMsg(`⚠️ ${errorMsg}`);
      setTimeout(() => setMiSedePreciosMsg(''), 5000);
      return;
    }
    const successMsg = t('admin.sedes.pricesSaved').startsWith('✅')
      ? t('admin.sedes.pricesSaved')
      : `✅ ${t('admin.sedes.pricesSaved')}`;
    setMiSedePreciosMsg(successMsg);
    if (updated && (updated.id != null || updated.nombre != null)) {
      setMiSede(updated);
      const preciosForm = miSedeFormPreciosFromSedeRow(updated);
      setMiSedeForm((f) => ({ ...f, ...preciosForm }));
      setSedesMap((m) => ({ ...m, [String(updated.id)]: { ...(m[String(updated.id)] || {}), ...updated } }));
      if (session?.access_token) {
        fetch(`${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/duraciones`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
          .then((r) => r.json())
          .then((j) => {
            const rows = Array.isArray(j.duraciones) ? j.duraciones : [];
            setMiSedeDuraciones(rows);
            const drafts = {};
            for (const r of rows) {
              drafts[r.id] = {
                precio: r.precio != null ? String(r.precio) : '',
                activo: !!r.activo,
              };
            }
            setMiSedeDuracionDrafts(drafts);
          })
          .catch(() => {});
      }
    }
  };

  const guardarMiSedeFilaDuracion = async (rowId) => {
    if (!sedeId || !session?.access_token) {
      setMiSedeDuracionesMsg(t('admin.formularios.loginAgainAlt'));
      setTimeout(() => setMiSedeDuracionesMsg(''), 4000);
      return;
    }
    const draft = miSedeDuracionDrafts[rowId];
    if (!draft) return;
    const pr = parseInt(String(draft.precio || '').replace(/\D/g, ''), 10);
    if (!Number.isFinite(pr) || pr < 0) {
      setMiSedeDuracionesMsg(t('admin.formularios.validPriceRequired'));
      setTimeout(() => setMiSedeDuracionesMsg(''), 4000);
      return;
    }
    setMiSedeDuracionGuardandoId(rowId);
    setMiSedeDuracionesMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/duraciones/${encodeURIComponent(rowId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ precio: pr, activo: !!draft.activo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      const d = j.duracion;
      if (d && d.id != null) {
        setMiSedeDuraciones((prev) => prev.map((x) => (Number(x.id) === Number(d.id) ? { ...x, ...d } : x)));
      } else {
        const refetch = await fetch(`${apiBaseUrl}/api/sedes/${encodeURIComponent(sedeId)}/duraciones`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const jr = await refetch.json().catch(() => ({}));
        if (refetch.ok && Array.isArray(jr.duraciones)) setMiSedeDuraciones(jr.duraciones);
      }
      setMiSedeDuracionesMsg(t('admin.metricas.savedOk'));
      setTimeout(() => setMiSedeDuracionesMsg(''), 2500);
    } catch (e) {
      setMiSedeDuracionesMsg(e?.message || String(e));
      setTimeout(() => setMiSedeDuracionesMsg(''), 5000);
    } finally {
      setMiSedeDuracionGuardandoId(null);
    }
  };

  const guardarSedeCamposPagosParcial = useCallback(
    async (partial) => {
      if (!sedeId || !session?.access_token) {
        setMiSedeMsg(`⚠️ ${t('admin.formularios.loginAgainAlt')}`);
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
        setMiSedeMsg(t('admin.sedes.paymentsUpdated'));
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
      setEditarSedeModalMsg(t('admin.formularios.loginAgainAlt'));
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
        setEditarSedeModalMsg(data.error || res.statusText || t('admin.metricas.saveError'));
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
            pushCambio(t('admin.sedes.addressLocation'), prev.direccion, editarSedeDraft.direccion),
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
            pushCambio(t('admin.sedes.contactEmail'), prev.email_contacto, editarSedeDraft.email_contacto),
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
        setMiSedeMsg(t('admin.sedes.venueUpdated'));
        setTimeout(() => setMiSedeMsg(''), 3000);
      }
    } catch (e) {
      setMiSedeSaving(false);
      setEditarSedeModalMsg(e?.message || String(e));
    }
  };

  const iniciarStripeOnboarding = useCallback(async () => {
    if (!sedeId || !session?.access_token) {
      alert(t('admin.formularios.loginStripeConnect'));
      return;
    }
    setStripeOnboardingLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/stripe/onboarding/${sedeId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || t('admin.formularios.stripeLinkFailed'));
      if (j.url) {
        window.location.href = j.url;
        return;
      }
      throw new Error(t('admin.formularios.noOnboardingUrl'));
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
        alert(t('admin.formularios.stripeKeyMissing'));
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
          alert(j.error || t('admin.formularios.subscriptionStartFailed'));
          return;
        }
        if (!j.client_secret) {
          alert(t('admin.formularios.noClientSecret'));
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
          alert(j.error || t('admin.formularios.statusUpdateFailed'));
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
    const { error } = await supabase.from(t('admin.metricas.venuesCount')).update({
      numero_licencia: licenciaForm.numero_licencia || null,
      fecha_licencia:  licenciaForm.fecha_licencia  || null,
      licencia_activa: licenciaForm.licencia_activa,
    }).eq('id', sedeId);
    setLicenciaSaving(false);
    setLicenciaMsg(error ? `⚠️ ${error.message}` : t('admin.sedes.licenseUpdated'));
    setTimeout(() => setLicenciaMsg(''), 3000);
    if (!error && prev) {
      const secret = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_PADBOL_SEDE_CRITICO_NOTIFY_SECRET : '';
      const cambios = [];
      const sa = (v) => (v == null || v === '' ? '' : String(v));
      const sbBool = (v) => (v ? 'activa' : 'suspendida');
      if (sa(prev.numero_licencia) !== sa(licenciaForm.numero_licencia)) {
        cambios.push({ campo: t('admin.sedes.licenseNumber'), anterior: sa(prev.numero_licencia) || '—', nuevo: sa(licenciaForm.numero_licencia) || '—' });
      }
      if (sa(prev.fecha_licencia) !== sa(licenciaForm.fecha_licencia)) {
        cambios.push({ campo: t('admin.sedes.licenseDate'), anterior: sa(prev.fecha_licencia) || '—', nuevo: sa(licenciaForm.fecha_licencia) || '—' });
      }
      if (Boolean(prev.licencia_activa) !== Boolean(licenciaForm.licencia_activa)) {
        cambios.push({
          campo: t('admin.sedes.licenseStatus'),
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
      setLogoMsg(t('admin.sedes.fileOver2mb'));
      return;
    }
    if (!String(file.type || '').startsWith('image/')) {
      setLogoMsg(t('admin.formularios.chooseImageWarnShort'));
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

  const aplicarLogoUrlEnPanel = useCallback(
    (publicUrl) => {
      const base = String(publicUrl || '').trim();
      if (!base) return;
      const bust = `${base}${base.includes('?') ? '&' : '?'}t=${Date.now()}`;
      setLogoUrl(bust);
      setMiSede((prev) => (prev ? { ...prev, logo_url: base } : prev));
      setSedesMap((prev) => {
        const sid = String(sedeId);
        const row = prev[sid];
        if (!row) return { ...prev, [sid]: { id: sedeId, logo_url: base } };
        return { ...prev, [sid]: { ...row, logo_url: base } };
      });
    },
    [sedeId],
  );

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
    const urlGuardar = String(publicUrl || '').trim();
    if (!urlGuardar) {
      setLogoMsg('⚠️ No se obtuvo URL pública del logo');
      setLogoUploading(false);
      return;
    }
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('No autorizado');
      const res = await fetch(`${apiBaseUrl}/api/admin/sedes/${encodeURIComponent(String(sedeId))}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ logo_url: urlGuardar }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo guardar el logo');
      const savedUrl = String(j?.sede?.logo_url || urlGuardar).trim();
      aplicarLogoUrlEnPanel(savedUrl);
      setLogoMsg(t('admin.sedes.logoGuardado'));
      window.setTimeout(() => setLogoMsg(''), 3000);
    } catch (e) {
      setLogoMsg(`⚠️ ${e?.message || 'Error al guardar'}`);
    } finally {
      setLogoUploading(false);
    }
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
      setLogoMsg(`⚠️ ${e?.message || t('admin.sedes.cropError')}`);
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
      setFotosMsg(t('admin.sedes.maxPhotosAllowed', { max: MAX_FOTOS_SEDE }));
      if (uploadingPrimed) {
        setFotosUploading(false);
        setFotosUploadLabel('');
      }
      return;
    }
    const toProcess = picked.slice(0, espacio);
    if (picked.length > espacio) {
      setFotosMsg(
        t('admin.sedes.photosRemaining', {
          count: espacio,
          unit: espacio === 1 ? t('admin.sedes.photosRemainingOne') : t('admin.sedes.photosRemainingMany'),
        }),
      );
    } else {
      setFotosMsg('');
    }
    if (!uploadingPrimed) {
      setFotosUploading(true);
      setFotosUploadLabel(t('admin.sedes.uploadingPhotos'));
    }
    const n = toProcess.length;
    let completed = 0;
    const failures = [];
    const urlsOk = [];

    const uploadOne = async (file, index) => {
      const name = file.name || `foto-${index}`;
      if (file.size > 2 * 1024 * 1024) {
        failures.push(t('admin.sedes.fileOver2mbName', { name }));
        completed += 1;
        setFotosUploadLabel(t('admin.sedes.uploadingPhotosProgress', { done: completed, total: n }));
        return;
      }
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${sedeId}/fotos/${Date.now()}_${index}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(t('admin.metricas.venuesCount'))
        .upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (uploadError) {
        failures.push(`${name}: ${uploadError.message}`);
      } else {
        const {
          data: { publicUrl },
        } = supabase.storage.from(t('admin.metricas.venuesCount')).getPublicUrl(path);
        urlsOk.push({ index, url: publicUrl });
      }
      completed += 1;
      setFotosUploadLabel(t('admin.sedes.uploadingPhotosProgress', { done: completed, total: n }));
    };

    await Promise.all(toProcess.map((f, i) => uploadOne(f, i)));
    urlsOk.sort((a, b) => a.index - b.index);
    const merged = [...fotosUrls, ...urlsOk.map((x) => x.url)];
    if (urlsOk.length) {
      await supabase.from(t('admin.metricas.venuesCount')).update({ fotos_urls: merged }).eq('id', sedeId);
      setFotosUrls(merged);
    }
    setFotosUploading(false);
    setFotosUploadLabel('');
    if (failures.length && urlsOk.length) {
      setFotosMsg(t('admin.sedes.photosPartialUploadFail', { details: failures.join(' · ') }));
    } else if (failures.length) {
      setFotosMsg(t('admin.sedes.photosUploadFail', { details: failures.join(' · ') }));
    } else if (urlsOk.length) {
      setFotosMsg(
        urlsOk.length === 1
          ? t('admin.sedes.onePhotoAdded')
          : t('admin.sedes.nPhotosAdded', { count: urlsOk.length }),
      );
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
    const invalida = payload.find((f) => {
      if (!f.hora_inicio || !f.hora_fin) return true;
      if (f.tipo === 'fecha_especial') return !f.fecha;
      return !Array.isArray(f.dias) || f.dias.length === 0;
    });
    if (invalida) {
      setFranjasSaving(false);
      setFranjasMsg(t('admin.franjas.completeSlotFields'));
      setTimeout(() => setFranjasMsg(''), 4000);
      return;
    }
    const { error } = await supabase.from(t('admin.metricas.venuesCount')).update({ franjas_horarias: payload }).eq('id', sedeId);
    setFranjasSaving(false);
    if (error) {
      setFranjasMsg(`⚠️ ${error.message}`);
    } else {
      setFranjasMsg(t('admin.franjas.slotsSaved'));
      setFranjasHorarias(normalizeFranjasHorarias(payload));
      setMiSede((prev) => (prev ? { ...prev, franjas_horarias: payload } : prev));
    }
    setTimeout(() => setFranjasMsg(''), 3000);
  };

  const persistFotosDestacadas = async (nextDestacadas, { successMessage } = {}) => {
    if (!sedeId || !session?.access_token) {
      setFotosDestacadasMsg(`⚠️ ${t('admin.formularios.loginAgainAlt')}`);
      setTimeout(() => setFotosDestacadasMsg(''), 4000);
      return false;
    }
    const arr = nextDestacadas.filter((u) => fotosUrls.includes(u)).slice(0, 4);
    setFotosDestacadasSaving(true);
    setFotosDestacadasMsg('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/sedes/${encodeURIComponent(String(sedeId))}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ fotos_destacadas: arr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFotosDestacadasMsg(`⚠️ ${data.error || res.statusText || t('admin.metricas.saveError')}`);
        setTimeout(() => setFotosDestacadasMsg(''), 4000);
        return false;
      }
      const saved = Array.isArray(data.sede?.fotos_destacadas)
        ? data.sede.fotos_destacadas.map((u) => String(u || '').trim()).filter(Boolean)
        : arr;
      setFotosDestacadas(saved.filter((u) => fotosUrls.includes(u)).slice(0, 4));
      setMiSede((prev) =>
        prev
          ? {
              ...prev,
              fotos_destacadas: saved,
              updated_at: data.sede?.updated_at ?? prev.updated_at,
            }
          : prev,
      );
      if (successMessage) {
        setFotosDestacadasMsg(successMessage);
        setTimeout(() => setFotosDestacadasMsg(''), 3000);
      }
      return true;
    } catch (e) {
      setFotosDestacadasMsg(`⚠️ ${e?.message || String(e)}`);
      setTimeout(() => setFotosDestacadasMsg(''), 4000);
      return false;
    } finally {
      setFotosDestacadasSaving(false);
    }
  };

  const usarComoHero = async (url) => {
    const heroKey = String(url || '').trim();
    const heroActual = fotosDestacadas[0] || null;
    if (heroActual && heroActual === heroKey) return;
    const prev = fotosDestacadas.filter((u) => fotosUrls.includes(u));
    const next = [heroKey, ...prev.filter((u) => u !== heroKey)].slice(0, 4);
    const ok = await persistFotosDestacadas(next);
    if (ok) {
      setHeroToast('Hero actualizado');
      window.setTimeout(() => setHeroToast(''), 2600);
    }
  };

  const guardarFotosDestacadas = async () => {
    await persistFotosDestacadas(fotosDestacadas, { successMessage: '✅ Destacadas guardadas' });
  };

  const toggleDestacadaFoto = (url) => {
    setFotosDestacadas((prev) => {
      const i = prev.indexOf(url);
      if (i >= 0) return prev.filter((u) => u !== url);
      if (prev.length >= 4) {
        window.setTimeout(() => {
          setFotosDestacadasMsg(t('admin.sedes.carouselMaxFour'));
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
      await supabase.storage.from(t('admin.metricas.venuesCount')).remove([storagePath]);
    }
    const newFotos = fotosUrls.filter((u) => u !== url);
    await supabase.from(t('admin.metricas.venuesCount')).update({ fotos_urls: newFotos }).eq('id', sedeId);
    setFotosUrls(newFotos);
    setFotosDestacadas((prev) => prev.filter((u) => u !== url));
  };

  const abrirModalCanchaNueva = useCallback(() => {
    setCanchaModalMode('add');
    setCanchaEditId(null);
    setCanchaModalDraft({ nombre: '', estado: 'activa', descripcion: '', deporte: 'padbol' });
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
      deporte: c.deporte && CANCHA_DEPORTE_ADMIN_VALUES.includes(c.deporte) ? c.deporte : 'padbol',
    });
    setCanchaModalMsg('');
    setCanchaModalOpen(true);
  }, []);

  const guardarCanchaModal = async () => {
    if (!sedeId || !session?.access_token) {
      setCanchaModalMsg(t('admin.formularios.loginAgainAlt'));
      return;
    }
    const nombre = String(canchaModalDraft.nombre || '').trim();
    if (!nombre) {
      setCanchaModalMsg(t('admin.formularios.nameRequired'));
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
            deporte: canchaModalDraft.deporte || 'padbol',
          }),
        });
        const data = await res.json().catch(() => ({}));
        setCanchaApiBusy(false);
        if (!res.ok) {
          setCanchaModalMsg(data.error || res.statusText || t('admin.alerts.createError'));
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
          deporte: canchaModalDraft.deporte || 'padbol',
        }),
      });
      const data = await res.json().catch(() => ({}));
      setCanchaApiBusy(false);
      if (!res.ok) {
        setCanchaModalMsg(data.error || res.statusText || t('admin.metricas.saveError'));
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
        alert(data.error || t('admin.alerts.statusChangeFailed'));
        return;
      }
      if (data.cancha) {
        setCanchas((prev) => prev.map((c) => (c.id === canchaRow.id ? { ...c, ...data.cancha } : c)));
      }
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  const handleVolverHubDesdeAdmin = async () => {
    clearAdminNavContext();
    try {
      await refreshSession();
    } catch {
      /* ignore */
    }
    navigate('/');
  };

  if (loading && !esEditorContenido) {
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
          padding: `${hubContentPaddingTopCss(location.pathname, navDock)} 20px ${hubMainPaddingBottomCss(location.pathname, navDock)}`,
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <AppHeader title="" showBack={false} adminPanelMinimalHeader contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
        Cargando...
      </div>
    );
  }

  if (esEditorContenido) {
    return (
      <div
        className="admin-dashboard"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          maxHeight: '100dvh',
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          overscrollBehavior: 'none',
          boxSizing: 'border-box',
        }}
      >
        <AppHeader title="" showBack={false} adminPanelMinimalHeader contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
        <div
          ref={adminMainScrollRef}
          className="admin-dashboard-main-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
            paddingBottom: `calc(12px + ${HUB_CONTENT_PADDING_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`,
            boxSizing: 'border-box',
          }}
        >
          <div className="admin-dashboard-brand-shell">
          <div className="admin-header" style={{ marginTop: 0, paddingTop: 0 }}>
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 0,
              }}
            >
              <img
                src="/logo-padbol-match.png"
                alt="Padbol Match"
                style={{
                  ...padbolLogoImgStyle,
                  display: 'block',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  width: '120px',
                  height: 'auto',
                  maxWidth: '120px',
                  objectFit: 'contain',
                  borderRadius: '16px',
                  marginTop: HUB_LOGO_CLEARANCE_TOP_PX,
                  marginBottom: '10px',
                }}
              />
              <p className="admin-super-header__title" style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, textAlign: 'center' }}>
                Editor de contenido
              </p>
              <p
                className="admin-super-header__date"
                style={{
                  margin: '0 0 16px',
                  fontSize: '13px',
                  textAlign: 'center',
                  maxWidth: 380,
                  lineHeight: 1.45,
                }}
              >
                {t('admin.panel.editorDescription')}
              </p>
              <button
                type="button"
                onClick={handleVolverHubDesdeAdmin}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  marginBottom: 16,
                }}
              >
                {t('admin.panel.backToHub')}
              </button>
            </div>
          </div>
          </div>
          <div
            ref={adminTabsStripRef}
            className="admin-dashboard-tabs-strip"
            style={{
              marginTop: '8px',
              marginBottom: '24px',
              paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
              position: 'sticky',
              top: 0,
              zIndex: 100,
            }}
          >
            {[
              { id: 'personalizar_hub', label: t('admin.tabs.personalizarHub') },
              { id: 'sponsors', label: t('admin.tabs.sponsors') },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  sessionStorage.setItem('adminActiveTab', tab.id);
                  navigate(`/admin?tab=${encodeURIComponent(tab.id)}`, { replace: true });
                }}
                style={{
                  padding: '10px 18px',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '3px solid var(--accent)' : '3px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                  color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '14px',
                  marginBottom: '-2px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div
            className="admin-dashboard-body-surface"
            style={{
              ...hubInstagramColumnWrapStyle,
              paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
            }}
          >
            {activeTab === 'personalizar_hub' ? (
              <AdminHubPersonalizarSection
                apiBaseUrl={apiBaseUrl}
                accessToken={session?.access_token}
                isSuperAdmin={isSuperAdmin}
              />
            ) : null}
            {activeTab === 'sponsors' ? (
              <AdminSponsorsSection isSuperAdmin={false} canDelete={false} canManageCupos={false} canAutoApprove />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const fechaActualLarga = (() => {
    const dateLocale = i18n.language?.startsWith('en') ? 'en-US' : 'es-AR';
    const s = new Date().toLocaleDateString(dateLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  })();

  const TABS = esEmpleado
    ? [
        { id: 'reservas', label: t('admin.tabs.reservas') },
        { id: 'torneos', label: t('admin.tabs.torneos') },
      ]
    : esAdminNacional
    ? [
        { id: 'resumen', label: t('nav.admin.resumen') },
        { id: 'torneos', label: t('torneos.titulo') },
        { id: t('admin.metricas.venuesCount'), label: t('admin.tabs.sedes') },
        { id: 'jugadores', label: t('admin.tabs.jugadores') },
      ]
    : [
        { id: 'resumen', label: t('admin.tabs.resumen') },
        ...(isSuperAdmin ? [{ id: t('admin.metricas.venuesCount'), label: t('admin.tabs.sedes') }] : []),
        ...(isSuperAdmin ? [{ id: 'solicitudes', label: t('admin.tabs.solicitudes') }] : []),
        ...(isSuperAdmin
          ? [{ id: 'profesores', label: t('admin.tabs.profesoresTab'), badge: snapPendienteProfesores, badgeRed: true }]
          : []),
        ...(isSuperAdmin ? [{ id: 'personalizar_hub', label: t('admin.tabs.personalizarHub') }] : []),
        { id: 'torneos', label: t('admin.tabs.torneos') },
        { id: 'reservas', label: t('admin.tabs.reservas') },
        { id: 'validaciones', label: t('admin.tabs.validaciones'), badge: pendientes.length },
        ...(puedeVerMiSede ? [{ id: 'mi_sede', label: t('admin.tabs.miSede') }] : []),
        ...(puedeVerConfig
          ? [
              { id: 'config', label: t('admin.tabs.config') },
              { id: 'planes', label: t('admin.tabs.planes') },
              { id: 'roles', label: t('admin.tabs.roles') },
            ]
          : []),
      ];

  const sedeClubHeader =
    sedeId != null && sedeId !== ''
      ? Object.values(sedesMap).find((s) => mismoIdSede(s.id, sedeId)) || null
      : null;
  const tituloPanelAdmin = (() => {
    if (isSuperAdmin) {
      return t('admin.panel.superTitle');
    }
    if (esAdminClub && sedeClubHeader?.nombre) {
      return t('admin.panel.clubTitle', { name: sedeClubHeader.nombre });
    }
    if (esAdminNacional) {
      return t('admin.panel.nationalTitle');
    }
    const badge = ROLE_BADGE[rol] || 'Admin';
    return t('admin.panel.genericTitle', {
      role: badge.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+\s*/, '').trim(),
    });
  })();
  const logoPanelSrc = (() => {
    const clubLogo =
      (logoUrl && String(logoUrl).trim()) ||
      (miSede?.logo_url && String(miSede.logo_url).trim()) ||
      (sedeClubHeader?.logo_url && String(sedeClubHeader.logo_url).trim()) ||
      '';
    if (esAdminClub && clubLogo) return clubLogo;
    return '/logo-padbol-match.png';
  })();

  return (
    <div
      className={isSuperAdmin ? 'admin-dashboard admin-dashboard--super' : 'admin-dashboard'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        maxHeight: '100dvh',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="" showBack={false} adminPanelMinimalHeader contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
      <div
        ref={adminMainScrollRef}
        className="admin-dashboard-main-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
          paddingBottom: `calc(12px + ${HUB_CONTENT_PADDING_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`,
          boxSizing: 'border-box',
        }}
      >
      <div className="admin-dashboard-brand-shell">
      <div className="admin-header" style={{ marginTop: 0, paddingTop: 0 }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 0 }}>
          <div className="admin-super-header__logo-wrap">
            <img className="admin-super-header__logo" src={logoPanelSrc} alt="" />
          </div>
          <p
            className="admin-super-header__title"
            style={{
              margin: '0 0 12px',
              fontSize: '18px',
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {tituloPanelAdmin}
          </p>
          <p
            className="admin-super-header__date"
            style={{
              margin: '0 0 10px',
              fontSize: '12px',
              textAlign: 'center',
            }}
          >
            {fechaActualLarga}
          </p>
          {puedeUsarCampanita ? (
          <div className={`admin-campanita-wrap${campanitaLoading ? ' admin-campanita-wrap--loading' : ''}`} style={{ position: 'relative', marginBottom: '12px' }}>
            <button
              type="button"
              className="admin-super-header__bell admin-campanita-bell"
              aria-label={t('admin.notifications.aria', { count: notificacionesNoLeidas })}
              aria-expanded={notificacionesOpen}
              onClick={() => setNotificacionesOpen((v) => !v)}
            >
              <IconGeroNotificacionesNav size={28} aria-hidden />
              {campanitaLoading ? <span className="admin-campanita-bell__loader" aria-hidden /> : null}
              {notificacionesNoLeidas > 0 ? (
                <span className="admin-campanita-bell__badge">
                  {notificacionesNoLeidas > 99 ? '99+' : notificacionesNoLeidas}
                </span>
              ) : null}
            </button>
            {notificacionesOpen ? (
              <div className="admin-campanita-panel" role="dialog" aria-label={t('nav.notificaciones')}>
                <div className="admin-campanita-panel__header">
                  <strong className="admin-campanita-panel__title">{t('admin.notifications.title')}</strong>
                  {adminNotificaciones.length > 0 ? (
                    <button
                      type="button"
                      className="admin-campanita-panel__mark-all"
                      onClick={() => setNotificacionesLeidas(adminNotificaciones.map((n) => String(n.id)))}
                    >
                      {t('campanita.marcarLeido')}
                    </button>
                  ) : null}
                </div>
                {adminNotificaciones.length === 0 ? (
                  <div className="admin-campanita-panel__empty">
                    <span className="admin-campanita-panel__empty-icon" aria-hidden>
                      ✓
                    </span>
                    <p>{t('campanita.sinAlertas')}</p>
                  </div>
                ) : (
                  <div className="admin-campanita-panel__body">
                    {adminNotificacionesAgrupadas.map((group) => (
                      <section key={group.key} className="admin-campanita-group">
                        <h4 className="admin-campanita-group__title">{group.label}</h4>
                        {group.items.map((n) => {
                          const leida = notificacionesLeidas.includes(String(n.id));
                          return (
                            <button
                              key={n.id}
                              type="button"
                              className={`admin-campanita-row admin-campanita-row--${n.tone || 'info'}${leida ? ' admin-campanita-row--read' : ''}`}
                              onClick={() => {
                                marcarNotificacionLeida(n.id);
                                setNotificacionesOpen(false);
                                if (typeof n.onClick === 'function') n.onClick();
                              }}
                            >
                              <span className="admin-campanita-row__icon" aria-hidden>
                                {n.category === 'instructores'
                                  ? '🎓'
                                  : n.category === 'sedes'
                                    ? '🏟️'
                                    : n.category === 'pagos'
                                      ? '💳'
                                      : n.category === 'cancelaciones'
                                        ? '❌'
                                        : '🔔'}
                              </span>
                              <span className="admin-campanita-row__main">
                                <span className="admin-campanita-row__text">{n.title}</span>
                                {n.body ? <span className="admin-campanita-row__sub">{n.body}</span> : null}
                                {n.timestamp ? (
                                  <span className="admin-campanita-row__time">{n.timestamp}</span>
                                ) : null}
                              </span>
                              <span className="admin-campanita-row__arrow" aria-hidden>
                                →
                              </span>
                            </button>
                          );
                        })}
                      </section>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          ) : null}
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
                      background: 'var(--bg-input)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
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
                      boxShadow: '0 1px 6px rgba(15,23,42,0.1)',
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
                    background: 'var(--bg-input)',
                    color: 'var(--accent)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
                  }}
                >
                  ⚠️ Licencia Suspendida
                </span>
              </div>
            );
          })() : null}
        </div>
      </div>

      {/* Tab navigation — scroll horizontal (mobile); dentro del bloque marca */}
      <div
        ref={adminTabsStripRef}
        className="admin-dashboard-tabs-strip"
        style={{
          marginTop: '8px',
          marginBottom: '24px',
          paddingTop: 0,
          paddingBottom: 0,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
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
              borderBottom: activeTab === tab.id ? '3px solid var(--accent)' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
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
                background: tab.badgeRed ? '#dc2626' : 'var(--accent)',
                color: 'var(--bg-card)',
                borderRadius: '50%',
                minWidth: '18px',
                height: '18px',
                padding: '0 4px',
                fontSize: '11px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      </div>

      <div
        className="admin-dashboard-body-surface"
        style={{
          ...hubInstagramColumnWrapStyle,
          paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
        }}
      >
      {isSuperAdmin && ['resumen', t('admin.metricas.venuesCount')].includes(activeTab) && (
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
              background: '#E11B22',
              color: '#fff',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(225, 27, 34, 0.35)',
            }}
          >
            ➕ Nueva sede
          </button>
        </div>
      )}

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
                  ⚠️ Tu suscripción venció. Regulariza el pago para evitar interrupciones.
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
                  🔴 Segundo aviso: tu cuenta será suspendida en breve si no regularizas.
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
              color: 'var(--text-primary)',
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
                <h2>{t('admin.metrics.totalVenues')}</h2>
                <p className="count">{sedesNacionalLista.length}</p>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>{t('admin.metrics.venuesScope')}</p>
              </div>
              <div className="card torneos">
                <h2>{t('admin.metrics.totalPlayers')}</h2>
                <p className="count">{nacionalJugadoresLoading ? '…' : totalJugadoresPais}</p>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>{t('admin.metrics.playersScope')}</p>
              </div>
              <div className="card torneos">
                <h2>{t('admin.metrics.activeTournaments')}</h2>
                <p className="count">{torneosActivosNacionalCount}</p>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>{t('admin.metrics.activeTournamentsHint')}</p>
              </div>
            </div>
            {resumenOperativoSecciones}
          </>
        </>
      ) : (
        <>
        {isSuperAdmin ? (
          <div
            className="section admin-analytics-globales"
            style={{
              marginBottom: '22px',
              borderRadius: '14px',
              padding: '18px 20px',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '14px', fontSize: '18px' }}>
              Analytics globales
            </h2>
            {!analyticsGlobales ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>{t('admin.metrics.loadingMetrics')}</p>
            ) : (
              <>
                <div className="dashboard-grid" style={{ marginBottom: '18px' }}>
                  <div className="card reservas" style={{ padding: '22px 18px' }}>
                    <h2 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>{t('admin.metrics.registeredPlayers')}</h2>
                    <p className="count" style={{ fontSize: '2.2rem' }}>
                      {(Number(analyticsGlobales.jugadores_registrados_total) || 0).toLocaleString('es-AR')}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.82rem' }}>{t('admin.metrics.onPlatform')}</p>
                  </div>
                  <div className="card torneos" style={{ padding: '22px 18px' }}>
                    <h2 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>{t('admin.metrics.newPlayersMonth')}</h2>
                    <p className="count" style={{ fontSize: '2.2rem' }}>
                      {(Number(analyticsGlobales.jugadores_nuevos_este_mes) || 0).toLocaleString('es-AR')}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.82rem' }}>
                      Mes calendario UTC · {new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="card ingresos" style={{ padding: '22px 18px' }}>
                    <h2 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>{t('admin.metrics.activeVenues')}</h2>
                    <p className="count" style={{ fontSize: '2.2rem' }}>
                      {(Number(analyticsGlobales.sedes_activas_total) || 0).toLocaleString('es-AR')}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.82rem' }}>{t('admin.metrics.activeVenuesHint')}</p>
                  </div>
                  <div className="card torneos" style={{ padding: '22px 18px' }}>
                    <h2 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>{t('admin.metrics.finishedTournaments')}</h2>
                    <p className="count" style={{ fontSize: '2.2rem' }}>
                      {(Number(analyticsGlobales.torneos_finalizados_total) || 0).toLocaleString('es-AR')}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.82rem' }}>{t('admin.metrics.finishedHint')}</p>
                  </div>
                  <div className="card reservas" style={{ padding: '22px 18px' }}>
                    <h2 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>{t('admin.metrics.bookings30d')}</h2>
                    <p className="count" style={{ fontSize: '2.2rem' }}>
                      {(Number(analyticsGlobales.reservas_ultimo_mes_total) || 0).toLocaleString('es-AR')}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.82rem' }}>{t('admin.metrics.bookings30dHint')}</p>
                  </div>
                  <div className="card ingresos" style={{ padding: '22px 18px' }}>
                    <h2 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>{t('admin.metrics.topSport')}</h2>
                    <p className="count" style={{ fontSize: '1.65rem', lineHeight: 1.25, wordBreak: 'break-word' }}>
                      {String(analyticsGlobales.deporte_mas_popular?.label || '—')}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.82rem' }}>
                      {(Number(analyticsGlobales.deporte_mas_popular?.torneos_creados) || 0).toLocaleString('es-AR')}{' '}
                      torneos (por deporte al crear)
                    </p>
                  </div>
                </div>
                <div
                  className="admin-analytics-sedes-por-pais"
                  style={{
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '14px',
                    marginTop: '4px',
                  }}
                >
                  <h3 style={{ margin: '0 0 10px', fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 800 }}>
                    Sedes por país (top 5)
                  </h3>
                  {Array.isArray(analyticsGlobales.sedes_por_pais_top5) &&
                  analyticsGlobales.sedes_por_pais_top5.length > 0 ? (
                    <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.65 }}>
                      {analyticsGlobales.sedes_por_pais_top5.map((row) => {
                        const n = Number(row.cantidad) || 0;
                        const paisNombre = String(row.pais || '').trim();
                        const flag = banderaEmojiDesdeNombrePais(paisNombre);
                        const nombreSinFlag = paisTextoSinBanderaInicial(paisNombre) || paisNombre;
                        const sedeLabel = n === 1 ? t('admin.metricas.oneVenue') : `${n.toLocaleString('es-AR')} sedes`;
                        return (
                          <li key={String(row.pais)}>
                            <strong>
                              {flag ? `${flag} ${nombreSinFlag}`.trim() : nombreSinFlag}
                            </strong>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {' '}
                              — {sedeLabel}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>{t('admin.metrics.noCountryData')}</p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}
        {resumenOperativoSecciones}
        {(esAdminClub || isSuperAdmin) && adminClubMetricasExtra ? (
          <AdminClubMetricasExtras
            metricas={adminClubMetricasExtra}
            moneda={
              esAdminClub && sedeId != null && sedeId !== ''
                ? bucketMonedaAdmin(sedesMap[String(sedeId)]?.moneda || 'ARS')
                : 'ARS'
            }
          />
        ) : null}
        {esAdminClub && misCanchasHoyAdminClub ? (
          <div
            className="section"
            style={{
              marginBottom: '18px',
              background: 'var(--bg-card)',
              borderRadius: '14px',
              padding: '16px 18px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              color: 'var(--text-primary)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '6px', color: 'var(--text-primary)', fontSize: '18px' }}>{t('admin.metrics.courtsToday')}</h2>
            <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
              {misCanchasHoyAdminClub.nombreSede} · {misCanchasHoyAdminClub.fechaLabel}
            </p>
            {misCanchasHoyAdminClub.sinCanchasActivas ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>
                Sin canchas activas cargadas. Configuralas en «Mi sede».
              </p>
            ) : misCanchasHoyAdminClub.totalReservasHoySede === 0 ? (
              <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 700 }}>{t('admin.metrics.noBookingsTodayShort')}</p>
            ) : null}
            {!misCanchasHoyAdminClub.sinCanchasActivas ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {misCanchasHoyAdminClub.rows.map((row) => (
                  <li
                    key={row.id != null ? `c-${row.id}` : `c-num-${row.numero}`}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                    }}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '15px', marginBottom: '6px' }}>
                      {row.nombre}
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '13px', marginLeft: '8px' }}>
                        (n.º {row.numero})
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Slots ocupados hoy:</span> {row.ocupados}
                      <span style={{ margin: '0 10px', color: '#cbd5e1' }}>|</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Slots disponibles hoy:</span>{' '}
                      {row.disponibles == null ? '—' : row.disponibles}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '6px', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{t('admin.reservas.nextBookingLabel')}</span> {row.proximaTexto}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {puedeVerFinanzas ? <>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
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
              { id: 'anio', label: t('admin.formularios.yearLabel') },
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
                style={adminFilterPillButtonStyle(superAdminPeriodo === opt.id, adminPillInactiveSurface)}
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
                  border: '1px solid var(--border)',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
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
                  border: '1px solid var(--border)',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
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
          <h2>{t('admin.metrics.periodRevenue')}</h2>
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
                style={{ textAlign: 'left' }}
              >
                <span className="ingreso-codigo" style={{ flex: 1, color: 'var(--text-primary)' }}>
                  Total
                </span>
                <span className="ingreso-valor" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
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
                  .join(' · ') || i18n.t('admin.notif.noRevenuePeriod');
              const pf = cifrasFinanzasResumen.porFuente;
              const resVac = monetarioObjTodoCero(pf.reservas);
              const insVac = monetarioObjTodoCero(pf.inscripciones);
              const totVac = monetarioObjTodoCero(cifrasFinanzasResumen.total);
              const rowSin = (v) => `ingreso-fila${v ? ' ingreso-fila--sin-ingresos ingreso-fila--centro' : ''}`;
              const valSin = (v) => `ingreso-valor${v ? ' ingreso-valor--sin-ingresos-msg' : ''}`;
              return (
                <div className="ingresos-por-moneda">
                  <div
                    className={rowSin(resVac)}
                    style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}
                  >
                    <span className="ingreso-codigo" style={{ width: '100%' }}>
                      ⚽ Reservas de canchas
                    </span>
                    <span
                      className={valSin(resVac)}
                      style={{ fontSize: '0.95rem', textAlign: resVac ? 'center' : 'right' }}
                    >
                      {fmt(pf.reservas)}
                    </span>
                  </div>
                  <div
                    className={rowSin(insVac)}
                    style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}
                  >
                    <span className="ingreso-codigo" style={{ width: '100%' }}>
                      🏆 Inscripciones a torneos
                    </span>
                    <span
                      className={valSin(insVac)}
                      style={{ fontSize: '0.95rem', textAlign: insVac ? 'center' : 'right' }}
                    >
                      {fmt(pf.inscripciones)}
                    </span>
                  </div>
                  <div
                    className={
                      totVac
                        ? 'ingreso-fila ingreso-fila--sin-ingresos ingreso-fila--centro'
                        : 'ingreso-fila ingreso-fila--total-ok'
                    }
                    style={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: '6px',
                    }}
                  >
                    <span className="ingreso-codigo" style={{ width: '100%' }}>
                      Total
                    </span>
                    <span
                      className={valSin(totVac)}
                      style={{ fontSize: '1rem', textAlign: totVac ? 'center' : 'right' }}
                    >
                      {fmt(cifrasFinanzasResumen.total)}
                    </span>
                  </div>
                </div>
              );
            })()
          )}
        </div>
        <div className="card reservas">
          <h2>{t('admin.metrics.periodBookings')}</h2>
          <p className="count">{cifrasFinanzasResumen.reservasEnPeriodo}</p>
        </div>
        <div className="card torneos">
          <h2>{t('admin.metrics.totalTournaments')}</h2>
          <p className="count">{torneos.length}</p>
        </div>
      </div>
      <div
        className={`section${isSuperAdmin ? ' admin-financiero-super' : ''}`}
        style={
          isSuperAdmin
            ? {
                marginTop: '16px',
                borderRadius: '14px',
                padding: '16px',
                boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
                border: '1px solid #374151',
              }
            : {
                marginTop: '16px',
                background: 'var(--bg-card)',
                borderRadius: '14px',
                padding: '16px',
                boxShadow: '0 10px 26px rgba(15,23,42,0.12)',
              }
        }
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{t('admin.metricas.financialTitle')}</h2>
          <button
            type="button"
            onClick={exportarFinanzasExcel}
            style={{
              border: 'none',
              borderRadius: '10px',
              padding: '10px 14px',
              background: '#E11B22',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Exportar
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '10px', marginTop: '12px' }}>
          <div
            style={
              isSuperAdmin
                ? { background: '#1f2937', border: '1px solid #374151', borderRadius: '10px', padding: '10px' }
                : { background: 'var(--bg-card)', borderRadius: '10px', padding: '10px' }
            }
          >
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>{t('admin.metrics.transactions')}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {dashboardFinanciero.totalTransacciones}
            </div>
          </div>
          <div
            style={
              isSuperAdmin
                ? { background: '#1f2937', border: '1px solid #374151', borderRadius: '10px', padding: '10px' }
                : { background: 'var(--bg-card)', borderRadius: '10px', padding: '10px' }
            }
          >
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>{t('admin.metrics.avgTicket')}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {isSuperAdmin
                ? Math.round(Number(dashboardFinanciero.ticketPromedio) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
                : `$ ${Math.round(Number(dashboardFinanciero.ticketPromedio) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ${cifrasFinanzasResumen.moneda || 'ARS'}`}
            </div>
          </div>
        </div>
        <div style={{ marginTop: '14px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '8px',
              color: 'var(--text-primary)',
            }}
          >
            Ingresos por día
          </div>
          {dashboardFinanciero.dailyRows.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Sin movimientos en el período seleccionado.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '6px' }}>
              {dashboardFinanciero.dailyRows.map((row) => {
                const pct = dashboardFinanciero.maxDaily > 0 ? Math.max(4, (row.total / dashboardFinanciero.maxDaily) * 100) : 0;
                return (
                  <div key={row.fecha} style={{ display: 'grid', gridTemplateColumns: '50px 1fr auto', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      {ymdToLabelShort(row.fecha)}
                    </span>
                    <div
                      style={{
                        height: '12px',
                        borderRadius: '999px',
                        background: 'var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)' }} />
                    </div>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                      }}
                    >
                      {Number(row.total).toLocaleString('es-AR')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </> : null}
        </>
      ))}

      {activeTab === 'torneos' && <>
        {crearTorneoEmbedOpen ? (
          <div className="section admin-torneo-crear-embed" style={{ marginBottom: '18px' }}>
            <TorneoCrear
              embedded
              apiBaseUrl={apiBaseUrl}
              rol={rol}
              onClose={() => setCrearTorneoEmbedOpen(false)}
              onCreated={() => {
                void fetchData();
                setCrearTorneoEmbedOpen(false);
              }}
            />
          </div>
        ) : (
        <>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {t('admin.torneosSection.filterEstado')}
          </div>
          <div
            role="group"
            aria-label={t('admin.torneosSection.filterEstado')}
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
            {filtrosEstadoTorneoPillsAdmin.map(({ id, label }) => {
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
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {t('admin.torneosSection.filterDeporte')}
          </div>
          <div
            role="group"
            aria-label={t('admin.torneosSection.filterDeporte')}
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
            {filtrosDeporteTorneoPillsAdmin.map(({ id, label }) => {
              const active = filtroDeporteTorneoAdmin === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFiltroDeporteTorneoAdmin(id)}
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
          <h2 style={{ margin: 0 }}>📋 {t('admin.torneosSection.createdTitle')}</h2>
          {!esEmpleado ? (
            <button
              onClick={() => setCrearTorneoEmbedOpen(true)}
              style={{ padding: '8px 16px', background: '#e53935', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
            >
              + Nuevo Torneo
            </button>
          ) : null}
        </div>
        {torneos.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>{t('admin.metrics.noTournaments')}</p>
        ) : torneosFiltradosAdminEstado.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>{t('admin.metrics.noTournamentsState')}</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {torneosFiltradosAdminEstado.map(torneo => {
              const sede = sedesMap[torneo.sede_id];
              const flag = sedeFlag(sede);
              const ciudadSede = String(sede?.ciudad || '').trim();
              const paisSede = String(sede?.pais || '').trim();
              const ubicacionSede = [ciudadSede, paisSede].filter(Boolean).join(', ');
              const NIVEL_COLOR = {
                club:          { bg: '#e2e8f0', color: 'var(--text-secondary)' },
                nacional:      { bg: '#dbeafe', color: '#1e40af' },
                internacional: { bg: '#fef2f2', color: '#991b1b' },
                fipa:          { bg: '#fef3c7', color: '#b45309' },
              };
              const FORMATO_COLOR = {
                round_robin:     { bg: '#fef2f2', color: '#991b1b' },
                knockout:        { bg: '#fee2e2', color: '#991b1b' },
                grupos_knockout: { bg: '#fee2e2', color: '#991b1b' },
              };
              const nivelTorneoRaw = String(torneo.nivel_torneo || '').trim().toLowerCase();
              const nivelCanonico = (
                nivelTorneoRaw === 'club_no_oficial' || nivelTorneoRaw === 'club_oficial'
              ) ? 'club' : (
                nivelTorneoRaw === 'mundial'
              ) ? 'fipa' : nivelTorneoRaw;
              const nivelColor   = NIVEL_COLOR[nivelCanonico] || { bg: '#e2e8f0', color: 'var(--text-secondary)' };
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
                <div
                  key={torneo.id}
                  className={isSuperAdmin ? 'admin-torneo-list-card' : undefined}
                  style={{
                  background: 'var(--bg-card)',
                  border: isEditingThis ? '2px solid #E11B22' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px 16px',
                }}>
                  {isEditingThis ? (
                    /* ── Inline edit form ── */
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('admin.formularios.name')}</label>
                          <input style={inp} value={editTorneoForm.nombre} onChange={e => setEditTorneoForm(p => ({ ...p, nombre: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Sede</label>
                          <SedeSearchInput
                            sedes={Object.values(sedesMap)}
                            valueId={editTorneoForm.sede_id}
                            onChangeId={(id) => setEditTorneoForm((p) => ({ ...p, sede_id: id }))}
                            inputStyle={inp}
                            formatLabel={(s) => `${sedeFlag(s)} ${String(s?.nombre || '').trim()}`.trim()}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('admin.formularios.levelCol')}</label>
                          <input style={inp} value={editTorneoForm.nivel_torneo} onChange={e => setEditTorneoForm(p => ({ ...p, nivel_torneo: e.target.value }))} placeholder={t('admin.formularios.levelExamplePh')} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('admin.metricas.sportLabel')}</label>
                          <select
                            style={inp}
                            value={editTorneoForm.deporte || TORNEO_DEPORTE_PADBOL}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEditTorneoForm((p) => ({
                                ...p,
                                deporte: v,
                                formato_equipo: formatoEquipoDefaultParaDeporte(v),
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
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                            Modalidad (jugadores)
                          </label>
                          {torneoDeportePermiteSinglesDobles(editTorneoForm.deporte) ? (
                            <select
                              style={inp}
                              value={editTorneoForm.formato_equipo || TORNEO_FORMATO_DOBLES}
                              onChange={(e) => setEditTorneoForm((p) => ({ ...p, formato_equipo: e.target.value }))}
                            >
                              {TORNEO_FORMATO_SINGLES_DOBLES_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : editTorneoForm.deporte === TORNEO_DEPORTE_FUTBOL5 ? (
                            <select style={{ ...inp, opacity: 0.92, cursor: 'not-allowed' }} value={TORNEO_FORMATO_EQUIPO_5} disabled>
                              <option value={TORNEO_FORMATO_EQUIPO_5}>{t('admin.metricas.teamFormat5')}</option>
                            </select>
                          ) : editTorneoForm.deporte === TORNEO_DEPORTE_FUTBOL7 ? (
                            <select style={{ ...inp, opacity: 0.92, cursor: 'not-allowed' }} value={TORNEO_FORMATO_EQUIPO_7} disabled>
                              <option value={TORNEO_FORMATO_EQUIPO_7}>{t('admin.metricas.teamFormat7')}</option>
                            </select>
                          ) : (
                            <select style={{ ...inp, opacity: 0.92, cursor: 'not-allowed' }} value={TORNEO_FORMATO_DOBLES} disabled>
                              <option value={TORNEO_FORMATO_DOBLES}>{t('admin.metricas.doublesFormat')}</option>
                            </select>
                          )}
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('admin.metricas.formatLabel')}</label>
                          <select style={inp} value={editTorneoForm.tipo_torneo} onChange={e => setEditTorneoForm(p => ({ ...p, tipo_torneo: e.target.value }))}>
                            <option value="">— Seleccionar —</option>
                            <option value="round_robin">{t('admin.metricas.formatRoundRobin')}</option>
                            <option value="knockout">{t('admin.metricas.formatKnockout')}</option>
                            <option value="grupos_knockout">{t('admin.metricas.formatGroupsKnockout')}</option>
                          </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('admin.metricas.tournamentTypeLabel')}</label>
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
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('admin.formularios.ageCategoryLabel')}</label>
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
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('admin.formularios.categoryRequiredLabel')}</label>
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
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                            {isSuperAdmin ? 'Estado (manual)' : t('admin.metricas.statusCol')}
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
                                {soloLecturaMsg || t('admin.formularios.statusReadOnly')}
                              </div>
                            );
                          })()}
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('admin.metricas.startDateLabel')}</label>
                          <input type="date" style={inp} value={editTorneoForm.fecha_inicio} onChange={e => setEditTorneoForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('admin.metricas.endDateLabel')}</label>
                          <input type="date" style={inp} value={editTorneoForm.fecha_fin} onChange={e => setEditTorneoForm(p => ({ ...p, fecha_fin: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('admin.formularios.maxTeamsSlotsLabel')}</label>
                          <input
                            type="number"
                            style={inp}
                            min="1"
                            placeholder={t('admin.formularios.emptyNoCapHint')}
                            value={editTorneoForm.cupos_maximos ?? ''}
                            onChange={(e) => setEditTorneoForm((p) => ({ ...p, cupos_maximos: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
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
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Vista pública: oculta la lista hasta esta cantidad de horas antes del inicio (admins ven siempre).
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                            Inscripción por equipo
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 74px', gap: '6px' }}>
                            <input
                              type="number"
                              style={inp}
                              min="0"
                              step="1"
                              placeholder={t('admin.formularios.emptyFreePh')}
                              value={editTorneoForm.inscripcion_monto ?? ''}
                              onChange={(e) => setEditTorneoForm((p) => ({ ...p, inscripcion_monto: e.target.value }))}
                            />
                            <select
                              style={inp}
                              value={editTorneoForm.inscripcion_moneda || 'ARS'}
                              onChange={(e) => setEditTorneoForm((p) => ({ ...p, inscripcion_moneda: e.target.value }))}
                              aria-label={t('admin.formularios.tournamentCurrencyAria')}
                            >
                              <option value="ARS">ARS</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                            Puntos del torneo
                          </label>
                          <input
                            type="number"
                            style={inp}
                            min="0"
                            step="1"
                            placeholder={t('admin.hub.optional')}
                            value={editTorneoForm.puntos_total ?? ''}
                            onChange={(e) => setEditTorneoForm((p) => ({ ...p, puntos_total: e.target.value }))}
                          />
                          {String(editTorneoForm.puntos_total || '').trim() ? (
                            <button
                              type="button"
                              onClick={() => setPuntosDistribucionTorneo(editTorneoForm)}
                              style={{
                                marginTop: '6px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#E11B22',
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Ver distribución
                            </button>
                          ) : null}
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                            Premios
                          </label>
                          <textarea
                            style={{ ...inp, minHeight: 70, resize: 'vertical' }}
                            value={editTorneoForm.premios_descripcion ?? ''}
                            onChange={(e) => setEditTorneoForm((p) => ({ ...p, premios_descripcion: e.target.value }))}
                            placeholder={t('admin.formularios.prizesExamplePh')}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditandoTorneoId(null)}
                          style={{ padding: '6px 14px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Cancelar
                        </button>
                        <button
                          disabled={savingTorneo}
                          onClick={() => guardarTorneo(torneo.id)}
                          style={{ padding: '6px 16px', background: '#E11B22', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: savingTorneo ? 0.6 : 1 }}
                        >
                          {savingTorneo ? t('admin.metricas.savingDots') : t('admin.formularios.saveOk')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Compact view in stacked layout: title/sede → badges → estado/equipos/dates/actions ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          {flag && <span style={{ fontSize: '18px', flexShrink: 0 }}>{flag}</span>}
                          <strong style={{ fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{torneo.nombre}</strong>
                        </div>
                        {sede ? <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>{sede.nombre}</div> : null}
                        {ubicacionSede ? (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {flag ? `${flag} ${ubicacionSede}` : ubicacionSede}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {torneo.nivel_torneo
                          ? <span style={badge(nivelColor.bg, nivelColor.color)}>{formatNivelTorneo(torneo.nivel_torneo)}</span>
                          : null}
                        <span style={badge('#fef2f2', '#991b1b')}>{resumenDeporteFormatoTorneo(torneo)}</span>
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
                                {torneo.fecha_fin && <div style={{ color: 'var(--text-secondary)' }}>→ {formatFecha(torneo.fecha_fin)}</div>}
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
                                background: 'linear-gradient(135deg,#E11B22,#b91c1c)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                              }}
                              title={t('admin.torneosSection.manualGroupDrawTitle')}
                            >
                              Sorteo grupos
                            </button>
                          ) : null;
                        })()}
                        <button
                          onClick={() => navigate(`/torneo/${torneo.id}`, { state: { fromAdmin: true } })}
                          style={{ padding: '6px 14px', background: '#E11B22', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                        >
                          Ver →
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => abrirEditTorneo(torneo)}
                            style={{ padding: '6px 10px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                            title={t('admin.torneosSection.editTournament')}
                          >
                            ✏️
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={() => eliminarTorneo(torneo.id, torneo.nombre)}
                            style={{ padding: '6px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}
                            title={t('admin.torneosSection.deleteTournament')}
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
      <TorneoPuntosDistribucionModal
        open={Boolean(puntosDistribucionTorneo)}
        onClose={() => setPuntosDistribucionTorneo(null)}
        torneo={puntosDistribucionTorneo}
      />
        </>
        )}
      </>}

      {activeTab === 'profesores' && isSuperAdmin && session?.access_token ? (
        <AdminProfesoresSuperSection
          accessToken={session.access_token}
          isSuperAdmin={isSuperAdmin}
          tabActive={activeTab === 'profesores'}
          onPendientesCountChange={setSnapPendienteProfesores}
        />
      ) : null}

      {activeTab === t('admin.metricas.venuesCount') && (esAdminNacional || isSuperAdmin) && (
        <div className="section">
          <h2>{isSuperAdmin ? t('admin.sedes.registeredVenues') : t('admin.sedes.venuesInCountry')}</h2>
          {isSuperAdmin && session?.access_token ? (
            <AdminSedeExtrasPendientesSuper apiBaseUrl={apiBaseUrl} accessToken={session.access_token} />
          ) : null}
          {(isSuperAdmin ? sedesSuperAdminLista : sedesNacionalLista).length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>
              {isSuperAdmin
                ? t('admin.sedes.noVenuesYet')
                : t('admin.sedes.noVenuesNationalScope')}
            </p>
          ) : (
            <>
              {isSuperAdmin ? (
                <div className="sedes-admin-filters-toolbar">
                  <label className="sedes-admin-filter-field">
                    <span className="sedes-admin-filter-label">{t('admin.formularios.countryLabel')}</span>
                    <select
                      value={sedeMobileFiltroPais}
                      onChange={(e) => {
                        setSedeMobileFiltroPais(e.target.value);
                        setSedeMobileFiltroCiudad('');
                      }}
                      className="sedes-admin-filter-select"
                      aria-label={t('admin.sedes.filterVenuesByCountry')}
                    >
                      <option value="">{t('admin.sponsors.allSports')}</option>
                      {sedesSuperAdminPaisesUnicos.map((p) => (
                        <option key={p} value={p}>
                          {etiquetaPaisFiltroMobile(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="sedes-admin-filter-field">
                    <span className="sedes-admin-filter-label">{t('admin.formularios.cityLabel')}</span>
                    <select
                      value={sedeMobileFiltroCiudad}
                      onChange={(e) => setSedeMobileFiltroCiudad(e.target.value)}
                      className="sedes-admin-filter-select"
                      aria-label={t('admin.sedes.filterByCityPh')}
                    >
                      <option value="">{t('admin.sponsors.allSports')}</option>
                      {sedesSuperAdminCiudadesOpciones.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="sedes-admin-filter-field sedes-admin-filter-field--search">
                    <span className="sedes-admin-filter-label">{t('admin.metricas.searchLabel')}</span>
                    <input
                      type="search"
                      value={sedesSuperAdminBusquedaTexto}
                      onChange={(e) => setSedesSuperAdminBusquedaTexto(e.target.value)}
                      placeholder={t('admin.sedes.searchLicensePh')}
                      className="sedes-admin-filter-select"
                      autoComplete="off"
                      enterKeyHint="search"
                      aria-label={t('admin.sedes.searchVenueLicense')}
                    />
                  </label>
                </div>
              ) : null}
              {isSuperAdmin &&
              sedesSuperAdminListaFiltrada.length > 0 &&
              sedesSuperAdminPaginacion.totalPages > 1 ? (
                <div
                  className="sedes-admin-sedes-pagination"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '14px',
                    margin: '0 0 8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
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
                      color: 'var(--text-primary)',
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
                      color: 'var(--text-primary)',
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
                      <th>{t('admin.formularios.cityLabel')}</th>
                      {isSuperAdmin ? <th>{t('admin.formularios.countryLabel')}</th> : null}
                      {isSuperAdmin ? <th>{t('admin.metricas.contactCol')}</th> : null}
                      <th>{t('admin.metricas.licenseCol')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isSuperAdmin &&
                    sedesSuperAdminListaFiltrada.length === 0 &&
                    sedesSuperAdminLista.length > 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: 'var(--text-secondary)', padding: '14px 12px' }}>
                          No hay sedes que coincidan con los filtros o la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      (isSuperAdmin ? sedesSuperAdminPaginacion.slice : sedesNacionalLista).map((s) => {
                      const flagS = sedeFlag(s);
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700 }}>
                            {flagS ? `${flagS} ` : ''}
                            {String(s.nombre || '').trim() || '—'}
                            {isSuperAdmin ? (
                              <button
                                type="button"
                                onClick={() => setSedeDetalleAbiertoId(s.id)}
                                style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '11px' }}
                              >
                                Detalle
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
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="sedes-admin-mobile-cards">
                {(isSuperAdmin ? sedesSuperAdminListaFiltrada : sedesNacionalLista).length === 0 &&
                (isSuperAdmin ? sedesSuperAdminLista : sedesNacionalLista).length > 0 ? (
                  <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
                    No hay sedes que coincidan con los filtros o la búsqueda.
                  </p>
                ) : null}
                {(isSuperAdmin ? sedesSuperAdminPaginacion.slice : sedesNacionalLista).map((s) => {
                  const flagS = sedeFlag(s);
                  const email = String(s.email_contacto || '').trim();
                  const pais = String(s.pais || '').trim();
                  const ciudad = String(s.ciudad || '').trim();
                  const locLine = [pais || null, ciudad || null].filter(Boolean).join(' · ') || '—';
                  return (
                    <div key={s.id} className="sede-admin-card">
                      <div className="sede-admin-card__hero">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <span style={{ fontSize: '1.35rem', lineHeight: 1.2, flexShrink: 0 }} aria-hidden>
                            {flagS || ''}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="sede-admin-card__name">{String(s.nombre || '').trim() || '—'}</div>
                            <div className="sede-admin-card__loc">{locLine}</div>
                            {email ? (
                              <div className="sede-admin-card__email">
                                <a href={`mailto:${email}`}>{email}</a>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="sede-admin-card__body">
                        <div>{sedeLicenciaChip(s)}</div>
                        {isSuperAdmin ? (
                          <button
                            type="button"
                            onClick={() => setSedeDetalleAbiertoId(s.id)}
                            style={{
                              marginTop: '8px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              background: 'var(--bg-card)',
                              cursor: 'pointer',
                            }}
                          >
                            Detalle
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isSuperAdmin && sedeSuperAdminDetalleModal ? (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="sede-super-admin-detalle-titulo"
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10050,
                    background: 'rgba(15, 23, 42, 0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding:
                      'max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))',
                    boxSizing: 'border-box',
                  }}
                  onClick={(ev) => {
                    if (ev.target === ev.currentTarget) setSedeDetalleAbiertoId(null);
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 'min(96vw, 720px)',
                      maxHeight: 'min(92dvh, 920px)',
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      background: 'var(--bg-card)',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                      boxSizing: 'border-box',
                    }}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      <h3
                        id="sede-super-admin-detalle-titulo"
                        style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}
                      >
                        {String(sedeSuperAdminDetalleModal.nombre || '').trim() || 'Sede'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSedeDetalleAbiertoId(null)}
                        aria-label="Cerrar detalle"
                        style={{
                          flexShrink: 0,
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          background: 'var(--bg-card)',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          color: 'var(--text-primary)',
                        }}
                      >
                        Cerrar
                      </button>
                    </div>
                    <SedeSuperDetallePanel
                      s={sedeSuperAdminDetalleModal}
                      contrato={contratosBySedeId[Number(sedeSuperAdminDetalleModal.id)] || null}
                      badge={contratoBadgeData(contratosBySedeId[Number(sedeSuperAdminDetalleModal.id)] || null)}
                      suscripcionEstadoSuperSavingId={suscripcionEstadoSuperSavingId}
                      guardarSuscripcionEstadoSuper={guardarSuscripcionEstadoSuper}
                      activarSuscripcionStripeSede={activarSuscripcionStripeSede}
                    />
                    {session?.access_token ? (
                      <SedeSuperDuracionesSection
                        apiBaseUrl={apiBaseUrl}
                        accessToken={session.access_token}
                        sedeId={Number(sedeSuperAdminDetalleModal.id)}
                        moneda={String(sedeSuperAdminDetalleModal.moneda || 'ARS')}
                      />
                    ) : null}
                    {session?.access_token ? (
                      <div
                        style={{
                          marginTop: 24,
                          paddingTop: 20,
                          borderTop: '1px solid var(--border)',
                        }}
                      >
                        <h4
                          style={{
                            margin: '0 0 12px',
                            fontSize: 16,
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                          }}
                        >
                          🎓 {t('admin.profesores.clasesYInstructores')}
                        </h4>
                        <AdminModuloClasesSection
                          apiBaseUrl={apiBaseUrl}
                          accessToken={session.access_token}
                          sedeId={Number(sedeSuperAdminDetalleModal.id)}
                          monedaSede={String(sedeSuperAdminDetalleModal.moneda || 'ARS').trim().toUpperCase().slice(0, 8) || 'ARS'}
                          isSuperAdmin
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {activeTab === 'jugadores' && esAdminNacional && (
        <div className="section">
          <h2>{t('admin.formularios.federatedPlayersTitle')}</h2>
          {nacionalJugadoresLoading ? (
            <p style={{ color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</p>
          ) : jugadoresFederadosPais.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>{t('admin.formularios.noFederatedPlayers')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="reservas-table">
                <thead>
                  <tr>
                    <th>{t('admin.reservas.player')}</th>
                    <th>{t('admin.formularios.emailLabel')}</th>
                    <th>{t('admin.formularios.categoryCol')}</th>
                    <th>{t('admin.formularios.countryProfileCol')}</th>
                    <th style={{ whiteSpace: 'nowrap' }}>{t('admin.metricas.profileCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {jugadoresFederadosPais.map((j) => {
                    const nom = [String(j.nombre || '').trim(), String(j.apellido || '').trim()]
                      .filter(Boolean)
                      .join(' ')
                      .trim();
                    const perfilFed = pathJugadorPerfilPublico(j);
                    return (
                      <tr key={j.email || `${j.nombre}-${j.apellido}`}>
                        <td style={{ fontWeight: 700 }}>{nom || String(j.alias || '').trim() || '—'}</td>
                        <td style={{ fontSize: '13px' }}>{String(j.email || '').trim() || '—'}</td>
                        <td>{String(j.nivel || '').trim() || '—'}</td>
                        <td>{String(j.pais || '').trim() || '—'}</td>
                        <td style={{ fontSize: '13px' }}>
                          {perfilFed ? (
                            <a href={perfilFed} target="_blank" rel="noopener noreferrer" style={{ color: '#E11B22', fontWeight: 700 }}>
                              Ver perfil
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
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
        <h2>{t('admin.formularios.pendingValidationTitle')}</h2>
        {pendientesLoading ? (
          <p style={{ color: 'var(--text-secondary)' }}>{t('admin.metricas.loading')}</p>
        ) : pendientes.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>{t('admin.formularios.noPendingValidation')}</p>
        ) : (
          <>
            <div style={{ marginBottom: '14px', maxWidth: '420px' }}>
              <label htmlFor="admin-busqueda-validaciones" style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {t('admin.formularios.validationSearchLabel')}
              </label>
              <input
                id="admin-busqueda-validaciones"
                type="search"
                value={busquedaValidaciones}
                onChange={(e) => setBusquedaValidaciones(e.target.value)}
                placeholder={t('admin.formularios.searchPlayerPlaceholder')}
                autoComplete="off"
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {pendientesFiltradosValidaciones.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>{t('admin.formularios.noPlayerSearchMatch')}</p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
            {pendientesFiltradosValidaciones.map(jugador => {
              const flag = (jugador.pais || '').split(' ')[0];
              const vs = validacionState[jugador.email] || {};
              const nombreMostrar = [String(jugador.nombre || '').trim(), String(jugador.apellido || '').trim()]
                .filter(Boolean)
                .join(' ')
                .trim();
              const perfilPathVal = pathJugadorPerfilPublico(jugador);
              return (
                <div key={jugador.email} className="admin-validacion-pendiente-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{nombreMostrar || jugador.nombre || '—'}</strong>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>{jugador.email}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                      {t('admin.formularios.validationGenderLabel')}: {String(jugador.genero || '').trim() || '—'}
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
                    {perfilPathVal ? (
                      <a
                        href={perfilPathVal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-validacion-ver-perfil"
                        style={{
                          padding: '7px 12px',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: '5px',
                          fontWeight: 700,
                          fontSize: '13px',
                          textDecoration: 'none',
                        }}
                      >
                        {t('admin.formularios.validationViewProfile')}
                      </a>
                    ) : null}
                    <button
                      disabled={vs.saving}
                      onClick={() => aprobarJugador(jugador.email)}
                      style={{ padding: '7px 14px', background: '#43a047', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                    >
                      {t('admin.formularios.validationApprove')}
                    </button>
                    <button
                      disabled={vs.saving}
                      onClick={() => toggleCambiarCategoria(jugador.email, jugador.nivel)}
                      style={{ padding: '7px 14px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: vs.saving ? 0.6 : 1 }}
                    >
                      {t('admin.formularios.validationChangeCategory')}
                    </button>

                    {vs.open && (
                      <>
                        <select
                          value={vs.categoria || jugador.nivel}
                          onChange={e => setValidacionState(prev => ({ ...prev, [jugador.email]: { ...prev[jugador.email], categoria: e.target.value } }))}
                          style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '13px' }}
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
                          {vs.saving ? t('admin.metricas.savingDots') : t('admin.formularios.saveDisk')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
              </div>
            )}
          </>
        )}
      </div>}

      {activeTab === 'reservas' && <>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Estado de la reserva
          </div>
          <div
            role="group"
            aria-label={t('admin.reservas.bookingStatusLabel')}
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
          const sedesManualReserva = Object.values(sedesMap || {}).sort((a, b) =>
            String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' })
          );
          const mostrarSelectorSedeManual = !esAdminClub && sedesManualReserva.length !== 1;
          const sedeManualId = String(reservaManualForm.sede_id || (esAdminClub && sedeId != null ? sedeId : '') || '');
          const sedeManualRow = sedeManualId ? sedesMap[sedeManualId] : null;
          const canchasManualReservaRaw = canchasDetallePorSede[sedeManualId] || [];
          const canchasManualReserva = canchasManualReservaRaw.length
            ? canchasManualReservaRaw
                .filter((c) => normalizeEstadoCanchaAdminDash(c.estado) !== 'inactiva')
                .map((c) => ({
                  numero: Number(c.numero_reserva ?? c.orden),
                  nombre: String(c.nombre || '').trim() || `Cancha ${c.numero_reserva ?? c.orden}`,
                }))
                .filter((c) => Number.isFinite(c.numero))
                .sort((a, b) => a.numero - b.numero)
            : Array.from(
                { length: Math.max(0, Number(sedeManualRow?.cantidad_canchas) || Number(canchasResumenPorSede[sedeManualId]?.activas) || 0) },
                (_, idx) => ({ numero: idx + 1, nombre: `Cancha ${idx + 1}` })
              );
          const reservaManualSlots = slotsReservaManualDisponiblesAdminDash({
            sedeRow: sedeManualRow,
            reservas,
            fecha: reservaManualForm.fecha,
            cancha: reservaManualForm.cancha,
            duracion: reservaManualForm.duracion,
            ctx: ahoraArgentinaPartes(),
          });
          const manualInput = {
            width: '100%',
            padding: '9px 10px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '14px',
            boxSizing: 'border-box',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            WebkitTextFillColor: 'var(--text-primary)',
          };
          const manualActionButton = (extra) => ({
            padding: '9px 14px',
            border: 'none',
            borderRadius: '3px',
            cursor: reservaManualSaving ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            color: 'white',
            ...extra,
          });
          const puedeCrearReservaManual = isSuperAdmin || esAdminClub;
          const reservaManualPanel = puedeCrearReservaManual ? (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '16px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setReservaManualOpen((open) => {
                    const next = !open;
                    if (next && !reservaManualForm.sede_id && sedesManualReserva.length === 1) {
                      setReservaManualForm((p) => ({ ...p, sede_id: String(sedesManualReserva[0].id) }));
                    }
                    setReservaManualError('');
                    return next;
                  });
                }}
                style={{
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {reservaManualOpen ? t('general.close') : 'Nueva reserva manual'}
              </button>

              {reservaManualOpen ? (
                <form onSubmit={crearReservaManual} style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
                  {mostrarSelectorSedeManual ? (
                    <label style={{ display: 'grid', gap: '5px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Sede
                      <SedeSearchInput
                        sedes={sedesManualReserva}
                        valueId={reservaManualForm.sede_id}
                        onChangeId={(id) => setReservaManualForm((p) => ({ ...p, sede_id: id, cancha: '', hora: '' }))}
                        inputStyle={manualInput}
                      />
                    </label>
                  ) : null}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '10px' }}>
                    <label style={{ display: 'grid', gap: '5px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Cancha
                      <select
                        value={reservaManualForm.cancha}
                        onChange={(e) => setReservaManualForm((p) => ({ ...p, cancha: e.target.value, hora: '' }))}
                        style={manualInput}
                        required
                        disabled={!sedeManualId || canchasManualReserva.length === 0}
                      >
                        <option value="">
                          {!sedeManualId
                            ? t('admin.reservas.selectVenue')
                            : canchasManualReserva.length === 0
                              ? t('admin.reservas.noActiveCourts')
                              : t('admin.reservas.selectCourt')}
                        </option>
                        {canchasManualReserva.map((cancha) => (
                          <option key={cancha.numero} value={String(cancha.numero)}>
                            {cancha.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: '5px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Fecha
                      <input
                        type="date"
                        value={reservaManualForm.fecha}
                        onChange={(e) => setReservaManualForm((p) => ({ ...p, fecha: e.target.value, hora: '' }))}
                        style={manualInput}
                        required
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '5px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Hora inicio
                      <select
                        value={reservaManualForm.hora}
                        onChange={(e) => setReservaManualForm((p) => ({ ...p, hora: e.target.value }))}
                        style={manualInput}
                        required
                        disabled={!reservaManualForm.cancha || !reservaManualForm.fecha || reservaManualSlots.length === 0}
                      >
                        <option value="">
                          {!reservaManualForm.cancha || !reservaManualForm.fecha
                            ? t('admin.reservas.chooseCourtAndDate')
                            : reservaManualSlots.length === 0
                              ? t('admin.reservas.noSlotsAvailable')
                              : t('admin.reservas.selectTimeSlot')}
                        </option>
                        {reservaManualSlots.map((hora) => (
                          <option key={hora} value={hora}>
                            {hora}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: '5px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Duración
                      <select
                        value={reservaManualForm.duracion}
                        onChange={(e) => setReservaManualForm((p) => ({ ...p, duracion: e.target.value, hora: '' }))}
                        style={manualInput}
                      >
                        <option value="60">60 min</option>
                        <option value="90">90 min</option>
                        <option value="120">120 min</option>
                      </select>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '10px' }}>
                    <label style={{ display: 'grid', gap: '5px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Nombre del jugador
                      <input
                        type="text"
                        value={reservaManualForm.nombre}
                        onChange={(e) => setReservaManualForm((p) => ({ ...p, nombre: e.target.value }))}
                        style={manualInput}
                        required
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '5px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Teléfono (opcional)
                      <input
                        type="tel"
                        value={reservaManualForm.telefono}
                        onChange={(e) => setReservaManualForm((p) => ({ ...p, telefono: e.target.value }))}
                        style={manualInput}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '5px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Estado
                      <select
                        value={reservaManualForm.estado}
                        onChange={(e) => setReservaManualForm((p) => ({ ...p, estado: e.target.value }))}
                        style={manualInput}
                      >
                        <option value="confirmada">{t('admin.metricas.statusConfirmed')}</option>
                        <option value="reservada">{t('admin.metricas.statusReserved')}</option>
                      </select>
                    </label>
                  </div>

                  {reservaManualError ? (
                    <div style={{ color: '#b91c1c', fontSize: '13px', fontWeight: 700 }}>{reservaManualError}</div>
                  ) : null}

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="submit"
                      disabled={reservaManualSaving}
                      style={manualActionButton({ background: reservaManualSaving ? '#94a3b8' : '#E11B22' })}
                    >
                      {reservaManualSaving ? t('admin.metricas.savingDots') : t('admin.reservas.createBookingBtn')}
                    </button>
                    <button
                      type="button"
                      disabled={reservaManualSaving}
                      onClick={() => {
                        setReservaManualOpen(false);
                        resetReservaManualForm();
                      }}
                      style={manualActionButton({ background: '#64748b' })}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : null;

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
            const reservasPeriodo = reservas.filter((r) => isInPeriodo(fechaReservaDiaISO(r?.fecha)));
            const reservasPeriodoFiltradas = reservasPeriodo.filter((r) =>
              reservaPasaFiltroEstadoPill(r, filtroPillReservas)
            );

            const ingresosMes = {};
            const porSede = new Map();
            reservasPeriodoFiltradas.forEach((r) => {
              const sedeNombre = String(r?.sede || t('admin.reservas.noVenue')).trim() || t('admin.reservas.noVenue');
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
                    { id: 'anio', label: t('admin.metricas.thisYear') },
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
                      style={adminFilterPillButtonStyle(superAdminPeriodo === opt.id, adminPillInactiveSurface)}
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
                        border: '1px solid var(--border)',
                        fontSize: '16px',
                        color: 'var(--text-primary)',
                        background: 'var(--bg-card)',
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
                        border: '1px solid var(--border)',
                        fontSize: '16px',
                        color: 'var(--text-primary)',
                        background: 'var(--bg-card)',
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
                    color: '#fff',
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
                      background: 'var(--bg-card)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
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
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      País
                      <select
                        value={superReservasFiltroPais}
                        onChange={(e) => setSuperReservasFiltroPais(e.target.value)}
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          fontSize: '15px',
                          color: 'var(--text-primary)',
                          background: 'var(--bg-card)',
                        }}
                      >
                        <option value="">{t('admin.sedes.allCountries')}</option>
                        {paisesOpts.map((p) => (
                          <option key={p} value={p}>
                            {etiquetaPaisFiltroMobile(p)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      Ciudad
                      <input
                        type="text"
                        value={rankingFiltroCiudad}
                        onChange={(e) => setRankingFiltroCiudad(e.target.value)}
                        placeholder={t('admin.sedes.filterByCityPh')}
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          fontSize: '15px',
                          color: 'var(--text-primary)',
                          background: 'var(--bg-card)',
                        }}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      Nombre del club
                      <input
                        type="text"
                        value={rankingFiltroNombreClub}
                        onChange={(e) => setRankingFiltroNombreClub(e.target.value)}
                        placeholder={t('admin.sedes.searchVenuePh')}
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          fontSize: '15px',
                          color: 'var(--text-primary)',
                          background: 'var(--bg-card)',
                        }}
                      />
                    </label>
                  </div>

                  {sedesRanking.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', padding: '10px 0', margin: 0 }}>{t('admin.metricas.noDataFilters')}</p>
                  ) : (
                    <div
                      style={{
                        background: 'var(--bg-card)',
                        borderRadius: '10px',
                        border: '1px solid #e5e7eb',
                        overflow: 'auto',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                        <thead>
                          <tr style={{ background: '#E11B22' }}>
                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#fff', fontWeight: 700 }}>
                              Sede
                            </th>
                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#fff', fontWeight: 700 }}>
                              País
                            </th>
                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#fff', fontWeight: 700 }}>
                              Ciudad
                            </th>
                            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#fff', fontWeight: 700 }}>
                              {sortHeaderBtn('reservas', t('nav.admin.reservas'))}
                            </th>
                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#fff', fontWeight: 700 }}>
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
                                <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>{g.sede}</td>
                                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                                  {(() => {
                                    const flag = sedeFlag({ pais: g.pais });
                                    return flag ? `${flag} ${g.pais}` : g.pais;
                                  })()}
                                </td>
                                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{g.ciudad}</td>
                                <td
                                  style={{
                                    padding: '10px 12px',
                                    textAlign: 'right',
                                    color: 'var(--text-primary)',
                                    fontWeight: 700,
                                  }}
                                >
                                  {g.reservasCount}
                                </td>
                                <td
                                  style={{
                                    padding: '10px 12px',
                                    color: 'var(--text-primary)',
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
                        background: 'var(--bg-card)',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        padding: '12px',
                      }}
                    >
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
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
                              color: 'var(--text-primary)',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '6px 8px',
                            }}
                          >
                            <span style={{ paddingTop: '2px' }}>{r.fecha || '—'}</span>
                            <span style={{ paddingTop: '2px' }}>{horarioReservaAdmin(r)}</span>
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
                {reservaManualPanel}
                {periodoReservasSuperRow}
                <label style={{ display: 'grid', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                  País
                  <select
                    value={superReservasFiltroPais}
                    onChange={(e) => setSuperReservasFiltroPais(e.target.value)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '15px',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-card)',
                      maxWidth: '400px',
                    }}
                  >
                    <option value="">{t('admin.sedes.allCountries')}</option>
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
                      background: 'var(--bg-card)',
                      borderRadius: '10px',
                      padding: '14px',
                      border: '1px solid #e5e7eb',
                      minWidth: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                      Total reservas del período
                    </div>
                    <div
                      style={{
                        color: 'var(--text-primary)',
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
                      background: 'var(--bg-card)',
                      borderRadius: '10px',
                      padding: '14px',
                      border: '1px solid #e5e7eb',
                      minWidth: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                      Total facturado (reservas)
                    </div>
                    <div
                      style={{
                        color: 'var(--text-primary)',
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
                      background: 'var(--bg-card)',
                      borderRadius: '10px',
                      padding: '14px',
                      border: '1px solid #e5e7eb',
                      minWidth: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                      Padbol Match (3% comisión)
                    </div>
                    <div
                      style={{
                        color: 'var(--text-primary)',
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
                    background: 'linear-gradient(135deg, #E11B22 0%, #991b1b 100%)',
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
                  <p style={{ color: 'var(--text-secondary)', padding: '4px 0', margin: 0 }}>
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
                isInPeriodoClub(fechaReservaDiaISO(r?.fecha))
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
                  { id: 'anio', label: t('admin.metricas.thisYear') },
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
                    style={adminFilterPillButtonStyle(superAdminPeriodo === opt.id, adminPillInactiveSurface)}
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
                      border: '1px solid var(--border)',
                      fontSize: '16px',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-card)',
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
                      border: '1px solid var(--border)',
                      fontSize: '16px',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-card)',
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
          const comisClubPm = isSuperAdmin
            ? Math.round(totalFactResClub * 0.03 * 100) / 100
            : 0;
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
                  background: 'var(--bg-card)',
                  borderRadius: '10px',
                  padding: '14px',
                  border: '1px solid #e5e7eb',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                  Total reservas del período
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '26px', fontWeight: 900, marginTop: '6px' }}>
                  {sortedRows.length}
                </div>
              </div>
              <div
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '10px',
                  padding: '14px',
                  border: '1px solid #e5e7eb',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                  Total facturado (reservas)
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 800, marginTop: '8px' }}>
                  {monResClub}{' '}
                  {totalFactResClub.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </div>
              </div>
              {isSuperAdmin ? (
                <div
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '10px',
                    padding: '14px',
                    border: '1px solid #e5e7eb',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
                    Padbol Match (3% comisión)
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 800, marginTop: '8px' }}>
                    {monResClub}{' '}
                    {comisClubPm.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null;

          if (sortedRows.length === 0) {
            return (
              <>
                {mostrarResumenClubNacional ? periodoNavClubReservas : null}
                {tarjetasClubReservas}
                {reservaManualPanel}
                <p style={{ color: 'var(--text-secondary)', padding: '10px 0' }}>{t('admin.reservas.noBookingsInPeriod')}</p>
              </>
            );
          }

          const accionesReservaRow = (r) => (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {['confirmada', 'completada'].includes(String(r.estado || '').toLowerCase()) ? (
                <button
                  type="button"
                  onClick={() => mostrarQrReservaAdmin(r)}
                  style={BTN({ background: '#0f766e' })}
                  title={t('checkin.tuQr')}
                >
                  QR
                </button>
              ) : null}
              {['pendiente_pago_manual', 'pendiente_pago_efectivo'].includes(String(r.estado || '').toLowerCase()) &&
              (esAdminClub || isSuperAdmin) ? (
                <button type="button" onClick={() => confirmarPagoManualReserva(r.id)} style={BTN({ background: '#f59e0b' })}>
                  {String(r.estado || '').toLowerCase() === 'pendiente_pago_efectivo' ? 'Confirmar cobro en sede' : t('admin.metricas.confirmPayment')}
                </button>
              ) : null}
              <button type="button" onClick={() => iniciarEdicion(r)} style={BTN({ background: '#E11B22' })}>
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
              {reservaManualPanel}
              {usarTarjetasReservasClub ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {sortedRows.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        border: '1px solid var(--border)',
                        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'grid', gap: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{t('admin.metricas.dateCol')}</span> · {formatFecha(r.fecha) || '—'}
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{t('admin.metricas.timeCol')}</span> · {horarioReservaAdmin(r)}
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{t('admin.metricas.courtCol')}</span> · {r.cancha ?? '—'}
                        </div>
                        {esAdminNacional ? (
                          <div>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Sede</span> · {String(r.sede || '').trim() || '—'}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <AdminReservaJugadorContacto reserva={r} />
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                        <EstadoBadge reserva={r} />
                        <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--text-primary)', fontSize: '15px' }}>
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
                        <th style={{ padding: '10px 8px' }}>{t('admin.metricas.dateCol')}</th>
                        <th style={{ padding: '10px 8px' }}>{t('admin.metricas.timeCol')}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>{t('admin.metricas.courtCol')}</th>
                        {esAdminNacional ? <th style={{ padding: '10px 8px' }}>Sede</th> : null}
                        <th style={{ padding: '10px 8px' }}>{t('admin.reservas.player')}</th>
                        <th style={{ padding: '10px 8px' }}>{t('admin.metricas.statusCol')}</th>
                        <th style={{ padding: '10px 8px' }}>{t('admin.metricas.amountCol')}</th>
                        <th style={{ padding: '10px 8px' }}>{t('admin.metricas.actionsCol')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((r) =>
                        editandoId === r.id ? (
                          <React.Fragment key={r.id}>
                          <tr>
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
                                  placeholder={t('admin.formularios.minAbbrPh')}
                                  value={editFormData.duracion || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, duracion: e.target.value })}
                                  style={{ padding: '4px', width: '46px' }}
                                  title={t('admin.franjas.durationMinutesTitle')}
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
                                placeholder={t('admin.formularios.emailLabel')}
                              />
                              {(() => {
                                const w = adminReservaJugadorWhatsappWaMeUrl(String(editFormData.jugador_whatsapp_perfil || '').trim());
                                const label = String(editFormData.jugador_whatsapp_perfil || '').trim();
                                return w && label ? (
                                  <div style={{ marginTop: '6px', fontSize: '11px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{label}</span>
                                    <a
                                      href={w}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: 'inline-flex',
                                        padding: '3px 7px',
                                        borderRadius: '5px',
                                        background: '#E11B22',
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
                                style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', width: '100%' }}
                              >
                                <option value="reservada">📋 Reservada</option>
                                <option value="pendiente_pago_manual">🟡 Pendiente pago manual</option>
                                <option value="pendiente_pago_efectivo">💵 Pendiente cobro en sede (efectivo)</option>
                                <option value="confirmada">{t('admin.reservas.badgeConfirmed')}</option>
                                <option value="completada">{t('admin.reservas.badgeCompleted')}</option>
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
                                <button type="button" onClick={() => guardarEdicion(r.id)} style={BTN({ background: '#E11B22' })}>
                                  ✅ Guardar
                                </button>
                                <button type="button" onClick={cancelarEdicion} style={BTN({ background: '#999' })}>
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td
                              colSpan={esAdminNacional ? 8 : 7}
                              style={{
                                padding: '10px 12px 14px',
                                background: 'var(--bg-card)',
                                borderBottom: '1px solid #e2e8f0',
                                verticalAlign: 'top',
                              }}
                            >
                              <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                                Historial
                              </div>
                              {(() => {
                                const h = reservaHistorialUi[r.id];
                                const abierto = Boolean(h?.open);
                                if (!abierto) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => void abrirHistorialReserva(r.id)}
                                      style={BTN({ background: '#64748b' })}
                                    >
                                      Ver historial
                                    </button>
                                  );
                                }
                                return (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => cerrarHistorialReserva(r.id)}
                                      style={{ ...BTN({ background: '#94a3b8' }), marginBottom: '10px' }}
                                    >
                                      Ocultar historial
                                    </button>
                                    {h.loading ? (
                                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('admin.common.loadingEllipsis')}</div>
                                    ) : h.error ? (
                                      <div style={{ fontSize: '13px', color: '#b91c1c' }}>{h.error}</div>
                                    ) : !h.rows?.length ? (
                                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('admin.metricas.noStateChanges')}</div>
                                    ) : (
                                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                        {h.rows.map((row) => (
                                          <li key={row.id} style={{ marginBottom: '8px' }}>
                                            <strong>{formatReservaHistorialFechaHora(row.created_at)}</strong>
                                            {' · '}
                                            {row.estado_anterior != null && String(row.estado_anterior).trim() !== ''
                                              ? `${row.estado_anterior} → ${row.estado_nuevo}`
                                              : `→ ${row.estado_nuevo}`}
                                            {' · '}
                                            {etiquetaQuienReservaHistorial(row.changed_by)}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                          </React.Fragment>
                        ) : (
                          <tr key={r.id}>
                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{formatFecha(r.fecha) || '—'}</td>
                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{horarioReservaAdmin(r)}</td>
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

      {activeTab === 'personalizar_hub' && (isSuperAdmin || esEditorContenido) ? (
        <AdminHubPersonalizarSection
          apiBaseUrl={apiBaseUrl}
          accessToken={session?.access_token}
          isSuperAdmin={isSuperAdmin}
        />
      ) : null}

      {activeTab === 'config' && puedeVerConfig && <div className="section">
        <h2 style={{ marginBottom: '10px', paddingBottom: '10px' }}>{t('admin.metricas.pointsConfigTitle')}</h2>
        {/* Niveles de torneo + tipos custom unificados — título pegado a la tabla (nota “Mi Sede” abajo) */}
        <div style={{ marginBottom: '4px' }}>
          <h3 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '8px', fontSize: '16px' }}>
            Puntos base por nivel de torneo
          </h3>
          <div className="admin-config-puntos-wrap">
          <table className="admin-config-puntos-table" style={{ width: '100%', maxWidth: '560px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--accent)', color: '#fff' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left',   fontSize: '13px', fontWeight: 600, color: '#fff' }}>{t('admin.formularios.levelCol')}</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, width: '130px', color: '#fff' }}>{t('admin.formularios.totalTournamentPtsCol')}</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, width: '90px', color: '#fff' }}></th>
              </tr>
            </thead>
            <tbody>
              {/* Standard rows — editable names and deletable */}
              {STANDARD_KEYS.filter(key => !configNivelesHidden.has(key)).map((key, i) => (
                <tr key={key} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg-page)' : 'var(--bg-card)' }}>
                  {editandoTipoId === key ? (
                    <>
                      <td style={{ padding: '7px 12px' }}>
                        <input type="text" value={editandoTipoData.nombre}
                          onChange={e => setEditandoTipoData(p => ({ ...p, nombre: e.target.value }))}
                          style={{ width: '100%', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <input type="number" min="0" value={editandoTipoData.puntos}
                          onChange={e => setEditandoTipoData(p => ({ ...p, puntos: parseInt(e.target.value) || 0 }))}
                          style={{ width: '72px', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', textAlign: 'center', color: 'var(--text-primary)' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <button onClick={() => {
                          setConfigNivelesLabels(prev => ({ ...prev, [key]: editandoTipoData.nombre }));
                          setConfigNiveles(prev => ({ ...prev, [key]: editandoTipoData.puntos }));
                          setEditandoTipoId(null);
                        }} style={{ padding: '3px 8px', background: '#E11B22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✅</button>
                        <button onClick={() => setEditandoTipoId(null)}
                          style={{ padding: '3px 8px', background: '#999', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="admin-config-puntos-nivel" style={{ padding: '10px 16px', fontSize: '14px' }}>{configNivelesLabels[key] || CONFIG_NIVELES_LABELS_DEFAULT[key] || key}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <input type="number" min="0" value={configNiveles[key] ?? 0}
                          onChange={e => setConfigNiveles(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                          style={{ width: '80px', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-primary)' }} />
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t('admin.metricas.totalPtsShort')}</div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button onClick={() => { setEditandoTipoId(key); setEditandoTipoData({ nombre: configNivelesLabels[key], puntos: configNiveles[key] ?? 0 }); }}
                          style={{ padding: '3px 8px', background: '#E11B22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✏️</button>
                        <button onClick={() => { if (window.confirm(t('admin.confirmaciones.deleteLevel', { name: configNivelesLabels[key] }))) setConfigNivelesHidden(prev => new Set([...prev, key])); }}
                          style={{ padding: '3px 8px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {/* Custom rows — with edit/delete */}
              {configTiposCustom.length > 0 && (
                <tr>
                  <td colSpan="3" style={{ padding: '6px 16px 2px', fontSize: '11px', fontWeight: '600', color: '#b91c1c', background: '#fef2f2', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Tipos personalizados
                  </td>
                </tr>
              )}
              {configTiposCustom.map((tipo, i) => (
                <tr key={tipo.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg-page)' : 'var(--bg-card)' }}>
                  {editandoTipoId === tipo.id ? (
                    <>
                      <td style={{ padding: '7px 12px' }}>
                        <input type="text" value={editandoTipoData.nombre}
                          onChange={e => setEditandoTipoData(p => ({ ...p, nombre: e.target.value }))}
                          style={{ width: '100%', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <input type="number" min="0" value={editandoTipoData.puntos}
                          onChange={e => setEditandoTipoData(p => ({ ...p, puntos: parseInt(e.target.value) || 0 }))}
                          style={{ width: '72px', padding: '5px 8px', border: '1px solid #c4b5fd', borderRadius: '4px', fontSize: '13px', textAlign: 'center', color: 'var(--text-primary)' }} />
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <button onClick={() => { setConfigTiposCustom(prev => prev.map(t => t.id === tipo.id ? { ...t, ...editandoTipoData } : t)); setEditandoTipoId(null); }}
                          style={{ padding: '3px 8px', background: '#E11B22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✅</button>
                        <button onClick={() => setEditandoTipoId(null)}
                          style={{ padding: '3px 8px', background: '#999', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="admin-config-puntos-nivel" style={{ padding: '10px 16px', fontSize: '14px' }}>{tipo.nombre || tipo.id}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{tipo.puntos}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t('admin.metricas.totalPtsShort')}</div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button onClick={() => { setEditandoTipoId(tipo.id); setEditandoTipoData({ nombre: tipo.nombre, puntos: tipo.puntos }); }}
                          style={{ padding: '3px 8px', background: '#E11B22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '3px' }}>✏️</button>
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
                  <input type="text" placeholder={t('admin.formularios.tournamentTypeExamplePh')} value={nuevoTipo.nombre}
                    onChange={e => setNuevoTipo(p => ({ ...p, nombre: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && nuevoTipo.nombre.trim()) { setConfigTiposCustom(prev => [...prev, { id: Date.now().toString(), nombre: nuevoTipo.nombre.trim(), puntos: nuevoTipo.puntos || 0 }]); setNuevoTipo({ nombre: '', puntos: 0 }); } }}
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--bg-input)', boxSizing: 'border-box' }} />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <input type="number" placeholder={t('admin.formularios.pointsAbbrPh')} min="0" value={nuevoTipo.puntos || ''}
                    onChange={e => setNuevoTipo(p => ({ ...p, puntos: parseInt(e.target.value) || 0 }))}
                    style={{ width: '72px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '13px', color: 'var(--text-primary)', textAlign: 'center', background: 'var(--bg-input)' }} />
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <button
                    onClick={() => { if (!nuevoTipo.nombre.trim()) return; setConfigTiposCustom(prev => [...prev, { id: Date.now().toString(), nombre: nuevoTipo.nombre.trim(), puntos: nuevoTipo.puntos || 0 }]); setNuevoTipo({ nombre: '', puntos: 0 }); }}
                    style={{ padding: '5px 12px', background: 'linear-gradient(135deg, #E11B22, #991b1b)', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    + Agregar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
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
            <div style={{ marginBottom: 0 }}>
              <h3 style={{ color: 'var(--text-primary)', marginTop: '4px', marginBottom: '8px', fontSize: '16px' }}>
                Distribución de puntos por posición
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Previsualizar con:
                </label>
                <select value={previewNivel} onChange={e => setPreviewNivel(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--bg-input)', cursor: 'pointer' }}>
                  {todosNiveles.map(n => (
                    <option key={n.value} value={n.value}>{n.label} ({n.pts} pts totales)</option>
                  ))}
                </select>
              </div>
              <div className="admin-config-puntos-wrap">
              <table className="admin-config-puntos-table" style={{ width: '100%', maxWidth: '520px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--accent)', color: '#fff' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#fff' }}>{t('admin.formularios.positionCol')}</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, width: '110px', color: '#fff' }}>% del total</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, width: '100px', whiteSpace: 'nowrap', color: '#fff' }}>{t('admin.metricas.pointsCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4,5,6,7,8,9,10].map((pos, i) => {
                    const pct = configPosiciones[pos] ?? 0;
                    const pts = Math.round((pct / 100) * totalPts);
                    return (
                      <tr key={pos} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg-page)' : 'var(--bg-card)' }}>
                        <td style={{ padding: '10px 16px', fontSize: '14px', color: 'var(--text-primary)' }}>
                          {pos === 1 ? '🥇 1ro' : pos === 2 ? '🥈 2do' : pos === 3 ? '🥉 3ro' : `${pos}°`}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <input type="number" min="0" max="100" value={pct}
                              onChange={e => setConfigPosiciones(prev => ({ ...prev, [pos]: parseInt(e.target.value) || 0 }))}
                              style={{ width: '70px', padding: '5px 24px 5px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', textAlign: 'right', fontWeight: 'bold', color: 'var(--text-primary)' }} />
                            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--text-secondary)', pointerEvents: 'none' }}>%</span>
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
              </div>
              {/* Percentage sum indicator */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                marginTop: '10px', padding: '7px 14px', borderRadius: '8px',
                background: pctDiff === 0 ? 'rgba(22,163,74,0.15)' : pctDiff > 0 ? 'rgba(220,38,38,0.12)' : 'rgba(234,88,12,0.12)',
                border: `1.5px solid ${pctDiff === 0 ? '#16a34a' : pctDiff > 0 ? '#dc2626' : '#ea580c'}`,
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: pctDiff === 0 ? '#16a34a' : pctDiff > 0 ? '#dc2626' : '#ea580c' }}>
                  {t('admin.metricas.totalPct', { pct: pctSum })}
                </span>
                <span style={{ fontSize: '12px', color: pctDiff === 0 ? '#16a34a' : pctDiff > 0 ? '#dc2626' : '#ea580c' }}>
                  {pctDiff === 0
                    ? t('admin.metricas.distributionComplete')
                    : pctDiff > 0
                      ? t('admin.metricas.exceedsBy', { pct: pctDiff })
                      : t('admin.metricas.missingBy', { pct: -pctDiff })}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Save button — directly under distribution (no info block in between) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px', marginBottom: '16px' }}>
          <button
            onClick={guardarConfig}
            disabled={configSaving}
            style={{
              padding: '12px 28px',
              background: configSaving ? '#fca5a5' : 'linear-gradient(135deg, #E11B22, #991b1b)',
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
            {configSaving ? t('admin.metricas.savingEllipsis') : t('admin.metricas.saveConfigBtn')}
          </button>
          {configMsg && (
            <span style={{ fontSize: '14px', fontWeight: '600', color: configMsg.startsWith('✅') ? '#86efac' : '#fde68a' }}>
              {configMsg}
            </span>
          )}
        </div>

        <div
          style={{
            marginBottom: '20px',
            padding: '12px 14px',
            background: 'var(--bg-input)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            maxWidth: '640px',
          }}
        >
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {t('admin.sedes.venueDataConfigHint')}
          </p>
        </div>

        <AdminSponsorsSection isSuperAdmin={isSuperAdmin} />

      </div>}

      {activeTab === 'planes' && puedeVerConfig && (
        <div className="section">
          <h2 style={{ marginBottom: '10px', paddingBottom: '10px' }}>{t('admin.metricas.plansPricingTitle')}</h2>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Precio mensual en USD según la cantidad de canchas del club. Solo super admin puede editar.
          </p>
          <div className="admin-planes-table-wrap" style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
            <table className="admin-planes-table"
              style={{
                width: '100%',
                minWidth: 520,
                maxWidth: '640px',
                borderCollapse: 'collapse',
                background: 'var(--bg-card)',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <thead>
                <tr style={{ background: '#E11B22', color: '#fff' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>{t('admin.formularios.name')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>{t('admin.formularios.courtsCol')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{t('admin.metricas.priceUsdMonthCol')}</th>
                  <th style={{ padding: '10px 16px', width: '96px' }} />
                </tr>
              </thead>
              <tbody>
                {planPricingLoading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Cargando…
                    </td>
                  </tr>
                ) : planPricingRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {t('admin.metricas.noPlansSqlHint')}
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
                        <td className="admin-planes-nombre" style={{ padding: '10px 16px', fontWeight: 700 }}>{p.nombre}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontSize: '14px' }}>{rango}</td>
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
                                  background: planPricingSavingId === p.id ? '#94a3b8' : '#E11B22',
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  cursor: planPricingSavingId === p.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {planPricingSavingId === p.id ? '…' : t('general.save')}
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
                                  background: 'var(--bg-card)',
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
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '16px' }}>
              Invitaciones de administradores
            </h3>
            <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setInviteClubForm({ email: '', nombre_club: '', pais: '', provincia: '', ciudad: '' });
                  setInviteAdminModalStep('tipo');
                  setInviteAdminTipo(null);
                  setInviteClubModalOpen(true);
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #E11B22, #b91c1c)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✉️ Invitar nuevo admin
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: '10px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#E11B22', color: '#fff' }}>
                    <th style={{ padding: '8px' }}>{t('admin.franjas.type')}</th>
                    <th style={{ padding: '8px' }}>{t('admin.formularios.emailLabel')}</th>
                    <th style={{ padding: '8px' }}>{t('admin.metricas.suggestedClubCol')}</th>
                    <th style={{ padding: '8px' }}>{t('admin.formularios.countryLabel')}</th>
                    <th style={{ padding: '8px' }}>{t('admin.metricas.statusCol')}</th>
                    <th style={{ padding: '8px' }}>{t('admin.metricas.expiresCol')}</th>
                    <th style={{ padding: '8px' }}>{t('admin.formularios.actionCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {adminInvitacionesLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '10px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600 }}>
                        Cargando…
                      </td>
                    </tr>
                  ) : adminInvitacionesRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '10px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600 }}>
                        No hay invitaciones pendientes
                      </td>
                    </tr>
                  ) : (
                    adminInvitacionesRows.map((inv) => {
                      const estadoLabel =
                        inv.estado === 'pendiente'
                          ? t('admin.roles.invitePendingSignup')
                          : inv.estado === 'completada'
                            ? 'Completada'
                            : inv.estado === 'expirada'
                              ? 'Expirada'
                              : inv.estado === 'cancelada'
                                ? t('admin.sedes.subscriptionCancelled')
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
                        <tr key={inv.id} style={{ borderTop: '1px solid #e2e8f0', color: 'var(--text-primary)' }}>
                          <td style={{ padding: '8px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                            {labelInvitacionAdminTipo(inv)}
                          </td>
                          <td style={{ padding: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>{inv.email}</td>
                          <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{inv.nombre_club || '—'}</td>
                          <td style={{ padding: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>{inv.pais || '—'}</td>
                          <td style={{ padding: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{estadoLabel}</td>
                          <td style={{ padding: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>{venceTxt}</td>
                          <td style={{ padding: '8px', color: 'var(--text-primary)' }}>
                            {inv.estado === 'pendiente' ? (
                              <button
                                type="button"
                                onClick={() => void reenviarInvitacionClub(inv.id)}
                                style={{
                                  padding: '4px 9px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  background: '#E11B22',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                }}
                              >
                                Reenviar email
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
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
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '12px', fontSize: '16px' }}>
              Gestión de Administradores
            </h3>
            <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 220px', minWidth: '180px', maxWidth: '400px' }}>
                <label htmlFor="admin-busqueda-roles" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'rgba(248,250,252,0.98)', marginBottom: '4px' }}>
                  Buscar por nombre o email
                </label>
                <input
                  id="admin-busqueda-roles"
                  type="search"
                  value={busquedaRolesAdmin}
                  onChange={(e) => setBusquedaRolesAdmin(e.target.value)}
                  placeholder={t('admin.formularios.nameOrEmailPh')}
                  autoComplete="off"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #c4b5fd',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ overflowX: rolesTabViewportNarrow ? 'visible' : 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  background: 'var(--bg-card)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  tableLayout: rolesTabViewportNarrow ? 'fixed' : 'auto',
                }}
              >
                <thead>
                  {rolesTabViewportNarrow ? (
                    <tr style={{ background: '#E11B22', color: '#fff' }}>
                      <th style={{ padding: '8px', textAlign: 'left', width: '34%' }}>{t('admin.formularios.name')}</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Rol</th>
                      <th style={{ padding: '8px', textAlign: 'right', width: '22%', whiteSpace: 'nowrap' }}>{t('admin.formularios.actionCol')}</th>
                    </tr>
                  ) : (
                    <tr style={{ background: '#E11B22', color: '#fff' }}>
                      <th style={{ padding: '8px' }}>{t('admin.formularios.name')}</th>
                      <th style={{ padding: '8px' }}>{t('admin.formularios.emailLabel')}</th>
                      <th style={{ padding: '8px' }}>Rol</th>
                      <th style={{ padding: '8px' }}>{t('admin.metricas.scopeCol')}</th>
                      <th style={{ padding: '8px' }}>{t('admin.formularios.assignmentCol')}</th>
                      <th style={{ padding: '8px' }}>{t('admin.formularios.actionCol')}</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {adminRolesLoading ? (
                    <tr>
                      <td
                        colSpan={rolesTabViewportNarrow ? 3 : 6}
                        style={{ padding: '10px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600 }}
                      >
                        Cargando…
                      </td>
                    </tr>
                  ) : adminRolesRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={rolesTabViewportNarrow ? 3 : 6}
                        style={{ padding: '10px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600 }}
                      >
                        Sin administradores registrados
                      </td>
                    </tr>
                  ) : adminRolesRowsFiltrados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={rolesTabViewportNarrow ? 3 : 6}
                        style={{ padding: '10px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600 }}
                      >
                        Ningún administrador coincide con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    adminRolesRowsFiltrados.map((row) =>
                      rolesTabViewportNarrow ? (
                        <tr key={row.email} style={{ borderTop: '1px solid #e2e8f0', color: 'var(--text-primary)' }}>
                          <td
                            style={{
                              padding: '10px 8px',
                              verticalAlign: 'top',
                              wordBreak: 'break-word',
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3 }}>
                              {row.nombre || '—'}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-secondary)',
                                marginTop: '4px',
                                wordBreak: 'break-all',
                                lineHeight: 1.25,
                              }}
                            >
                              {row.email}
                            </div>
                          </td>
                          <td
                            style={{
                              padding: '10px 8px',
                              verticalAlign: 'top',
                              fontSize: '13px',
                              lineHeight: 1.4,
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {textoRolGestionAdminCompleto(row)}
                          </td>
                          <td
                            style={{
                              padding: '10px 8px',
                              verticalAlign: 'middle',
                              textAlign: 'right',
                            }}
                          >
                            {row.role === 'super_admin' ? (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void revocarRolAdmin(row.email)}
                                style={{
                                  padding: '6px 10px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  background: '#dc2626',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  whiteSpace: 'normal',
                                  maxWidth: '100%',
                                  lineHeight: 1.2,
                                }}
                              >
                                Revocar rol
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        <tr key={row.email} style={{ borderTop: '1px solid #e2e8f0', color: 'var(--text-primary)' }}>
                          <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{row.nombre || '—'}</td>
                          <td style={{ padding: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>{row.email}</td>
                          <td style={{ padding: '8px', color: 'var(--text-primary)' }}>
                            {row.role === 'editor_contenido' ? t('admin.formularios.contentEditorTitle') : row.role || '—'}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{row.alcance || '—'}</td>
                          <td style={{ padding: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>
                            {row.role === 'editor_contenido' ? t('admin.roles.editorScopeLabel') : null}
                            {row.role !== 'editor_contenido' && row.alcance === 'sede'
                              ? row.sede_nombre || `Sede ${row.sede_id || '—'}`
                              : null}
                            {row.role !== 'editor_contenido' && row.alcance === 'ciudad' ? row.ciudad || '—' : null}
                            {row.role !== 'editor_contenido' && row.alcance === 'provincia' ? row.provincia || '—' : null}
                            {row.role !== 'editor_contenido' && row.alcance === 'pais'
                              ? (() => {
                                  const p = String(row.pais || '').trim();
                                  if (!p) return '—';
                                  const f = banderaEmojiDesdeNombrePais(p);
                                  const nombre = paisTextoSinBanderaInicial(p) || p;
                                  return f ? `${f} ${nombre}`.trim() : nombre;
                                })()
                              : null}
                            {row.role !== 'editor_contenido' && row.alcance === 'global' ? t('admin.sponsors.scopeGlobal') : null}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-primary)' }}>
                            {row.role === 'super_admin' ? (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void revocarRolAdmin(row.email)}
                                style={{
                                  padding: '4px 9px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  background: '#dc2626',
                                  color: '#fff',
                                  cursor: 'pointer',
                                }}
                              >
                                Revocar rol
                              </button>
                            )}
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
            <div
              style={{
                marginTop: '28px',
                paddingTop: '20px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '16px' }}>
                Editor de contenido del hub
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.45, marginBottom: '14px', maxWidth: 520 }}>
                Asigná acceso solo a la sección «Personalizar Hub» (fotos, títulos y subtítulos de las cards del inicio del jugador).
              </p>
              {editorContenidoAsignado ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '12px',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                      {String(editorContenidoAsignado.nombre || '').trim() || editorContenidoAsignado.email}
                    </div>
                    {String(editorContenidoAsignado.nombre || '').trim() ? (
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          marginTop: '4px',
                          wordBreak: 'break-all',
                        }}
                      >
                        {editorContenidoAsignado.email}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void revocarRolAdmin(editorContenidoAsignado.email)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--accent)',
                      color: 'var(--bg-card)',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Revocar acceso
                  </button>
                </div>
              ) : !editorContenidoFormAbierto ? (
                <button
                  type="button"
                  onClick={() => setEditorContenidoFormAbierto(true)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  ＋ Agregar editor de contenido
                </button>
              ) : (
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', marginBottom: '12px' }}>
                    <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
                      <label htmlFor="editor-contenido-email" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Email
                      </label>
                      <input
                        id="editor-contenido-email"
                        type="email"
                        value={editorContenidoEmail}
                        onChange={(e) => setEditorContenidoEmail(e.target.value)}
                        placeholder={t('admin.formularios.emailExamplePh')}
                        autoComplete="off"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ flex: '1 1 200px', minWidth: '160px' }}>
                      <label htmlFor="editor-contenido-nombre" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Nombre (opcional)
                      </label>
                      <input
                        id="editor-contenido-nombre"
                        type="text"
                        value={editorContenidoNombre}
                        onChange={(e) => setEditorContenidoNombre(e.target.value)}
                        placeholder={t('admin.formularios.displayNamePh')}
                        autoComplete="off"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={editorContenidoSaving}
                      onClick={() => void asignarEditorContenido()}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: editorContenidoSaving ? 'var(--text-secondary)' : 'var(--accent)',
                        color: 'var(--bg-card)',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: editorContenidoSaving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {editorContenidoSaving ? t('admin.metricas.saving') : t('admin.formularios.assignEditor')}
                    </button>
                    <button
                      type="button"
                      disabled={editorContenidoSaving}
                      onClick={() => {
                        setEditorContenidoFormAbierto(false);
                        setEditorContenidoEmail('');
                        setEditorContenidoNombre('');
                      }}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: editorContenidoSaving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Solicitudes (super admin): altas nacionales + interés web, unificado ── */}
      {activeTab === 'solicitudes' && isSuperAdmin && (
        <div className="section" style={{ maxWidth: '980px', margin: '0 auto' }}>
          <h2 style={{ color: 'var(--text-primary)', textAlign: 'center', marginBottom: '8px' }}>{t('admin.sedes.requestsTitle')}</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '16px', fontSize: '14px' }}>
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
              { id: 'todos', label: t('admin.sponsors.allSports') },
              { id: 'pendiente', label: t('admin.sponsors.pendingStatus') },
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
            <p style={{ color: '#e2e8f0', textAlign: 'center' }}>{t('admin.common.loadingEllipsis')}</p>
          ) : solicitudesUnificadas.length === 0 ? (
            <p style={{ color: '#e2e8f0', textAlign: 'center' }}>{t('admin.metricas.noRequestsFilter')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {solicitudesUnificadas.map((row) => {
                const pendiente = row.estado === 'pendiente';
                const wa = waDigitsForUrl(row.whatsapp);
                const estadoLabel =
                  row.estado === 'aprobada' ? 'Aprobada' : row.estado === 'rechazada' ? 'Rechazada' : t('admin.sponsors.pendingStatus');
                const estadoChipBg =
                  row.estado === 'aprobada' ? '#dcfce7' : row.estado === 'rechazada' ? '#fee2e2' : '#fef9c3';
                const estadoChipColor =
                  row.estado === 'aprobada' ? '#166534' : row.estado === 'rechazada' ? '#991b1b' : '#854d0e';
                const origenLabel = row.kind === 'sede_nacional' ? t('admin.sedes.nationalSignup') : t('admin.sedes.webInterest');
                const sp = row.kind === 'sede_nacional' ? row.rawNacional : null;
                return (
                  <div
                    key={row.idKey}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: '14px',
                      padding: '16px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      color: 'var(--text-primary)',
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
                          background: '#fee2e2',
                          color: '#991b1b',
                        }}
                      >
                        {origenLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                      <div>
                        <strong>{t('admin.common.countryColon')}</strong> {row.pais} · <strong>{t('admin.common.cityColon')}</strong> {row.ciudad}
                      </div>
                      <div>
                        <strong>{t('admin.common.responsible')}</strong> {row.responsableNombre}
                      </div>
                      <div>
                        <strong>{t('admin.common.emailColon')}</strong>{' '}
                        {row.email && row.email !== '—' ? (
                          <a href={`mailto:${encodeURIComponent(row.email)}`} style={{ color: '#E11B22' }}>
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
                          <strong>{t('admin.common.interestType')}</strong> {etiquetaTipoInteresSolicitudLicencia(row.tipoInteres)} ·{' '}
                          <strong>Canchas:</strong>{' '}
                          {row.cantidadCanchas ?? '—'}
                        </div>
                      ) : null}
                      {row.kind === 'licencia_web' && row.mensaje ? (
                        <div>
                          <strong>Mensaje:</strong> {row.mensaje}
                        </div>
                      ) : null}
                      <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
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
                            background: 'var(--bg-card)',
                            cursor: 'pointer',
                          }}
                        >
                          {solicitudDetalleExpandidoKey === row.idKey ? t('admin.sedes.hideDetail') : t('admin.sedes.moreNationalSignup')}
                        </button>
                        {solicitudDetalleExpandidoKey === row.idKey ? (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '12px',
                              background: 'var(--bg-card)',
                              borderRadius: '10px',
                              fontSize: '13px',
                              lineHeight: 1.6,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <div>
                              <strong>{t('admin.common.addressColon')}</strong> {sp.direccion || '—'}
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
                              <strong>{t('admin.common.licenseeCountry')}</strong> {sp.licenciatario_pais || '—'}
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
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
                            background: '#E11B22',
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
                            background: '#E11B22',
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
                            background: '#E11B22',
                            color: '#fff',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'inline-block',
                          }}
                        >
                          💬 Contactar
                        </a>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('admin.reservas.noWhatsappNumber')}</span>
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
                background: 'linear-gradient(135deg, #E11B22, #b91c1c)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(225,27,34,0.35)',
              }}
            >
              ✏️ Editar sede
            </button>
          ) : null}
        </div>

        {miSedeLoading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Cargando datos de la sede...</p>
        ) : !miSede ? (
          <p style={{ color: 'var(--pm-color-error, #f87171)' }}>{t('admin.sedes.venueInfoNotFound')}</p>
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
                className="admin-editar-sede-dialog"
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxHeight: 'min(90vh, 760px)',
                  overflowY: 'auto',
                }}
              >
                <h3 id="editar-sede-modal-titulo" style={{ margin: '0 0 8px', fontSize: '18px' }}>
                  Editar sede
                </h3>
                <p className="admin-editar-sede-intro">
                  Datos del perfil público. Al guardar se actualizan en la base y se ven al entrar de nuevo a{' '}
                  <strong>/sede/…</strong>.
                </p>
                {[
                  { label: t('admin.sedes.clubNameLabel'), k: 'nombre' },
                  { label: t('admin.sedes.address'), k: 'direccion' },
                  { label: t('admin.formularios.cityLabel'), k: 'ciudad' },
                  { label: 'Provincia / Estado', k: 'provincia' },
                  { label: t('admin.formularios.countryLabel'), k: 'pais' },
                  { label: 'Horario apertura', k: 'horario_apertura', ph: 'Ej: 08:00' },
                  { label: 'Horario cierre', k: 'horario_cierre', ph: 'Ej: 23:00' },
                  {
                    label: t('admin.sedes.clubWhatsappLabel'),
                    k: 'telefono',
                    ph: 'Ej: 5493512345678',
                    hint: t('admin.formularios.phoneHint'),
                  },
                  { label: t('admin.sedes.contactEmailLabel'), k: 'email_contacto' },
                  { label: t('admin.sedes.latitude'), k: 'latitud', ph: '-34.92105', inputType: 'number' },
                  { label: t('admin.sedes.longitude'), k: 'longitud', ph: '-57.96505', inputType: 'number' },
                ].map(({ label, k, ph, hint, inputType }) => (
                  <div key={k} style={{ marginBottom: '12px' }}>
                    <label>{label}</label>
                    <input
                      type={inputType === 'number' ? 'number' : 'text'}
                      step={inputType === 'number' ? 'any' : undefined}
                      inputMode={inputType === 'number' ? 'decimal' : undefined}
                      value={editarSedeDraft[k] || ''}
                      placeholder={ph || ''}
                      onChange={(e) => setEditarSedeDraft((p) => ({ ...p, [k]: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                    {hint ? <p className="admin-editar-sede-hint">{hint}</p> : null}
                  </div>
                ))}
                <div style={{ marginBottom: '12px' }}>
                  <label>Moneda</label>
                  <select
                    value={editarSedeDraft.moneda || 'ARS'}
                    onChange={(e) => setEditarSedeDraft((p) => ({ ...p, moneda: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
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
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {t('admin.sedes.pricesByDurationCurrency', { currency: editarSedeDraft.moneda || 'ARS' })}
                </p>
                {[
                  { field: 'precio_60min', label: '60 min' },
                  { field: 'precio_90min', label: '90 min' },
                  { field: 'precio_120min', label: '120 min' },
                ].map(({ field, label }) => (
                  <div key={field} style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '4px' }}>{label}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={precioDuracionInputDisplay(editarSedeDraft[field])}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                        setEditarSedeDraft((p) => ({ ...p, [field]: digits }));
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: '12px' }}>
                  <label>{t('admin.sedes.clubDescriptionLabel')}</label>
                  <textarea
                    rows={4}
                    maxLength={300}
                    value={editarSedeDraft.descripcion || ''}
                    onChange={(e) => setEditarSedeDraft((p) => ({ ...p, descripcion: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label>{t('admin.sedes.clubStoryLabel')}</label>
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
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label>{t('admin.sedes.paymentMethodLabel')}</label>
                  <select
                    value={editarSedeDraft.metodo_pago || 'mercadopago'}
                    onChange={(e) => setEditarSedeDraft((p) => ({ ...p, metodo_pago: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                  >
                    <option value="mercadopago">{t('admin.sedes.paymentMercadoPago')}</option>
                    <option value="stripe">Stripe</option>
                    <option value="manual">Pago manual</option>
                    <option value="efectivo">{t('admin.sedes.paymentCashVenue')}</option>
                  </select>
                </div>
                {String(editarSedeDraft.metodo_pago || '') === 'mercadopago' ? (
                  <div style={{ marginBottom: '12px' }}>
                    <label>Access token MP (opcional)</label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={editarSedeDraft.mp_access_token || ''}
                      onChange={(e) => setEditarSedeDraft((p) => ({ ...p, mp_access_token: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ) : null}
                {String(editarSedeDraft.metodo_pago || '') === 'stripe' ? (
                  <div style={{ marginBottom: '12px' }}>
                    <label>Stripe Connect account ID</label>
                    <input
                      type="text"
                      value={editarSedeDraft.stripe_account_id || ''}
                      onChange={(e) => setEditarSedeDraft((p) => ({ ...p, stripe_account_id: e.target.value }))}
                      placeholder={t('admin.sedes.stripeAccountEllipsisPh')}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ) : null}
                {String(editarSedeDraft.metodo_pago || '') === 'efectivo' ? (
                  <p className="admin-editar-sede-hint" style={{ margin: '0 0 12px' }}>
                    Reservas sin Mercado Pago ni Stripe; el jugador paga al llegar. Sin fee del 3% en el flujo de reserva.
                  </p>
                ) : null}
                {String(editarSedeDraft.metodo_pago || '') === 'manual' ? (
                  <div style={{ marginBottom: '12px' }}>
                    <label>{t('admin.sedes.manualPaymentInstructions')}</label>
                    <textarea
                      rows={3}
                      value={editarSedeDraft.pago_manual_instrucciones || ''}
                      onChange={(e) =>
                        setEditarSedeDraft((p) => ({ ...p, pago_manual_instrucciones: e.target.value }))
                      }
                      style={{
                        width: '100%',
                        padding: '8px 10px',
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
                  <p className="admin-editar-sede-msg">{editarSedeModalMsg}</p>
                ) : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="admin-editar-sede-btn-cancel"
                    onClick={() => !miSedeSaving && setEditarSedeModalOpen(false)}
                    disabled={miSedeSaving}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
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
                      background: miSedeSaving ? '#94a3b8' : 'linear-gradient(135deg, #E11B22, #991b1b)',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: miSedeSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {miSedeSaving ? t('admin.metricas.saving') : 'Guardar cambios'}
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
                  background: 'var(--bg-card)',
                  borderRadius: '14px',
                  padding: '22px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                  boxSizing: 'border-box',
                }}
              >
                <h3 id="cancha-modal-title" style={{ margin: '0 0 16px', fontSize: '17px', color: 'var(--text-primary)' }}>
                  {canchaModalMode === 'add' ? t('admin.sedes.addCourt') : t('admin.sedes.editCourt')}
                </h3>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Nombre
                </label>
                <input
                  type="text"
                  value={canchaModalDraft.nombre}
                  onChange={(e) => setCanchaModalDraft((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder={t('admin.sedes.courtNameExamplePh')}
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    marginBottom: '14px',
                    boxSizing: 'border-box',
                  }}
                />
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Estado
                </label>
                <select
                  value={canchaModalDraft.estado === 'inactiva' ? 'inactiva' : 'activa'}
                  onChange={(e) => setCanchaModalDraft((p) => ({ ...p, estado: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    marginBottom: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="activa">Activa (visible en reservas)</option>
                  <option value="inactiva">Inactiva (no reservable)</option>
                </select>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Deporte
                </label>
                <select
                  value={canchaModalDraft.deporte || 'padbol'}
                  onChange={(e) => setCanchaModalDraft((p) => ({ ...p, deporte: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    marginBottom: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  {canchaDeporteAdminOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Descripción (opcional)
                </label>
                <textarea
                  rows={3}
                  value={canchaModalDraft.descripcion}
                  onChange={(e) => setCanchaModalDraft((p) => ({ ...p, descripcion: e.target.value }))}
                  placeholder={t('admin.reservas.internalNotesPh')}
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    border: '1px solid var(--border)',
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
                      background: 'var(--bg-card)',
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
                      background: canchaApiBusy ? '#94a3b8' : 'linear-gradient(135deg, #E11B22, #991b1b)',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: canchaApiBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {canchaApiBusy ? t('admin.metricas.saving') : t('general.save')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="admin-mi-sede-layout">
            <aside className="admin-mi-sede-sidebar" aria-label={t('admin.sedes.myVenueSectionsAria')}>
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
              <nav className="admin-mi-sede-nav-mobile" aria-label={t('admin.sedes.myVenueSectionsAria')}>
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
          {puedeVerMiSede && !esEditorContenido ? (
            <div
              style={{
                marginBottom: '24px',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border, #e2e8f0)',
                background: 'var(--bg-card)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <h3 className="admin-mi-sede-block-title" style={{ margin: '0 0 10px', fontSize: '15px', color: 'var(--text-primary)' }}>
                Mis sponsors disponibles
              </h3>
              {miSedeSponsorSlots.loading ? (
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>{t('admin.sponsors.loadingSponsorQuotas')}</p>
              ) : miSedeSponsorSlots.error ? (
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--pm-color-error, #dc2626)', fontWeight: 600 }}>
                  {miSedeSponsorSlots.error}
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    📢 Sponsors de tu sede: {miSedeSponsorSlots.used} de {miSedeSponsorSlots.max} slots usados (
                    {Math.max(0, miSedeSponsorSlots.max - miSedeSponsorSlots.used)} disponible
                    {Math.max(0, miSedeSponsorSlots.max - miSedeSponsorSlots.used) === 1 ? '' : 's'})
                  </p>
                  <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    Plan considerado: <strong>{miSedeSponsorSlots.planLabel}</strong> (límite según configuración de Padbol Match). Solo lectura:
                    no podés cambiar el cupo desde acá.
                  </p>
                  {miSedeSponsorSlots.usedConfigFallback ? (
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      Se muestran límites por defecto tipo Starter hasta que tu sede pueda leer la tabla global de cupos (si ya aplicaste la
                      migración en Supabase, ignorá este aviso).
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
          {/* ── 0. Licencia PADBOL ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>{t('admin.sedes.padbolLicenseTitle')}</h3>
            <div className="admin-mi-sede-theme-panel">
              {isSuperAdmin ? (
                /* Editable for super_admin */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <label className="admin-mi-sede-field-label" style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600 }}>{t('admin.sedes.licenseNumberLabel')}</label>
                    <input
                      type="text"
                      value={licenciaForm.numero_licencia}
                      placeholder={t('admin.sedes.fipaLicensePh')}
                      onChange={e => setLicenciaForm(p => ({ ...p, numero_licencia: e.target.value }))}
                      className="admin-mi-sede-theme-input"
                      style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <label className="admin-mi-sede-field-label" style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600 }}>{t('admin.sedes.licenseGrantDate')}</label>
                    <input
                      type="date"
                      value={licenciaForm.fecha_licencia}
                      onChange={e => setLicenciaForm(p => ({ ...p, fecha_licencia: e.target.value }))}
                      className="admin-mi-sede-theme-input"
                      style={{ padding: '7px 10px', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <label className="admin-mi-sede-field-label" style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600 }}>{t('admin.metricas.statusCol')}</label>
                    <select
                      value={licenciaForm.licencia_activa ? 'activa' : 'suspendida'}
                      onChange={e => setLicenciaForm(p => ({ ...p, licencia_activa: e.target.value === 'activa' }))}
                      className="admin-mi-sede-theme-input"
                      style={{ padding: '7px 10px', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                    >
                      <option value="activa">✅ Activa</option>
                      <option value="suspendida">{t('admin.sedes.licenseSuspended')}</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={guardarLicencia} disabled={licenciaSaving}
                      style={{ padding: '10px 24px', background: licenciaSaving ? '#fecaca' : 'linear-gradient(135deg, #E11B22, #991b1b)', color: 'white', border: 'none', borderRadius: '8px', cursor: licenciaSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                      {licenciaSaving ? t('admin.metricas.savingEllipsis') : '💾 Guardar licencia'}
                    </button>
                    {licenciaMsg && <span style={{ fontSize: '13px', fontWeight: 600, color: licenciaMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{licenciaMsg}</span>}
                  </div>
                </>
              ) : (
                /* Read-only for admin_club / admin_nacional */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span className="admin-mi-sede-field-label" style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('admin.sedes.licenseNumberLabel')}</span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                      {licenciaForm.numero_licencia || <span style={{ color: 'var(--text-secondary)', fontFamily: 'inherit', fontWeight: 400 }}>—</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span className="admin-mi-sede-field-label" style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('admin.sedes.licenseGrantDate')}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      {licenciaForm.fecha_licencia
                        ? new Date(licenciaForm.fecha_licencia + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span className="admin-mi-sede-field-label" style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('admin.metricas.statusCol')}</span>
                    <span style={{
                      padding: '4px 14px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                      background: licenciaForm.licencia_activa ? '#dcfce7' : '#fee2e2',
                      color:      licenciaForm.licencia_activa ? '#16a34a' : '#dc2626',
                    }}>
                      {licenciaForm.licencia_activa ? '✅ Activa' : t('admin.sedes.licenseSuspended')}
                    </span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    🔒 Solo un Super Admin puede modificar estos datos.
                  </p>
                </div>
              )}
            </div>
          </div>

          {(esAdminClub || isSuperAdmin) && sedeId ? <AdminHubPromoSedeSection sedeId={Number(sedeId)} /> : null}

          {/* ── Colores del hero (página pública de la sede) ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>{t('admin.sedes.heroColorsTitle')}</h3>
            <div className="admin-mi-sede-theme-panel">
              <p className="admin-mi-sede-theme-muted" style={{ margin: '0 0 16px', fontSize: '13px', lineHeight: 1.5 }}>
                El bloque derecho del hero público usa siempre un degradado del color principal al secundario. El texto se ajusta solo según la luminosidad del color principal.
              </p>
              {[
                { label: 'Color principal (degradado inicio)', field: 'color_hero_primario' },
                { label: 'Color secundario (degradado fin)', field: 'color_hero_secundario' },
                { label: t('admin.sedes.heroBorderColorLabel'), field: 'color_borde_hero' },
              ].map(({ label, field }) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <label className="admin-mi-sede-field-label" style={{ width: '200px', flexShrink: 0, fontSize: '13px', fontWeight: 600, paddingTop: '4px' }}>{label}</label>
                  <input
                    type="color"
                    value={normalizeHexSedeAdmin(miSedeForm[field]) || (field === 'color_hero_primario' ? '#4C1D95' : field === 'color_hero_secundario' ? '#7C3AED' : '#6D28D9')}
                    onChange={(e) => setMiSedeForm((p) => ({ ...p, [field]: e.target.value }))}
                    style={{ width: 48, height: 36, padding: 0, border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    className="admin-mi-sede-theme-input"
                    value={miSedeForm[field] || ''}
                    onChange={(e) => setMiSedeForm((p) => ({ ...p, [field]: e.target.value }))}
                    style={{ flex: 1, minWidth: '120px', padding: '7px 10px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace', boxSizing: 'border-box' }}
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
                  <div style={{ width: '72px', flexShrink: 0, background: 'rgba(15, 23, 42, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(248, 250, 252, 0.45)', fontSize: '22px' }}>⚽</div>
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
                      {miSedeForm.nombre || t('admin.sedes.yourClub')}
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
              <p className="admin-mi-sede-theme-muted" style={{ margin: '14px 0 0', fontSize: '12px' }}>
                Guarda los cambios con «Guardar cambios» en Información general.
              </p>
            </div>
          </div>

          {/* ── 1. Info General ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>{t('admin.sedes.generalInfoTitle')}</h3>
            <div className="admin-mi-sede-theme-panel">
              {[
                { label: t('admin.sedes.clubNameLabel'),        field: 'nombre' },
                { label: t('admin.sedes.address'),              field: 'direccion' },
                { label: t('admin.formularios.cityLabel'),                 field: 'ciudad' },
                { label: 'Provincia / Estado',     field: 'provincia' },
                { label: t('admin.formularios.countryLabel'),                   field: 'pais' },
                { label: t('admin.sedes.clubWhatsappLabel'),       field: 'telefono', placeholder: t('admin.sedes.phoneExamplePh'), hint: t('admin.sedes.phoneNoLeadingZero') },
                { label: t('admin.sedes.contactEmailLabel'),      field: 'email_contacto' },
                { label: 'Horario apertura',       field: 'horario_apertura', placeholder: 'Ej: 08:00' },
                { label: 'Horario cierre',         field: 'horario_cierre',   placeholder: 'Ej: 23:00' },
                { label: t('admin.sedes.latitude'), field: 'latitud', placeholder: 'Ej: -34.92105', inputType: 'number' },
                { label: t('admin.sedes.longitude'), field: 'longitud', placeholder: 'Ej: -57.96505', inputType: 'number', hint: t('admin.sedes.coordsGoogleMapsHint') },
              ].map(({ label, field, placeholder, hint, inputType }) => (
                <div key={field} className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', paddingTop: '8px' }}>{label}</label>
                  <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                    <input
                      type={inputType === 'number' ? 'number' : 'text'}
                      step={inputType === 'number' ? 'any' : undefined}
                      inputMode={inputType === 'number' ? 'decimal' : undefined}
                      value={miSedeForm[field] || ''}
                      placeholder={placeholder || ''}
                      onChange={e => setMiSedeForm(p => ({ ...p, [field]: e.target.value }))}
                      className="admin-mi-sede-theme-input"
                      style={{ width: '100%', maxWidth: '100%', padding: '7px 10px', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                    {hint && <p className="admin-mi-sede-theme-muted" style={{ margin: '3px 0 0', fontSize: '11px' }}>{hint}</p>}
                  </div>
                </div>
              ))}
              <div className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', paddingTop: '8px' }}>
                  Slogan
                </label>
                <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                  <input
                    type="text"
                    maxLength={80}
                    value={miSedeForm.slogan || ''}
                    placeholder="Ej: El mejor padbol de la zona"
                    onChange={(e) => setMiSedeForm((p) => ({ ...p, slogan: e.target.value.slice(0, 80) }))}
                    className="admin-mi-sede-theme-input"
                    style={{ width: '100%', maxWidth: '100%', padding: '7px 10px', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '12px', color: (miSedeForm.slogan || '').length >= 72 ? '#dc2626' : '#9ca3af', marginTop: '3px' }}>
                    {(miSedeForm.slogan || '').length}/80
                  </div>
                  <p className="admin-mi-sede-theme-muted" style={{ margin: '4px 0 0', fontSize: '11px', lineHeight: 1.45 }}>
                    Tagline corta debajo del nombre en <strong>/sede/…</strong>.
                  </p>
                </div>
              </div>
              <div className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', paddingTop: '8px' }}>
                  Descripción
                </label>
                <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                  <textarea
                    rows={4}
                    maxLength={300}
                    value={miSedeForm.descripcion || ''}
                    placeholder="Contá en pocas líneas qué ofrece tu club…"
                    onChange={e => setMiSedeForm(p => ({ ...p, descripcion: e.target.value }))}
                    className="admin-mi-sede-theme-input"
                    style={{ width: '100%', maxWidth: '100%', padding: '7px 10px', borderRadius: '6px', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '12px', color: (miSedeForm.descripcion || '').length >= 280 ? '#dc2626' : '#9ca3af', marginTop: '3px' }}>
                    {(miSedeForm.descripcion || '').length}/300
                  </div>
                  <p className="admin-mi-sede-theme-muted" style={{ margin: '4px 0 0', fontSize: '11px', lineHeight: 1.45 }}>
                    Texto sobre el club en el perfil público (sección Descripción).
                  </p>
                </div>
              </div>
              <div className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', paddingTop: '8px' }}>
                  Instalaciones
                </label>
                <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: '8px',
                    }}
                  >
                    {SEDE_AMENITY_DEFINITIONS.map((amenity) => {
                      const selected = amenitiesArrayToSelectionSet(miSedeForm.amenities).has(amenity.key);
                      return (
                        <label
                          key={amenity.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: `1px solid ${selected ? 'var(--primary, #e33030)' : 'var(--border, #2a2a2a)'}`,
                            background: selected ? 'rgba(227, 48, 48, 0.08)' : 'transparent',
                            cursor: 'pointer',
                            fontSize: '13px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) => {
                              const current = amenitiesArrayToSelectionSet(miSedeForm.amenities);
                              if (e.target.checked) current.add(amenity.key);
                              else current.delete(amenity.key);
                              const nextAmenities = [...current];
                              setMiSedeForm((p) => ({
                                ...p,
                                amenities: nextAmenities,
                              }));
                              void guardarInstalacionesMiSede(nextAmenities);
                            }}
                          />
                          <span aria-hidden>{amenity.icon}</span>
                          <span>{amenity.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="admin-mi-sede-theme-muted" style={{ margin: '8px 0 0', fontSize: '11px', lineHeight: 1.45 }}>
                    Se guardan al marcar/desmarcar y se muestran en el perfil público (sección Instalaciones).
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => void guardarInstalacionesMiSede()}
                      disabled={miSedeInstalacionesSaving}
                      style={{
                        padding: '8px 16px',
                        background: miSedeInstalacionesSaving ? '#fecaca' : 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: miSedeInstalacionesSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    >
                      {miSedeInstalacionesSaving ? 'Guardando…' : 'Guardar instalaciones'}
                    </button>
                    {miSedeInstalacionesMsg ? (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: miSedeInstalacionesMsg.startsWith('✅') ? '#4ade80' : '#fca5a5' }}>
                        {miSedeInstalacionesMsg}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', paddingTop: '8px' }}>
                  Historia del club
                </label>
                <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                  <textarea
                    rows={8}
                    maxLength={500}
                    value={miSedeForm.historia || ''}
                    placeholder={t('admin.sedes.aboutPlaceholder')}
                    onChange={(e) =>
                      setMiSedeForm((p) => ({ ...p, historia: e.target.value.slice(0, 500) }))
                    }
                    className="admin-mi-sede-theme-input"
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      fontSize: '14px',
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
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    Texto largo opcional en <strong>/sede/…</strong> (complementa la descripción corta).
                  </p>
                </div>
              </div>
              <div className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <label style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Año de fundación
                </label>
                <div style={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1800}
                    max={2100}
                    step={1}
                    placeholder={t('admin.sedes.yearFoundedPh')}
                    value={miSedeForm.anio_fundacion || ''}
                    onChange={(e) =>
                      setMiSedeForm((p) => ({ ...p, anio_fundacion: e.target.value.replace(/[^\d]/g, '').slice(0, 4) }))
                    }
                    className="admin-mi-sede-theme-input"
                    style={{
                      width: '100%',
                      maxWidth: '160px',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <p className="admin-mi-sede-theme-muted" style={{ margin: '4px 0 0', fontSize: '11px', lineHeight: 1.45 }}>
                    Opcional. Se muestra en la sección «En números» del perfil público del club.
                  </p>
                </div>
              </div>
              <div className="admin-mi-sede-field-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <label className="admin-mi-sede-field-label" style={{ width: '180px', flexShrink: 0, fontSize: '13px', fontWeight: 600 }}>Moneda</label>
                <select
                  value={miSedeForm.moneda || 'ARS'}
                  onChange={(e) => setMiSedeForm((p) => ({ ...p, moneda: e.target.value }))}
                  className="admin-mi-sede-theme-input"
                  style={{ width: '100%', maxWidth: '100%', padding: '7px 10px', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', flex: 1, minWidth: 0 }}
                >
                  <option value="ARS">{t('admin.sedes.currencyArs')}</option>
                  <option value="USD">{t('admin.sedes.currencyUsd')}</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="BRL">{t('admin.sedes.currencyBrl')}</option>
                  <option value="CLP">{t('admin.sedes.currencyClp')}</option>
                  <option value="UYU">{t('admin.sedes.currencyUyu')}</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={guardarMiSede} disabled={miSedeSaving}
                  style={{ padding: '10px 24px', background: miSedeSaving ? '#fecaca' : 'linear-gradient(135deg, #E11B22, #991b1b)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  {miSedeSaving ? t('admin.metricas.savingEllipsis') : '💾 Guardar cambios'}
                </button>
                {miSedeMsg && <span style={{ fontSize: '13px', fontWeight: 600, color: miSedeMsg.startsWith('✅') ? '#4ade80' : '#fca5a5' }}>{miSedeMsg}</span>}
              </div>
            </div>
          </div>
          </div>

          {/* ── Precios por duración (60 / 90 / 120 min) ── */}
          <div id="admin-mi-sede-precios" style={{ marginBottom: '32px' }}>
            <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>
              {t('admin.sedes.pricesByDuration')}
            </h3>
            <div className="admin-mi-sede-theme-panel">
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {t('admin.sedes.pricesByDurationCurrency', { currency: miSedeForm.moneda || 'ARS' })}
              </p>
              {[
                { field: 'precio_60min', label: '60 min' },
                { field: 'precio_90min', label: t('admin.sedes.price90minLabel') },
                { field: 'precio_120min', label: '120 min' },
              ].map(({ field, label }) => (
                <div
                  key={field}
                  className="admin-mi-sede-field-row admin-mi-sede-precio-base"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}
                >
                  <label style={{ flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '140px' }}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, maxWidth: '100%' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{miSedeForm.moneda || 'ARS'}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={precioDuracionInputDisplay(miSedeForm[field])}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                        setMiSedeForm((p) => ({ ...p, [field]: digits }));
                      }}
                      placeholder={t('admin.sedes.emptyNotOfferedPh')}
                      style={{ width: '100%', maxWidth: '100%', minWidth: 0, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'right', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={guardarPreciosDuracion}
                  disabled={miSedePreciosSaving}
                  style={{ padding: '8px 20px', background: miSedePreciosSaving ? '#fecaca' : 'linear-gradient(135deg, #E11B22, #b91c1c)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedePreciosSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                >
                  {miSedePreciosSaving ? t('admin.metricas.savingEllipsis') : t('admin.sedes.savePricesButton')}
                </button>
                {miSedePreciosMsg ? (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: miSedePreciosMsg.startsWith('✅') ? '#4ade80' : '#fca5a5' }}>{miSedePreciosMsg}</span>
                ) : null}
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {t('admin.sedes.pricesDurationHint')}
              </p>

              {isSuperAdmin ? (
                <>
              <h4 className="admin-mi-sede-block-title" style={{ margin: '24px 0 10px', fontSize: '15px', fontWeight: 800 }}>
                {t('admin.sedes.durationsTableTitle')}
              </h4>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {t('admin.sedes.durationsTableHint')}
              </p>
              {miSedeDuracionesMsg ? (
                <p
                  style={{
                    margin: '0 0 10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: miSedeDuracionesMsg.startsWith('✅') ? '#4ade80' : '#fca5a5',
                  }}
                >
                  {miSedeDuracionesMsg}
                </p>
              ) : null}
              {miSedeDuracionesLoading ? (
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando duraciones…</p>
              ) : miSedeDuraciones.length === 0 ? (
                <p style={{ margin: '0 0 18px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  No hay filas en la tabla de duraciones para esta sede. Las reservas usan los precios por columna de arriba (compatibilidad) hasta que se carguen duraciones.
                </p>
              ) : (
                <div style={{ margin: '0 0 20px', display: 'grid', gap: '10px' }}>
                  {miSedeDuraciones.map((row) => {
                    const dr = miSedeDuracionDrafts[row.id] || { precio: '', activo: !!row.activo };
                    const mon = miSedeForm.moneda || 'ARS';
                    return (
                      <div
                        key={row.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          padding: '12px',
                          display: 'grid',
                          gap: '10px',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
                          {row.duracion_minutos} minutos
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Precio ({mon})</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={precioDuracionInputDisplay(dr.precio === '' ? '' : dr.precio)}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
                              setMiSedeDuracionDrafts((p) => ({
                                ...p,
                                [row.id]: { ...dr, precio: digits },
                              }));
                            }}
                            style={{
                              flex: '1 1 120px',
                              minWidth: '100px',
                              maxWidth: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              fontSize: '14px',
                              fontWeight: 700,
                              textAlign: 'right',
                              boxSizing: 'border-box',
                            }}
                          />
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!!dr.activo}
                              onChange={(e) =>
                                setMiSedeDuracionDrafts((p) => ({
                                  ...p,
                                  [row.id]: { ...dr, activo: e.target.checked },
                                }))
                              }
                            />
                            Activa para reservas
                          </label>
                          <button
                            type="button"
                            disabled={miSedeDuracionGuardandoId === row.id}
                            onClick={() => void guardarMiSedeFilaDuracion(row.id)}
                            style={{
                              marginLeft: 'auto',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: 'none',
                              background: miSedeDuracionGuardandoId === row.id ? '#94a3b8' : 'linear-gradient(135deg, #E11B22, #991b1b)',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: miSedeDuracionGuardandoId === row.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {miSedeDuracionGuardandoId === row.id ? t('admin.metricas.saving') : t('general.save')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
                </>
              ) : null}
            </div>
          </div>

          <div id="admin-mi-sede-horarios" style={{ marginBottom: '32px' }}>
            <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>
              {t('admin.franjas.slotsAndPricesTitle')}
            </h3>
            <div className="admin-mi-sede-theme-panel">
              <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{t('admin.franjas.slotsAndPricesTitle')}</p>
              <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Define franjas semanales por día o fechas especiales (feriados/eventos). El precio se elige según la hora de inicio del turno (formato 24 h).
              </p>
              {franjasHorarias.map((fj, idx) => (
                <div
                  key={fj.id}
                  className="admin-franja-bloque"
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px',
                    marginBottom: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Franja {idx + 1}</span>
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
                      title={t('admin.franjas.deleteSlot')}
                    >
                      ✕
                    </button>
                  </div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('admin.formularios.name')}</label>
                  <input
                    type="text"
                    value={fj.nombre}
                    placeholder={fj.tipo === 'fecha_especial' ? t('admin.franjas.specialDateNamePh') : t('admin.franjas.slotNamePh')}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFranjasHorarias((rows) => rows.map((r) => (r.id === fj.id ? { ...r, nombre: v } : r)));
                    }}
                    style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-primary)' }}
                  />
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('admin.franjas.applicationLabel')}</label>
                    <select
                      value={fj.tipo || 'semanal'}
                      onChange={(e) => {
                        const v = e.target.value === 'fecha_especial' ? 'fecha_especial' : 'semanal';
                        setFranjasHorarias((rows) =>
                          rows.map((r) =>
                            r.id === fj.id
                              ? {
                                  ...r,
                                  tipo: v,
                                  fecha: v === 'fecha_especial' ? r.fecha || '' : '',
                                  dias: v === 'semanal' ? (Array.isArray(r.dias) && r.dias.length ? r.dias : DIAS_SEMANA_DEFAULT_FRANJA) : [],
                                }
                              : r
                          )
                        );
                      }}
                      style={{ width: '100%', maxWidth: '220px', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-primary)' }}
                    >
                      <option value="semanal">{t('admin.franjas.weekly')}</option>
                      <option value="fecha_especial">{t('admin.franjas.specialDate')}</option>
                    </select>
                  </div>
                  {fj.tipo === 'fecha_especial' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('admin.franjas.specialDate')}</label>
                      <input
                        type="date"
                        value={fj.fecha || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFranjasHorarias((rows) => rows.map((r) => (r.id === fj.id ? { ...r, fecha: v } : r)));
                        }}
                        style={{ width: '100%', maxWidth: '220px', boxSizing: 'border-box', padding: '7px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-primary)' }}
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('admin.franjas.weekdays')}</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {DIAS_SEMANA_FRANJA.map((dia) => {
                          const checked = Array.isArray(fj.dias) ? fj.dias.includes(dia.id) : true;
                          return (
                            <label
                              key={dia.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 8px',
                                borderRadius: '999px',
                                border: checked ? '1px solid #E11B22' : '1px solid #cbd5e1',
                                background: checked ? '#eef2ff' : '#f8fafc',
                                color: checked ? '#312e81' : '#475569',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setFranjasHorarias((rows) =>
                                    rows.map((r) => {
                                      if (r.id !== fj.id) return r;
                                      const actuales = Array.isArray(r.dias) ? r.dias : DIAS_SEMANA_DEFAULT_FRANJA;
                                      const next = isChecked
                                        ? [...new Set([...actuales, dia.id])]
                                        : actuales.filter((d) => d !== dia.id);
                                      return { ...r, dias: next };
                                    })
                                  );
                                }}
                              />
                              {t(`admin.weekdays.${dia.id}`)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="admin-franja-horas" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('admin.franjas.start')}</label>
                      <input
                        type="time"
                        value={fj.hora_inicio}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFranjasHorarias((rows) => rows.map((r) => (r.id === fj.id ? { ...r, hora_inicio: v } : r)));
                        }}
                        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '7px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('admin.franjas.end')}</label>
                      <input
                        type="time"
                        value={fj.hora_fin}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFranjasHorarias((rows) => rows.map((r) => (r.id === fj.id ? { ...r, hora_fin: v } : r)));
                        }}
                        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '7px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
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
                        placeholder={t('admin.formularios.priceExamplePh')}
                        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'right' }}
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
                      { id: newFranjaId(), tipo: 'semanal', nombre: '', dias: DIAS_SEMANA_DEFAULT_FRANJA, fecha: '', hora_inicio: '', hora_fin: '', precio: '' },
                    ])
                  }
                  style={{
                    padding: '8px 16px',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
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
                  onClick={() =>
                    setFranjasHorarias((rows) => [
                      ...rows,
                      { id: newFranjaId(), tipo: 'fecha_especial', nombre: '', dias: [], fecha: '', hora_inicio: '', hora_fin: '', precio: '' },
                    ])
                  }
                  style={{
                    padding: '8px 16px',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  + Fecha especial
                </button>
                <button
                  type="button"
                  onClick={guardarFranjas}
                  disabled={franjasSaving}
                  style={{
                    padding: '8px 20px',
                    background: franjasSaving ? '#fecaca' : 'linear-gradient(135deg, #E11B22, #991b1b)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: franjasSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px',
                  }}
                >
                  {franjasSaving ? t('admin.metricas.savingEllipsis') : '💾 Guardar franjas'}
                </button>
                {franjasMsg ? (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: franjasMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{franjasMsg}</span>
                ) : null}
              </div>

            </div>
          </div>

          {/* ── Clases y profesores ── */}
          {(esAdminClub || isSuperAdmin) && sedeId && session?.access_token ? (
            <div id="admin-mi-sede-clases" style={{ marginBottom: '32px' }}>
              <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>
                🎓 {t('admin.profesores.clasesYInstructores')}
              </h3>
              <div className="admin-mi-sede-theme-panel" style={{ maxWidth: '640px' }}>
                <AdminModuloClasesSection
                  apiBaseUrl={apiBaseUrl}
                  accessToken={session.access_token}
                  sedeId={Number(sedeId)}
                  canchas={canchas}
                  monedaSede={String(miSede?.moneda || 'ARS').trim().toUpperCase().slice(0, 8) || 'ARS'}
                  isSuperAdmin={isSuperAdmin}
                />
              </div>
            </div>
          ) : null}

          {/* ── Extras tercer tiempo (opcional en checkout armar partido) ── */}
          {(esAdminClub || isSuperAdmin) && sedeId && session?.access_token ? (
            <div id="admin-mi-sede-extras" style={{ marginBottom: '32px' }}>
              <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>
                🍕 Extras del tercer tiempo
              </h3>
              <div className="admin-mi-sede-theme-panel" style={{ maxWidth: '560px' }}>
                <AdminSedeExtrasSection
                  apiBaseUrl={apiBaseUrl}
                  accessToken={session.access_token}
                  sedeId={Number(sedeId)}
                  monedaSede={String(miSede?.moneda || 'ARS').trim().toUpperCase().slice(0, 8) || 'ARS'}
                  isSuperAdmin={isSuperAdmin}
                />
              </div>
            </div>
          ) : null}

          {/* ── 3. Configuración de pagos (MP / Stripe por sede) ── */}
          {(esAdminClub || isSuperAdmin) && (
            <div id="admin-mi-sede-pagos" style={{ marginBottom: '32px' }}>
              <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>{t('admin.sedes.paymentConfigTitle')}</h3>
              <div className="admin-mi-sede-theme-panel" style={{ maxWidth: '520px' }}>
                <p className="admin-mi-sede-theme-muted" style={{ margin: '0 0 16px', fontSize: '13px', lineHeight: 1.5 }}>
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
                    border: '1px solid var(--border)',
                    background: 'var(--pm-color-muted-bg)',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <div className="admin-mi-sede-theme-muted" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Mercado Pago
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {Boolean(String(miSede?.mp_access_token || '').trim()) ? 'Conectado ✅' : t('admin.sedes.notConfiguredWarn')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPagosMpPanelAbierto((v) => !v)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {pagosMpPanelAbierto ? 'Ocultar' : 'Conectar Mercado Pago'}
                  </button>
                </div>
                {pagosMpPanelAbierto ? (
                  <div style={{ marginBottom: '18px', paddingLeft: '4px' }}>
                    <label className="admin-mi-sede-field-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Access Token de Mercado Pago
                    </label>
                    <div style={{ position: 'relative', marginBottom: '14px' }}>
                      <input
                        type={pagosMpAccessTokenVisible ? 'text' : 'password'}
                        className="admin-mi-sede-theme-input"
                        autoComplete="off"
                        value={miSedeForm.mp_access_token || ''}
                        placeholder={Boolean(String(miSede?.mp_access_token || '').trim()) ? t('admin.sedes.mpTokenReplacePh') : t('admin.sedes.mpTokenPh')}
                        onChange={(e) => setMiSedeForm((p) => ({ ...p, mp_access_token: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 40px 8px 10px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setPagosMpAccessTokenVisible((v) => !v)}
                        aria-label={pagosMpAccessTokenVisible ? t('auth.hidePassword') : t('auth.showPassword')}
                        style={{
                          position: 'absolute',
                          right: '6px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '4px 6px',
                          fontFamily: 'inherit',
                        }}
                      >
                        {pagosMpAccessTokenVisible ? t('auth.hidePassword') : t('auth.showPassword')}
                      </button>
                    </div>
                    <label className="admin-mi-sede-field-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      {t('admin.sedes.mpPublicKeyLabel', { defaultValue: 'Public Key de Mercado Pago' })}
                    </label>
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                      <input
                        type={pagosMpPublicKeyVisible ? 'text' : 'password'}
                        className="admin-mi-sede-theme-input"
                        autoComplete="off"
                        value={miSedeForm.mp_public_key || ''}
                        placeholder={
                          Boolean(String(miSede?.mp_public_key || '').trim())
                            ? t('admin.sedes.mpPublicKeyReplacePh', { defaultValue: 'Public Key guardada — ingresa una nueva para reemplazar' })
                            : t('admin.sedes.mpPublicKeyPh', { defaultValue: 'APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' })
                        }
                        onChange={(e) => setMiSedeForm((p) => ({ ...p, mp_public_key: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px 40px 8px 10px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setPagosMpPublicKeyVisible((v) => !v)}
                        aria-label={pagosMpPublicKeyVisible ? t('auth.hidePassword') : t('auth.showPassword')}
                        style={{
                          position: 'absolute',
                          right: '6px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '4px 6px',
                          fontFamily: 'inherit',
                        }}
                      >
                        {pagosMpPublicKeyVisible ? t('auth.hidePassword') : t('auth.showPassword')}
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={pagosParcialSaving || !String(miSedeForm.mp_access_token || '').trim()}
                      onClick={() =>
                        void guardarSedeCamposPagosParcial({
                          mp_access_token: String(miSedeForm.mp_access_token || '').trim(),
                          mp_public_key: String(miSedeForm.mp_public_key || '').trim(),
                        }).then((ok) => {
                          if (ok) {
                            setPagosMpPanelAbierto(false);
                            setPagosMpAccessTokenVisible(false);
                            setPagosMpPublicKeyVisible(false);
                          }
                        })
                      }
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        background:
                          pagosParcialSaving || !String(miSedeForm.mp_access_token || '').trim() ? '#94a3b8' : '#E11B22',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: pagosParcialSaving || !String(miSedeForm.mp_access_token || '').trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {pagosParcialSaving ? t('admin.metricas.saving') : t('admin.sedes.saveMpCredentials', { defaultValue: 'Guardar credenciales Mercado Pago' })}
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
                    border: '1px solid var(--border)',
                    background: 'var(--pm-color-muted-bg)',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <div className="admin-mi-sede-theme-muted" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Stripe
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {String(miSede?.stripe_account_id || '')
                        .trim()
                        .startsWith('acct_')
                        ? 'Conectado ✅'
                        : t('admin.sedes.notConfiguredWarn')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPagosStripePanelAbierto((v) => !v)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {pagosStripePanelAbierto ? 'Ocultar' : 'Conectar Stripe'}
                  </button>
                </div>
                {pagosStripePanelAbierto ? (
                  <div style={{ marginBottom: '18px', paddingLeft: '4px' }}>
                    <label className="admin-mi-sede-field-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Stripe Account ID
                    </label>
                    <input
                      className="admin-mi-sede-theme-input"
                      value={miSedeForm.stripe_account_id || ''}
                      placeholder={t('admin.sedes.stripeAccountPh')}
                      onChange={(e) => setMiSedeForm((p) => ({ ...p, stripe_account_id: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '13px',
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
                              : '#E11B22',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor:
                            pagosParcialSaving || !String(miSedeForm.stripe_account_id || '').trim()
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        {pagosParcialSaving ? t('admin.metricas.saving') : 'Guardar Stripe Account ID'}
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
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      Puedes pegar manualmente el <code style={{ fontSize: '11px' }}>{t('admin.sedes.stripeAccountEllipsisPh')}</code> o usar el onboarding; al volver, comprueba que el ID quedó guardado.
                    </p>
                  </div>
                ) : null}

                <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />
                <label className="admin-mi-sede-field-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Método de cobro para reservas y torneos
                </label>
                <select
                  className="admin-mi-sede-theme-input"
                  value={miSedeForm.metodo_pago || 'mercadopago'}
                  onChange={(e) => setMiSedeForm((p) => ({ ...p, metodo_pago: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    marginBottom: '12px',
                  }}
                >
                  <option value="mercadopago">{t('admin.sedes.paymentMercadoPago')}</option>
                  <option value="stripe">Stripe</option>
                  <option value="manual">Manual (transferencia u otras instrucciones)</option>
                  <option value="efectivo">Efectivo en sede (sin pasarela ni fee 3%)</option>
                </select>
                {String(miSedeForm.metodo_pago || '') === 'efectivo' ? (
                  <p className="admin-mi-sede-theme-muted" style={{ margin: '0 0 12px', fontSize: '12px', lineHeight: 1.45 }}>
                    Las reservas quedan pendientes de cobro en el club hasta que confirmes el pago recibido.
                  </p>
                ) : null}
                {String(miSedeForm.metodo_pago || '') === 'manual' ? (
                  <>
                    <label className="admin-mi-sede-field-label" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Instrucciones para el jugador
                    </label>
                    <textarea
                      className="admin-mi-sede-theme-input"
                      rows={4}
                      value={miSedeForm.pago_manual_instrucciones || ''}
                      onChange={(e) => setMiSedeForm((p) => ({ ...p, pago_manual_instrucciones: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '13px',
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
                    background: pagosParcialSaving ? '#fecaca' : 'linear-gradient(135deg, #E11B22, #991b1b)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: pagosParcialSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px',
                  }}
                >
                  {pagosParcialSaving ? t('admin.metricas.savingEllipsis') : t('admin.sedes.savePaymentMethodBtn')}
                </button>
              </div>
            </div>
          )}

          {/* ── 4. Redes Sociales ── */}
          <div style={{ marginBottom: '32px' }}>
            <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>{t('admin.sedes.socialNetworksTitle')}</h3>
            <div className="admin-mi-sede-theme-panel" style={{ maxWidth: '480px' }}>
              <p className="admin-mi-sede-theme-muted" style={{ margin: '0 0 16px', fontSize: '13px', lineHeight: 1.5 }}>
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
                  <label className="admin-mi-sede-field-label" style={{ width: '150px', flexShrink: 0, fontSize: '13px', fontWeight: 600 }}>{label}</label>
                  <input
                    type="url"
                    className="admin-mi-sede-theme-input"
                    value={miSedeForm[field] || ''}
                    placeholder={placeholder}
                    onChange={e => setMiSedeForm(p => ({ ...p, [field]: e.target.value }))}
                    style={{ flex: 1, minWidth: 0, maxWidth: '100%', width: '100%', padding: '7px 10px', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button onClick={guardarMiSede} disabled={miSedeSaving}
                style={{ marginTop: '8px', padding: '8px 20px', background: miSedeSaving ? '#fecaca' : 'linear-gradient(135deg, #E11B22, #991b1b)', color: 'white', border: 'none', borderRadius: '8px', cursor: miSedeSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                {miSedeSaving ? t('admin.metricas.savingEllipsis') : '💾 Guardar redes'}
              </button>
            </div>
          </div>

          {/* ── 5. Mis Canchas ── */}
          <div id="admin-mi-sede-canchas" style={{ marginBottom: '32px' }}>
            <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>{t('admin.sedes.myCourtsTitle')}</h3>
            <div className="admin-mi-sede-theme-panel" style={{ maxWidth: '640px' }}>
              <p className="admin-mi-sede-theme-muted" style={{ margin: '0 0 14px', fontSize: '13px', lineHeight: 1.5 }}>
                Las canchas <strong>inactivas</strong> no aparecen como opción en las reservas públicas. El número en
                la primera columna es el que usa el sistema de reservas para esa cancha.
              </p>
              {canchas.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>No hay canchas registradas para esta sede.</p>
              ) : (
                <>
                  <div className="admin-mi-sede-canchas-table-wrap">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--accent)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--bg-card)', width: '48px' }}>#</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--bg-card)' }}>{t('admin.formularios.name')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--bg-card)' }}>{t('admin.metricas.sportLabel')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--bg-card)' }}>Nota</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--bg-card)', width: '100px' }}>{t('admin.metricas.statusCol')}</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--bg-card)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {canchas.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 700 }}>{c.orden ?? '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: '14px', color: 'var(--text-primary)' }}>{c.nombre}</td>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <SportIcon deporte={c.deporte} size={18} color="var(--text-secondary)" />
                            {canchaDeporteAdminOptions.find((o) => o.value === c.deporte)?.label || c.deporte || 'Padbol'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '180px' }}>
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
                            {c.estado === 'activa' ? t('admin.sedes.subscriptionActive') : 'Inactiva'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => abrirModalCanchaEditar(c)}
                            style={{
                              padding: '4px 10px',
                              marginRight: '6px',
                              background: '#fee2e2',
                              color: '#991b1b',
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
                            {c.estado === 'activa' ? t('admin.sponsors.deactivateBtn') : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  </div>
                  <div className="admin-mi-sede-canchas-cards" role="list">
                    {canchas.map((c) => (
                      <div key={`card-${c.id}`} className="admin-mi-sede-cancha-card" role="listitem">
                        <div className="admin-mi-sede-cancha-card__row">
                          <span className="admin-mi-sede-cancha-card__label">Orden</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.orden ?? '—'}</span>
                        </div>
                        <div className="admin-mi-sede-cancha-card__row">
                          <span className="admin-mi-sede-cancha-card__label">{t('admin.formularios.name')}</span>
                          <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{c.nombre}</span>
                        </div>
                        <div className="admin-mi-sede-cancha-card__row">
                          <span className="admin-mi-sede-cancha-card__label">{t('admin.metricas.sportLabel')}</span>
                          <span
                            style={{
                              color: 'var(--text-primary)',
                              textAlign: 'right',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              justifyContent: 'flex-end',
                            }}
                          >
                            <SportIcon deporte={c.deporte} size={18} color="var(--text-primary)" />
                            {canchaDeporteAdminOptions.find((o) => o.value === c.deporte)?.label || c.deporte || 'Padbol'}
                          </span>
                        </div>
                        <div className="admin-mi-sede-cancha-card__row" style={{ alignItems: 'flex-start' }}>
                          <span className="admin-mi-sede-cancha-card__label">Nota</span>
                          <span style={{ color: 'var(--text-secondary)', textAlign: 'right', fontSize: '13px', lineHeight: 1.4, wordBreak: 'break-word' }}>
                            {c.descripcion ? (
                              <span title={c.descripcion}>{c.descripcion.length > 120 ? `${c.descripcion.slice(0, 120)}…` : c.descripcion}</span>
                            ) : (
                              '—'
                            )}
                          </span>
                        </div>
                        <div className="admin-mi-sede-cancha-card__row">
                          <span className="admin-mi-sede-cancha-card__label">{t('admin.metricas.statusCol')}</span>
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
                            {c.estado === 'activa' ? t('admin.sedes.subscriptionActive') : 'Inactiva'}
                          </span>
                        </div>
                        <div className="admin-mi-sede-cancha-card__actions">
                          <button
                            type="button"
                            onClick={() => abrirModalCanchaEditar(c)}
                            style={{
                              flex: '1 1 auto',
                              minWidth: '120px',
                              padding: '8px 12px',
                              background: '#fee2e2',
                              color: '#991b1b',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 700,
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCanchaEstado(c)}
                            style={{
                              flex: '1 1 auto',
                              minWidth: '120px',
                              padding: '8px 12px',
                              background: c.estado === 'activa' ? '#fee2e2' : '#dcfce7',
                              color: c.estado === 'activa' ? '#dc2626' : '#16a34a',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 700,
                            }}
                          >
                            {c.estado === 'activa' ? t('admin.sponsors.deactivateBtn') : 'Activar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={abrirModalCanchaNueva}
                style={{
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg, #E11B22, #991b1b)',
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
          <h3 className="admin-mi-sede-block-title" style={{ marginBottom: '16px', fontSize: '16px' }}>📸 Fotos</h3>

          {/* Logo */}
          <div className="admin-mi-sede-theme-panel" style={{ marginBottom: '20px' }}>
            <p className="admin-mi-sede-block-title" style={{ margin: '0 0 16px', fontSize: '14px' }}>{t('admin.sedes.clubLogoLabel')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {logoUrl ? (
                <div
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={logoUrl}
                    alt={t('admin.sedes.clubLogoLabel')}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                </div>
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '10px', border: '2px dashed var(--border)', background: 'var(--pm-color-muted-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '28px' }}>🏟️</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Sin logo</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                  display: 'inline-block', padding: '9px 18px',
                  background: logoUploading ? '#e5e7eb' : 'linear-gradient(135deg, #E11B22, #991b1b)',
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
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('admin.sedes.photoFormatHint')}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{t('admin.common.recommendedPhotoHint')}</span>
                {logoMsg && <span style={{ fontSize: '13px', fontWeight: 600, color: logoMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{logoMsg}</span>}
              </div>
            </div>
          </div>

          {/* Fotos de canchas */}
          <div className="admin-mi-sede-theme-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <p className="admin-mi-sede-block-title" style={{ margin: 0, fontSize: '14px' }}>
                Fotos de las canchas
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  ({fotosUrls.length}/{MAX_FOTOS_SEDE})
                </span>
              </p>
              {fotosUrls.length < MAX_FOTOS_SEDE && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'stretch' }}>
                  <label style={{
                    display: 'inline-block', padding: '7px 16px',
                    background: fotosUploading ? '#e5e7eb' : 'linear-gradient(135deg, #E11B22, #991b1b)',
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
                        setFotosUploadLabel(
                          files.length > 1
                            ? t('admin.sedes.uploadingNPhotos', { count: files.length })
                            : t('admin.sedes.uploadingOneOfOne'),
                        );
                        void subirFotosMultiples(files, { uploadingPrimed: true });
                      }}
                    />
                  </label>
                  <label
                    className="admin-mi-sede-photo-upload-once"
                    style={{
                      cursor: fotosUploading ? 'not-allowed' : 'pointer',
                      opacity: fotosUploading ? 0.55 : 1,
                    }}
                    title={t('admin.sedes.safariOnePhotoHint')}
                  >
                    + 1 foto (Safari)
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
                        setFotosUploadLabel(t('admin.sedes.uploadingOneOfOne'));
                        void subirFotosMultiples([file], { uploadingPrimed: true });
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
            {fotosUploadLabel ? (
              <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: '#E11B22' }}>{fotosUploadLabel}</p>
            ) : null}
            <div style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              <p style={{ margin: '0 0 6px' }}>
                Tocá &quot;Usar como hero&quot; en la foto que querés mostrar de fondo en tu página pública.
              </p>
              <p style={{ margin: 0 }}>
                Marcá hasta 4 fotos con ⭐ para el carrusel. Guardá los cambios del carrusel con el botón inferior.
              </p>
            </div>
            {heroToast ? (
              <div className="admin-mi-sede-hero-toast" role="status">
                {heroToast}
              </div>
            ) : null}
            {fotosUrls.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>{t('admin.sedes.noPhotosYet')}</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {fotosUrls.map((url, i) => {
                  const destacada = fotosDestacadas.includes(url);
                  const heroFotoUrl = fotosDestacadas[0] || fotosUrls[0] || null;
                  const isHeroFoto = Boolean(heroFotoUrl && url === heroFotoUrl);
                  return (
                    <div key={url} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/3', background: '#f1f5f9' }}>
                      <img
                        src={url}
                        alt={`Cancha ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleDestacadaFoto(url)}
                        title={
                          destacada
                            ? 'Quitar del carrusel público'
                            : 'Marcar para carrusel público (máx. 4)'
                        }
                        aria-label={
                          destacada
                            ? 'Quitar del carrusel público'
                            : 'Marcar para carrusel público (máx. 4)'
                        }
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
                        ⭐
                      </button>
                      {isHeroFoto ? (
                        <span className="admin-mi-sede-photo-hero-current" title="Fondo del hero en la página pública">
                          ✓ Hero actual
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="admin-mi-sede-photo-hero-btn"
                          onClick={() => void usarComoHero(url)}
                          disabled={fotosDestacadasSaving}
                          title="Usar como fondo del hero en la página pública"
                        >
                          Usar como hero
                        </button>
                      )}
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
                        title={t('admin.sedes.deletePhoto')}
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
                    background: fotosDestacadasSaving ? '#fecaca' : 'linear-gradient(135deg, #E11B22, #991b1b)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: fotosDestacadasSaving ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px',
                  }}
                >
                  {fotosDestacadasSaving ? t('admin.metricas.savingEllipsis') : '💾 Guardar destacadas'}
                </button>
                {fotosDestacadasMsg ? (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: fotosDestacadasMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>
                    {fotosDestacadasMsg}
                  </span>
                ) : null}
              </div>
            ) : null}
            {fotosMsg ? <p style={{ margin: '12px 0 0', fontSize: '13px', fontWeight: 600, color: fotosMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{fotosMsg}</p> : null}
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
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
          aria-label={t('admin.formularios.assignInterestTypeAria')}
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
              background: 'var(--bg-card)',
              borderRadius: 16,
              padding: '22px 20px',
              boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>{t('admin.sedes.interestTypeTitle')}</h3>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              El club no eligió el modelo en el formulario público. Asigna el tipo antes de crear la sede.
            </p>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
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
                  background: 'var(--bg-card)',
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
                  background: licApruebaTipoSaving ? '#94a3b8' : '#E11B22',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: licApruebaTipoSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {licApruebaTipoSaving ? t('admin.metricas.saving') : 'Continuar a crear sede'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inviteClubModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invitar nuevo admin"
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
            if (ev.target === ev.currentTarget && !inviteClubSaving) {
              setInviteClubModalOpen(false);
              setInviteAdminModalStep('tipo');
              setInviteAdminTipo(null);
            }
          }}
        >
          <div style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-card)', borderRadius: '14px', padding: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>{t('admin.formularios.inviteNewAdminTitle')}</h3>
            {inviteAdminModalStep === 'tipo' ? (
              <>
                <p style={{ margin: '8px 0 14px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.45, fontWeight: 500 }}>
                  Elige el tipo de administrador. Luego completa el formulario y se enviará un enlace válido 48 hs.
                </p>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <button
                    type="button"
                    disabled={inviteClubSaving}
                    onClick={() => {
                      setInviteAdminTipo('club');
                      setInviteAdminModalStep('form');
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '2px solid #e2e8f0',
                      background: 'var(--bg-card)',
                      cursor: inviteClubSaving ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>{t('admin.sedes.adminClub')}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>{t('admin.sedes.manageOneVenue')}</div>
                  </button>
                  <button
                    type="button"
                    disabled={inviteClubSaving}
                    onClick={() => {
                      setInviteAdminTipo('nacional');
                      setInviteAdminModalStep('form');
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '2px solid #e2e8f0',
                      background: 'var(--bg-card)',
                      cursor: inviteClubSaving ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>{t('admin.formularios.nationalAdminRole')}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>{t('admin.sedes.manageFullCountry')}</div>
                  </button>
                  <button
                    type="button"
                    disabled={inviteClubSaving}
                    onClick={() => {
                      setInviteAdminTipo('ciudad_region');
                      setInviteAdminModalStep('form');
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '2px solid #e2e8f0',
                      background: 'var(--bg-card)',
                      cursor: inviteClubSaving ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>{t('admin.sedes.adminCityRegion')}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>{t('admin.sedes.manageRegion')}</div>
                  </button>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteClubModalOpen(false);
                      setInviteAdminModalStep('tipo');
                      setInviteAdminTipo(null);
                    }}
                    disabled={inviteClubSaving}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'var(--bg-card)', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={inviteClubSaving}
                  onClick={() => {
                    setInviteAdminModalStep('tipo');
                    setInviteAdminTipo(null);
                  }}
                  style={{
                    marginTop: '6px',
                    marginBottom: '8px',
                    padding: '4px 0',
                    border: 'none',
                    background: 'none',
                    color: '#E11B22',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: inviteClubSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  ← Cambiar tipo
                </button>
                <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {inviteAdminTipo === 'club'
                    ? t('admin.sedes.inviteEmailVenueHint')
                    : inviteAdminTipo === 'nacional'
                      ? t('admin.sedes.inviteCountryRoleHint')
                      : t('admin.sedes.inviteRegionRoleHint')}
                </p>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <label style={{ display: 'grid', gap: '6px', margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Email del futuro admin *
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={inviteClubForm.email}
                      onChange={(e) => setInviteClubForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder={t('admin.formularios.adminEmailPh')}
                      style={{ padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </label>
                  {inviteAdminTipo === 'club' ? (
                    <label style={{ display: 'grid', gap: '6px', margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Nombre del club (opcional)
                      <input
                        type="text"
                        value={inviteClubForm.nombre_club}
                        onChange={(e) => setInviteClubForm((p) => ({ ...p, nombre_club: e.target.value }))}
                        placeholder={t('admin.sedes.clubNameExamplePh')}
                        style={{ padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </label>
                  ) : null}
                  <label style={{ display: 'grid', gap: '6px', margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    País *
                    <select
                      value={inviteClubForm.pais}
                      onChange={(e) => setInviteClubForm((p) => ({ ...p, pais: e.target.value }))}
                      style={{ padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">{t('admin.sedes.selectCountry')}</option>
                      {PAISES_SEDE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {inviteAdminTipo === 'ciudad_region' ? (
                    <>
                      <label style={{ display: 'grid', gap: '6px', margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Provincia / estado *
                        <input
                          type="text"
                          value={inviteClubForm.provincia}
                          onChange={(e) => setInviteClubForm((p) => ({ ...p, provincia: e.target.value }))}
                          placeholder={t('admin.formularios.cityPlaceholder')}
                          style={{ padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: '6px', margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Ciudad (opcional)
                        <input
                          type="text"
                          value={inviteClubForm.ciudad}
                          onChange={(e) => setInviteClubForm((p) => ({ ...p, ciudad: e.target.value }))}
                          placeholder={t('admin.formularios.scopeProvinceHint')}
                          style={{ padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                      </label>
                    </>
                  ) : null}
                </div>
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!inviteClubSaving) {
                        setInviteAdminModalStep('tipo');
                        setInviteAdminTipo(null);
                      }
                    }}
                    disabled={inviteClubSaving}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'var(--bg-card)', cursor: inviteClubSaving ? 'not-allowed' : 'pointer' }}
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteClubModalOpen(false);
                      setInviteAdminModalStep('tipo');
                      setInviteAdminTipo(null);
                    }}
                    disabled={inviteClubSaving}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'var(--bg-card)', cursor: inviteClubSaving ? 'not-allowed' : 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void enviarInvitacionClub()}
                    disabled={inviteClubSaving || !inviteAdminTipo}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '8px',
                      background: inviteClubSaving || !inviteAdminTipo ? '#94a3b8' : '#E11B22',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: inviteClubSaving || !inviteAdminTipo ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {inviteClubSaving ? t('admin.metricas.sending') : t('admin.formularios.sendInvitation')}
                  </button>
                </div>
              </>
            )}
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

      {reservaQrModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('checkin.tuQr')}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 19998,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={() => setReservaQrModal(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              textAlign: 'center',
              color: 'var(--text-primary)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>{t('checkin.tuQr')}</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {String(reservaQrModal.reserva?.nombre || '').trim() || '—'} ·{' '}
              {formatFecha(reservaQrModal.reserva?.fecha)} · {horarioReservaAdmin(reservaQrModal.reserva)}
            </p>
            {reservaQrModalLoading ? (
              <p style={{ margin: '16px 0', color: 'var(--text-secondary)' }}>{t('general.loading')}</p>
            ) : reservaQrModal.error ? (
              <p style={{ margin: '16px 0', color: '#b45309', fontWeight: 600 }}>{reservaQrModal.error}</p>
            ) : reservaQrModal.qr_token ? (
              <>
                <div ref={reservaQrCanvasRef} style={{ display: 'inline-block', padding: '8px', background: '#fff' }}>
                  <QRCodeCanvas value={reservaQrModal.qr_token} size={220} level="M" includeMargin />
                </div>
                <button
                  type="button"
                  onClick={descargarQrReservaAdmin}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: '14px',
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#0f766e',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {t('checkin.descargar')}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setReservaQrModal(null)}
              style={{
                marginTop: '12px',
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t('general.close')}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmCancelReservaModal
        open={cancelReservaModalId != null}
        title={t('admin.reservas.cancelBookingTitle')}
        dismissLabel={t('admin.reservas.dismissToPanel')}
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
          aria-label={t('admin.sedes.subscriptionPaymentAria')}
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
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
              boxSizing: 'border-box',
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Suscripción Padbol Match
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
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
                    t('admin.sedes.stripeWebhookHint')
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
          aria-label={t('admin.sedes.cropClubLogo')}
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
              background: 'var(--bg-card)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('admin.sedes.cropLogoShort')}</h3>
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Mueve y haz zoom para encuadrar el logo. Se guardará como JPG en buena calidad.
              </p>
            </div>
            <div
              className="admin-logo-crop"
              style={{ position: 'relative', width: '100%', height: 'min(56vh, 360px)', background: '#0f172a' }}
            >
              <Cropper
                image={logoCropSrc}
                crop={logoCrop}
                zoom={logoCropZoom}
                aspect={1}
                cropShape="rect"
                showGrid={false}
                onCropChange={setLogoCrop}
                onZoomChange={setLogoCropZoom}
                onCropComplete={onLogoCropComplete}
              />
            </div>
            <div style={{ padding: '14px 18px 18px' }}>
              <label
                htmlFor="admin-logo-crop-zoom"
                style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}
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
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
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
                    background: logoCropAreaListo && !logoUploading ? '#E11B22' : '#94a3b8',
                    color: '#fff',
                    cursor: logoCropAreaListo && !logoUploading ? 'pointer' : 'default',
                  }}
                >
                  {logoUploading ? t('admin.metricas.uploadingEllipsis') : t('admin.sedes.confirmCrop')}
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

      {inviteMagicLinkModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('admin.formularios.magicLinkAccess')}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 19050,
            background: 'rgba(15, 23, 42, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setInviteMagicLinkModal(null);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              background: 'var(--bg-card)',
              borderRadius: '14px',
              padding: '18px',
              color: 'var(--text-primary)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>🔗 Magic link de acceso</h3>
            <p style={{ margin: '0 0 12px', fontSize: '13px', lineHeight: 1.45, fontWeight: 500 }}>
              Enlace de inicio de sesión para <strong>{inviteMagicLinkModal.email}</strong>. Compartilo por un canal
              seguro si Make no envió el email automáticamente. Válido un solo uso (Supabase Auth).
            </p>
            {inviteMagicLinkModal.invite_url ? (
              <p style={{ margin: '0 0 10px', fontSize: '12px', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 700 }}>{t('admin.sedes.venueInvite48h')}</span>{' '}
                <a href={inviteMagicLinkModal.invite_url} style={{ wordBreak: 'break-all', color: '#4f46e5' }}>
                  {inviteMagicLinkModal.invite_url}
                </a>
              </p>
            ) : null}
            <textarea
              readOnly
              value={inviteMagicLinkModal.magic_link}
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                fontSize: '12px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                resize: 'vertical',
                fontFamily: 'monospace',
                color: 'var(--text-primary)',
                background: 'var(--bg-page, #f8fafc)',
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteMagicLinkModal.magic_link);
                    setMensajeExito(t('admin.formularios.magicLinkCopied'));
                    setTimeout(() => setMensajeExito(''), 2500);
                  } catch {
                    alert('No se pudo copiar al portapapeles');
                  }
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#E11B22',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Copiar magic link
              </button>
              <button
                type="button"
                onClick={() => setInviteMagicLinkModal(null)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}