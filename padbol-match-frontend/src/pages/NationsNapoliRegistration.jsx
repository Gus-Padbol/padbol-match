import React,{useEffect,useState} from 'react';
import {Link,Navigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {getApiBaseUrl} from '../utils/apiPublicBaseUrl';
import {PUBLIC_SITE_STORE_LINKS} from '../constants/publicSiteLinks';
import NationsRegistrationShell from '../components/NationsRegistrationShell';
import {NATIONS_NAPOLI_SLUG,NATIONS_PROFILE_PATH,NATIONS_RETURN_PATH,nationsCountryOptions,storedNationsSelection,storeNationsSelection,activeNationsRequest} from '../utils/nationsEssentialProfile';

export default function NationsNapoliRegistration() {
 const {session,loading}=useAuth();
 const actor=session?.user?.id,token=session?.access_token;
 const [rows,setRows]=useState([]),[country,setCountry]=useState(''),[selectionId,setSelectionId]=useState('');
 const [pending,setPending]=useState(true),[error,setError]=useState(false),[latest,setLatest]=useState(null),[readiness,setReadiness]=useState(null),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let current=true;setPending(true);setError(false);setLatest(null);setReadiness(null);setSelectionId('');setCountry('');
  const base=getApiBaseUrl(),path=`${base}/api/nations-activation/events/${NATIONS_NAPOLI_SLUG}`;
  const headers=token?{Authorization:`Bearer ${token}`} : {};
  const read=async(url)=>{const res=await fetch(url,{headers,signal:controller.signal});if(!res.ok)throw new Error('read');return res.json();};
  Promise.all([read(`${path}/selector`),actor?read(`${path}/profile-request`):Promise.resolve({requests:[]})]).then(([list,status])=>{
   if(!current)return;
   const participants=(Array.isArray(list.participants)?list.participants:[]).filter(row=>typeof row.selectionId==='string'&&typeof row.name==='string'&&/^[A-Z]{2}$/.test(row.country));
   setRows(participants);setLatest(status.requests?.[0]||null);setReadiness(status.profile_readiness||null);
   const saved=participants.find(row=>row.selectionId===storedNationsSelection());
   if(saved){setSelectionId(saved.selectionId);setCountry(saved.country);}else storeNationsSelection(null);
  }).catch(()=>{if(current)setError(true);}).finally(()=>{if(current)setPending(false);});
  return()=>{current=false;controller.abort();};
 },[actor,token,retry]);
 const selected=rows.find(row=>row.selectionId===selectionId);
 const choose=(value)=>{const row=rows.find(item=>item.selectionId===value)||null;setSelectionId(row?.selectionId||'');storeNationsSelection(row);};
 if(!loading&&!pending&&!error&&session?.user&&selected&&!activeNationsRequest(latest))return <Navigate replace to={NATIONS_PROFILE_PATH}/>;
 return <NationsRegistrationShell><section className="nations-card">
  <h1 className="nations-title">5th Nations Cup</h1><p className="nations-intro">Naples · November 20–22, 2026</p>
  {loading||pending?<p role="status">Loading…</p>:error?<div role="alert"><p>Unable to load your registration.</p><button className="nations-button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:activeNationsRequest(latest)?<section role="status"><h2>{readiness?.complete!==true?'Complete your player details':'Registration received'}</h2><Link className="nations-button" to={NATIONS_PROFILE_PATH}>{readiness?.complete!==true?'Complete player details':'Edit player details'}</Link>{readiness?.complete===true?<footer><p>Your registration is saved. Sign in to Padbol Match with the same email and password.</p><p>{PUBLIC_SITE_STORE_LINKS.appStore?<a className="nations-text-button" href={PUBLIC_SITE_STORE_LINKS.appStore} target="_blank" rel="noopener noreferrer">App Store</a>:null}{' · '}{PUBLIC_SITE_STORE_LINKS.googlePlay?<a className="nations-text-button" href={PUBLIC_SITE_STORE_LINKS.googlePlay} target="_blank" rel="noopener noreferrer">Google Play</a>:null}</p></footer>:null}</section>:<>
   <div className="nations-field"><label className="nations-label" htmlFor="nations-country">Country</label><select className="nations-select" id="nations-country" value={country} onChange={event=>{setCountry(event.target.value);choose('');}}><option value="">All countries</option>{nationsCountryOptions(rows.map(row=>row.country)).map(row=><option key={row.code} value={row.code}>{row.flag} {row.name}</option>)}</select></div>
   <div className="nations-field"><label className="nations-label" htmlFor="nations-name">Your name</label><select className="nations-select" id="nations-name" value={selectionId} onChange={event=>choose(event.target.value)}><option value="">Choose your name</option>{rows.filter(row=>!country||row.country===country).slice().sort((a,b)=>a.name.localeCompare(b.name,'en')).map(row=><option key={row.selectionId} value={row.selectionId}>{row.name}</option>)}</select></div>
   {!rows.length?<p role="status">The player list is temporarily unavailable.</p>:null}
   {selected?<Link className="nations-button" to={`/login?redirect=${encodeURIComponent(NATIONS_RETURN_PATH)}&lang=en`}>Sign in or create an account</Link>:<button className="nations-button" disabled>Sign in or create an account</button>}
  </>}
 </section></NationsRegistrationShell>;
}
