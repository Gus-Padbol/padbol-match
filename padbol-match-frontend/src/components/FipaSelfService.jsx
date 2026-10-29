import React, {useEffect, useState} from 'react';
import {getApiBaseUrl} from '../utils/apiPublicBaseUrl';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export default function FipaSelfService({accessToken, navigate, en=false}) {
 const text=(es,english)=>en?english:es;
 const [snapshot,setSnapshot]=useState(null);
 const [query,setQuery]=useState('');
 const [selected,setSelected]=useState(null);
 const [confirmed,setConfirmed]=useState(false);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;setSelected(null);setConfirmed(false);setError('');
  if(!accessToken)return undefined;
  Promise.all([
   fetch(`${getApiBaseUrl()}/api/fipa/rankings/oficial`),
   fetch(`${getApiBaseUrl()}/api/fipa/solicitudes`,{headers:{Authorization:`Bearer ${accessToken}`}}),
   fetch(`${getApiBaseUrl()}/api/fipa/mi-perfil`,{headers:{Authorization:`Bearer ${accessToken}`}}),
  ].map(async responsePromise=>{const response=await responsePromise;const data=await response.json();if(!response.ok)throw Error(data.error||text('No se pudieron cargar tus datos. Intenta nuevamente.','Your details could not be loaded. Please try again.'));return data;}))
   .then(([ranking,requests,profile])=>{if(active)setSnapshot({token:accessToken,players:ranking.rankings||[],requests:requests.solicitudes||[],player:profile.jugador});})
   .catch(err=>{if(active)setSnapshot({token:accessToken,error:err.message});});
  return()=>{active=false};
 // Copy depends only on language; account changes always clear the previous account's data.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[accessToken,en,refresh]);
 const current=snapshot?.token===accessToken?snapshot:null;
 const pending=current?.requests?.find(request=>request.state==='pending');
 const matches=(current?.players||[]).filter(player=>normalize(`${player.display_name} ${player.pais}`).includes(normalize(query.trim()))).slice(0,20);
 async function submit(){
  if(!selected||!confirmed||sending)return;
  const token=accessToken;setSending(true);setError('');
  try{
   const response=await fetch(`${getApiBaseUrl()}/api/fipa/solicitudes`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({source_key:selected.fipa_source_key,identidad_confirmada:true})});
   const data=await response.json();if(!response.ok)throw Error(data.error||text('No se pudo enviar la solicitud.','Your request could not be sent.'));
   setSnapshot(previous=>previous?.token===token?{...previous,requests:[data.solicitud,...previous.requests.filter(item=>item.id!==data.solicitud.id)]}:previous);
   setSelected(null);setConfirmed(false);
  }catch(err){setError(err.message)}finally{setSending(false)}
 }
 return <>
  <h1>{text('Vincular mis puntos FIPA','Link my FIPA points')}</h1>
  <p>{text('Busca tu nombre en el ranking y solicita la vinculación con tu cuenta. Coordinación comprobará tu identidad antes de aprobarla. Conservas los puntos oficiales existentes; no se suman ni se duplican.','Find your name in the ranking and request a link to your account. Coordination will verify your identity before approval. Your existing official points are preserved, without adding or duplicating points.')}</p>
  {!accessToken?<button type="button" className="external-history-submit" style={{marginTop:20}} onClick={()=>navigate('/login?login=1&redirect=%2Ffipa%2Freclamar')}>{text('Ingresar o crear mi cuenta','Sign in or create my account')}</button>:!current?<p role="status">{text('Cargando tu perfil y el ranking…','Loading your profile and ranking…')}</p>:current.error?<div><p role="alert">{current.error}</p><button className="fipa-claim-refresh" type="button" onClick={()=>setRefresh(value=>value+1)}>{text('Intentar nuevamente','Try again')}</button></div>:current.player?<div className="fipa-claim-notice" role="status"><h2>{text('Tu perfil ya está vinculado','Your profile is already linked')}</h2><strong>{current.player.nombre_completo} · {current.player.pais}</strong><p>{current.player.puntos} {text('puntos oficiales · posición','official points · position')} {current.player.posicion}</p></div>:pending?<div className="fipa-claim-notice" role="status"><h2>{text('Solicitud enviada: pendiente de verificación','Request sent: awaiting verification')}</h2><strong>{pending.jugador?.nombre_completo}</strong><p>{text('Coordinación revisará que este perfil te pertenece. Puedes seguir usando tu cuenta mientras esperas; no necesitas otro enlace.','Coordination will check that this profile belongs to you. You can keep using your account while you wait; no additional link is needed.')}</p><button className="fipa-claim-refresh" style={{marginTop:14}} type="button" onClick={()=>setRefresh(value=>value+1)}>{text('Actualizar estado','Refresh status')}</button></div>:<>
   {current.requests.filter(request=>request.state==='rejected').slice(0,1).map(request=><div className="fipa-claim-notice" key={request.id}><strong>{text('Solicitud anterior no aprobada','Previous request not approved')}</strong><p>{request.review_note||text('Revisa el perfil elegido o consulta a coordinación.','Check the profile you selected or contact coordination.')}</p></div>)}
   <div className="fipa-claim-search"><label htmlFor="fipa-player-search">{text('Busca tu nombre o país','Search your name or country')}</label><input id="fipa-player-search" value={query} onChange={event=>{setQuery(event.target.value);setSelected(null);setConfirmed(false)}} placeholder={text('Escribe al menos 2 letras','Enter at least 2 letters')}/></div>
   {query.trim().length>=2?<div className="fipa-claim-results">{matches.length?matches.map(player=><article key={player.fipa_source_key}><div><strong>{player.display_name}</strong><p>{player.pais} · {player.puntos} {text('puntos · posición','points · position')} {player.posicion}</p></div><button type="button" disabled={!player.puede_reclamar||sending} aria-pressed={selected?.fipa_source_key===player.fipa_source_key} onClick={()=>{setSelected(player);setConfirmed(false)}}>{player.puede_reclamar?text('Este soy yo','This is me'):text('Ya vinculado','Already linked')}</button></article>):<p>{text('No encontramos coincidencias. Prueba con tu apellido o consulta a coordinación; no crees otro registro del ranking.','No matching player found. Try your surname or contact coordination; do not create a duplicate ranking record.')}</p>}{matches.length===20?<small>{text('Se muestran hasta 20 resultados. Escribe tu nombre completo para precisar la búsqueda.','Up to 20 results are shown. Enter your full name to narrow your search.')}</small>:null}</div>:null}
   {selected?<div className="fipa-claim-notice"><h2>{selected.display_name}</h2><p>{selected.pais} · {selected.puntos} {text('puntos oficiales','official points')}</p><label className="fipa-claim-check"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>{text('Confirmo que este es mi perfil en el ranking oficial.','I confirm this is my official ranking profile.')}</label><button type="button" className="external-history-submit" disabled={!confirmed||sending} onClick={submit}>{sending?text('Enviando…','Sending…'):text('Solicitar vinculación','Request profile linking')}</button></div>:null}
  </>}
  {error?<p role="alert">{error}</p>:null}
  <p style={{marginTop:20}}>{text('La inscripción al torneo se realiza por separado. Solicitar la vinculación no confirma tu participación.','Tournament registration is separate. Requesting profile linking does not confirm your participation.')}</p>
 </>;
}
