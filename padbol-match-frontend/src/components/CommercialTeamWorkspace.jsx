import React, {useEffect, useRef, useState} from 'react';
import {commercialCaseSourceLabel} from '../utils/commercialCaseSourceLabel';
import {PADBOL_INTERNACIONAL_LOGO_ON_DARK} from '../constants/padbolInstitutionalBrand';
import CommercialAdvisorFilter, {matchesAdvisor} from './CommercialAdvisorFilter';
import CommercialAssignments from './CommercialAssignments';
import CommercialCaseDetail from './CommercialCaseDetail';
import CommercialManualLeadForm from './CommercialManualLeadForm';
import CommercialAgendaAlerts from './CommercialAgendaAlerts';
import './CommercialTeamWorkspace.css';
import './CommercialCrmTheme.css';
import '../pages/CrmCommercialRedesign.css';

// The server determines the role and filters every case; client state never grants access.
export default function CommercialTeamWorkspace({api,currentUserId=''}) {
  const [advisorFilter,setAdvisorFilter]=useState('');
  const [authorized,setAuthorized]=useState(false);
  const [sessionRejected,setSessionRejected]=useState(false),[sessionRevision,setSessionRevision]=useState(0),[recovering,setRecovering]=useState(false);
  const activeApi=useRef(api);activeApi.current=api;
  const [role,setRole]=useState(null), [cases,setCases]=useState([]), [selected,setSelected]=useState(null), [error,setError]=useState('');
  const [manualOpen,setManualOpen]=useState(false),[manualEditId,setManualEditId]=useState(null);
  useEffect(()=>{setRole(null);setSelected(null);setCases([]);setError('');},[currentUserId]);
  useEffect(()=>{let active=true;setAuthorized(false);
    Promise.all([api.getRole(),api.listCases()]).then(([r,c])=>{if(!active)return;if(!['manager','advisor'].includes(r.role))throw Object.assign(new Error('Invalid role'),{status:403});setRole(r.role);setCases(c.cases || []);setSelected(current=>current&&(c.cases||[]).some(item=>item.id===current.id&&item.channel===current.channel)?current:null);setAuthorized(true);setSessionRejected(false);setError('');}).catch(error=>{if(active){setSessionRejected(error?.status===401&&error?.code==='UNAUTHENTICATED');if(error?.status===403||error?.status===404){setSelected(null);setCases([]);setRole(null);}setError('No se pudo abrir el área comercial.');}});
    return ()=>{active=false};},[api,sessionRevision]);
  async function recoverSession(){
    if(recovering||typeof api.revalidateSession!=='function')return;setRecovering(true);
    try{await api.revalidateSession();if(activeApi.current===api)setSessionRevision(v=>v+1);}
    catch{if(activeApi.current===api)setError('No se pudo verificar la sesión. Conserva el borrador e inicia sesión nuevamente.');}
    finally{setRecovering(false);}
  }
  async function refresh(){try{const c=await api.listCases();setCases(c.cases || []);setSelected(null);setError('');}catch{setError('No se pudieron actualizar las consultas.');}}
  async function selectCase(id){
    const c=await api.listCases(); setCases(c.cases || []);
    const item=(c.cases||[]).find(x=>x.id===id&&x.channel==='form');
    setSelected(item||null); setError('');
    if(!item) setError('La ficha se guardó, pero todavía no aparece en la bandeja. Actualizá las consultas.');
  }
  const openManualCreated=async id=>{setManualOpen(false);setManualEditId(null);try{await selectCase(id);}catch{setError('La ficha se guardó, pero no se pudo abrir. Actualizá las consultas.');}};
  const openExisting=async id=>{setManualOpen(false);setManualEditId(null);try{await selectCase(id);}catch{setError('No se pudo abrir la ficha existente.');}};
  if(error&&!role)return <p role="alert">{error}</p>;
  if(!role)return <p>Cargando área comercial…</p>;
  const visibleCases=cases.filter(c=>matchesAdvisor(c,advisorFilter,currentUserId));
  return <main className="commercial-team">
    <header className="commercial-team-top">
      <div className="commercial-team-brand">
        <img src={PADBOL_INTERNACIONAL_LOGO_ON_DARK} alt="Padbol Internacional" />
        <div><strong>Padbol Internacional</strong><span>Área comercial · Plataforma Padbol Match</span></div>
      </div>
      <div className="commercial-team-tools">
        <CommercialAgendaAlerts api={api} onOpen={setSelected}/>
        <button type="button" className="commercial-team-new" onClick={()=>{setManualEditId(null);setManualOpen(true);}}>Nuevo lead</button>
        <button type="button" className="commercial-team-refresh" onClick={refresh}>Actualizar consultas</button>
      </div>
    </header>
    <fieldset disabled={!authorized}>
      <h1>Área comercial</h1>
      {role==='manager'&&<details className="commercial-team-admin"><summary>Administración comercial</summary><CommercialAssignments api={api}/></details>}
      <div className="commercial-team-workspace">
        <section className="commercial-team-list" aria-label="Consultas comerciales">
          <header>
            <div><p>BANDEJA COMERCIAL</p><h2>Consultas</h2></div>
            <span className="commercial-team-count">{cases.length}</span>
          </header>
          {error&&<p role="alert">{error}</p>}
          <div className="commercial-team-filters">
            {role==='manager'&&<CommercialAdvisorFilter value={advisorFilter} onChange={value=>{setAdvisorFilter(value);setSelected(null);}} cases={cases} currentUserId={currentUserId}/>}
            {advisorFilter&&<button type="button" onClick={()=>{setAdvisorFilter('');setSelected(null);}}>Ver todas las consultas</button>}
          </div>
          {!cases.length&&<p>No hay consultas disponibles.</p>}
          {advisorFilter&&!visibleCases.length&&<p>No hay consultas para este asesor.</p>}
          <ul>{visibleCases.map(c=><li key={`${c.channel}:${c.id}`}><button type="button" className={selected?.id===c.id&&selected?.channel===c.channel?'is-active':''} onClick={()=>setSelected(c)}><strong>{c.contact?.name || c.contact?.phone || c.contact?.email || 'Consulta comercial'}</strong><span>{commercialCaseSourceLabel(c)}</span>{c.assignedAdvisor?.name&&<small>Asesor: {c.assignedAdvisor.name}</small>}</button></li>)}</ul>
        </section>
        {selected?<div className="commercial-team-detail"><CommercialCaseDetail key={`${selected.channel}:${selected.id}`} item={selected} api={api} disabled={!authorized} revalidationRevision={sessionRevision} onEditManual={()=>{setManualEditId(selected.id);setManualOpen(true);}}/></div>:<div className="commercial-team-placeholder"><strong>Seleccioná una consulta</strong><span>Elegí un lead de la bandeja para ver su ficha, origen e historial.</span></div>}
      </div>
    </fieldset>
    {sessionRejected&&typeof api.revalidateSession==='function'&&<button type="button" disabled={recovering} onClick={recoverSession}>Volver a comprobar sesión</button>}
    {manualOpen&&<CommercialManualLeadForm api={api} currentUserId={currentUserId} mode={manualEditId?'edit':'create'} caseId={manualEditId} onClose={()=>{setManualOpen(false);setManualEditId(null);}} onCreated={openManualCreated} onOpenExisting={openExisting}/>}
  </main>
}
