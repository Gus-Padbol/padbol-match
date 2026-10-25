import React,{useEffect,useRef,useState} from 'react';
import {useSafeTranslation} from '../i18n/tSafe';
import {verifyEmailAccessCode} from '../utils/passwordlessAccess';
export default function EmailAccessCode({auth,email,onVerified,onBusyChange,disabled=false}){
 const {t}=useSafeTranslation();
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const inFlight=useRef(false);
 useEffect(()=>{setCode('');setError('');},[email]);
 async function verify(){
  if(inFlight.current||disabled||!/^\d{6,10}$/.test(code.trim()))return;
  inFlight.current=true;setBusy(true);setError('');onBusyChange?.(true);
  try{
   const result=await verifyEmailAccessCode({auth,email,code});
   if(result.error||!result.data?.session?.user){setError(t(result.error?.status===429?'auth.emailCodeRateLimited':'auth.emailCodeInvalid'));return;}
   setCode('');await onVerified(result.data.session);
  }catch{setError(t('auth.emailCodeInvalid'));}
  finally{inFlight.current=false;setBusy(false);onBusyChange?.(false);}
 }
 if(!email)return null;
 return <fieldset style={{margin:'18px 0 0',padding:16,border:'1px solid var(--border)',borderRadius:12,minWidth:0}}>
  <legend>{t('auth.emailCodeTitle')}</legend>
  <p style={{fontSize:14,margin:'0 0 12px'}}>{t('auth.emailCodeHelp',{email})}</p>
  <label>{t('auth.emailCodeLabel')}<input value={code} onChange={e=>setCode(e.target.value.replace(/\s/g,''))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void verify();}}} inputMode="numeric" autoComplete="one-time-code" maxLength={10} disabled={busy||disabled} style={{width:'100%',boxSizing:'border-box',padding:12,marginTop:6,fontSize:20,letterSpacing:4,border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-card)',color:'var(--text-primary)'}}/></label>
  {error&&<p role="alert" style={{color:'var(--danger,#b91c28)',fontSize:14}}>{error}</p>}
  <button type="button" onClick={()=>void verify()} disabled={busy||disabled||!/^\d{6,10}$/.test(code.trim())} style={{marginTop:12,padding:'12px 16px',border:0,borderRadius:10,background:'var(--accent)',color:'#fff',fontWeight:700,width:'100%'}}>{busy?t('auth.signingIn'):t('auth.emailCodeVerify')}</button>
 </fieldset>;
}
