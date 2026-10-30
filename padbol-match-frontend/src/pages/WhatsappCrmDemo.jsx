import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { crmAdminApi } from '../utils/crmAdminApi';
import {PADBOL_ICON_SVG} from '../constants/padbolBrandLogo';
import CommercialLeadManagement from '../components/CommercialLeadManagement';
import CommercialAgendaAlerts from '../components/CommercialAgendaAlerts';
import CommercialAdvisorAccess from '../components/CommercialAdvisorAccess';
import { createCommercialAssignmentsApi } from '../utils/commercialAssignmentsApi';
import CrmReplyTextarea from '../components/CrmReplyTextarea';
import CrmEmailHistory from '../components/CrmEmailHistory';
import CommercialAdvisorFilter, {matchesAdvisor} from '../components/CommercialAdvisorFilter';
import './WhatsappCrmDemo.css';
import '../components/CommercialCrmTheme.css';

const CRM_IS_QA = String(process.env.REACT_APP_APP_VARIANT || '').toLowerCase() === 'qa';

const statusTone = {
  nuevo: 'blue',
  en_atencion: 'amber',
  derivado: 'violet',
  cerrado: 'red',
};

const WHATSAPP_TOPICS = {
  sede: 'Abrir una sede / comprar una cancha', match: 'Padbol Match',
  next_generation: 'Next Generation', academy: 'Academy', fipa: 'FIPA',
  soporte: 'Soporte', otros: 'Otra consulta',
};

export function whatsappContext(conversation) {
  if (conversation?.source_channel !== 'whatsapp') return null;
  const data = conversation.qualification_data || {};
  const menu = data.whatsapp_menu;
  const deliveryState = conversation.whatsapp_delivery_review;
  const deliveryUnknown = deliveryState !== undefined && deliveryState !== 'clear' && deliveryState !== 'required';
  const deliveryUncertain = deliveryState === 'required' || (data.whatsapp_order_review?.required === true && data.whatsapp_order_review?.reason === 'uncertain_automated_delivery');
  const orderState = conversation.whatsapp_message_order_review;
  const orderUnknown = orderState !== undefined && orderState !== 'clear' && orderState !== 'required';
  const orderUncertain = orderState === 'required' || (data.whatsapp_order_review?.required === true && data.whatsapp_order_review?.reason === 'ambiguous_message_order') || menu?.needs_review === true;
  const review = deliveryUncertain || deliveryUnknown || orderUncertain || orderUnknown;
  if ((!menu || typeof menu !== 'object' || Array.isArray(menu)) && !review) return null;
  return {
    review,
    deliveryUncertain,
    deliveryUnknown,
    orderUncertain,
    orderUnknown,
    topic: !review ? WHATSAPP_TOPICS[menu?.topic] || '' : '',
    subtopic: !review && typeof menu?.subtopic === 'string' ? menu.subtopic : '',
    initialMessage: typeof menu?.initialMessage === 'string' ? menu.initialMessage : '',
    detailMessage: typeof menu?.detailMessage === 'string' ? menu.detailMessage : '',
  };
}

export function needsEnglishHumanAttention(conversation) {
  return conversation?.source_channel === 'whatsapp'
    && conversation.qualification_status === 'needs_review'
    && conversation.next_step === 'advisor_handoff'
    && conversation.qualification_data?.whatsapp_menu?.humanLanguage === 'en'
    && conversation.estado !== 'cerrado';
}

const FOLLOW_UP_TOPICS = [
  'Consulta general', 'Información sobre Padbol', 'Interés comercial', 'Club o sede',
  'Jugador o partido', 'Soporte técnico', 'Reclamo', 'Seguimiento previo', 'Otro',
];
const FOLLOW_UP_RESULTS = [
  'Contactado', 'No respondió', 'Información enviada', 'Interesado',
  'Reunión agendada', 'Pendiente de decisión', 'Derivado', 'Resuelto',
  'Sin interés', 'Otro',
];
const FOLLOW_UP_NEXT_STEPS = [
  'Volver a contactar', 'Enviar información', 'Enviar propuesta', 'Agendar llamada',
  'Agendar reunión online', 'Agendar reunión presencial', 'Esperar respuesta',
  'Derivar a otra persona', 'Cerrar gestión', 'Otro',
];

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Suma días a una fecha `YYYY-MM-DD` sin saltos de zona horaria. */
function addDays(dateValue, days) {
  const base = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  base.setDate(base.getDate() + days);
  return localDateValue(base);
}

const FOLLOW_UP_ESTADOS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'en_atencion', label: 'En atención' },
  { value: 'derivado', label: 'Derivado' },
  { value: 'cerrado', label: 'Cerrado' },
];

function estadoLabel(value) {
  return FOLLOW_UP_ESTADOS.find((option) => option.value === value)?.label || String(value || '—');
}

const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const ADVISOR_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || ARGENTINA_TIME_ZONE;

function formatInTimeZone(date, timeZone) {
  const day = new Intl.DateTimeFormat('es-AR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('es-AR', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${day} · ${time} h`;
}

export function compactDateTime(value, advisorTimeZone = ADVISOR_TIME_ZONE) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const local = formatInTimeZone(date, advisorTimeZone);
  const argentina = formatInTimeZone(date, ARGENTINA_TIME_ZONE);
  if (local === argentina) return local;
  return `${local} · Argentina: ${argentina}`;
}

export function formatCrmEventText(value) {
  const text = String(value || '');
  const attachment = text.match(/^\[WhatsApp: (imagen|audio|video|documento|sticker) recibido\.(?: Archivo aún no disponible\.)?\]\s*/);
  const names = { imagen: 'Imagen recibida', audio: 'Audio recibido', video: 'Video recibido', documento: 'Documento recibido', sticker: 'Sticker recibido' };
  const normalized = attachment ? text.slice(attachment[0].length) || names[attachment[1]] : text;
  const labels = {
    'nextgen.registration.created': 'Nueva inscripción a Next Generation',
    'nextgen.registration.updated': 'Inscripción a Next Generation actualizada',
    'nextgen.registration.cancelled': 'Inscripción a Next Generation cancelada',
    'nextgen.registration.confirmed': 'Inscripción a Next Generation confirmada',
    'nextgen.session.created': 'Nueva jornada de Next Generation',
    'nextgen.session.updated': 'Jornada de Next Generation actualizada',
    'nextgen.venue.created': 'Nueva sede de Next Generation',
  };
  if (labels[text.trim()]) return labels[text.trim()];
  if (/^nextgen\.[a-z0-9_.]+$/i.test(text.trim())) return 'Actualización de Next Generation';
  return normalized;
}

export function conversationDisplayDate(conversation) {
  return conversation?.source_channel === 'whatsapp'
    ? conversation.received_at || conversation.created_at
    : conversation?.created_at;
}

