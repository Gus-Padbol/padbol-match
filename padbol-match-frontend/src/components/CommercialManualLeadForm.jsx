import React, {useEffect, useRef, useState} from 'react';
import {parseReminderHours, toLocalDateTime} from './CommercialLeadManagement';
import './CommercialManualLeadForm.css';

const PREFIXES = [
  ['54', 'Argentina +54'], ['598', 'Uruguay +598'], ['55', 'Brasil +55'], ['56', 'Chile +56'],
  ['595', 'Paraguay +595'], ['591', 'Bolivia +591'], ['51', 'Perú +51'], ['57', 'Colombia +57'],
  ['52', 'México +52'], ['34', 'España +34'], ['1', 'EE. UU./Canadá +1'],
];
const INTERESTS = [
  ['cancha', 'Cancha oficial Padbol'], ['club', 'Sumar Padbol a un club'],
  ['sede', 'Abrir un Punto Padbol'], ['representacion_regional', 'Representación regional'],
  ['representacion_nacional', 'Representación nacional'], ['otra', 'Otra consulta'],
];
const STATUSES = [['nuevo', 'Nuevo'], ['en_atencion', 'En atención'], ['en_espera', 'En espera / seguimiento'], ['cerrado', 'Cerrado']];
const ACTIVITY_TYPES = [['note', 'Nota'], ['email', 'Correo electrónico'], ['phone_call', 'Llamada'], ['zoom_meeting', 'Reunión online'], ['in_person_meeting', 'Reunión presencial'], ['other', 'Otra gestión']];
const EMPTY = {
  name: '', email: '', prefix: '54', phone: '', company: '', country: '', city: '',
  interest: 'club', status: 'nuevo', sourceDetail: '', notes: '', nextStep: '',
  nextContact: '', reminders: '24, 8', assignedAdvisorId: '', closureOutcome: '', activityType: 'note',
};

function splitPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const prefix = PREFIXES.map(([code]) => code).sort((a, b) => b.length - a.length).find(code => digits.startsWith(code)) || '54';
  return {prefix, phone: digits.startsWith(prefix) ? digits.slice(prefix.length) : digits};
}

function combinedPhone(prefix, phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `+${String(prefix || '').replace(/\D/g, '')}${digits}` : '';
}

