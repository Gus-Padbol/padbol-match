import React, {useCallback, useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import {useAuth} from '../context/AuthContext';
import {getApiBaseUrl} from '../utils/apiPublicBaseUrl';
import './RecorridoExterno.css';
import './FipaClaims.css';

const stateLabel={pending:'Pendiente de verificación',approved:'Aprobada',rejected:'No aprobada'};
export default function AdminFipaPlayers(){
 const navigate=useNavigate();const {session}=useAuth();const token=session?.access_token;
 const [snapshot,setSnapshot]=useState(null);const [query,setQuery]=useState('');const [status,setStatus]=useState('pending');
 const [notes,setNotes]=useState({});const [verified,setVerified]=useState({});const [sending,setSending]=useState(false);const [error,setError]=useState('');
 const load=useCallback(async()=>{
  if(!token)return;const response=await fetch(`${getApiBaseUrl()}/api/admin/fipa/solicitudes`,{headers:{Authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudieron cargar las solicitudes.');return {token,requests:data.solicitudes||[]};
 },[token]);
 useEffect(()=>{let active=true;setNotes({});setVerified({});setError('');load().then(data=>{if(active)setSnapshot(data)}).catch(err=>{if(active)setSnapshot({token,error:err.message})});return()=>{active=false}},[load,token]);
 const current=snapshot?.token===token?snapshot:null;
 async function refresh(){try{setError('');const data=await load();setSnapshot(data)}catch(err){setError(err.message)}}
 async function resolve(request,decision){
  const note=(notes[request.id]||'').trim();if(sending||note.length<10||(decision==='approved'&&!verified[request.id]))return;
  setSending(true);setError('');
  try{
   const response=await fetch(`${getApiBaseUrl()}/api/admin/fipa/solicitudes/${request.id}/resolver`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({decision,nota:note})});const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo guardar la decisión.');await refresh();
  }catch(err){setError(err.message)}finally{setSending(false)}
 }
 const requests=current?.requests||[];const rows=requests.filter(request=>(!status||request.state===status)&&`${request.jugador?.nombre_completo||''} ${request.jugador?.pais||''} ${request.email||''}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <main className="external-history-page"><AppHeader title="Vinculaciones FIPA"/><div className="external-history-wrap" style={{width:'min(980px,calc(100% - 28px))'}}>
  <button className="external-history-back" type="button" onClick={()=>navigate('/admin?tab=solicitudes')}>← Volver al panel</button>
  <section className="external-history-hero"><span>Coordinación FIPA</span><h1>Solicitudes de vinculación</h1><p>Cada jugador crea su cuenta, busca su nombre en el ranking y solicita la vinculación. Aquí solo revisas su identidad y apruebas o rechazas. No necesitas cargar jugadores ni enviar enlaces individuales.</p><p style={{marginTop:14}}>Comprueba el nombre, país y correo con la nómina o el responsable de su delegación. Aprobar conserva los puntos oficiales; no los modifica.</p><p style={{marginTop:14}}><strong>{requests.filter(request=>request.state==='pending').length} pendientes de revisión</strong></p></section>
  <div className="fipa-claim-filters"><input aria-label="Buscar solicitudes" placeholder="Buscar por jugador, país o correo" value={query} onChange={event=>setQuery(event.target.value)}/><select aria-label="Estado de las solicitudes" value={status} onChange={event=>setStatus(event.target.value)}><option value="pending">Pendientes</option><option value="approved">Aprobadas</option><option value="rejected">No aprobadas</option><option value="">Todos los estados</option></select><button type="button" className="fipa-claim-refresh" disabled={sending} onClick={refresh}>Actualizar</button></div>
  {error||current?.error?<p role="alert">{error||current.error}</p>:null}
  {!current?<p role="status">Cargando solicitudes…</p>:!current.error&&!rows.length?<div className="fipa-claim-notice">No hay solicitudes para este filtro. Puedes cambiar a «Todos los estados» o actualizar la lista.</div>:rows.map(request=><article className="fipa-claim-review" key={request.id}><h2>{request.jugador?.nombre_completo||'Perfil oficial pendiente de revisión'}</h2><p><strong>{request.jugador?.pais} · {request.jugador?.puntos} puntos · posición {request.jugador?.posicion}</strong></p><p>Cuenta del jugador: <strong>{request.email}</strong><br/>Solicitud: {new Date(request.created_at).toLocaleString()} · {stateLabel[request.state]||request.state}</p>
   {request.state==='pending'?<><label>Comprobación de identidad o motivo de la decisión<textarea aria-label={`Nota de revisión de ${request.jugador?.nombre_completo}`} maxLength={500} value={notes[request.id]||''} onChange={event=>setNotes(previous=>({...previous,[request.id]:event.target.value}))} placeholder="Ej.: identidad y correo confirmados con el responsable de la delegación"/></label><label className="fipa-claim-check" style={{display:'flex'}}><input type="checkbox" checked={verified[request.id]===true} onChange={event=>setVerified(previous=>({...previous,[request.id]:event.target.checked}))}/>Verifiqué que esta cuenta pertenece al jugador del ranking.</label><div className="fipa-claim-actions"><button className="external-history-submit" type="button" disabled={sending||!verified[request.id]||(notes[request.id]||'').trim().length<10} onClick={()=>resolve(request,'approved')}>Aprobar vinculación</button><button className="external-history-submit fipa-claim-reject" type="button" disabled={sending||(notes[request.id]||'').trim().length<10} onClick={()=>resolve(request,'rejected')}>No aprobar</button></div></>:<p>{request.review_note}</p>}
  </article>)}
 </div></main>;
}