const REMINDER_TIMES = Array.from({ length: 12 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);

function ChannelIcon({ channel }) {
  const isWa = channel === 'whatsapp';
  return <span className={`wa-channel wa-channel--${isWa ? 'wa' : 'mail'}`}>{isWa ? 'W' : '@'}</span>;
}

export function crmOriginLabel(conversation) {
  const origin = String(conversation?.origin || '').trim();
  const area = conversationArea(conversation);
  if (isSupportEmail(conversation)) return 'support@padbol.com';
  if (origin.startsWith('web_form:')) {
    if (area === 'nextgen_venues') return 'Formulario Next Generation · Sedes';
    if (area === 'nextgen_participants') return 'Formulario Next Generation · Participantes';
    return 'Formulario web';
  }
  if (/^nextgen[.:_]/i.test(origin)) return 'Next Generation';
  if (origin === 'manual' || origin === 'manual_contact') return 'Registro manual';
  return channelLabel(conversation?.source_channel);
}

function channelLabel(channel) {
  return channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : String(channel || '—');
}

const INBOX_AREAS = [
  { id: 'all', label: 'Todo', icon: '◉' },
  { id: 'commercial', label: 'Formularios', icon: '▤' },
  { id: 'nextgen_venues', label: 'Next Generation · Sedes', icon: 'S' },
  { id: 'nextgen_participants', label: 'Next Generation · Participantes', icon: 'NG' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'W' },
  { id: 'email', label: 'Email', icon: '@' },
  { id: 'support', label: 'Soporte y reclamos', icon: '!' },
];

function isSupportEmail(conversation) {
  return conversation?.source_channel === 'email'
    && conversation?.origin === 'support_email'
    && conversation?.qualification_data?.mailbox?.address === 'support@padbol.com';
}

function conversationArea(conversation) {
  if (isSupportEmail(conversation)) return 'support';
  const fields = conversation?.qualification_data?.form_submission?.fields || {};
  const workflow = String(fields.workflow || '').trim().toLowerCase();
  const participantType = String(fields.participantType || '').trim().toLowerCase();
  const searchable = [conversation?.subject, conversation?.inbound_body, conversation?.origin]
    .filter(Boolean).join(' ').toLocaleLowerCase('es');
  if (
    workflow === 'next_generation_venue'
    || participantType === 'venue'
    || /next generation.*(?:sede|adhesi[oó]n|beneficio)/.test(searchable)
  ) return 'nextgen_venues';
  if (
    workflow === 'program_registration'
    || ['youth_interest', 'player_interest'].includes(participantType)
    || /nextgen\.(?:registration|waitlist)|next generation.*(?:jugador|participante|familia|jornada|inter[eé]s|u1[34568])/.test(searchable)
  ) return 'nextgen_participants';
  if (/soporte|reclamo|problema|falla|error|no funciona|incidente/.test(searchable)) return 'support';
  if (String(conversation?.origin || '').startsWith('web_form:')) return 'commercial';
  if (conversation?.source_channel === 'whatsapp') return 'whatsapp';
  if (conversation?.source_channel === 'email') return 'email';
  return 'commercial';
}

const FORM_FIELD_ALIASES = {
  Nombre: ['name', 'firstName', 'first_name', 'nombre'],
  Apellido: ['lastName', 'last_name', 'surname', 'apellido'],
  Email: ['email', 'correo'],
  WhatsApp: ['phone', 'telefono', 'whatsapp'],
  'Empresa o club': ['company', 'club', 'empresa', 'companyName'],
  País: ['country', 'pais'],
  'Ciudad o región': ['city', 'location', 'ciudad', 'region', 'cityRegion'],
  'Cantidad de canchas': ['courts', 'courtCount', 'court_count', 'cantidad_canchas', 'cantidadCanchas', 'numberOfCourts', 'Cantidad de canchas proyectada'],
  'Destino de la cancha': ['destination', 'destino', 'courtDestination', 'court_destination', 'uso'],
  'Disponibilidad de espacio': ['space', 'availableSpace', 'spaceAvailable', 'espacio', 'disponibilidad_espacio'],
  'Información adicional': ['message', 'mensaje', 'additionalInfo', 'additional_info', 'comments', 'consulta'],
  Asunto: ['subject', 'asunto'],
};
const fieldKey = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
function fieldLabel(label) {
  const key = fieldKey(label);
  return Object.entries(FORM_FIELD_ALIASES).find(([name, aliases]) => [name, ...aliases].some(alias => fieldKey(alias) === key))?.[0] || label;
}
function fieldText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.map(fieldText).filter(Boolean).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}: ${fieldText(item)}`).join(' · ');
  return String(value).trim();
}

export function formDetails(conversation) {
  const saved = conversation?.qualification_data?.form_submission?.fields;
  const body = String(conversation?.inbound_body || '');
  const labels = [...Object.keys(FORM_FIELD_ALIASES), 'Ciudad', 'Categoría', 'Curso', 'Programa Academy'];
  const pattern = new RegExp(`(?:^|\\s)(${labels.join('|')}):\\s*`, 'gi');
  const matches = [...body.matchAll(pattern)];
  const parsed = matches.flatMap((match, index) => {
    const value = body.slice(match.index + match[0].length, matches[index + 1]?.index ?? body.length).trim();
    return value ? [[match[1], value]] : [];
  });
  const entries = saved && typeof saved === 'object' && !Array.isArray(saved) ? Object.entries(saved) : [];
  const result = new Map();
  // Preserve submitted fields, filling absent legacy fields from the original body.
  for (const [key, value] of [...entries, ...parsed]) {
    const text = fieldText(value);
    const label = String(key);
    const alreadySaved = [...result.keys()].some(existing => fieldKey(existing) === fieldKey(label));
    if (text && !alreadySaved) result.set(label, text);
  }
  return [...result];
}

export function whatsappDeliveryLabel(message) {
  if (message.status === 'sent') {
    return ({read:'Leído',delivered:'Entregado',failed:'No entregado',sent:'Aceptado por WhatsApp · entrega sin confirmar'})[message.deliveryStatus] || 'Aceptado por WhatsApp · entrega sin confirmar';
  }
  return ({pending:'Pendiente de confirmación',cancelled:'Entrega no confirmada'})[message.status] || 'Estado no disponible';
}

export function originalLeadMessage(conversation, details = formDetails(conversation)) {
  const saved = detailValue(details, 'Información adicional');
  const body = String(conversation?.inbound_body || '').trim();
  // Legacy field copies were capped at 1,000 characters; inbound retains the original.
  const start = /(?:^|\n)(?:Mensaje|Información adicional|message|additionalInfo):[ \t]*/i.exec(body);
  if (start) {
    const original = body.slice(start.index + start[0].length)
      .replace(/\nconsent(?:Privacy|Terms|Marketing|FormType|DocumentVersion|AcceptedAt|Language|Whatsapp):[^]*$/i, '').trim();
    if (!saved || original.startsWith(saved)) return original;
  }
  if (saved && body.startsWith(saved)) return body;
  return saved || body;
}

export function commercialFormDetails(details) {
  return details.filter(([label]) => {
    const key = fieldKey(label);
    return !/^(consent|consentimiento)/.test(key)
      && !['workflow', 'participanttype', 'documentversion', 'privacyversion', 'termsversion', 'privacypolicyversion', 'termsandconditionsversion'].includes(key);
  });
}

function detailValue(details, ...labels) {
  const expected = labels.map(label => fieldKey(fieldLabel(label)));
  return details.find(([label]) => expected.includes(fieldKey(fieldLabel(label))))?.[1] || null;
}

export function commercialLeadHighlights(details, analysis) {
  return {
    location: [detailValue(details, 'Ciudad o región', 'Ciudad'), detailValue(details, 'País')].filter(Boolean).join(', ') || detailValue(details, 'Territorio solicitado') || 'Ubicación no informada',
    investment: detailValue(details, 'Capital estimado de inversión', 'Inversión estimada', 'Inversión', 'Presupuesto', 'Budget', 'investment', 'investmentBudget') || 'No informada',
    score: analysis?.score !== null && analysis?.score !== undefined && Number.isFinite(Number(analysis.score)) ? `${analysis.score}/100` : 'Sin calificación',
    priority: analysis?.priority ? `Prioridad ${analysis.priority}` : 'Prioridad pendiente',
  };
}

export function leadAnalysisNotice(status, enabled) {
  if (status === 'disabled' || enabled === false) return { title: 'Análisis automático desactivado', message: 'El servicio de análisis no está habilitado. Esta consulta permanece disponible para revisión manual.', badge: 'DESACTIVADO' };
  if (status === 'failed' || status === 'error') return { title: 'No se pudo completar el análisis', message: 'No hay un resultado confirmado. Esta consulta permanece disponible para revisión manual.', badge: 'SIN RESULTADO' };
  if (status) return { title: 'Análisis solicitado, sin resultado confirmado', message: enabled === true ? 'La solicitud está pendiente. Se mostrará el resultado cuando esté disponible; este estado no confirma que el análisis esté ejecutándose.' : 'No se pudo confirmar la disponibilidad del servicio de análisis. Esta consulta permanece disponible para revisión manual.', badge: 'PENDIENTE' };
  return { title: 'Sin análisis solicitado', message: 'Esta ficha no tiene una solicitud de análisis registrada.', badge: '' };
}

export default function WhatsappCrmDemo({ accessToken, onBack, requiredScope, backInAppHeader=false } = {}) {
  const hasPanelExit = Boolean(onBack);
  useEffect(() => {
    if (hasPanelExit) window.scrollTo(0, 0);
  }, [hasPanelExit]);
  const { session } = useAuth();
  const token = accessToken || session?.access_token || '';
  const commercialApi = useMemo(() => createCommercialAssignmentsApi(token), [token]);
  const [perms, setPerms] = useState(null);
  const [items, setItems] = useState([]);
  const [advisorFilter,setAdvisorFilter]=useState('');
  const [assignmentScope,setAssignmentScope]=useState({ready:false,role:null,cases:[],advisors:[]});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [institutionalCase, setInstitutionalCase] = useState(null);
  const [institutionalRevision, setInstitutionalRevision] = useState(0);
  const [agendaLeadId, setAgendaLeadId] = useState(null);
  const [areaFilter, setAreaFilter] = useState('all');
  const channelFilter = '';
  const [estadoFilter, setEstadoFilter] = useState('');
  const [ticketInput, setTicketInput] = useState('');
  const [ticketReference, setTicketReference] = useState('');
  const [ticketError, setTicketError] = useState('');
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const loadSequence = useRef(0);
  const [replyText, setReplyText] = useState('');
  const [reviewOutcome, setReviewOutcome] = useState('');
  const [reviewEvidence, setReviewEvidence] = useState('');
  const [reviewProviderId, setReviewProviderId] = useState('');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const replyComposition = useRef(null);
  const activeConversationId = useRef(null);
  const threadRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [activities, setActivities] = useState([]);
  const [whatsappHistory, setWhatsappHistory] = useState(null);
  const [historyError, setHistoryError] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [whatsappAttachments, setWhatsappAttachments] = useState([]);
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [imagePreviews, setImagePreviews] = useState({});
  const [downloadingAttachment, setDownloadingAttachment] = useState(null);
  const [activityType, setActivityType] = useState('note');
  const [activityTopic, setActivityTopic] = useState('');
  const [activitySummary, setActivitySummary] = useState('');
  const [activityOutcome, setActivityOutcome] = useState('');
  const [activityNextStep, setActivityNextStep] = useState('');
  const [reminderDate, setReminderDate] = useState(() => localDateValue());
  const [reminderTime, setReminderTime] = useState('10:00');
  const [activityResponsable, setActivityResponsable] = useState('');
  const [activityEstado, setActivityEstado] = useState('nuevo');
  const [activityDerivado, setActivityDerivado] = useState('no');
  const [sedes, setSedes] = useState([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualReceipt, setManualReceipt] = useState(null);
  const [manualNotice, setManualNotice] = useState(null);
  const [manual, setManual] = useState({ name: '', email: '', phone: '' });
  const [ngOverview, setNgOverview] = useState({ sedes: [], jornadas: [] });
  const [ngOpen, setNgOpen] = useState(false);
  const [ngDraft, setNgDraft] = useState({ sede_id: '', sesion_id: '', categoria: '', participant_name: '' });
  const [ngVenueOpen, setNgVenueOpen] = useState(false);
  const [ngVenueDraft, setNgVenueDraft] = useState({ sede_club: '', ciudad: '', pais: '' });

  const load = useCallback(async ({ silent = false } = {}) => {
    const sequence = ++loadSequence.current;
    if (!token) {
      setError({ status: 401 });
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const p = await crmAdminApi.permissions(token);
      if (sequence !== loadSequence.current) return;
      setPerms(p);
      if (requiredScope === 'commercial' && (!p?.commercialOnly || !p?.canOperate)) {
        setItems([]);
        setPerms(null);
        throw Object.assign(new Error('No tienes acceso a las consultas comerciales.'), { status: 403 });
      }
      if (p?.canOperate || p?.canAudit) {
        const inbox = await crmAdminApi.inbox(token, { channel: channelFilter, estado: estadoFilter, ...(hiddenOnly ? { hiddenOnly:true } : {}), ...(ticketReference ? { ticketReference } : {}) });
        if (sequence !== loadSequence.current) return;
        setItems(Array.isArray(inbox) ? inbox : Array.isArray(inbox?.items) ? inbox.items : []);
      } else {
        setItems([]);
      }
    } catch (e) {
      if (sequence !== loadSequence.current) return;
      setError(e);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [token, channelFilter, estadoFilter, ticketReference, requiredScope, hiddenOnly]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!token || !perms?.canAudit) return;
    crmAdminApi.sedes(token).then((data) => setSedes(Array.isArray(data) ? data : (data?.sedes || []))).catch(() => setSedes([]));
  }, [token, perms?.canAudit]);

  useEffect(() => {
    if (!token || perms?.commercialOnly || (!perms?.canOperate && !perms?.canAudit)) return;
    crmAdminApi.nextGenerationOverview(token)
      .then((data) => setNgOverview({
        sedes: Array.isArray(data?.sedes) ? data.sedes : [],
        jornadas: Array.isArray(data?.jornadas) ? data.jornadas : [],
      }))
      .catch(() => setNgOverview({ sedes: [], jornadas: [] }));
  }, [token, perms?.canOperate, perms?.canAudit, perms?.commercialOnly]);

  useEffect(() => {
    const timer = window.setInterval(() => { void load({ silent: true }); }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const areaCounts = INBOX_AREAS.reduce((counts, area) => ({
    ...counts,
    [area.id]: area.id === 'all' ? items.length : items.filter((item) => conversationArea(item) === area.id).length,
  }), {});
  const commercialOnly = requiredScope === 'commercial' || perms?.commercialOnly === true;
  const areas = commercialOnly ? INBOX_AREAS.filter(area => area.id === 'commercial') : INBOX_AREAS;
  useEffect(()=>{
    if(!token||(!commercialOnly&&!(perms?.canAudit&&areaFilter==='commercial')))return;
    let live=true;
    async function refresh(){try{
      const role=await commercialApi.getRole();
      if(role.role!=='manager'){if(live)setAssignmentScope({ready:false,role:role.role,cases:[],advisors:[]});return;}
      const [c,a]=await Promise.all([commercialApi.listCases(),commercialApi.listAdvisors()]);
      if(live)setAssignmentScope({ready:true,role:'manager',cases:c.cases||[],advisors:a.advisors||[]});
    }catch{if(live)setAssignmentScope(v=>({...v,ready:false}));}}
    void refresh();const timer=window.setInterval(refresh,15000);
    window.addEventListener('commercial-agenda-updated',refresh);
    return()=>{live=false;window.clearInterval(timer);window.removeEventListener('commercial-agenda-updated',refresh);};
  },[token,commercialOnly,perms?.canAudit,areaFilter,commercialApi]);
  const areaItems = commercialOnly || areaFilter === 'all' ? items : items.filter((item) => conversationArea(item) === areaFilter);
  const visibleItems=advisorFilter?areaItems.filter(item=>matchesAdvisor(assignmentScope.cases.find(c=>(c.conversationId||(c.channel==='form'?c.id:null))===item.id),advisorFilter,session?.user?.id)):areaItems;
  const active = visibleItems.find((i) => i.id === activeId) || visibleItems[0] || null;
  const institutionalCandidate = !commercialOnly && active?.source_channel === 'email' && active?.origin === 'institutional_email';
  useEffect(() => {
    if (!institutionalCandidate || !token) return;
    let live = true;
    const identity = {conversationId:active.id,token};
    setInstitutionalCase({...identity,status:'loading'});
    commercialApi.resolveConversation(active.id).then(item => {
      if (!live) return;
      if (item?.id !== active.id || item?.channel !== 'form') throw new Error('INVALID_CASE');
      setInstitutionalCase({...identity,status:'confirmed',item});
    }).catch(error => {
      if (live) setInstitutionalCase({...identity,status:[403,404].includes(error.status)?'not_commercial':'unavailable'});
    });
    return () => {live=false;};
  }, [institutionalCandidate,active?.id,token,commercialApi,institutionalRevision]);
  const currentInstitutionalCase = institutionalCandidate && institutionalCase?.conversationId === active?.id && institutionalCase?.token === token ? institutionalCase : null;
  const verifiedCommercialCase = currentInstitutionalCase?.status === 'confirmed' ? currentInstitutionalCase.item : null;
  const checkingInstitutional = institutionalCandidate && (!currentInstitutionalCase || currentInstitutionalCase.status === 'loading');
  const institutionalUnavailable = institutionalCandidate && currentInstitutionalCase?.status === 'unavailable';
  const leadAnalysis = active?.qualification_data?.lead_analysis || null;
  const analysisRequestStatus = active?.qualification_data?.lead_analysis_request?.status || null;
  const analysisNotice = leadAnalysisNotice(analysisRequestStatus, perms?.leadAnalysisEnabled);
  const whatsappSendEnabled = perms?.whatsappSendEnabled === true;
  const emailSendEnabled = perms?.emailSendEnabled === true;
  const supportEmail = isSupportEmail(active);
  const supportOrigin = active?.origin === 'support_email';
  const activeCanOperate = perms?.canOperate === true || (active?.source_channel === 'email' && perms?.canOperateEmail === true) || (supportEmail && perms?.canOperateSupport === true)
    || (active?.source_channel === 'whatsapp' && active?.origin === 'whatsapp:1376102838911694' && perms?.canOperateWhatsapp === true);
  const activeDetails = formDetails(active);
  const waContext = whatsappContext(active);
  const isWebForm = String(active?.origin || '').startsWith('web_form:');
  const canReplyWhatsapp = active?.source_channel === 'whatsapp' && whatsappSendEnabled;
  const canReplyEmail = active?.source_channel === 'email' && (supportOrigin ? supportEmail && perms?.supportEmailSendEnabled === true : emailSendEnabled) && Boolean(active?.contact?.email_normalized);
  const canReply = (canReplyWhatsapp && !waContext?.deliveryUncertain && !waContext?.deliveryUnknown) || canReplyEmail;
  const replyUnavailableReason = !activeCanOperate ? 'Esta cuenta tiene acceso de consulta a esta conversación y no puede enviar respuestas.' : active?.source_channel === 'email' && !active?.contact?.email_normalized ? 'Esta conversación no tiene un email de contacto válido.' : active?.source_channel === 'email' && !canReplyEmail ? 'El envío por email no está habilitado para este canal.' : active?.source_channel === 'whatsapp' && (waContext?.deliveryUncertain || waContext?.deliveryUnknown) ? 'Hay una entrega pendiente de confirmar. Revisa su estado antes de enviar otra respuesta.' : !canReply ? 'El envío por este canal no está habilitado.' : '';

  const loadEmailHistory = useCallback(id=>crmAdminApi.emailHistory(token,id),[token]);
  activeConversationId.current = active?.id;
  useEffect(() => { replyComposition.current = null; setReplyText(''); setNotice(null); }, [active?.id]);
  const leadName = [detailValue(activeDetails, 'Nombre'), detailValue(activeDetails, 'Apellido')].filter(Boolean).join(' ') || active?.contact?.nombre || active?.identity_used || 'Contacto sin nombre';
  const activeArea = commercialOnly ? 'commercial' : conversationArea(active);
  const isNextGenerationParticipant = activeArea === 'nextgen_participants';
  const isNextGenerationVenue = activeArea === 'nextgen_venues';
  const isNextGenerationForm = isNextGenerationParticipant || isNextGenerationVenue;
  const isCommercial = Boolean(verifiedCommercialCase) || activeArea === 'commercial' || (active?.source_channel === 'whatsapp' && waContext?.topic === WHATSAPP_TOPICS.sede);
  const isCommercialForm = isWebForm && activeArea === 'commercial';
  const leadHighlights = commercialLeadHighlights(activeDetails, leadAnalysis);
  const displayedLeadFields = ['Nombre', 'Apellido', 'Email', 'WhatsApp', 'Asunto', 'Información adicional', 'Ciudad o región', 'Ciudad', 'País', 'Capital estimado de inversión', 'Inversión estimada', 'Inversión', 'Presupuesto', 'Budget', 'investment', 'investmentBudget'].map(label => fieldKey(fieldLabel(label)));
  const extraLeadDetails = commercialFormDetails(activeDetails).filter(([label]) => !displayedLeadFields.includes(fieldKey(fieldLabel(label))));
  const nextGenerationDetails = [
    ['Nombre', detailValue(activeDetails, 'Nombre del participante', 'Participante', 'Nombre')],
    ['Categoría', detailValue(activeDetails, 'Categoría', 'Categoria')],
    ['Sede o club', detailValue(activeDetails, 'Sede / club', 'Sede', 'Empresa o club', 'Club')],
    ['Ciudad', detailValue(activeDetails, 'Ciudad', 'Ciudad o región', 'Ciudad o region')],
    ['País', detailValue(activeDetails, 'País', 'Pais')],
  ].filter(([,value]) => Boolean(value));
  const ngJornadas = ngOverview.jornadas.filter((jornada) => !ngDraft.sede_id || String(jornada.sede_id) === String(ngDraft.sede_id));
  const activeNgSedeId = active?.sede_id ? String(active.sede_id) : '';
  const activeNgCategory = detailValue(activeDetails, 'Categoría', 'Categoria') || '';
  const activeNgParticipantName = active
    ? ([detailValue(activeDetails, 'Nombre'), detailValue(activeDetails, 'Apellido')].filter(Boolean).join(' ') || active?.contact?.nombre || '')
    : '';
  const activeNgVenueName = detailValue(activeDetails, 'Sede / club', 'Sede', 'Empresa o club', 'Club') || '';
  const activeNgVenueCity = detailValue(activeDetails, 'Ciudad', 'Ciudad o región', 'Ciudad o region') || '';
  const activeNgVenueCountry = detailValue(activeDetails, 'País', 'Pais') || '';

  useEffect(() => {
    setNgOpen(false);
    setNgVenueOpen(false);
    setNgDraft({
      sede_id: activeNgSedeId,
      sesion_id: '',
      categoria: activeNgCategory,
      participant_name: activeNgParticipantName,
    });
    setNgVenueDraft({ sede_club: activeNgVenueName, ciudad: activeNgVenueCity, pais: activeNgVenueCountry });
  }, [active?.id, activeNgSedeId, activeNgCategory, activeNgParticipantName, activeNgVenueName, activeNgVenueCity, activeNgVenueCountry]);

  useEffect(() => {
    let current = true;
    setWhatsappAttachments([]);
    setAttachmentNotice('');
    if (!token || !active?.id || active.source_channel !== 'whatsapp') return () => { current = false; };
    crmAdminApi.whatsappMediaList(token, active.id)
      .then((data) => { if (current) setWhatsappAttachments(Array.isArray(data?.attachments) ? data.attachments : []); })
      .catch(() => { if (current) setAttachmentNotice('No se pudieron consultar los archivos adjuntos.'); });
    return () => { current = false; };
  }, [token, active?.id, active?.source_channel, active?.inbound_body]);

  useEffect(() => {
    let current = true;
    setWhatsappHistory(null);
    setHistoryError(false);
    if (!token || !active?.id || active.source_channel !== 'whatsapp') return () => { current = false; };
    crmAdminApi.whatsappHistory(token, active.id)
      .then(data => { if (current) setWhatsappHistory({ conversationId: active.id, messages: Array.isArray(data?.messages) ? data.messages : [], truncated: data?.truncated === true }); })
      .catch(() => { if (current) setHistoryError(true); });
    return () => { current = false; };
  }, [token, active?.id, active?.source_channel, active?.inbound_body, historyRevision]);

  useEffect(() => {
    let current = true;
    const urls = [];
    setImagePreviews({});
    if (token && active?.id) {
      whatsappAttachments.filter((attachment) => attachment.mediaType === 'image').forEach((attachment) => {
        crmAdminApi.whatsappMedia(token, active.id, attachment.eventId).then(async ({ blob }) => {
          const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
          const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
          const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
          const webp = bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
          const type = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : '';
          if (!current || !type) return;
          const url = URL.createObjectURL(new Blob([blob], { type }));
          urls.push(url);
          setImagePreviews((previous) => ({ ...previous, [attachment.eventId]: url }));
        }).catch(() => {});
      });
    }
    return () => { current = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [token, active?.id, whatsappAttachments]);

  const downloadWhatsappAttachment = async (attachment) => {
    if (!active?.id || downloadingAttachment) return;
    setDownloadingAttachment(attachment.eventId);
    setAttachmentNotice('');
    try {
      const { blob, filename } = await crmAdminApi.whatsappMedia(token, active.id, attachment.eventId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setAttachmentNotice('No se pudo descargar el archivo. Inténtalo nuevamente.');
    } finally {
      setDownloadingAttachment(null);
    }
  };

  const loadActivities = useCallback(async (conversationId) => {
    if (!token || !conversationId || (!perms?.canOperate && !perms?.canAudit)) {
      setActivities([]);
      return;
    }
    try {
      const rows = await crmAdminApi.activities(token, conversationId);
      setActivities(Array.isArray(rows) ? rows : []);
    } catch {
      setActivities([]);
    }
  }, [token, perms?.canOperate, perms?.canAudit]);

  useEffect(() => { void loadActivities(active?.id); }, [active?.id, loadActivities]);

  /** Responsable, estado y derivación arrancan con lo que ya tiene la conversación. */
  useEffect(() => {
    setActivityResponsable(session?.user?.email || '');
    setActivityEstado(active?.estado || 'nuevo');
    setActivityDerivado(active?.derivado ? 'si' : 'no');
  }, [active?.id, active?.estado, active?.derivado, session?.user?.email]);

  useEffect(() => { setReviewOutcome(''); setReviewEvidence(''); setReviewProviderId(''); setReviewConfirmed(false); }, [active?.id]);

  const submitDeliveryReview = async (event) => {
    event.preventDefault();
    if (!active || !perms?.canAudit || !waContext?.deliveryUncertain || busy || !reviewConfirmed || !['delivered', 'not_delivered'].includes(reviewOutcome) || reviewEvidence.trim().length < 10 || reviewEvidence.trim().length > 2048 || (reviewOutcome === 'delivered' && (!reviewProviderId.trim() || reviewProviderId.trim().length > 512))) return;
    const conversationId = active.id;
    setBusy(true); setNotice(null);
    try {
      await crmAdminApi.reviewWhatsappDelivery(token, conversationId, { outcome: reviewOutcome, evidence: reviewEvidence.trim(), ...(reviewOutcome === 'delivered' ? { providerId: reviewProviderId.trim() } : {}) });
      if (activeConversationId.current !== conversationId) return;
      setReviewOutcome(''); setReviewEvidence(''); setReviewProviderId(''); setReviewConfirmed(false);
      setNotice('Revisión registrada. Comprobando el estado actualizado.');
      await load();
    } catch (error) {
      if (activeConversationId.current === conversationId) setNotice(error?.message || 'No se pudo registrar la revisión.');
    } finally { setBusy(false); }
  };

  const resumeWhatsappAutomation = async () => {
    if (!active || active.source_channel !== 'whatsapp' || !activeCanOperate || !perms?.whatsappAutomationResumeEnabled || busy || waContext?.deliveryUncertain || waContext?.deliveryUnknown) return;
    if (!window.confirm('¿Reanudar las respuestas automáticas para esta conversación? No se enviarán respuestas por mensajes anteriores.')) return;
    const conversationId = active.id;
    setBusy(true); setNotice(null);
    try {
      await crmAdminApi.resumeWhatsappAutomation(token, conversationId);
      if (activeConversationId.current !== conversationId) return;
      setNotice('Reanudación registrada. Las respuestas automáticas podrán funcionar en mensajes nuevos cuando corresponda.');
      await load();
    } catch (error) {
      if (activeConversationId.current === conversationId) setNotice(error?.message || 'No se pudo reanudar las respuestas automáticas.');
    } finally { setBusy(false); }
  };

  const submitReply = async () => {
    if (!active || busy || !activeCanOperate || !canReply || !replyText.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      let requestId;
      if (canReplyEmail || canReplyWhatsapp) {
        const composition = replyComposition.current;
        if (!composition || composition.conversationId !== active.id || composition.body !== replyText) {
          const bytes = new Uint8Array(16);
          crypto.getRandomValues(bytes);
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
          replyComposition.current = { conversationId: active.id, body: replyText, requestId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` };
        }
        requestId = replyComposition.current.requestId;
      }
      const result = await crmAdminApi.reply(token, active.id, replyText.trim(), requestId);
      if (activeConversationId.current !== active.id) return;
      setNotice(result?.status === 'sent'
        ? (canReplyEmail ? 'Mensaje enviado por email.' : 'Mensaje enviado por WhatsApp.')
        : 'Respuesta guardada como pendiente.');
      replyComposition.current = null;
      setReplyText('');
      if (canReplyWhatsapp || canReplyEmail) setHistoryRevision(value => value + 1);
      await load();
    } catch (e) {
      if (activeConversationId.current === active.id) setNotice(e?.message || 'No se pudo registrar la respuesta');
    } finally {
      setBusy(false);
    }
  };

  const submitHandoff = async () => {
    if (!active || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await crmAdminApi.handoff(token, active.id);
      setNotice('Consulta derivada a una persona.');
      await load();
    } catch (e) {
      setNotice(e?.message || 'No se pudo derivar');
    } finally {
      setBusy(false);
    }
  };

  const submitManual = async (event) => {
    event.preventDefault();
    if (!perms?.canOperate || busy) return;
    setBusy(true); setManualNotice(null);
    try {
      const result = await crmAdminApi.createManual(token, manual);
      if (!result?.contact?.id) throw new Error('El servidor no confirmó el registro del contacto.');
      setManualReceipt(result.contact);
      setManual({ name: '', email: '', phone: '' });
      setManualOpen(false); setManualNotice(result.existing ? 'El contacto ya existía; no se modificaron sus datos.' : 'Contacto registrado, sin enviar comunicaciones.');
    } catch (e) { setManualNotice(e?.message || 'No se pudo registrar el contacto'); }
    finally { setBusy(false); }
  };

  const assignSede = async (sedeId) => {
    if (!active || !sedeId) return;
    setBusy(true); setNotice(null);
    try { await crmAdminApi.assignSede(token, active.id, sedeId); setNotice('Sede asignada.'); await load(); }
    catch (e) { setNotice(e?.message || 'No se pudo asignar la sede'); }
    finally { setBusy(false); }
  };

  const createNextGenerationRegistration = async (event) => {
    event.preventDefault();
    if (!active || busy) return;
    setBusy(true); setNotice(null);
    try {
      const result = await crmAdminApi.createNextGenerationRegistration(token, {
        conversation_id: active.id,
        sede_id: ngDraft.sede_id,
        sesion_id: ngDraft.sesion_id,
        categoria: ngDraft.categoria.trim(),
        participants: [{ nombre: ngDraft.participant_name.trim(), categoria: ngDraft.categoria.trim() }],
      });
      setNgOpen(false);
      const registration = result?.registration || result;
      setNotice(result?.created === false
        ? `Esta conversación ya estaba vinculada a una inscripción (${registration?.estado || 'registrada'}).`
        : `Inscripción creada como borrador${registration?.id ? ` (${registration.id})` : ''}. Todavía no ocupa un cupo.`);
      await load({ silent: true });
    } catch (e) {
      setNotice(e?.message || 'No se pudo crear la inscripción Next Generation');
    } finally {
      setBusy(false);
    }
  };

  const createNextGenerationVenueApplication = async (event) => {
    event.preventDefault();
    if (!active || busy || !perms?.canAudit) return;
    setBusy(true); setNotice(null);
    try {
      const result = await crmAdminApi.createNextGenerationVenueApplication(token, {
        conversation_id: active.id,
        sede_club: ngVenueDraft.sede_club.trim(),
        ciudad: ngVenueDraft.ciudad.trim(),
        pais: ngVenueDraft.pais.trim(),
      });
      setNgVenueOpen(false);
      const application = result?.venueApplication || result;
      setNotice(result?.created === false
        ? 'Esta conversación ya estaba vinculada a una postulación de sede.'
        : `Postulación de sede creada${application?.id ? ` (${application.id})` : ''}. Ya puede evaluarse en Next Generation.`);
      await load({ silent: true });
    } catch (e) {
      setNotice(e?.message || 'No se pudo crear la postulación de sede');
    } finally {
      setBusy(false);
    }
  };

  const submitActivity = async () => {
    if (!active || busy || !activityTopic) return;
    setBusy(true);
    setNotice(null);
    try {
      // El estado y la actividad se guardan juntos en el servidor.
      const responsable = (activityResponsable || session?.user?.email || '').trim();
      const contexto = [
        `Responsable: ${responsable || '—'}`,
        `Estado: ${estadoLabel(activityEstado)}`,
        `Derivación: ${activityDerivado === 'si' ? 'Sí' : 'No'}`,
      ].join(' · ');
      const resumenBase = activitySummary.trim()
        ? `${activityTopic}: ${activitySummary.trim()}`
        : activityTopic;
      await crmAdminApi.addActivity(token, active.id, {
        type: activityType,
        conversation_state: activityEstado,
        summary: `${resumenBase} · ${contexto}`,
        outcome: activityOutcome.trim() || null,
        next_step: activityNextStep.trim() || null,
        follow_up_at: reminderDate ? `${reminderDate}T${reminderTime}` : null,
      });
      setActivitySummary('');
      setActivityTopic('');
      setActivityOutcome('');
      setActivityNextStep('');
      setActivityDerivado(active?.derivado ? 'si' : 'no');
      setActivityEstado(active?.estado || 'nuevo');
      setReminderDate(localDateValue());
      setReminderTime('10:00');
      setNotice('Seguimiento registrado.');
      await loadActivities(active.id);
      await load({ silent: true });
    } catch (e) {
      setNotice(e?.message || 'No se pudo registrar el seguimiento');
    } finally {
      setBusy(false);
    }
  };

  const clearInboxFilters=()=>{
    const needsQuery=Boolean(estadoFilter||ticketReference||hiddenOnly);
    setEstadoFilter('');setAdvisorFilter('');setTicketReference('');setTicketInput('');setTicketError('');setAreaFilter('all');setHiddenOnly(false);setActiveId(null);
    if(!needsQuery)void load({silent:true});
  };

  const statusName = (s) => ({ nuevo: 'Nuevo', en_atencion: 'En atención', derivado: 'Derivado', cerrado: 'Cerrado' }[s] || String(s || '—'));

  return (
    <main className="wa-demo">
      <header className="wa-topbar">
        {onBack&&!backInAppHeader?<button className="wa-inline-exit" type="button" onClick={onBack}>Volver al panel general</button>:null}
        <div className="wa-brand">
          <img src={PADBOL_ICON_SVG} alt="Padbol" />
          <div><strong>{commercialOnly ? 'Consultas comerciales' : 'Atención & CRM'}</strong><span>{commercialOnly ? 'Formularios, informes y seguimiento' : 'Centro de conversaciones'}</span></div>
        </div>
        <div className="wa-demo-badge"><span /> {CRM_IS_QA ? 'CONECTADO A QA' : 'CONECTADO'}</div>
        <div className="wa-agent"><img className="wa-agent-logo" src={PADBOL_ICON_SVG} alt="Padbol International" /><div><strong>{perms?.canOperate || perms?.canOperateEmail || perms?.canOperateWhatsapp ? 'Atención' : perms?.canAudit ? 'Consulta' : 'Sin acceso'}</strong><span>{session?.user?.email || ''}</span></div></div>
      </header>



      <div className="wa-tools" aria-label="Herramientas de la bandeja">
      {(perms?.canAudit || commercialOnly) ? <CommercialAdvisorAccess api={commercialApi}/> : null}
      {(perms?.canAudit || commercialOnly) ? <CommercialAgendaAlerts api={commercialApi} onOpen={item=>{const id=item.conversationId || (item.channel==='form'?item.id:null);if(id){setAreaFilter('all');setTicketReference('');setTicketInput('');setEstadoFilter('');setHiddenOnly(false);setActiveId(id);setAgendaLeadId(id);if(threadRef.current)threadRef.current.scrollTop=0;}}}/> : null}
      {!commercialOnly && (perms?.canOperate || perms?.canAudit) ? <section className="wa-manual-tool">
        <button type="button" onClick={() => { setManualOpen((value) => !value); setManualReceipt(null); setManualNotice(null); }}>{manualOpen ? 'Cerrar alta manual' : 'Agregar contacto manual'}</button>
        {manualOpen ? <form onSubmit={submitManual} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <strong>Registro de contacto</strong>
          <p>Solo se registran nombre, correo y teléfono. Este alta no crea conversaciones ni guarda notas, origen o sede.</p>
          <input required aria-label="Nombre del contacto" placeholder="Nombre" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input aria-label="Correo del contacto" type="email" placeholder="Correo" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} /><input aria-label="Teléfono del contacto" placeholder="Teléfono" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} /></div>
          <button type="submit" disabled={!perms?.canOperate || busy || (!manual.email && !manual.phone)}>Guardar sin enviar mensajes</button>
        </form> : null}
        {manualReceipt ? <div role="status" style={{ marginTop: 12 }}><strong>Contacto registrado: {manualReceipt.nombre || 'Sin nombre'}</strong><p>{[manualReceipt.email_normalized, manualReceipt.phone_normalized].filter(Boolean).join(' · ')}</p><small>ID del contacto: {manualReceipt.id}</small><p>Este contacto no crea una conversación entrante ni un historial en la bandeja.</p></div> : null}
        {manualNotice ? <p role="status">{manualNotice}</p> : null}
      </section> : null}

      {(perms?.canOperate || perms?.canAudit) ? <form className="wa-ticket-search" onSubmit={(event) => {
        event.preventDefault();
        const reference = ticketInput.trim();
        if (reference && !/^PB-(?:[a-f0-9]{32}|[1-9][0-9]{5,11})$/i.test(reference)) { setTicketError('Ingresa la referencia completa del ticket, por ejemplo PB-123456.'); return; }
        setTicketError(''); setAreaFilter('all'); setEstadoFilter(''); setActiveId(null); setTicketReference(reference.toUpperCase());
      }}>
        <label htmlFor="wa-ticket-reference">Buscar por número de ticket</label>
        <input id="wa-ticket-reference" value={ticketInput} onChange={(event) => setTicketInput(event.target.value)} placeholder="Buscar ticket PB-…" maxLength={35} />
        <button type="submit">Buscar</button>
        {ticketReference ? <button type="button" onClick={() => { setTicketInput(''); setTicketReference(''); setTicketError(''); setActiveId(null); }}>Mostrar todos</button> : null}
        {ticketError ? <p role="alert">{ticketError}</p> : null}
      </form> : null}
      <details className="wa-channel-status"><summary>Canales</summary>      <section className="wa-safety" aria-label="Estado de seguridad">
        <div><span className="wa-lock">✓</span><strong>{CRM_IS_QA ? 'Entorno de prueba' : 'Centro de atención'}</strong><small>{emailSendEnabled ? 'El envío por email está habilitado para operadores autorizados.' : 'Los formularios entran al CRM. Configura un canal de respuesta para enviar mensajes.'}</small></div>
        <div className="wa-safety-flags"><span>Entrada formularios <b className="is-on">HABILITADA</b></span>{!commercialOnly ? <span>WhatsApp saliente <b className={whatsappSendEnabled ? 'is-on' : undefined}>{whatsappSendEnabled ? 'HABILITADO' : 'NO HABILITADO'}</b></span> : null}<span>Email saliente <b className={emailSendEnabled ? 'is-on' : undefined}>{emailSendEnabled ? 'HABILITADO' : 'DESACTIVADO'}</b></span></div>
      </section></details>
      {perms?.canAudit&&['superadmin','super_admin'].includes(perms.role)?<details className="wa-inbox-options"><summary>Más opciones</summary><div><button type="button" onClick={()=>{setHiddenOnly(v=>!v);setActiveId(null);setTicketReference('');setTicketInput('');}}>{hiddenOnly?'Volver a la bandeja':'Registros de prueba archivados'}</button></div></details>:null}
      </div>
      {loading ? (
        <div className="wa-empty"><p>Cargando bandeja…</p></div>
      ) : error ? (
        <div className="wa-empty">
          <p style={{ color: '#e33030' }}>
            {error?.status === 401 ? 'No autorizado. Inicia sesión.' : error?.status === 403 ? 'No tienes acceso a esta sección.' : (error?.message || 'No se pudo cargar.')}
          </p>
          <button type="button" onClick={() => { setError(null); setLoading(true); void load(); }}>Reintentar</button>
        </div>
      ) : (
        <div className="wa-crm-body">
          {hiddenOnly&&<p className="wa-archive-notice" role="status">Registros de prueba archivados. No forman parte de la bandeja activa.</p>}
          <nav className="wa-area-tabs wa-area-tabs--top" aria-label="Áreas de atención">
            {areas.map((area) => <button type="button" key={area.id} className={areaFilter === area.id ? 'active' : ''} onClick={() => { setAreaFilter(area.id); setAdvisorFilter(''); setActiveId(null); }}><i>{area.icon}</i><span>{area.label}</span><b>{commercialOnly ? items.length : areaCounts[area.id] || 0}</b></button>)}
          </nav>
          <div className="wa-workspace">
          <aside className="wa-inbox">
            <div className="wa-inbox-head"><div><p>{commercialOnly ? 'Formularios comerciales' : INBOX_AREAS.find((area) => area.id === areaFilter)?.label || 'Todo'}</p><h1>Conversaciones</h1></div><span className="wa-inbox-count">{visibleItems.length}</span></div>
            <div className="wa-filters" aria-label="Filtros">
              {(commercialOnly||areaFilter==='commercial')&&assignmentScope.role==='manager'&&<CommercialAdvisorFilter value={advisorFilter} onChange={value=>{setAdvisorFilter(value);setActiveId(null);}} cases={assignmentScope.cases} advisors={assignmentScope.advisors} currentUserId={session?.user?.id} disabled={!assignmentScope.ready}/> }
              <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} aria-label="Estado">
                <option value="">Todos los estados</option><option value="nuevo">Nuevo</option><option value="en_atencion">En atención</option><option value="derivado">Derivado</option><option value="cerrado">Cerrado</option>
              </select>
              {(estadoFilter||advisorFilter||ticketReference||!visibleItems.length)&&<button className="wa-clear-filters" type="button" onClick={clearInboxFilters}>Ver todas las consultas</button>}
            </div>
            <div className="wa-list" role="region" aria-label="Listado de conversaciones" tabIndex={0}>
              {visibleItems.length === 0 ? <div className="wa-area-empty"><p>{!items.length?(ticketReference?'No se encontró el ticket.':estadoFilter||advisorFilter?'No hay consultas con estos filtros.':'No hay conversaciones.'):'No hay conversaciones en esta sección.'}</p></div> : visibleItems.map((item) => (
                <button type="button" className={`wa-conversation wa-conversation--${item.estado || 'nuevo'} ${active?.id === item.id ? 'active' : ''}`} key={item.id} onClick={() => { setActiveId(item.id); if (threadRef.current) threadRef.current.scrollTop = 0; threadRef.current?.scrollIntoView?.({ block: 'start' }); }}>
                  <div className="wa-avatar">{(item.identity_used || item.contact?.nombre || '?').slice(0, 2).toUpperCase()}</div>
                  <div className="wa-conversation-copy">
                    <div><strong>{item.contact?.nombre || item.identity_used || '—'}</strong><time dateTime={conversationDisplayDate(item) || undefined}>{compactDateTime(conversationDisplayDate(item))}</time></div>
                    <p>{formatCrmEventText(item.subject || item.inbound_body).slice(0, 80)}</p>
                    {item.short_ticket_reference || item.ticket_reference ? <p>N.º de ticket: {item.short_ticket_reference || item.ticket_reference}</p> : null}
                    {needsEnglishHumanAttention(item) ? <p className="wa-language-attention">Atención humana en inglés pendiente</p> : null}
                    <footer><span className={`wa-pill wa-pill--${statusTone[item.estado] || 'blue'}`}>{statusName(item.estado)}</span><ChannelIcon channel={item.source_channel} /></footer>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {active ? (
            <>
              <section className="wa-thread" ref={threadRef}>
                <header className="wa-thread-head">
                  <div className="wa-avatar">{String(active.identity_used || active.contact?.nombre || '?').slice(0, 2).toUpperCase()}</div>
                  <div className="wa-thread-person"><h2>{isCommercial ? leadName : active.contact?.nombre || active.identity_used || '—'}</h2>{isCommercial ? <p className="wa-lead-location">{leadHighlights.location}</p> : null}<p><ChannelIcon channel={active.source_channel} /> {channelLabel(active.source_channel)} · {crmOriginLabel(active)}</p></div>
                  {active.short_ticket_reference || active.ticket_reference ? <p className="wa-ticket-reference">N.º de ticket: <strong>{active.short_ticket_reference || active.ticket_reference}</strong></p> : null}
                  {(perms?.canManageVisibility || (active.source_channel === 'whatsapp' && activeCanOperate && perms?.whatsappAutomationResumeEnabled === true)) ? <details className="wa-thread-admin"><summary>Administración</summary><div className="wa-thread-admin__actions">
                  {perms?.canManageVisibility ? <button type="button" disabled={busy} onClick={async () => {
                    const hide = !hiddenOnly;
                    if (hide && !window.confirm('Confirma que toda esta conversación es una prueba. Se ocultará de la bandeja y se podrá restaurar.')) return;
                    setBusy(true); setNotice(null);
                    try { await crmAdminApi.setTestVisibility(token, active.id, hide, active.test_visibility_version); setActiveId(null); await load(); }
                    catch (err) { setNotice(`No se pudo cambiar la visibilidad: ${err.message}`); }
                    finally { setBusy(false); }
                  }}>{hiddenOnly ? 'Restaurar conversación' : 'Ocultar prueba'}</button> : null}
                  {active.source_channel === 'whatsapp' && activeCanOperate && perms?.whatsappAutomationResumeEnabled === true ? <button type="button" disabled={busy || waContext?.deliveryUncertain || waContext?.deliveryUnknown} onClick={resumeWhatsappAutomation}>Reanudar respuestas automáticas</button> : null}
                  </div></details> : null}
                  <span className={`wa-pill wa-pill--${statusTone[active.estado] || 'blue'}`}>{statusName(active.estado)}</span>
                </header>
                {isCommercial ? <section className="wa-lead-highlights" aria-label="Datos principales del lead">
                  <div><span>Inversión declarada</span><strong>{leadHighlights.investment}</strong></div>
                  <div><span>Calificación</span><strong>{leadHighlights.score}</strong></div>
                  <div><span>Prioridad de atención</span><strong>{leadHighlights.priority}</strong></div>
                </section> : null}
                <div className="wa-messages">
                  {needsEnglishHumanAttention(active) ? <div className="wa-context-warning" role="status"><strong>Atención humana en inglés pendiente</strong><p>La consulta necesita atención en inglés. Revisa la conversación para continuar.</p></div> : null}
                  {waContext?.deliveryUncertain || waContext?.deliveryUnknown ? <div className="wa-context-warning" role="status"><strong>Revisión de entrega necesaria</strong><p>{waContext.deliveryUncertain ? 'No se pudo confirmar si llegó una respuesta automática. Revisa el envío antes de volver a responder para evitar duplicados.' : 'No se pudo comprobar el estado de las respuestas automáticas. Revisa la conversación antes de continuar.'}</p></div> : null}
                  {waContext?.orderUncertain || waContext?.orderUnknown ? <div className="wa-context-warning" role="status"><strong>Revisión humana necesaria</strong><p>{waContext.orderUncertain ? 'El orden de algunos mensajes no está confirmado. Revisa el historial y confirma la consulta con la persona antes de continuar.' : 'No se pudo comprobar el orden de los mensajes. Revisa la conversación antes de responder.'}</p></div> : null}
                  {waContext?.deliveryUncertain && perms?.canAudit ? <form className="wa-context-warning" aria-label="Revisar entrega automática" onSubmit={submitDeliveryReview}>
                    <strong>Registrar revisión de entrega</strong>
                    <p>Solo registra un resultado si comprobaste evidencia. Esta acción no reenvía el mensaje.</p>
                    <label htmlFor="delivery-outcome">Resultado comprobado</label>
                    <select id="delivery-outcome" value={reviewOutcome} onChange={e => { setReviewOutcome(e.target.value); setReviewConfirmed(false); }}>
                      <option value="">Selecciona un resultado</option><option value="delivered">Comprobé que se entregó</option><option value="not_delivered">Comprobé que no se entregó</option>
                    </select>
                    <label htmlFor="delivery-evidence">Evidencia comprobada</label>
                    <textarea id="delivery-evidence" maxLength={2048} value={reviewEvidence} onChange={e => { setReviewEvidence(e.target.value); setReviewConfirmed(false); }} />
                    {reviewOutcome === 'delivered' ? <><label htmlFor="delivery-provider">Identificador de Meta</label><input id="delivery-provider" maxLength={512} value={reviewProviderId} onChange={e => { setReviewProviderId(e.target.value); setReviewConfirmed(false); }} /></> : null}
                    <label><input type="checkbox" checked={reviewConfirmed} onChange={e => setReviewConfirmed(e.target.checked)} /> Revisé la evidencia y confirmo este resultado.</label>
                    <button type="submit" disabled={busy || !reviewConfirmed || !reviewOutcome || reviewEvidence.trim().length < 10 || reviewEvidence.trim().length > 2048 || (reviewOutcome === 'delivered' && (!reviewProviderId.trim() || reviewProviderId.trim().length > 512))}>Registrar revisión</button>
                  </form> : null}
                  <div className="wa-day">{active.source_channel === 'whatsapp' && active.received_at ? 'MENSAJE RECIBIDO' : 'NUEVA CONSULTA'} · {compactDateTime(conversationDisplayDate(active))}</div>
                  {!isCommercialForm ? <div className="wa-system">⌁ {formatCrmEventText(active.subject) || 'Sin asunto'}</div> : null}
                  {isCommercialForm && activeDetails.length ? <article className="wa-lead-card">
                    <section className="wa-lead-section"><h3>Consulta</h3><strong translate="no" className="notranslate">{formatCrmEventText(detailValue(activeDetails, 'Asunto') || active.subject) || 'Consulta Padbol'}</strong></section>
                    <section className="wa-lead-note"><h4>Mensaje original</h4><p translate="no" className="notranslate" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{originalLeadMessage(active, activeDetails) || 'No se registró un mensaje adicional.'}</p></section>
                    {extraLeadDetails.length ? <details className="wa-lead-note"><summary>Más datos del formulario</summary><dl>{extraLeadDetails.map(([label, value]) => <div key={label}><dt>{label}</dt><dd translate="no" className="notranslate">{value}</dd></div>)}</dl></details> : null}
                  </article> : active.source_channel === 'whatsapp' && whatsappHistory?.conversationId === active.id && whatsappHistory.messages.length ? whatsappHistory.messages.map(message => <div key={`${message.direction}-${message.id}`} className={`wa-message wa-message--${message.direction === 'outbound' ? 'out' : 'in'}`}><p translate="no" className="notranslate">{formatCrmEventText(message.body) || 'Sin contenido'}</p><small>{compactDateTime(message.at)}{message.direction === 'outbound' ? ` · ${whatsappDeliveryLabel(message)}` : ''}</small></div>) : <div className="wa-message wa-message--in"><p translate="no" className="notranslate">{formatCrmEventText(active.inbound_body) || 'Sin contenido'}</p></div>}
                  {active.source_channel === 'whatsapp' && historyError ? <p role="status">No se pudo cargar el historial completo.</p> : null}
                  {whatsappHistory?.conversationId === active.id && whatsappHistory.truncated ? <p role="status">Se muestran los mensajes más recientes; hay mensajes anteriores.</p> : null}
                  {whatsappAttachments.length ? <section aria-label="Archivos de WhatsApp">
                    <h3>Archivos recibidos</h3>
                    {whatsappAttachments.map((attachment, index) => <div key={attachment.eventId}>
                      {imagePreviews[attachment.eventId] ? <img src={imagePreviews[attachment.eventId]} alt={`Imagen recibida ${index + 1}`} style={{ display: 'block', maxWidth: '100%', maxHeight: 400, objectFit: 'contain', marginBottom: 8 }} /> : null}
                      <button type="button" className="wa-attachment-download" disabled={Boolean(downloadingAttachment)} onClick={() => void downloadWhatsappAttachment(attachment)}>{downloadingAttachment === attachment.eventId ? 'Descargando…' : `↓ Descargar ${{ image: 'imagen', audio: 'audio', video: 'video', document: 'documento', sticker: 'sticker' }[attachment.mediaType] || 'archivo'}${whatsappAttachments.length > 1 ? ` ${index + 1}` : ''}`}</button>
                    </div>)}
                  </section> : null}
                  {attachmentNotice ? <p role="status">{attachmentNotice}</p> : null}
                  {isNextGenerationForm && nextGenerationDetails.length ? <section className="wa-panel wa-ng-details"><h3>Datos de Next Generation</h3><dl>{nextGenerationDetails.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section> : null}
                  {isNextGenerationForm ? <article className="wa-analysis-pending"><div><strong>Análisis pendiente de validación para Next Generation</strong><p>Revisa los datos y el mensaje de esta consulta para continuar.</p></div></article> : leadAnalysis ? <article className="wa-executive-card">
                    <header><div><span>ANÁLISIS DEL LEAD</span><h3>Resumen ejecutivo</h3></div><div className="wa-executive-score"><strong>{leadAnalysis.score}</strong><small>/100</small><b>Prioridad {leadAnalysis.priority}</b></div></header>
                    {leadAnalysis.verdict ? <p className="wa-executive-verdict">{leadAnalysis.verdict}</p> : null}
                    <div className="wa-executive-grid">
                      {leadAnalysis.summary ? <section><h4>Quién es</h4><p>{leadAnalysis.summary}</p></section> : null}
                      {leadAnalysis.recommendation ? <section><h4>Recomendación comercial</h4><p>{leadAnalysis.recommendation}</p></section> : null}
                      {leadAnalysis.market ? <section><h4>Mercado y ubicación</h4><p>{leadAnalysis.market}</p></section> : null}
                      {leadAnalysis.climate ? <section><h4>Instalación sugerida</h4><p>{leadAnalysis.climate}</p></section> : null}
                    </div>
                    <div className="wa-executive-actions">
                      {leadAnalysis.next_steps?.length ? <section><h4>Próximo paso recomendado</h4><ol>{leadAnalysis.next_steps.map((step) => <li key={step}>{step}</li>)}</ol></section> : null}
                      {leadAnalysis.risks?.length ? <section className="wa-executive-risks"><h4>Atención</h4><ul>{leadAnalysis.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul></section> : null}
                    </div>
                    <footer>{leadAnalysis.pdf_url ? <a href={leadAnalysis.pdf_url} target="_blank" rel="noreferrer">Ver informe completo en PDF <span>↗</span></a> : <span className="wa-pdf-pending">Informe detallado pendiente de asociar</span>}<small>Análisis integrado a esta ficha · sin duplicar el contacto</small></footer>
                  </article> : <article className="wa-analysis-pending"><div><strong>{analysisNotice.title}</strong><p>{analysisNotice.message}</p></div>{analysisNotice.badge ? <b>{analysisNotice.badge}</b> : null}</article>}
                  {active.source_channel === 'email' && <CrmEmailHistory key={active.id} recordId={active.id} loadHistory={loadEmailHistory} revision={historyRevision} initialBody={active.inbound_body} initialMessage={detailValue(activeDetails, 'Información adicional')}/> }
                  {active.audio_type ? <div className="wa-system">⌁ Audio entrante: {active.audio_type} {active.transcript ? `· ${active.transcript}` : ''}</div> : null}
                </div>
                <div className="wa-composer">
                  <div className="wa-draft-label"><label htmlFor="crm-response">Respuesta</label><small>{replyUnavailableReason || (canReplyEmail ? (supportEmail ? 'Se enviará desde support@padbol.com al contacto registrado' : 'Se enviará por email al contacto registrado') : canReplyWhatsapp ? (CRM_IS_QA ? 'Se enviará por WhatsApp desde QA' : 'Se enviará por WhatsApp') : 'Envío no habilitado')}</small></div>
                  <CrmReplyTextarea id="crm-response" disabled={busy || !activeCanOperate || !canReply} value={replyText} onChange={(e) => { replyComposition.current = null; setReplyText(e.target.value); }} placeholder={replyUnavailableReason || 'Escribe una respuesta…'} />
                  <div className="wa-composer-actions">
                    <button type="button" className="wa-secondary" disabled={busy || active.handoff_ready !== true || active.qualification_status !== 'qualified'} onClick={submitHandoff}>Derivar a una persona</button>
                    <button type="button" className={`wa-send ${canReply ? 'wa-send--enabled' : ''}`} disabled={busy || !activeCanOperate || !canReply || !replyText.trim()} onClick={submitReply}>{busy ? 'Enviando…' : canReplyEmail ? 'Enviar por email' : canReplyWhatsapp ? 'Enviar por WhatsApp' : 'Respuesta no habilitada'}</button>
                  </div>
                  {notice ? <p className="wa-notice">{notice}</p> : null}
                </div>
              </section>

              <aside className="wa-detail">
                <section className="wa-contact-card"><h2>Contacto</h2>{!isCommercial ? <p><b>Nombre</b><span>{active.contact?.nombre || detailValue(activeDetails, 'Nombre') || '—'}</span></p> : null}<p><b>Email</b><span>{active.contact?.email_normalized || active.contact?.email || detailValue(activeDetails, 'Email') || '—'}</span></p><p><b>WhatsApp</b><span>{active.contact?.phone_normalized || active.contact?.phone || detailValue(activeDetails, 'WhatsApp') || '—'}</span></p></section>
                {isCommercial ? <CommercialLeadManagement key={active.id} api={commercialApi} conversation={active} caseItem={verifiedCommercialCase} onUpdated={load} showHistory={agendaLeadId===active.id} /> : null}
                {waContext && !isCommercial ? <section className="wa-panel wa-whatsapp-context" aria-label="Contexto de WhatsApp"><h3>Contexto de WhatsApp</h3>
                  {waContext.review ? <p>Revisa el historial y los avisos de esta conversación antes de continuar.</p> : <dl>{waContext.topic ? <div><dt>Tema</dt><dd>{waContext.topic}</dd></div> : null}{waContext.subtopic ? <div><dt>Opción elegida</dt><dd>{waContext.subtopic}</dd></div> : null}</dl>}
                  {waContext.initialMessage ? <div><strong>Mensaje inicial</strong><p className="wa-context-original">{waContext.initialMessage}</p></div> : null}
                  {waContext.detailMessage ? <div><strong>Detalle compartido</strong><p className="wa-context-original">{waContext.detailMessage}</p></div> : null}
                </section> : null}
                {checkingInstitutional ? <p role="status">Comprobando la gestión de esta consulta…</p> : null}
                {institutionalUnavailable ? <section role="alert"><p>No se pudo comprobar la gestión de esta consulta.</p><button type="button" onClick={()=>setInstitutionalRevision(value=>value+1)}>Volver a comprobar</button></section> : null}
                <section className="wa-panel" hidden={isCommercial || checkingInstitutional || institutionalUnavailable}><h3>Gestión</h3>
                  <dl>
                    <div><dt>Origen</dt><dd>{crmOriginLabel(active)}</dd></div>
                    <div><dt>Canal</dt><dd>{channelLabel(active.source_channel)}</dd></div>
                    <div><dt>Responsable</dt><dd>{active.operador || '—'}</dd></div>
                    <div><dt>Estado</dt><dd>{statusName(active.estado)}</dd></div>
                    <div><dt>Derivado</dt><dd>{active.derivado ? 'Sí' : 'No'}</dd></div>
                    {!isCommercial ? <div><dt>Sede</dt><dd>{active.sede_id || 'Sin asignar'}</dd></div> : null}
                  </dl>
                  {!isCommercial && !checkingInstitutional && !institutionalUnavailable && perms?.canAudit ? <label>Asignar a sede<select aria-label="Asignar conversación a sede" value={active.sede_id || ''} onChange={(e) => void assignSede(e.target.value)}><option value="">Sin asignar</option>{sedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre || `Sede ${sede.id}`}</option>)}</select></label> : null}
                </section>
                {isNextGenerationParticipant ? <section className="wa-panel wa-ng-conversion">
                  <h3>Inscripción Next Generation</h3>
                  <p className="wa-ng-help">Esta consulta sigue en el CRM hasta que decidas convertirla. Crear la inscripción no significa “lista de espera”: primero queda como borrador y no ocupa un cupo.</p>
                  {!ngOpen ? <button type="button" className="wa-ng-primary" onClick={() => setNgOpen(true)}>Preparar inscripción deportiva</button> : <form onSubmit={createNextGenerationRegistration}>
                    <label>Nombre del participante<input required aria-label="Nombre del participante Next Generation" value={ngDraft.participant_name} onChange={(e) => setNgDraft({ ...ngDraft, participant_name: e.target.value })} /></label>
                    <label>Sede<select required aria-label="Sede Next Generation" value={ngDraft.sede_id} onChange={(e) => setNgDraft({ ...ngDraft, sede_id: e.target.value, sesion_id: '' })}><option value="">Seleccionar sede…</option>{ngOverview.sedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.sede_club || sede.nombre || `Sede ${sede.id}`}</option>)}</select></label>
                    <label>Jornada<select required aria-label="Jornada Next Generation" value={ngDraft.sesion_id} onChange={(e) => { const jornada = ngOverview.jornadas.find((item) => String(item.id) === e.target.value); setNgDraft({ ...ngDraft, sesion_id: e.target.value, categoria: ngDraft.categoria || jornada?.categoria || '' }); }}><option value="">Seleccionar jornada…</option>{ngJornadas.map((jornada) => <option key={jornada.id} value={jornada.id}>{jornada.nombre_publico || 'Jornada sin nombre'}{jornada.categoria ? ` · ${jornada.categoria}` : ''}</option>)}</select></label>
                    <label>Categoría<input required aria-label="Categoría Next Generation" placeholder="Ej.: U14" value={ngDraft.categoria} onChange={(e) => setNgDraft({ ...ngDraft, categoria: e.target.value })} /></label>
                    {!ngOverview.jornadas.length ? <p className="wa-ng-warning">Todavía no hay jornadas disponibles. Créala antes de convertir esta consulta.</p> : null}
                    <div className="wa-ng-actions"><button type="button" onClick={() => setNgOpen(false)}>Cancelar</button><button type="submit" className="wa-ng-primary" disabled={busy || !ngOverview.jornadas.length}>Crear como borrador</button></div>
                  </form>}
                </section> : null}
                {isNextGenerationVenue ? <section className="wa-panel wa-ng-conversion"><h3>Postulación de sede</h3><p className="wa-ng-help">Esta es una postulación de sede, no una inscripción deportiva. Primero se atiende en el CRM y luego se crea la postulación formal para evaluarla en Next Generation.</p>
                  {perms?.canAudit ? (!ngVenueOpen ? <button type="button" className="wa-ng-primary" onClick={() => setNgVenueOpen(true)}>Crear postulación de sede</button> : <form onSubmit={createNextGenerationVenueApplication}>
                    <label>Nombre de la sede o club<input required aria-label="Nombre de sede postulante" value={ngVenueDraft.sede_club} onChange={(e) => setNgVenueDraft({ ...ngVenueDraft, sede_club: e.target.value })} /></label>
                    <label>Ciudad<input required aria-label="Ciudad de sede postulante" value={ngVenueDraft.ciudad} onChange={(e) => setNgVenueDraft({ ...ngVenueDraft, ciudad: e.target.value })} /></label>
                    <label>País<input required aria-label="País de sede postulante" value={ngVenueDraft.pais} onChange={(e) => setNgVenueDraft({ ...ngVenueDraft, pais: e.target.value })} /></label>
                    <div className="wa-ng-actions"><button type="button" onClick={() => setNgVenueOpen(false)}>Cancelar</button><button type="submit" className="wa-ng-primary" disabled={busy}>Crear postulación</button></div>
                  </form>) : <p className="wa-ng-warning">La creación formal de nuevas sedes la realiza el Super Admin.</p>}
                </section> : null}
                {perms?.canOperate ? <section className="wa-panel wa-followup"><h3>Registrar seguimiento</h3>
                  <label>Tipo<select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
                    <option value="note">Nota / WhatsApp externo</option><option value="phone_call">Llamada</option><option value="zoom_meeting">Reunión online</option><option value="in_person_meeting">Reunión presencial</option>
                  </select></label>
                  <label>Motivo<select value={activityTopic} onChange={(e) => setActivityTopic(e.target.value)}><option value="">Elegir motivo…</option>{FOLLOW_UP_TOPICS.filter(option => !commercialOnly || !['Jugador o partido', 'Soporte técnico', 'Reclamo'].includes(option)).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <label>Detalle opcional<textarea value={activitySummary} onChange={(e) => setActivitySummary(e.target.value)} placeholder="Sólo si hace falta agregar algo" /></label>
                  <label>Resultado<select value={activityOutcome} onChange={(e) => setActivityOutcome(e.target.value)}><option value="">Elegir resultado…</option>{FOLLOW_UP_RESULTS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <label>Próximo paso<select value={activityNextStep} onChange={(e) => setActivityNextStep(e.target.value)}><option value="">Sin próximo paso</option>{FOLLOW_UP_NEXT_STEPS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <label>Responsable<input type="text" value={activityResponsable} readOnly title="Se guarda con tu usuario" /></label>
                  <div className="wa-followup-split">
                    <label>Estado<select value={activityEstado} onChange={(e) => setActivityEstado(e.target.value)}>{FOLLOW_UP_ESTADOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label>Derivación<select value={activityDerivado} onChange={(e) => setActivityDerivado(e.target.value)}><option value="no">No derivado</option><option value="si">Derivado a una persona</option></select></label>
                  </div>
                  <div className="wa-reminder-row">
                    <label>Recordatorio<input type="date" min={localDateValue()} value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} /></label>
                    <label>Hora<select value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}>{REMINDER_TIMES.map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
                  </div>
                  <div className="wa-reminder-quick" role="group" aria-label="Atajos de recordatorio">
                    <button type="button" className={reminderDate === localDateValue() ? 'active' : ''} onClick={() => setReminderDate(localDateValue())}>Hoy</button>
                    <button type="button" className={reminderDate === addDays(localDateValue(), 1) ? 'active' : ''} onClick={() => setReminderDate(addDays(localDateValue(), 1))}>Mañana</button>
                    <button type="button" className={reminderDate === addDays(localDateValue(), 2) ? 'active' : ''} onClick={() => setReminderDate(addDays(localDateValue(), 2))}>Pasado mañana</button>
                  </div>
                  <button type="button" className="wa-followup-save" disabled={busy || !activityTopic} onClick={submitActivity}>Guardar seguimiento</button>
                  <div className="wa-activity-list">
                    {activities.map((activity) => <article key={activity.id}><header><strong>{({ note: 'Nota', phone_call: 'Llamada', zoom_meeting: 'Reunión online', in_person_meeting: 'Reunión presencial' })[activity.activity_type] || activity.activity_type}</strong><time dateTime={activity.created_at || undefined}>{compactDateTime(activity.created_at)}</time></header><p>{activity.summary}</p>{activity.next_step ? <small>Próximo paso: {activity.next_step}</small> : null}</article>)}
                  </div>
                </section> : null}
              </aside>
            </>
          ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
