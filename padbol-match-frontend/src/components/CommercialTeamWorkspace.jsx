import React, {useEffect, useState} from 'react';
import {commercialCaseSourceLabel} from '../utils/commercialCaseSourceLabel';
import CommercialAdvisorFilter, {matchesAdvisor} from './CommercialAdvisorFilter';
import CommercialAssignments from './CommercialAssignments';
import CommercialCaseDetail from './CommercialCaseDetail';
import CommercialAgendaAlerts from './CommercialAgendaAlerts';
import './CommercialTeamWorkspace.css';
import './CommercialCrmTheme.css';

// The server determines the role and filters every case; client state never grants access.
export default function CommercialTeamWorkspace({api,currentUserId=''}) {
  const [advisorFilter,setAdvisorFilter]=useState('');
  const [authorized,setAuthorized]=useState(false);
  const [role,setRole]=useState(null), [cases,setCases]=useState([]), [selected,setSelected]=useState(null), [error,setError]=useState('');
  useEffect(()=>{setRole(null);setSelected(null);setCases([]);setError('');},[currentUserId]);
  useEffect(()=>{let active=true;setAuthorized(false);
    Promise.all([api.getRole(),api.listCases()]).then(([r,c])=>{if(!active)return;if(!['manager','advisor'].includes(r.role))throw Object.assign(new Error('Invalid role'),{status:403});setRole(r.role);setCases(c.cases || []);setSelected(current=>current&&(c.cases||[]).some(item=>item.id===current.id&&item.channel===current.channel)?current:null);setAuthorized(true);setError('');}).catch(error=>{if(active){if(error?.status===403||error?.status===404){setSelected(null);setCases([]);setRole(null);}setError('No se pudo abrir el área comercial.');}});
    return ()=>{active=false};},[api]);
  async function refresh(){try{const c=await api.listCases();setCases(c.cases || []);setSelected(null);setError('');}catch{setError('No se pudieron actualizar las consultas.');}}
  if(error&&!role)return <p role="alert">{error}</p>;
  if(!role)return <p>Cargando área comercial…</p>;
  const visibleCases=cases.filter(c=>matchesAdvisor(c,advisorFilter,currentUserId));
  return <main className="commercial-team"><fieldset disabled={!authorized}><h1>Área comercial</h1><CommercialAgendaAlerts api={api} onOpen={setSelected}/>{role==='manager'&&<CommercialAssignments api={api}/>}<section aria-label="Consultas comerciales"><h2>Consultas</h2><button type="button" onClick={refresh}>Actualizar consultas</button>{error&&<p role="alert">{error}</p>}{!cases.length&&<p>No hay consultas disponibles.</p>}{role==='manager'&&<CommercialAdvisorFilter value={advisorFilter} onChange={value=>{setAdvisorFilter(value);setSelected(null);}} cases={cases} currentUserId={currentUserId}/>}{advisorFilter&&<button type="button" onClick={()=>{setAdvisorFilter('');setSelected(null);}}>Ver todas las consultas</button>}{advisorFilter&&!visibleCases.length&&<p>No hay consultas para este asesor.</p>}<ul>{visibleCases.map(c=><li key={`${c.channel}:${c.id}`}><button type="button" onClick={()=>setSelected(c)}>{c.contact?.name || c.contact?.phone || c.contact?.email || 'Consulta comercial'} · {commercialCaseSourceLabel(c)}</button></li>)}</ul></section>{selected&&<CommercialCaseDetail key={`${selected.channel}:${selected.id}`} item={selected} api={api}/>}</fieldset></main>;
}
