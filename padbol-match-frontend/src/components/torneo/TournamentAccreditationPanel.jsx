import React, { useState } from 'react';

export default function TournamentAccreditationPanel({ catalog, busy, text, perform, request, requestId }) {
  const [reference, setReference] = useState('');
  const [evidence, setEvidence] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [enableFipa, setEnableFipa] = useState(false);
  const [decisions, setDecisions] = useState({});
  const awaiting = (catalog.accreditation_requests || []).filter(r => r.estado === 'pendiente');
  const own = catalog.participants.filter(p => p.can_request_accreditation);
  if (!catalog.can_accredit && !own.length) return null;
  const ready = reference.trim().length >= 8 && evidence.trim().length >= 20 && confirmed && (!catalog.homologation_requires_fipa_enablement || enableFipa);
  const success = text('Decisión guardada y comprobada. No se han asignado puntos ni modificado resultados anteriores.', 'Decision saved and confirmed. No points have been awarded or previous results changed.');
  return <section aria-label={text('Acreditación para ranking oficial', 'Official ranking accreditation')}>
    <h3>{text('Acreditación para ranking oficial', 'Official ranking accreditation')}</h3>
    <p>{text('La cuenta vinculada debe solicitar su revisión. La homologación del torneo y la acreditación individual requieren una decisión expresa del superadministrador. Ser elegible no significa haber recibido puntos.', 'The linked account must request its review. Event homologation and individual accreditation require an explicit superadministrator decision. Eligibility does not mean points have been awarded.')}</p>
    <p>{catalog.homologacion?.estado === 'aprobada' ? text('Torneo homologado', 'Event homologated') : text('Torneo pendiente de homologación', 'Event awaiting homologation')}{catalog.homologacion?.referencia_oficial ? `: ${catalog.homologacion.referencia_oficial}` : ''}</p>
    {catalog.can_homologate && catalog.homologacion?.estado !== 'aprobada' ? <fieldset disabled={busy}>
      <legend>{text('Homologar el torneo', 'Homologate event')}</legend>
      <label htmlFor="event-official-reference">{text('Referencia oficial de la decisión', 'Official decision reference')}</label><input id="event-official-reference" value={reference} maxLength={1000} onChange={e => setReference(e.target.value)} />
      <label htmlFor="event-official-evidence">{text('Evidencia revisada y requisitos comprobados', 'Reviewed evidence and verified requirements')}</label><textarea id="event-official-evidence" value={evidence} maxLength={4000} onChange={e => setEvidence(e.target.value)} />
      <label className="participant-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{text('He comprobado que es un evento oficial y que cumple los requisitos configurados.', 'I have verified that this is an official event meeting the configured requirements.')}</label>
      {catalog.homologation_requires_fipa_enablement ? <label className="participant-check"><input type="checkbox" checked={enableFipa} onChange={e => setEnableFipa(e.target.checked)} />{text('Activar inscripción FIPA para este torneo al homologarlo.', 'Enable FIPA registration for this event when homologating it.')}</label> : null}
      <button type="button" disabled={!ready} onClick={() => void perform(() => request('/homologacion', { request_id: requestId(`homologation:${reference}:${evidence}`), referencia_oficial: reference.trim(), evidencia: evidence.trim(), confirmar_evento_oficial: true, confirmar_requisitos: true, ...(catalog.homologation_requires_fipa_enablement ? { habilitar_inscripcion_fipa: enableFipa } : {}) }), success, (fresh, result) => result.homologacion?.estado === 'aprobada' && fresh.homologacion?.estado === 'aprobada' && fresh.homologacion.referencia_oficial === result.homologacion.referencia_oficial && result.homologacion.referencia_oficial === reference.trim())}>{text('Confirmar homologación', 'Confirm homologation')}</button>
    </fieldset> : catalog.can_accredit && catalog.homologacion?.estado !== 'aprobada' ? <p>{catalog.homologation_block_reason || text('Este evento no está habilitado para homologación oficial.', 'This event is not enabled for official homologation.')}</p> : null}
    {own.map(p => <div className="participant-entry" key={p.id}><strong>{p.nombre}</strong><button type="button" disabled={busy} onClick={() => void perform(() => request(`/participantes/${p.id}/acreditacion`, { request_id: requestId(`accreditation:${p.id}`) }), text('Solicitud de acreditación registrada y comprobada.', 'Accreditation request recorded and confirmed.'), (fresh, result) => result.solicitud?.participante_id === p.id && fresh.accreditation_requests?.some(r => r.id === result.solicitud.id && r.participante_id === p.id && r.estado === result.solicitud.estado))}>{text('Solicitar revisión para ranking oficial', 'Request official ranking review')}</button></div>)}
    {catalog.can_accredit && awaiting.map(r => {
      const d = decisions[r.id] || { reference: '', evidence: '', confirmed: false };
      const update = change => setDecisions(old => ({ ...old, [r.id]: { ...d, ...change } }));
      const valid = d.reference.trim().length >= 8 && d.evidence.trim().length >= 20 && d.confirmed && catalog.homologacion?.estado === 'aprobada';
      return <fieldset key={r.id} disabled={busy}><legend>{r.nombre_solicitante || text('Solicitud individual', 'Individual request')}</legend>
        <label htmlFor={`accredit-ref-${r.id}`}>{text('Referencia oficial', 'Official reference')}</label><input id={`accredit-ref-${r.id}`} maxLength={1000} value={d.reference} onChange={e => update({ reference: e.target.value })} />
        <label htmlFor={`accredit-evidence-${r.id}`}>{text('Evidencia de identidad y requisitos revisados', 'Reviewed identity and requirements evidence')}</label><textarea id={`accredit-evidence-${r.id}`} maxLength={4000} value={d.evidence} onChange={e => update({ evidence: e.target.value })} />
        <label className="participant-check"><input type="checkbox" checked={d.confirmed} onChange={e => update({ confirmed: e.target.checked })} />{text('He verificado la identidad y los requisitos exigidos por este torneo.', 'I have verified identity and the requirements for this event.')}</label>
        {['aprobar', 'rechazar'].map(decision => <button type="button" key={decision} disabled={decision === 'aprobar' && !valid} onClick={() => void perform(() => request(`/acreditaciones/${r.id}/resolver`, { request_id: requestId(`accredit-resolve:${r.id}:${decision}:${d.reference}:${d.evidence}`), decision, referencia_oficial: d.reference.trim(), evidencia: d.evidence.trim(), confirmar_identidad: d.confirmed, confirmar_requisitos: d.confirmed }), success, (fresh, result) => result.solicitud?.id === r.id && result.solicitud.estado === (decision === 'aprobar' ? 'aprobado' : 'rechazado') && fresh.accreditation_requests?.some(item => item.id === r.id && item.estado === result.solicitud.estado))}>{decision === 'aprobar' ? text('Aprobar elegibilidad', 'Approve eligibility') : text('Rechazar acreditación', 'Reject accreditation')}</button>)}
      </fieldset>;
    })}
  </section>;
}
