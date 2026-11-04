import React, {useEffect, useMemo, useState} from 'react';
import { useAuth } from '../context/AuthContext';
import WhatsappCrmDemo from './WhatsappCrmDemo';
import CommercialTeamWorkspace from '../components/CommercialTeamWorkspace';
import CommercialProspects from '../components/CommercialProspects';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';
import CrmMetaResultsEntry from '../components/CrmMetaResultsEntry';
import PushActivation from '../components/PushActivation';

export default function CommercialCrmPage() {
  const { session, signOutAndClear } = useAuth();
  const token=session?.access_token || '';
  const api=useMemo(()=>createCommercialAssignmentsApi(token),[token]);
  const [available,setAvailable]=useState(false), [team,setTeam]=useState(false), [view,setView]=useState('inbox'), [role,setRole]=useState(null), [manualRequest,setManualRequest]=useState(0);
  const [esAngosto,setEsAngosto]=useState(()=>typeof window!=='undefined' && window.innerWidth < 700);
  useEffect(()=>{const on=()=>setEsAngosto(window.innerWidth < 700);window.addEventListener('resize',on);return ()=>window.removeEventListener('resize',on);},[]);
  useEffect(()=>{setAvailable(false);setTeam(false);setRole(null);},[session?.user?.id]);
  // PADBOL CRM se instala como app independiente: este manifest define nombre,
  // icono y start_url propios, de modo que el icono abra el CRM y no el area
  // de jugadores. Se restaura el manifest original al salir.
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return undefined;
    const previous = link.getAttribute('href');
    link.setAttribute('href', '/crm-manifest.json');
    return () => { if (previous) link.setAttribute('href', previous); };
  }, []);

  useEffect(()=>{let active=true;if(token)api.getRole().then(r=>{if(!active)return;if(['manager','advisor'].includes(r.role)){setAvailable(true);setRole(r.role);if(r.role==='advisor')setTeam(true);}else{setAvailable(false);setTeam(false);setRole(null);}}).catch(error=>{if(active&&(error?.status===403||error?.status===404)){setAvailable(false);setTeam(false);setRole(null);}});return ()=>{active=false};},[api,token]);
  const utilityActions = <>
    <PushActivation token={token} />
    {!esAngosto && <span className="wa-meta-entry"><CrmMetaResultsEntry /></span>}
    {available&&<button type="button" className="wa-new-lead" onClick={()=>{setTeam(true);setManualRequest(value=>value+1);}}>Nuevo lead</button>}
    {available&&role==='manager'&&<button type="button" className="wa-team-toggle" onClick={()=>{setView(team?'inbox':'team');setTeam(!team);}}>{team ? 'Volver a consultas actuales' : 'Área del equipo comercial'}</button>}
    <button type="button" className="wa-signout" onClick={signOutAndClear}>Cerrar sesión</button>
  </>;
  return <>
    {available && <nav className="crm-view-tabs" role="tablist" aria-label="Vistas del CRM"><button type="button" role="tab" aria-selected={view==='inbox'} className={view==='inbox'?'is-active':''} onClick={()=>{setView('inbox');setTeam(false);}}>Bandeja</button>{role==='manager'&&<button type="button" role="tab" aria-selected={view==='team'} className={view==='team'?'is-active':''} onClick={()=>{setView('team');setTeam(true);}}>Equipo comercial</button>}<button type="button" role="tab" aria-selected={view==='prospect'} className={view==='prospect'?'is-active':''} onClick={()=>{setView('prospect');setTeam(false);}}>PADBOL PROSPECT</button></nav>}
    {view==='prospect' && available ? <CommercialProspects api={api}/> : team && available ? <>
      <div className="commercial-crm-utility" aria-label="Acciones de la cuenta">{utilityActions}</div>
      <CommercialTeamWorkspace api={api} currentUserId={session?.user?.id} manualRequest={manualRequest}/>
    </> : <WhatsappCrmDemo requiredScope="commercial" headerActions={utilityActions} />}
  </>;
}