export default function CommercialManualLeadForm({api, currentUserId='', mode='create', caseId=null, onClose, onCreated, onOpenExisting}) {
  const [form, setForm] = useState(EMPTY);
  const [role, setRole] = useState(null);
  const [advisors, setAdvisors] = useState([]);
  const [matches, setMatches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [force, setForce] = useState(false);
  const [linked, setLinked] = useState([]), [linkable, setLinkable] = useState([]);
  const panel = useRef(null);
  const editing = mode === 'edit' && Boolean(caseId);

  const update = (key, value) => { setForm(current => ({...current, [key]: value})); setError(''); setNotice(''); };
  const phone = combinedPhone(form.prefix, form.phone);
  const canSubmit = Boolean(form.email.trim() || phone) && !busy;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const permission = await api.getRole();
        if (!active) return;
        setRole(permission.role);
        if (permission.role === 'manager') {
          const data = await api.listAdvisors();
          if (active) setAdvisors(data.advisors || []);
        } else if (active) {
          setAdvisors([{id:currentUserId, name:'Yo', active:true}]);
          setForm(current => ({...current, assignedAdvisorId: currentUserId}));
        }
        if (editing) {
          const data = await api.readManual(caseId);
          if (!active) return;
          const split = splitPhone(data.contact?.phone_normalized);
          setForm({
            ...EMPTY,
            name: data.contact?.nombre || data.fields?.Nombre || '',
            email: data.contact?.email_normalized || '',
            prefix: split.prefix, phone: split.phone,
            company: data.manualData?.company || data.fields?.['Empresa, club o sede'] || '',
            country: data.manualData?.country || data.fields?.País || '',
            city: data.manualData?.city || data.fields?.Ciudad || '',
            interest: data.manualData?.interest || 'otra',
            status: data.status || 'nuevo',
            sourceDetail: data.manualData?.source_detail || '',
            notes: data.notes || '', nextStep: data.nextStep || '',
            nextContact: toLocalDateTime(data.nextContactAt),
            reminders: (data.reminderHours || [24,8]).join(', '),
            assignedAdvisorId: data.assignedAdvisor?.id || '',
            closureOutcome: data.closureOutcome || '',
          });
          setLinked(data.linkedConversations || []); setLinkable(data.linkableConversations || []);
        }
      } catch (e) {
        if (active) setError(e?.message === 'FORBIDDEN' ? 'No tenés permiso para esta ficha.' : 'No se pudo cargar el formulario.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [api, caseId, currentUserId, editing]);

  useEffect(() => {
    const previous = document.activeElement;
    const onKey = event => { if (event.key === 'Escape' && !busy) onClose?.(); };
    document.addEventListener('keydown', onKey);
    panel.current?.querySelector('input,select,textarea,button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [busy, onClose]);

  async function search() {
    const q = form.email.trim() || phone || form.name.trim();
    if (!q) { setError('Ingresá un correo, teléfono o nombre para buscar coincidencias.'); return; }
    setBusy(true); setError(''); setMatches([]);
    try {
      const result = await api.searchManual(q);
      setMatches(result.matches || []);
      if (!(result.matches || []).length) setNotice('No encontramos coincidencias. Podés crear la ficha.');
    } catch { setError('No se pudo buscar coincidencias. Intentá nuevamente.'); }
    finally { setBusy(false); }
  }

  function applyMatch(match) {
    if (!match) return;
    if (match.case_id) { onOpenExisting?.(match.case_id); onClose?.(); return; }
    setForm(current => ({
      ...current,
      name: match.nombre || current.name,
      email: match.email_normalized || current.email,
      ...(() => { const split = splitPhone(match.phone_normalized); return {prefix:split.prefix, phone:split.phone}; })(),
    }));
    setMatches([]); setNotice('Contacto existente seleccionado. Completá el seguimiento y guardá.');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!form.email.trim() && !phone) { setError('Ingresá un correo o un teléfono para poder contactar al interesado.'); return; }
    if (form.status === 'cerrado' && !editing && !form.closureOutcome) { setError('Indicá si la venta se concretó o no avanzó.'); return; }
    const reminders = parseReminderHours(form.reminders);
    let nextContactAt = null;
    if (form.nextContact) { const parsed = new Date(form.nextContact); if (!Number.isFinite(parsed.getTime())) { setError('La fecha de próximo contacto no es válida.'); return; } nextContactAt = parsed.toISOString(); }
    if (form.nextContact && !reminders) { setError('Indicá las horas de aviso separadas por comas. Ej.: 24, 8.'); return; }
    const payload = {
      name: form.name, email: form.email, phone, company: form.company, country: form.country,
      city: form.city, interest: form.interest, status: form.status, sourceDetail: form.sourceDetail,
      notes: form.notes, nextStep: form.nextStep, nextContactAt,
      reminderHours: reminders || [24,8], assignedAdvisorId: form.assignedAdvisorId || undefined,
      closureOutcome: form.status === 'cerrado' ? form.closureOutcome : undefined,
      activityType: form.activityType,
      ...(force ? {force: true} : {}),
    };
    setBusy(true); setError(''); setNotice('');
    try {
      const result = editing ? await api.updateManual(caseId, payload) : await api.createManual(payload);
      if (result?.existing && result.caseId) {
        setNotice('Ya existe una ficha activa para este contacto. Abriéndola…');
        onOpenExisting?.(result.caseId); onClose?.(); return;
      }
      const id = result?.caseId || result?.conversationId || result?.id;
      if (!id) throw new Error('El servidor no confirmó la ficha.');
      setNotice(editing ? 'Ficha actualizada.' : 'Lead creado. Abriendo seguimiento…');
      if (editing) onCreated?.(id); else onCreated?.(id);
      onClose?.();
    } catch (e) {
      if (e?.code === 'MANUAL_IDENTITY_CONFLICT' || e?.status === 409) {
        setError(e?.message || 'El contacto coincide con otra ficha. Revisá las coincidencias.');
        await search();
      } else setError(e?.userMessage || e?.message || 'No se pudo guardar la ficha. Revisá los datos.');
    } finally { setBusy(false); }
  }

  const manager = role === 'manager';
  const title = editing ? 'Editar ficha comercial' : 'Nuevo lead manual';
  return <div className="manual-lead-overlay" role="presentation">
    <section className="manual-lead-modal" role="dialog" aria-modal="true" aria-labelledby="manual-lead-title" ref={panel}>
      <header className="manual-lead-header">
        <div><p>ÁREA COMERCIAL · PADBOL INTERNACIONAL</p><h2 id="manual-lead-title">{title}</h2><span>{editing ? 'Actualizá los datos y el seguimiento sin alterar el historial.' : 'Registrá una oportunidad aunque todavía no haya conversación.'}</span></div>
        <button type="button" className="manual-lead-close" onClick={onClose} disabled={busy} aria-label="Cerrar formulario">×</button>
      </header>
      {loading ? <p className="manual-lead-loading">Cargando ficha…</p> : <form onSubmit={submit} className="manual-lead-form">
        <section aria-labelledby="manual-contact-title">
          <h3 id="manual-contact-title">1 · Contacto</h3>
          <div className="manual-lead-grid two">
            <label>Nombre y apellido<input value={form.name} onChange={e=>update('name',e.target.value)} maxLength={160} autoComplete="name" placeholder="Ej.: Juan Pérez" /></label>
            <label>Empresa, club o sede<input value={form.company} onChange={e=>update('company',e.target.value)} maxLength={160} placeholder="Organización" /></label>
            <label>Correo electrónico<input type="email" value={form.email} onChange={e=>update('email',e.target.value)} maxLength={254} autoComplete="email" placeholder="nombre@organizacion.com" /></label>
            <label>Teléfono con prefijo internacional<span className="manual-phone-row"><select aria-label="Prefijo internacional" value={form.prefix} onChange={e=>update('prefix',e.target.value)}>{PREFIXES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><input type="tel" inputMode="tel" value={form.phone} onChange={e=>update('phone',e.target.value)} maxLength={20} autoComplete="tel" placeholder="9 11 1234 5678" /></span></label>
          </div>
          <div className="manual-duplicate-row"><button type="button" className="manual-secondary" onClick={search} disabled={busy}>Buscar coincidencias</button><small>Por correo, teléfono o nombre. No se fusiona ni elimina nada automáticamente.</small></div>
          {matches.length ? <div className="manual-matches" aria-label="Posibles coincidencias"><strong>Posibles coincidencias</strong>{matches.map(match=><article key={match.id}><div><b>{match.nombre || 'Sin nombre'}</b><span>{[match.email_normalized, match.phone_normalized ? `+${match.phone_normalized}` : ''].filter(Boolean).join(' · ')}</span>{match.status&&<small>Estado: {match.status}</small>}</div><button type="button" className="manual-secondary" onClick={()=>applyMatch(match)}>{match.case_id ? 'Abrir ficha existente' : 'Usar este contacto'}</button></article>)}</div> : null}
        </section>
        <section aria-labelledby="manual-context-title">
          <h3 id="manual-context-title">2 · Ubicación e interés</h3>
          <div className="manual-lead-grid two">
            <label>País<input value={form.country} onChange={e=>update('country',e.target.value)} maxLength={120} autoComplete="country-name" placeholder="Argentina" /></label>
            <label>Ciudad o región<input value={form.city} onChange={e=>update('city',e.target.value)} maxLength={120} autoComplete="address-level2" placeholder="La Plata" /></label>
            <label>Tipo de interés comercial<select value={form.interest} onChange={e=>update('interest',e.target.value)}>{INTERESTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label>Procedencia conocida <small>Opcional</small><input value={form.sourceDetail} onChange={e=>update('sourceDetail',e.target.value)} maxLength={200} placeholder="Referido, evento, feria, club…" /></label>
          </div>
        </section>
        <section aria-labelledby="manual-followup-title">
          <h3 id="manual-followup-title">3 · Seguimiento</h3>
          <div className="manual-lead-grid two">
            <label>Estado del lead<select value={form.status} onChange={e=>update('status',e.target.value)}>{STATUSES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label>Responsable comercial{manager && !editing ? <select value={form.assignedAdvisorId} onChange={e=>update('assignedAdvisorId',e.target.value)}><option value="">Seleccionar asesor</option>{advisors.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name || a.email}</option>)}</select> : <input value={editing ? (advisors.find(a=>a.id===form.assignedAdvisorId)?.name || 'Responsable actual') : 'Yo'} readOnly aria-label="Responsable comercial" />}</label>
            {form.status==='cerrado' && <label>Resultado comercial<select value={form.closureOutcome} onChange={e=>update('closureOutcome',e.target.value)}><option value="">Seleccionar resultado</option><option value="venta_concretada">Venta concretada</option><option value="no_avanzo">No avanzó</option></select></label>}
            <label>Primera gestión<select value={form.activityType} onChange={e=>update('activityType',e.target.value)}>{ACTIVITY_TYPES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label>Notas iniciales<textarea value={form.notes} onChange={e=>update('notes',e.target.value)} maxLength={2000} rows={3} placeholder="Qué necesita, qué se habló y cualquier dato útil." /></label>
          <div className="manual-lead-grid two">
            <label>Próximo paso<input value={form.nextStep} onChange={e=>update('nextStep',e.target.value)} maxLength={2000} placeholder="Ej.: enviar propuesta" /></label>
            <label>Fecha de próximo contacto <small>Opcional</small><input type="datetime-local" value={form.nextContact} onChange={e=>update('nextContact',e.target.value)} /></label>
            <label>Avisarme estas horas antes<input value={form.reminders} onChange={e=>update('reminders',e.target.value)} placeholder="24, 8" /><small>Horas separadas por coma. Por defecto 24 y 8.</small></label>
          </div>
        </section>
        {editing && (linkable.length>0 || linked.length>0) ? <section aria-labelledby="manual-links-title" className="manual-links"><h3 id="manual-links-title">Conversaciones reales del mismo contacto</h3><p>Se vinculan a esta ficha sin fusionar ni eliminar registros. El historial comercial sigue siendo el de esta ficha.</p>{linkable.map(item=><div key={item.id} className="manual-link-row"><span>{item.source_channel==='whatsapp'?'WhatsApp':'Correo'} · {item.origin || 'sin origen'} · {item.subject || 'Sin asunto'}</span>{linked.includes(item.id)?<b>Vinculada</b>:<button type="button" className="manual-secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const data=await api.linkManual(caseId,item.id);setLinked(data.linkedConversations||[]);setLinkable(data.linkableConversations||[]);setNotice('Conversación vinculada.');}catch(e){setError(e?.message||'No se pudo vincular.');}finally{setBusy(false);}}}>Vincular</button>}</div>)}</section> : null}
        {error && <p className="manual-lead-error" role="alert">{error}</p>}
        {notice && <p className="manual-lead-notice" role="status">{notice}</p>}
        <footer className="manual-lead-actions">
          {matches.some(m=>m.email_normalized===form.email.trim().toLowerCase() || m.phone_normalized===phone.replace(/\D/g,'')) && !editing ? <button type="button" className="manual-secondary" disabled={busy} onClick={()=>{setForce(true);setNotice('Se creará una ficha separada. El contacto existente no se modificará.');}}>Crear ficha separada</button> : null}
          <button type="button" className="manual-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="manual-primary" disabled={!canSubmit}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear lead y abrir seguimiento'}</button>
        </footer>
      </form>}
    </section>
  </div>;
}
