import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { crmAdminApi } from '../utils/crmAdminApi';
import './WhatsappCrmDemo.css';

const CRM_IS_QA = String(process.env.REACT_APP_APP_VARIANT || '').toLowerCase() === 'qa';

const statusTone = {
  nuevo: 'blue',
  en_atencion: 'amber',
  derivado: 'violet',
  cerrado: 'red',
};

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
  return text;
}

const REMINDER_TIMES = Array.from({ length: 12 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);

function ChannelIcon({ channel }) {
  const isWa = channel === 'whatsapp';
  return <span className={`wa-channel wa-channel--${isWa ? 'wa' : 'mail'}`}>{isWa ? 'W' : '@'}</span>;
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

function conversationArea(conversation) {
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

function formDetails(conversation) {
  const saved = conversation?.qualification_data?.form_submission?.fields;
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    const entries = Object.entries(saved).filter(([, value]) => String(value ?? '').trim());
    if (entries.length) return entries;
  }
  const body = String(conversation?.inbound_body || '');
  const fromLines = body.split('\n').flatMap((line) => {
    const separator = line.indexOf(':');
    if (separator < 1) return [];
    const label = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    return label && value ? [[label, value]] : [];
  });
  if (fromLines.length > 1) return fromLines;
  const labels = [
    'Disponibilidad de espacio', 'Información adicional', 'Cantidad de canchas',
    'Destino de la cancha', 'Ciudad o región', 'Empresa o club', 'Programa Academy',
    'WhatsApp', 'Apellido', 'Asunto', 'Nombre', 'Email', 'País', 'Curso',
  ];
  const pattern = new RegExp(`(?:^|\\s)(${labels.join('|')}):\\s*`, 'gi');
  const matches = [...body.matchAll(pattern)];
  return matches.flatMap((match, index) => {
    const valueStart = match.index + match[0].length;
    const valueEnd = matches[index + 1]?.index ?? body.length;
    const value = body.slice(valueStart, valueEnd).trim();
    return value ? [[match[1], value]] : [];
  });
}

function detailValue(details, ...labels) {
  const expected = labels.map((label) => label.toLocaleLowerCase('es'));
  return details.find(([label]) => expected.includes(String(label).toLocaleLowerCase('es')))?.[1] || null;
}

export default function WhatsappCrmDemo({ accessToken, onBack } = {}) {
  const hasPanelExit = Boolean(onBack);
  useEffect(() => {
    if (hasPanelExit) window.scrollTo(0, 0);
  }, [hasPanelExit]);
  const { session } = useAuth();
  const token = accessToken || session?.access_token || '';
  const [perms, setPerms] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [areaFilter, setAreaFilter] = useState('all');
  const channelFilter = '';
  const [estadoFilter, setEstadoFilter] = useState('');
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [activities, setActivities] = useState([]);
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
  const [manual, setManual] = useState({ name: '', email: '', phone: '', origin: 'in_person', subject: '', body: '', sede_id: '' });
  const [ngOverview, setNgOverview] = useState({ sedes: [], jornadas: [] });
  const [ngOpen, setNgOpen] = useState(false);
  const [ngDraft, setNgDraft] = useState({ sede_id: '', sesion_id: '', categoria: '', participant_name: '' });
  const [ngVenueOpen, setNgVenueOpen] = useState(false);
  const [ngVenueDraft, setNgVenueDraft] = useState({ sede_club: '', ciudad: '', pais: '' });

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!token) {
      setError({ status: 401 });
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const p = await crmAdminApi.permissions(token);
      setPerms(p);
      if (p?.canOperate || p?.canAudit) {
        const inbox = await crmAdminApi.inbox(token, { channel: channelFilter, estado: estadoFilter });
        setItems(Array.isArray(inbox) ? inbox : Array.isArray(inbox?.items) ? inbox.items : []);
      } else {
        setItems([]);
      }
    } catch (e) {
      setError(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, channelFilter, estadoFilter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!token || !perms?.canAudit) return;
    crmAdminApi.sedes(token).then((data) => setSedes(Array.isArray(data) ? data : (data?.sedes || []))).catch(() => setSedes([]));
  }, [token, perms?.canAudit]);

  useEffect(() => {
    if (!token || (!perms?.canOperate && !perms?.canAudit)) return;
    crmAdminApi.nextGenerationOverview(token)
      .then((data) => setNgOverview({
        sedes: Array.isArray(data?.sedes) ? data.sedes : [],
        jornadas: Array.isArray(data?.jornadas) ? data.jornadas : [],
      }))
      .catch(() => setNgOverview({ sedes: [], jornadas: [] }));
  }, [token, perms?.canOperate, perms?.canAudit]);

  useEffect(() => {
    const timer = window.setInterval(() => { void load({ silent: true }); }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const areaCounts = INBOX_AREAS.reduce((counts, area) => ({
    ...counts,
    [area.id]: area.id === 'all' ? items.length : items.filter((item) => conversationArea(item) === area.id).length,
  }), {});
  const visibleItems = areaFilter === 'all' ? items : items.filter((item) => conversationArea(item) === areaFilter);
  const active = visibleItems.find((i) => i.id === activeId) || visibleItems[0] || null;
  const leadAnalysis = active?.qualification_data?.lead_analysis || null;
  const analysisRequestStatus = active?.qualification_data?.lead_analysis_request?.status || null;
  const whatsappSendEnabled = perms?.whatsappSendEnabled === true;
  const activeDetails = formDetails(active);
  const isWebForm = String(active?.origin || '').startsWith('web_form:');
  const whatsappMetaPending = true;
  const canReplyWhatsapp = active?.source_channel === 'whatsapp' && whatsappSendEnabled && !whatsappMetaPending;
  const leadName = [detailValue(activeDetails, 'Nombre'), detailValue(activeDetails, 'Apellido')].filter(Boolean).join(' ') || active?.contact?.nombre || active?.identity_used || 'Contacto sin nombre';
  const activeArea = conversationArea(active);
  const isNextGenerationParticipant = activeArea === 'nextgen_participants';
  const isNextGenerationVenue = activeArea === 'nextgen_venues';
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

  const submitReply = async () => {
    if (!active || busy || !replyText.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await crmAdminApi.reply(token, active.id, replyText.trim());
      setNotice(result?.status === 'sent'
        ? 'Mensaje enviado por WhatsApp.'
        : 'Respuesta guardada como pendiente.');
      setReplyText('');
      await load();
    } catch (e) {
      setNotice(e?.message || 'No se pudo registrar la respuesta');
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
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      await crmAdminApi.createManual(token, { ...manual, sede_id: perms?.canAudit ? manual.sede_id : undefined });
      setManual({ name: '', email: '', phone: '', origin: 'in_person', subject: '', body: '', sede_id: '' });
      setManualOpen(false); setNotice('Contacto registrado en la sede, sin enviar comunicaciones.'); await load();
    } catch (e) { setNotice(e?.message || 'No se pudo registrar el contacto'); }
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
      // El backend QA guarda el seguimiento con un esquema fijo
      // (activity_type, summary, outcome, next_step, follow_up_at y author).
      // Responsable, estado y derivación viajan dentro del resumen para que
      // queden persistidos en la ficha sin cambiar el contrato del backend.
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
    } catch (e) {
      setNotice(e?.message || 'No se pudo registrar el seguimiento');
    } finally {
      setBusy(false);
    }
  };

  const statusName = (s) => ({ nuevo: 'Nuevo', en_atencion: 'En atención', derivado: 'Derivado', cerrado: 'Cerrado' }[s] || String(s || '—'));

  return (
    <main className="wa-demo">
      {onBack ? <div className="wa-panel-exit"><button type="button" onClick={onBack}>Volver al panel general</button></div> : null}
      <header className="wa-topbar">
        <div className="wa-brand">
          <img src="/media/public-site/jero/padbol-logo-tertiary.png" alt="Padbol" />
          <div><strong>Atención & CRM</strong><span>Centro de conversaciones</span></div>
        </div>
        <div className="wa-demo-badge"><span /> {CRM_IS_QA ? 'CONECTADO A QA' : 'CONECTADO'}</div>
        <div className="wa-agent"><div className="wa-avatar wa-avatar--small">{perms?.canAudit ? 'SU' : perms?.canOperate ? 'OP' : '—'}</div><div><strong>{perms?.canAudit ? 'Auditoría' : perms?.canOperate ? 'Operador' : 'Sin acceso'}</strong><span>{session?.user?.email || ''}</span></div></div>
      </header>

      <section className="wa-safety" aria-label="Estado de seguridad">
        <div><span className="wa-lock">✓</span><strong>{CRM_IS_QA ? 'Entorno de prueba' : 'Centro de atención'}</strong><small>Los formularios entran al CRM. Ninguna respuesta saliente está habilitada todavía.</small></div>
        <div className="wa-safety-flags"><span>Entrada formularios <b className="is-on">HABILITADA</b></span><span>WhatsApp saliente <b>PENDIENTE META</b></span><span>Email saliente <b>DESACTIVADO</b></span></div>
      </section>

      {perms?.canOperate || perms?.canAudit ? <section style={{ margin: '12px 18px', padding: 14, border: '1px solid var(--border-color, #ddd)', borderRadius: 12 }}>
        <button type="button" onClick={() => setManualOpen((value) => !value)}>{manualOpen ? 'Cerrar alta manual' : 'Agregar contacto manual'}</button>
        {manualOpen ? <form onSubmit={submitManual} style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <strong>Contacto recibido por la sede</strong>
          <input required aria-label="Nombre del contacto" placeholder="Nombre" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input aria-label="Correo del contacto" type="email" placeholder="Correo" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} /><input aria-label="Teléfono del contacto" placeholder="Teléfono" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} /></div>
          <select aria-label="Origen del contacto" value={manual.origin} onChange={(e) => setManual({ ...manual, origin: e.target.value })}><option value="in_person">Presencial</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="other">Otro</option></select>
          {perms?.canAudit ? <select required aria-label="Sede canónica" value={manual.sede_id} onChange={(e) => setManual({ ...manual, sede_id: e.target.value })}><option value="">Elegir sede</option>{sedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre || `Sede ${sede.id}`}</option>)}</select> : null}
          <input aria-label="Asunto" placeholder="Asunto" value={manual.subject} onChange={(e) => setManual({ ...manual, subject: e.target.value })} />
          <textarea aria-label="Detalle" placeholder="Detalle" rows={2} value={manual.body} onChange={(e) => setManual({ ...manual, body: e.target.value })} />
          <button type="submit" disabled={busy || (!manual.email && !manual.phone)}>Guardar sin enviar mensajes</button>
        </form> : null}
      </section> : null}

      {loading ? (
        <div className="wa-empty"><p>Cargando bandeja…</p></div>
      ) : error ? (
        <div className="wa-empty">
          <p style={{ color: '#e33030' }}>
            {error?.status === 401 ? 'No autorizado. Inicia sesión.' : error?.status === 403 ? 'No tienes acceso a esta sección.' : (error?.message || 'No se pudo cargar.')}
          </p>
          <button type="button" onClick={() => { setError(null); setLoading(true); void load(); }}>Reintentar</button>
        </div>
      ) : items.length === 0 ? (
        <div className="wa-empty"><p>No hay conversaciones.</p></div>
      ) : (
        <div className="wa-crm-body">
          <nav className="wa-area-tabs wa-area-tabs--top" aria-label="Áreas de atención">
            {INBOX_AREAS.map((area) => <button type="button" key={area.id} className={areaFilter === area.id ? 'active' : ''} onClick={() => { setAreaFilter(area.id); setActiveId(null); }}><i>{area.icon}</i><span>{area.label}</span><b>{areaCounts[area.id] || 0}</b></button>)}
          </nav>
          <div className="wa-workspace">
          <aside className="wa-inbox">
            <div className="wa-inbox-head"><div><p>{INBOX_AREAS.find((area) => area.id === areaFilter)?.label || 'Todo'}</p><h1>Conversaciones</h1></div><span className="wa-inbox-count">{visibleItems.length}</span></div>
            <div className="wa-filters" aria-label="Filtros">
              <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} aria-label="Estado">
                <option value="">Todos los estados</option><option value="nuevo">Nuevo</option><option value="en_atencion">En atención</option><option value="derivado">Derivado</option><option value="cerrado">Cerrado</option>
              </select>
            </div>
            <div className="wa-list">
              {visibleItems.length === 0 ? <div className="wa-area-empty">No hay conversaciones en esta sección.</div> : visibleItems.map((item) => (
                <button type="button" className={`wa-conversation wa-conversation--${item.estado || 'nuevo'} ${active?.id === item.id ? 'active' : ''}`} key={item.id} onClick={() => setActiveId(item.id)}>
                  <div className="wa-avatar">{(item.identity_used || item.contact?.nombre || '?').slice(0, 2).toUpperCase()}</div>
                  <div className="wa-conversation-copy">
                    <div><strong>{item.contact?.nombre || item.identity_used || '—'}</strong><time dateTime={item.created_at || undefined}>{compactDateTime(item.created_at)}</time></div>
                    <p>{formatCrmEventText(item.subject || item.inbound_body).slice(0, 80)}</p>
                    <footer><span className={`wa-pill wa-pill--${statusTone[item.estado] || 'blue'}`}>{statusName(item.estado)}</span><ChannelIcon channel={item.source_channel} /></footer>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {active ? (
            <>
              <section className="wa-thread">
                <header className="wa-thread-head">
                  <div className="wa-avatar">{String(active.identity_used || active.contact?.nombre || '?').slice(0, 2).toUpperCase()}</div>
                  <div className="wa-thread-person"><h2>{active.contact?.nombre || active.identity_used || '—'}</h2><p><ChannelIcon channel={active.source_channel} /> {channelLabel(active.source_channel)} · {active.origin || active.source_channel}</p></div>
                  <span className={`wa-pill wa-pill--${statusTone[active.estado] || 'blue'}`}>{statusName(active.estado)}</span>
                </header>
                <div className="wa-messages">
                  <div className="wa-day">NUEVA CONSULTA · {compactDateTime(active.created_at)}</div>
                  <div className="wa-system">⌁ {formatCrmEventText(active.subject) || 'Sin asunto'}</div>
                  {isWebForm && activeDetails.length ? <article className="wa-lead-card">
                    <header><span>Nuevo lead</span><div><h3>{leadName}</h3><p>{detailValue(activeDetails, 'Empresa o club') || 'Consulta particular'} · {[detailValue(activeDetails, 'Ciudad o región'), detailValue(activeDetails, 'País')].filter(Boolean).join(', ') || 'Ubicación no indicada'}</p></div></header>
                    <section className="wa-lead-section"><h4>Qué está buscando</h4><strong>{formatCrmEventText(detailValue(activeDetails, 'Asunto') || active.subject) || 'Consulta Padbol'}</strong></section>
                    <dl>
                      <div><dt>Cantidad de canchas</dt><dd>{detailValue(activeDetails, 'Cantidad de canchas') || 'Sin definir'}</dd></div>
                      <div><dt>Destino</dt><dd>{detailValue(activeDetails, 'Destino de la cancha') || 'Sin definir'}</dd></div>
                      <div><dt>Espacio disponible</dt><dd>{detailValue(activeDetails, 'Disponibilidad de espacio') || 'Sin definir'}</dd></div>
                      <div><dt>Ubicación</dt><dd>{[detailValue(activeDetails, 'Ciudad o región'), detailValue(activeDetails, 'País')].filter(Boolean).join(', ') || 'Sin definir'}</dd></div>
                    </dl>
                    <section className="wa-lead-note"><h4>Mensaje de la persona</h4><p>{detailValue(activeDetails, 'Información adicional') || 'No agregó información adicional.'}</p></section>
                  </article> : <div className="wa-message wa-message--in"><p>{formatCrmEventText(active.inbound_body) || 'Sin contenido'}</p></div>}
                  {leadAnalysis ? <article className="wa-executive-card">
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
                  </article> : analysisRequestStatus === 'pending' ? <article className="wa-analysis-pending is-running"><span>✦</span><div><strong>Analizando este lead</strong><p>La ficha se actualiza automáticamente cuando llega el resultado. No hace falta recargar ni abrir otro informe.</p></div><b>EN PROCESO</b></article> : <article className="wa-analysis-pending"><span>✦</span><div><strong>Sin análisis solicitado</strong><p>Este registro de prueba o histórico no disparó un análisis automático.</p></div></article>}
                  {active.audio_type ? <div className="wa-system">⌁ Audio entrante: {active.audio_type} {active.transcript ? `· ${active.transcript}` : ''}</div> : null}
                </div>
                <div className="wa-composer">
                  <div className="wa-draft-label"><span>✦ Respuesta</span><small>{canReplyWhatsapp ? (CRM_IS_QA ? 'Se enviará por WhatsApp desde QA' : 'Se enviará por WhatsApp') : isWebForm ? 'Respuesta por email todavía no habilitada' : 'Envío desactivado'}</small></div>
                  <textarea disabled={!canReplyWhatsapp} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={isWebForm ? 'Esta consulta se podrá responder cuando habilitemos el email saliente.' : 'Escribe una respuesta…'} />
                  <div className="wa-composer-actions">
                    <button type="button" className="wa-secondary" disabled={busy || active.handoff_ready !== true || active.qualification_status !== 'qualified'} onClick={submitHandoff}>Derivar a una persona</button>
                    <button type="button" className={`wa-send ${canReplyWhatsapp ? 'wa-send--enabled' : ''}`} disabled={busy || !perms?.canOperate || !canReplyWhatsapp || !replyText.trim()} onClick={submitReply}>{busy ? 'Enviando…' : canReplyWhatsapp ? 'Enviar por WhatsApp' : 'Respuesta no habilitada'}</button>
                  </div>
                  {notice ? <p className="wa-notice">{notice}</p> : null}
                </div>
              </section>

              <aside className="wa-detail">
                <section className="wa-contact-card"><h2>Contacto</h2><p><b>Nombre</b><span>{active.contact?.nombre || detailValue(activeDetails, 'Nombre') || '—'}</span></p><p><b>Email</b><span>{active.contact?.email_normalized || active.contact?.email || detailValue(activeDetails, 'Email') || '—'}</span></p><p><b>WhatsApp</b><span>{active.contact?.phone_normalized || active.contact?.phone || detailValue(activeDetails, 'WhatsApp') || '—'}</span></p></section>
                {isWebForm && activeDetails.length ? <section className="wa-panel wa-lead-summary"><h3>Datos de la consulta</h3><dl>{['Empresa o club', 'País', 'Ciudad o región', 'Cantidad de canchas', 'Destino de la cancha', 'Disponibilidad de espacio'].map((label) => <div key={label}><dt>{label}</dt><dd>{detailValue(activeDetails, label) || '—'}</dd></div>)}</dl></section> : null}
                <section className="wa-panel"><h3>Gestión</h3>
                  <dl>
                    <div><dt>Origen</dt><dd>{active.origin || active.source_channel || '—'}</dd></div>
                    <div><dt>Canal</dt><dd>{channelLabel(active.source_channel)}</dd></div>
                    <div><dt>Responsable</dt><dd>{active.operador || '—'}</dd></div>
                    <div><dt>Estado</dt><dd>{statusName(active.estado)}</dd></div>
                    <div><dt>Derivado</dt><dd>{active.derivado ? 'Sí' : 'No'}</dd></div>
                    <div><dt>Sede</dt><dd>{active.sede_id || 'Sin asignar'}</dd></div>
                  </dl>
                  {perms?.canAudit ? <label>Asignar a sede<select aria-label="Asignar conversación a sede" value={active.sede_id || ''} onChange={(e) => void assignSede(e.target.value)}><option value="">Sin asignar</option>{sedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre || `Sede ${sede.id}`}</option>)}</select></label> : null}
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
                  <label>Motivo<select value={activityTopic} onChange={(e) => setActivityTopic(e.target.value)}><option value="">Elegir motivo…</option>{FOLLOW_UP_TOPICS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
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
                <section className="wa-panel wa-audit"><div className="wa-panel-title"><h3>Auditoría</h3><span>{CRM_IS_QA ? 'QA' : 'GLOBAL'}</span></div><p>Consulta la vista de auditoría global desde el panel de superadmin.</p></section>
              </aside>
            </>
          ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
