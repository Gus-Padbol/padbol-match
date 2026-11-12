import {supabase} from '../supabaseClient';
import {insertOwnProfileRow,loadCanonicalProfile} from '../utils/canonicalProfile';
import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {getApiBaseUrl} from '../utils/apiPublicBaseUrl';
import {PAISES_ISO_OPTIONS} from '../utils/jugadorIdentidad';
import NationsRegistrationShell from '../components/NationsRegistrationShell';
import {NATIONS_NAPOLI_SLUG,NATIONS_RETURN_PATH,storedNationsSelection,nationsProfileDraft,nationsCountryOptions,nationsRequestId,activeNationsRequest,storeNationsSelection} from '../utils/nationsEssentialProfile';

export default function NationsPlayerProfile() {
 const {session,loading:authLoading,profileLoading=false}=useAuth();const navigate=useNavigate();
 const actor=session?.user?.id,token=session?.access_token;
 const owner=useRef({actor,token});owner.current={actor,token};
 const [data,setData]=useState(null),[form,setForm]=useState(null),[pending,setPending]=useState(true),[retry,setRetry]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const busyRef=useRef(false),generation=useRef(0);
 const base=getApiBaseUrl(),eventPath=`${base}/api/nations-activation/events/${NATIONS_NAPOLI_SLUG}`;
 const verified=Boolean(session?.user?.email&&(session.user.email_confirmed_at||session.user.confirmed_at));
 useEffect(()=>{
  const ticket=++generation.current;const abort=new AbortController();busyRef.current=false;setBusy(false);setError('');setData(null);setForm(null);setPending(true);
  if(profileLoading)return()=>abort.abort();
  if(!actor||!token){setPending(false);return()=>abort.abort();}
  const headers={Authorization:`Bearer ${token}`};
  const read=async(url,allowMissing=false)=>{const response=await fetch(url,{headers,signal:abort.signal});if(allowMissing&&response.status===404)return null;if(!response.ok)throw new Error('Unable to load your player details.');return response.json();};
  Promise.all([read(`${base}/api/jugador/perfil`,true),read(`${eventPath}/selector`).catch(()=>({participants:[],unavailable:true})),read(`${eventPath}/profile-request`)]).then(([profile,list,state])=>{
   if(ticket!==generation.current||owner.current.actor!==actor||owner.current.token!==token)return;
   const profileMissing=profile===null;profile=profile||{};
   const latest=state.requests?.[0]||null,active=activeNationsRequest(latest);
   if(list.unavailable&&!active)throw new Error('Unable to load the player list.');
   const participants=Array.isArray(list.participants)?list.participants:[];
   const selected=active?null:participants.find(row=>row.selectionId===storedNationsSelection())||null;
   setData({profile,profileMissing,selected,participants,active,latest});setForm(nationsProfileDraft(profile,selected));
  }).catch(err=>{if(ticket===generation.current&&!abort.signal.aborted)setError(err.message||'Unable to load your player details.');}).finally(()=>{if(ticket===generation.current)setPending(false);});
  return()=>{generation.current+=1;abort.abort();};
 },[actor,token,base,eventPath,retry,profileLoading]);
 const change=event=>setForm(current=>({...current,[event.target.name]:event.target.value}));
 const submit=async event=>{
  event.preventDefault();if(busyRef.current||!data||!form||!verified)return;
  const patch={nombre:form.nombre.trim(),apellido:form.apellido.trim(),pais:form.pais.trim(),genero:form.genero};
  if(!patch.nombre||!patch.apellido||!patch.pais||!['masculino','femenino'].includes(patch.genero)){setError('Complete your name, surname, country and competition gender.');return;}
  const fields=new FormData(event.currentTarget);
  if(!data.active&&(!data.selected||fields.get('adult')!=='on'||fields.get('consent')!=='on')){setError('Confirm that you are 18 or older and agree to registration.');return;}
  const phone=form.telefono.trim();if(phone){if(!/^\+?[\d\s().-]{8,40}$/.test(phone)){setError('Check your optional contact number, including the country code.');return;}patch.telefono=phone;}
  busyRef.current=true;setBusy(true);setError('');
  const ticket=generation.current,capturedActor=actor,capturedToken=token;
  const current=()=>generation.current===ticket&&owner.current.actor===capturedActor&&owner.current.token===capturedToken;
  const request=async(url,options={})=>{
   if(!current())throw new Error('Session changed. Reopen your player details.');
   const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${capturedToken}`,...(options.body?{'Content-Type':'application/json'}:{})}});
   const body=await response.json().catch(()=>({}));
   if(!current())throw new Error('Session changed. Reopen your player details.');
   if(!response.ok){const err=new Error(response.status===409?'Your registration needs review. Return to the registration page.':'Unable to save your player details. Try again.');err.code=body.code;throw err;}
   return body;
  };
  try {
   if(data.profileMissing) {
    if(!current())return;
    const created=await insertOwnProfileRow({supabase,userId:capturedActor,payload:{email:session.user.email,nombre:patch.nombre,apellido:patch.apellido,pais:patch.pais}});
    if(!current())return;
    if(created.error) {
     if(String(created.error.code)!=='23505')throw new Error('Unable to create your player details. Try again.');
     const loaded=await loadCanonicalProfile({supabase,userId:capturedActor,email:session.user.email});
     if(!current())return;
     if(!loaded.row||String(loaded.row.user_id)!==capturedActor)throw new Error('Unable to confirm your own player details.');
    }else if(String(created.data?.user_id)!==capturedActor)throw new Error('Unable to confirm your own player details.');
   }
   if(data.profileMissing||Object.entries(patch).some(([key,value])=>String(data.profile[key]||'').trim()!==value)) {
    const saved=await request(`${base}/api/jugador/perfil`,{method:'PUT',body:JSON.stringify(patch)});
    if(['nombre','apellido','pais','genero'].some(key=>String(saved[key]||'').trim()!==patch[key]))throw new Error('Your saved player details could not be confirmed.');
    if(current())setData(previous=>({...previous,profile:saved,profileMissing:false}));
   }
   const readiness=await request(`${eventPath}/profile-readiness`);
   if(readiness.complete!==true)throw new Error('Your player details could not be confirmed. Try again.');
   if(!data.active) {
    const request_id=nationsRequestId(capturedActor,{rejectedRequestId:data.latest?.status==='rechazada'?data.latest.request_id:null});
    const receipt=await request(`${eventPath}/profile-request`,{method:'POST',body:JSON.stringify({request_id,selection_id:data.selected.selectionId,declared_name:`${patch.nombre} ${patch.apellido}`,declared_country:patch.pais,age_status:'adulto',guardian_consent:false,profile_consent:true})});
    if(!activeNationsRequest(receipt))throw new Error('Your registration could not be confirmed. Return to registration to check its status.');
    if(current())storeNationsSelection(null);
   }
   if(current())navigate(NATIONS_RETURN_PATH,{replace:true});
  }catch(err){if(current())setError(err.message||'Unable to register. Try again.');}
  finally {if(current()){busyRef.current=false;setBusy(false);}}
 };
 const countries=nationsCountryOptions([...PAISES_ISO_OPTIONS.map(row=>row.code),...(data?.participants||[]).map(row=>row.country),form?.pais].filter(Boolean));
 if(form?.pais&&!countries.some(row=>row.code===form.pais))countries.unshift({code:form.pais,name:form.pais,flag:''});
 return <NationsRegistrationShell><section className="nations-card">
  <h1 className="nations-title">Player details</h1><p className="nations-intro">Nations Cup · Elite</p>
  {authLoading||pending?<p role="status">Loading…</p>:!actor?<Link className="nations-button" to={`/login?redirect=${encodeURIComponent(NATIONS_RETURN_PATH)}&lang=en`}>Sign in or create an account</Link>:!verified?<p role="alert">Verify your email to continue.</p>:error&&!data?<div role="alert"><p>{error}</p><button className="nations-button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:data&&!data.selected&&!data.active?<Link className="nations-button" to={NATIONS_RETURN_PATH}>Choose your name</Link>:form?<form className="nations-form" onSubmit={submit} aria-busy={busy}>
   {data.selected?<p className="nations-status__note">{data.selected.name} · {data.selected.country}</p>:null}
   <div className="nations-field"><label className="nations-label" htmlFor="nations-profile-name">Name</label><input className="nations-input" id="nations-profile-name" name="nombre" autoComplete="given-name" required value={form.nombre} maxLength={100} onChange={change}/></div>
   <div className="nations-field"><label className="nations-label" htmlFor="nations-profile-surname">Surname</label><input className="nations-input" id="nations-profile-surname" name="apellido" autoComplete="family-name" required value={form.apellido} maxLength={100} onChange={change}/></div>
   <div className="nations-field"><label className="nations-label" htmlFor="nations-profile-country">Country</label><select className="nations-select" id="nations-profile-country" name="pais" required value={form.pais} onChange={change}><option value="">Choose country</option>{countries.map(row=><option key={row.code} value={row.code}>{row.flag} {row.name}</option>)}</select></div>
   <div className="nations-field"><label className="nations-label" htmlFor="nations-profile-gender">Competition gender</label><select className="nations-select" id="nations-profile-gender" name="genero" required value={form.genero} onChange={change}><option value="">Choose</option><option value="masculino">Male</option><option value="femenino">Female</option></select></div>
   <div className="nations-field"><label className="nations-label" htmlFor="nations-profile-email">Account email</label><input className="nations-input" id="nations-profile-email" type="email" value={session.user.email||''} readOnly/></div>
   <div className="nations-field"><label className="nations-label" htmlFor="nations-profile-phone">WhatsApp / phone (optional)</label><input className="nations-input" id="nations-profile-phone" name="telefono" type="tel" autoComplete="tel" value={form.telefono} onChange={change}/>{!form.telefono.trim()&&String(data.profile.telefono||data.profile.whatsapp||'').trim()?<small>Blank keeps your saved contact.</small>:null}</div>
   {!data.active?<><label className="nations-check"><input type="checkbox" name="adult" required/><span className="nations-check__box" aria-hidden="true"/><span className="nations-check__text">I confirm that I am 18 or older.</span></label><label className="nations-check"><input type="checkbox" name="consent" required/><span className="nations-check__box" aria-hidden="true"/><span className="nations-check__text">I agree to the use of my details for this registration.</span></label></>:null}
   {error?<p role="alert">{error}</p>:null}
   <button className="nations-button" type="submit" disabled={busy}>{busy?'Saving…':data.active?'Save player details':'Confirm registration'}</button>
   <Link className="nations-text-button" to={NATIONS_RETURN_PATH}>Back</Link>
  </form>:null}
 </section></NationsRegistrationShell>;
}
