import {crmNotificationConversation,crmNotificationFromSearch} from '../utils/crmNotificationTarget';
import React, {useEffect, useMemo, useState} from 'react';
import WhatsappCrmDemo from '../pages/WhatsappCrmDemo';
import CommercialCrmHeader from './CommercialCrmHeader';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';
import {useAuth} from '../context/AuthContext';
import './CommercialCrmHeader.css';

// Restore the integrated CRM workspace from e04c7e1e.
export default function AdminWhatsappSection({ accessToken, onBack, backInAppHeader=false }) {
  const {session,signOutAndClear}=useAuth();
  const token=accessToken||session?.access_token||'';
  const api=useMemo(()=>createCommercialAssignmentsApi(token),[token]);
  const [role,setRole]=useState(null),[searchRequest,setSearchRequest]=useState(null);
  useEffect(()=>{
    let active=true;
    if(!token)return undefined;
    api.getRole().then(result=>{if(active&&['manager','advisor'].includes(result.role))setRole(result.role);}).catch(()=>{});
    return()=>{active=false};
  },[api,token]);
  const [openConversationId,setOpenConversationId]=useState(()=>crmNotificationFromSearch(window.location.search));
  useEffect(()=>{const open=event=>{const id=crmNotificationConversation(event?.detail?.conversation_id);if(id)setOpenConversationId(id);};window.addEventListener('crm-open-notification',open);return()=>window.removeEventListener('crm-open-notification',open);},[]);
  if(!role) return <WhatsappCrmDemo openConversationId={openConversationId} accessToken={token} onBack={onBack} backInAppHeader={backInAppHeader} />;
  const go=next=>{
    if(next==='inbox')return;
    window.location.assign('/crm-leads');
  };
  const search=reference=>{setSearchRequest({reference,nonce:Date.now()});};
  return <>
    <CommercialCrmHeader view="inbox" role={role} user={session?.user} token={token} api={api} onView={go} onNewLead={()=>window.location.assign('/crm-leads')} onSearch={search} onSignOut={signOutAndClear}/>
    <WhatsappCrmDemo openConversationId={openConversationId} accessToken={token} onBack={onBack} backInAppHeader={backInAppHeader} headless searchRequest={searchRequest}/>
  </>;
}
