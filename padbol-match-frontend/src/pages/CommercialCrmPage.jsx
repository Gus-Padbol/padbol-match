import React, {useEffect, useMemo, useState} from 'react';
import { useAuth } from '../context/AuthContext';
import WhatsappCrmDemo from './WhatsappCrmDemo';
import CommercialTeamWorkspace from '../components/CommercialTeamWorkspace';
import CommercialProspects from '../components/CommercialProspects';
import CommercialCrmHeader from '../components/CommercialCrmHeader';
import '../components/CommercialCrmHeader.css';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';

export default function CommercialCrmPage() {
  const { session, signOutAndClear } = useAuth();
  const token=session?.access_token || '';
  const api=useMemo(()=>createCommercialAssignmentsApi(token),[token]);
  const [available,setAvailable]=useState(false), [team,setTeam]=useState(false), [view,setView]=useState('inbox'), [role,setRole]=useState(null), [manualRequest,setManualRequest]=useState(0);
  const [openCaseId,setOpenCaseId]=useState(null),[openConversationId,setOpenConversationId]=useState(null),[searchRequest,setSearchRequest]=useState(null);
  useEffect(()=>{setAvailable(false);setTeam(false);setRole(null);},[session?.user?.id]);
  // PADBOL CRM se instala como app independiente: este manifest define nombre,
  // icono y start_url propios, de modo que el icono abra el CRM y no el area
  // de jugadores. Se restaura el manifest original al salir.
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const previous = link?.getAttribute('href');
    if (link) link.setAttribute('href', '/crm-manifest.json');
    return () => { if (link && previous) link.setAttribute('href', previous); };
  }, []);

  useEffect(()=>{let active=true;if(token)api.getRole().then(r=>{if(!active)return;if(['manager','advisor'].includes(r.role)){setAvailable(true);setRole(r.role);if(r.role==='advisor')setTeam(true);}else{setAvailable(false);setTeam(false);setRole(null);}}).catch(error=>{if(active&&(error?.status===403||error?.status===404)){setAvailable(false);setTeam(false);setRole(null);}});return ()=>{active=false};},[api,token]);
  useEffect(()=>{
    const openNotification=event=>{
      const id=event?.detail?.conversation_id;
      if(!id)return;
      setTeam(false);setView('inbox');setOpenCaseId(null);setOpenConversationId(id);
    };
    window.addEventListener('crm-open-notification',openNotification);
    return ()=>window.removeEventListener('crm-open-notification',openNotification);
  },[]);
  const openView=(next,caseId=null)=>{
    if(next==='team'){setTeam(true);setView('team');setOpenCaseId(caseId||null);}
    else if(next==='inbox'){setTeam(false);setView('inbox');setOpenCaseId(null);}
    else {setTeam(false);setView(next);setOpenCaseId(null);}
  };
  const openNewLead=()=>{setTeam(true);setView('team');setManualRequest(value=>value+1);};
  const submitSearch=reference=>{setTeam(false);setView('inbox');setSearchRequest({reference,nonce:Date.now()});};
  const inboxLocked=Boolean(available&&view==='inbox'&&!team);
  return <div className={`crm-page${inboxLocked?' crm-page--inbox':''}`}>
    {available&&<CommercialCrmHeader view={view} role={role} user={session?.user} token={token} api={api} onView={openView} onNewLead={openNewLead} onSearch={submitSearch} onSignOut={signOutAndClear}/>}
    {view==='prospect' && available ? <CommercialProspects api={api} embedded/> : team && available ? <CommercialTeamWorkspace api={api} currentUserId={session?.user?.id} manualRequest={manualRequest} openCaseId={openCaseId} headless/> : <WhatsappCrmDemo requiredScope="commercial" headless searchRequest={searchRequest} openConversationId={openConversationId}/>}
  </div>;
}