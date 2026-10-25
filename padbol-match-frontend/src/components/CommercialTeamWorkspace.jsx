import React, {useEffect, useState} from 'react';
import CommercialAssignments from './CommercialAssignments';
import CommercialCaseDetail from './CommercialCaseDetail';
import CommercialAgendaAlerts from './CommercialAgendaAlerts';
import './CommercialTeamWorkspace.css';

// The server determines the role and filters every case; client state never grants access.
export default function CommercialTeamWorkspace({api}) {
  const [role,setRole]=useState(null), [cases,setCases]=useState([]), [selected,setSelected]=useState(null), [error,setError]=useState('');
  useEffect(()=>{let active=true; setRole(null);setSelected(null);setError('');
    Promise.all([api.getRole(),api.listCases()]).then(([r,c])=>{if(!active)return;if(!['manager','advisor'].includes(r.role))throw new Error('Invalid role');setRole(r.role);setCases(c.cases || []);}).catch(()=>{if(active)setError('No se pudo abrir el área comercial.');});
    return ()=>{active=false};},[api]);
  async function refresh(){try{const c=await api.listCases();setCases(c.cases || []);setSelected(null);setError('');}catch{setError('No se pudieron actualizar las consultas.');}}
  if(error&&!role)return <p role="alert">{error}</p>;
  if(!role)return <p>Cargando área comercial…</p>;
  return <main className="commercial-team"><h1>Área comercial</h1><CommercialAgendaAlerts api={api} onOpen={setSelected}/>{role==='manager'&&<CommercialAssignments api={api}/>}<section aria-label="Consultas comerciales"><h2>Consultas</h2><button type="button" onClick={refresh}>Actualizar consultas</button>{error&&<p role="alert">{error}</p>}{!cases.length&&<p>No hay consultas disponibles.</p>}<ul>{cases.map(c=><li key={`${c.channel}:${c.id}`}><button type="button" onClick={()=>setSelected(c)}>{c.contact?.name || c.contact?.phone || c.contact?.email || 'Consulta comercial'} · {c.channel === 'whatsapp' ? 'WhatsApp' : 'Formulario'}</button></li>)}</ul></section>{selected&&<CommercialCaseDetail key={`${selected.channel}:${selected.id}`} item={selected} api={api}/>}</main>;
}
