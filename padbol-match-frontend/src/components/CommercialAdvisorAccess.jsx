import React,{useEffect,useState} from 'react';
import {ADVISOR_REQUEST_STATUS,advisorOperationNotice} from '../utils/commercialAdvisorStatus';
import './CommercialAdvisorAccess.css';
const emptyAdvisor={email:'',name:'',territory:'',agreedConditions:''};
export default function CommercialAdvisorAccess({api}){
 const [manager,setManager]=useState(false),[open,setOpen]=useState(false),[formOpen,setFormOpen]=useState(false);
 const [requests,setRequests]=useState([]),[advisors,setAdvisors]=useState([]),[canApprove,setCanApprove]=useState(false);
 const [draft,setDraft]=useState({...emptyAdvisor}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  let active=true,authorized=false,pending=false;
  async function refreshRequests(){if(!authorized||document.visibilityState==='hidden'||pending)return;pending=true;try{const result=await api.listAdvisorRequests();if(active){setRequests(result.requests||[]);setCanApprove(result.canApprove===true);}}catch{}finally{pending=false;}}
  api.getRole().then(result=>{if(!active)return;authorized=result.role==='manager';setManager(authorized);if(authorized)refreshRequests();}).catch(()=>{});
  const timer=window.setInterval(refreshRequests,15000);window.addEventListener('focus',refreshRequests);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refreshRequests);};
 },[api]);
 async function load(){const [result,team]=await Promise.all([api.listAdvisorRequests(),api.listAdvisors()]);setRequests(result.requests||[]);setCanApprove(result.canApprove===true);setAdvisors(team.advisors||[]);}
 async function show(){setOpen(true);setError('');setBusy(true);try{await load();}catch{setError('No se pudo cargar el equipo. Volvé a abrir este panel.');}finally{setBusy(false);}}
 async function submit(event){event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');try{const result=await api.addAdvisor(draft.email.trim(),{name:draft.name.trim(),territory:draft.territory.trim(),agreedConditions:draft.agreedConditions.trim()});setDraft({...emptyAdvisor});await load();setFormOpen(false);setNotice(advisorOperationNotice(result));}catch(err){setError(err.userMessage || 'No se pudo confirmar la operación. Actualizá el panel antes de repetirla.');}finally{setBusy(false);}}
 async function decide(id,decision){if(busy)return;setBusy(true);setError('');setNotice('');try{const result=await api.decideAdvisorRequest(id,decision);await load();window.dispatchEvent(new Event('commercial-agenda-updated'));setNotice(advisorOperationNotice(result,decision));}catch(e){setError(e.status===409?'No se pudo habilitar: comprobá que el asesor haya creado su cuenta y confirmado el correo, y actualizá la lista.':'No se pudo confirmar la decisión. Actualizá el panel.');}finally{setBusy(false);}}
 if(!manager)return null;
 const pendingCount=requests.filter(request=>['pending','pending_verification'].includes(request.status)).length;
 return <div className="commercial-advisor-access"><button type="button" aria-expanded={open} onClick={()=>open?setOpen(false):show()}>Equipo comercial{canApprove&&pendingCount>0&&<span className="commercial-advisor-pending">{pendingCount} pendiente{pendingCount===1?'':'s'}</span>}</button>
 {open&&<section className="commercial-advisor-access__panel" aria-label="Equipo comercial"><header><h2>Equipo comercial</h2><button type="button" onClick={()=>setOpen(false)}>Cerrar</button></header>
 {!formOpen&&<button className="commercial-advisor-add" type="button" onClick={()=>setFormOpen(true)}>{canApprove?'Habilitar asesor':'Agregar asesor'}</button>}
 <p>{canApprove?'Completá los datos para habilitar al asesor. Su cuenta debe tener el correo confirmado.':'Completá los datos para solicitar el acceso. Quedará pendiente de habilitación por Administración central.'}</p>
 {formOpen&&<form onSubmit={submit} aria-label={canApprove?'Habilitar asesor':'Solicitar acceso de asesor'}><label>Nombre<input value={draft.name} maxLength={120} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Correo del asesor<input type="email" required value={draft.email} maxLength={254} onChange={e=>setDraft({...draft,email:e.target.value})}/></label><label>País o región de referencia (opcional)<input value={draft.territory} maxLength={200} onChange={e=>setDraft({...draft,territory:e.target.value})}/></label><label>Condiciones acordadas (opcional)<textarea value={draft.agreedConditions} maxLength={2000} rows="3" onChange={e=>setDraft({...draft,agreedConditions:e.target.value})}/></label><small>Las consultas se asignan desde cada ficha.</small><button type="submit" disabled={busy||!draft.email.trim()}>{canApprove?'Habilitar asesor':'Solicitar alta'}</button><button type="button" onClick={()=>setFormOpen(false)}>Cancelar</button></form>}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Actualizando…</p>}
 <h3>Solicitudes</h3>{!requests.length&&!busy&&<p>No hay solicitudes.</p>}<ul>{requests.map(request=><li key={request.id}><strong>{request.name||request.email}</strong><span>{request.email}{request.territory?` · ${request.territory}`:''}</span>{request.agreedConditions&&<span>Condiciones acordadas: {request.agreedConditions}</span>}<span>{ADVISOR_REQUEST_STATUS[request.status]||request.status}</span>{canApprove&&['pending','pending_verification'].includes(request.status)&&<div><button type="button" disabled={busy} onClick={()=>decide(request.id,'approved')}>Habilitar acceso</button><button type="button" disabled={busy} onClick={()=>decide(request.id,'rejected')}>Rechazar</button></div>}</li>)}</ul>
 <h3>Asesores habilitados</h3><ul>{advisors.filter(advisor=>advisor.active).map(advisor=><li key={advisor.id}>{advisor.name||advisor.email}{advisor.role==='manager'?' · Dirección comercial':''}</li>)}</ul>
 </section>}</div>;
}
