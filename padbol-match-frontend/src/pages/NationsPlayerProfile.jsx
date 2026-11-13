import {supabase} from '../supabaseClient';
import {insertOwnProfileRow,loadCanonicalProfile} from '../utils/canonicalProfile';
import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {getApiBaseUrl} from '../utils/apiPublicBaseUrl';
import {PAISES_ISO_OPTIONS,parseIdentidadFromApi} from '../utils/jugadorIdentidad';
import NationsRegistrationShell from '../components/NationsRegistrationShell';
import {NATIONS_NAPOLI_SLUG,NATIONS_RETURN_PATH,storedNationsSelection,nationsCompleteDraft,nationsCompleteError,NATIONS_PLAYER_FIELDS,NATIONS_IDENTITY_FIELDS,nationsCountryOptions,nationsRequestId,activeNationsRequest,storeNationsSelection} from '../utils/nationsEssentialProfile';

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
  Promise.all([read(`${base}/api/jugador/perfil`,true),read(`${eventPath}/selector`).catch(()=>({participants:[],unavailable:true})),read(`${eventPath}/profile-request`),read(`${base}/api/jugador/identidad`)]).then(([profile,list,state,identityBody])=>{
   if(ticket!==generation.current||owner.current.actor!==actor||owner.current.token!==token)return;
   const profileMissing=profile===null;profile=profile||{};
   const latest=state.requests?.[0]||null,active=activeNationsRequest(latest);
   if(list.unavailable&&!active)throw new Error('Unable to load the player list.');
   const participants=Array.isArray(list.participants)?list.participants:[];
   const ownSelection=latest?.selection;
   const selected=active&&typeof ownSelection?.selectionId==='string'&&typeof ownSelection?.name==='string'&&/^[A-Z]{2}$/.test(ownSelection?.country)?ownSelection:active?null:participants.find(row=>row.selectionId===storedNationsSelection())||null;
   const identity=parseIdentidadFromApi(identityBody);
   setData({profile,profileMissing,selected,participants,active,latest,identity});setForm(nationsCompleteDraft(profile,selected,identity));
  }).catch(err=>{if(ticket===generation.current&&!abort.signal.aborted)setError(err.message||'Unable to load your player details.');}).finally(()=>{if(ticket===generation.current)setPending(false);});
  return()=>{generation.current+=1;abort.abort();};
 },[actor,token,base,eventPath,retry,profileLoading]);
 const change=event=>setForm(current=>({...current,[event.target.name]:event.target.value}));
 const submit=async event=>{
  event.preventDefault();if(busyRef.current||!data||!form||!verified)return;
  const patch={nombre:form.nombre.trim(),apellido:form.apellido.trim(),pais:form.pais.trim()};
  const validation=nationsCompleteError(form,data.identity.tiene_documento);if(validation){setError(validation);return;}
  for(const key of NATIONS_PLAYER_FIELDS)patch[key]=form[key].trim();
  const fields=new FormData(event.currentTarget);
  if(!data.active&&(!data.selected||fields.get('adult')!=='on'||fields.get('consent')!=='on')){setError('Confirm that you are 18 or older and agree to registration.');return;}
  patch.telefono=form.telefono.trim();
  busyRef.current=true;setBusy(true);setError('');
  const ticket=generation.current,capturedActor=actor,capturedToken=token;
  const current=()=>generation.current===ticket&&owner.current.actor===capturedActor&&owner.current.token===capturedToken;
  const request=async(url,options={})=>{
   if(!current())throw new Error('Session changed. Reopen your player details.');
   const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${capturedToken}`,...(options.body?{'Content-Type':'application/json'}:{})}});
   const body=await response.json().catch(()=>({}));
   if(!current())throw new Error('Session changed. Reopen your player details.');
   if(!response.ok){const duplicate=response.status===409&&body.code==='DOCUMENTO_DUPLICADO';const err=new Error(duplicate?'That document is already registered to another account. Use a different document number.':response.status===409?'Your registration needs review. Return to the registration page.':'Unable to save your player details. Try again.');err.code=body.code;throw err;}
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
    if(Object.keys(patch).some(key=>String(saved[key]||'').trim()!==patch[key]))throw new Error('Your saved player details could not be confirmed.');
    if(current())setData(previous=>({...previous,profile:saved,profileMissing:false}));
   }
   const identityPatch=Object.fromEntries(NATIONS_IDENTITY_FIELDS.map(key=>[key,form[key].trim()]));
   identityPatch.telefono=patch.telefono;
   if(!data.identity.tiene_documento)identityPatch.numero_documento=form.numero_documento.trim();
   await request(`${base}/api/jugador/identidad`,{method:'PUT',body:JSON.stringify(identityPatch)});
   const identitySaved=parseIdentidadFromApi(await request(`${base}/api/jugador/identidad`));
   if([...NATIONS_IDENTITY_FIELDS,'telefono'].some(key=>identitySaved[key]!==identityPatch[key])||!identitySaved.tiene_documento)throw new Error('Your tournament details could not be confirmed.');
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
 const countryChoices=countries.map(row=>({value:row.code,label:`${row.flag} ${row.name}`}));
 const renderInput=(name,label,type='text')=><div className="nations-field"><label className="nations-label" htmlFor={`nations-${name}`}>{label}</label><input className="nations-input" id={`nations-${name}`} name={name} type={type} required value={form[name]} onChange={change} maxLength={name==='numero_documento'?undefined:120}/></div>;
 const renderSelect=(name,label,options)=><div className="nations-field"><label className="nations-label" htmlFor={`nations-${name}`}>{label}</label><select className="nations-select" id={`nations-${name}`} name={name} required value={form[name]} onChange={change}><option value="">Choose</option>{options.map(row=><option key={row.value} value={row.value}>{row.label}</option>)}</select></div>;
 return <NationsRegistrationShell><section className="nations-card">
  <h1 className="nations-title">Player details</h1><p className="nations-intro">5th Padbol Nations Cup · Naples 2026</p><p className="nations-status__note">Male · Elite</p>
  {authLoading||pending?<p role="status">Loading…</p>:!actor?<Link className="nations-button" to={`/login?redirect=${encodeURIComponent(NATIONS_RETURN_PATH)}&lang=en`}>Sign in or create an account</Link>:!verified?<p role="alert">Verify your email to continue.</p>:error&&!data?<div role="alert"><p>{error}</p><button className="nations-button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:data&&!data.selected&&!data.active?<Link className="nations-button" to={NATIONS_RETURN_PATH}>Choose your name</Link>:form?<form className="nations-form" onSubmit={submit} aria-busy={busy}>
   <p className="nations-status__note" aria-label="Selected player">{data.selected?.name||`${form.nombre} ${form.apellido}`.trim()||'Player identity unavailable'} · {countries.find(row=>row.code===form.pais)?.name||form.pais}</p>
   <div className="nations-field"><label className="nations-label" htmlFor="nations-profile-email">Account email</label><input className="nations-input" id="nations-profile-email" type="email" value={session.user.email||''} readOnly/></div>
   <div className="nations-field"><label className="nations-label" htmlFor="nations-profile-phone">WhatsApp / phone</label><input className="nations-input" id="nations-profile-phone" name="telefono" type="tel" autoComplete="tel" required value={form.telefono} onChange={change}/></div>
   {renderInput('ciudad','City')}
   {renderSelect('pierna_habil','Preferred foot',[{value:'derecha',label:'Right'},{value:'izquierda',label:'Left'},{value:'ambas',label:'Both'}])}
   <h2>Identity details</h2>
   {renderInput('fecha_nacimiento','Date of birth','date')}
   {renderSelect('nacionalidad','Nationality',countryChoices)}
   {renderSelect('tipo_documento','Document type',[{value:'dni',label:'National ID'},{value:'pasaporte',label:'Passport'},{value:'cedula',label:'Identity card'},{value:'otro',label:'Other document'}])}
   {renderSelect('pais_documento','Document issuing country',countryChoices)}
   {data.identity.tiene_documento?<p>Document saved: {data.identity.numero_documento_mascarado}</p>:renderInput('numero_documento','Document number')}
   {!data.active?<><label className="nations-check"><input type="checkbox" name="adult" required/><span className="nations-check__box" aria-hidden="true"/><span className="nations-check__text">I confirm that I am 18 or older.</span></label><label className="nations-check"><input type="checkbox" name="consent" required/><span className="nations-check__box" aria-hidden="true"/><span className="nations-check__text">I agree to the use of my details for this registration.</span></label></>:null}
   {error?<p role="alert">{error}</p>:null}
   <button className="nations-button" type="submit" disabled={busy}>{busy?'Saving…':data.active?'Save player details':'Confirm registration'}</button>
   <Link className="nations-text-button" to={NATIONS_RETURN_PATH} onClick={()=>{if(!data.active)storeNationsSelection(null);}}>Back</Link>
  </form>:null}
 </section></NationsRegistrationShell>;
}
