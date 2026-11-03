import React, {useEffect, useMemo, useState} from 'react';
import { useAuth } from '../context/AuthContext';
import WhatsappCrmDemo from './WhatsappCrmDemo';
import CommercialTeamWorkspace from '../components/CommercialTeamWorkspace';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';
import CrmMetaResultsEntry from '../components/CrmMetaResultsEntry';
import PushActivation from '../components/PushActivation';

export default function CommercialCrmPage() {
  const { session, signOutAndClear } = useAuth();
  const token=session?.access_token || '';
  const api=useMemo(()=>createCommercialAssignmentsApi(token),[token]);
  const [available,setAvailable]=useState(false), [team,setTeam]=useState(false), [role,setRole]=useState(null);
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
  return <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '6px 10px', background: '#0b1324', color: '#fff', flexWrap: 'nowrap', alignItems: 'center', rowGap: 8, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <PushActivation token={token} />
      {!esAngosto && <CrmMetaResultsEntry />}
      {available&&role==='manager'&&<button type="button" onClick={()=>setTeam(!team)}>{team ? 'Volver a consultas actuales' : 'Área del equipo comercial'}</button>}
      <button type="button" onClick={signOutAndClear}>Cerrar sesión</button>
    </div>
    {team && available ? <CommercialTeamWorkspace api={api} currentUserId={session?.user?.id}/> : <WhatsappCrmDemo requiredScope="commercial" />}
  </>;
}
