import React, { useEffect, useState } from 'react';

// Transport and authorization are provided by the calling CRM; this component
// never derives an operator's access from client-supplied identity data.
export default function CommercialAssignments({ api }) {
  const [cases, setCases] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [selection, setSelection] = useState({});
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  async function refresh() {
    const [caseData, advisorData] = await Promise.all([api.listCases(), api.listAdvisors()]);
    setCases(caseData.cases || []);
    setAdvisors(advisorData.advisors || []);
    setReady(true);
  }
  useEffect(() => { let active = true; Promise.all([api.listCases(), api.listAdvisors()]).then(([c, a]) => {
    if (active) { setCases(c.cases || []); setAdvisors(a.advisors || []); setReady(true); }
  }).catch(() => { if (active) setError('No se pudieron cargar las consultas y los asesores.'); }); return () => { active = false; }; }, [api]);
  async function retryLoad() {
    setBusy(true); setError('');
    try { await refresh(); } catch { setError('No se pudieron cargar las consultas y los asesores.'); }
    finally { setBusy(false); }
  }
  async function assign(event, item) {
    event.preventDefault();
    const advisorId = selection[`${item.channel}:${item.id}`];
    if (!advisorId || busy || !Number.isSafeInteger(item.version)) return;
    setBusy(true); setError(''); setNotice('');
    try { await api.assign(item.channel, item.id, advisorId, item.version); await refresh(); setNotice('Asignación actualizada.'); }
    catch { setError('No se pudo confirmar la asignación. Actualiza la lista antes de intentarlo de nuevo.'); setReady(false); }
    finally { setBusy(false); }
  }
  async function addAdvisor(event) {
    event.preventDefault(); if (!email.trim() || busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await api.addAdvisor(email.trim()); setEmail(''); await refresh(); setNotice('Asesor habilitado.'); }
    catch { setError('No se pudo confirmar el alta. Revisa la lista antes de intentarlo de nuevo.'); setReady(false); }
    finally { setBusy(false); }
  }
  async function deactivateAdvisor(advisor) {
    if (busy || !window.confirm(`¿Desactivar a ${advisor.name || advisor.email}? Primero debes reasignar sus consultas abiertas.`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await api.deactivateAdvisor(advisor.id); await refresh(); setNotice('Asesor desactivado.'); }
    catch { setError('No se pudo confirmar la desactivación. Actualiza la lista antes de intentarlo de nuevo.'); setReady(false); }
    finally { setBusy(false); }
  }
  return <section aria-label="Administración comercial">
    <h2>Administración comercial</h2>
    <p>Consulta y distribuye las oportunidades comerciales entre los asesores.</p>
    {error && <div><p role="alert">{error}</p><button type="button" disabled={busy} onClick={retryLoad}>Actualizar lista</button></div>}{notice && <p role="status">{notice}</p>}
    {!ready && !error && <p>Cargando…</p>}
    {ready && <><h3>Asesores</h3><p>El asesor debe tener una cuenta de Padbol Match con el correo confirmado.</p>
      <form onSubmit={addAdvisor}><label>Correo del asesor <input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label> <button type="submit" disabled={busy}>Dar de alta</button></form>
      {advisors.length ? <ul>{advisors.map(a => <li key={a.id}>{a.name || a.email} {a.status ? `· ${a.status}` : ''} {a.active === true && a.role !== 'manager' && <button type="button" disabled={busy} onClick={() => deactivateAdvisor(a)}>Desactivar</button>}</li>)}</ul> : <p>No hay asesores disponibles.</p>}
      <h3>Consultas comerciales</h3>
      {!cases.length && <p>No hay consultas comerciales para mostrar.</p>}
      {cases.map(item => <article key={`${item.channel}:${item.id}`}><h4>{item.contact?.name || item.contact?.phone || 'Consulta comercial'}</h4><p>Canal: {item.channel === 'whatsapp' ? 'WhatsApp' : item.channel === 'form' ? 'Formulario' : 'No disponible'} · Estado: {item.status || 'No disponible'}</p><p>Asesor: {item.assignedAdvisor?.name || 'Sin asignar'}</p>
        <form onSubmit={e => assign(e, item)}><label>Asignar a <select value={selection[`${item.channel}:${item.id}`] || ''} onChange={e => setSelection({...selection, [`${item.channel}:${item.id}`]: e.target.value})} required><option value="">Selecciona un asesor</option>{advisors.filter(a => a.active === true).map(a => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}</select></label> <button disabled={busy || !selection[`${item.channel}:${item.id}`] || !Number.isSafeInteger(item.version) || !['form','whatsapp'].includes(item.channel) || item.status === 'closed' || item.progressState === 'cerrado'}>Guardar asignación</button></form>
      </article>)}
    </>}
  </section>;
}
