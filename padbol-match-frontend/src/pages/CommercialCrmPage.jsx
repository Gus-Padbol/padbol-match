import React, {useEffect, useMemo, useState} from 'react';
import { useAuth } from '../context/AuthContext';
import WhatsappCrmDemo from './WhatsappCrmDemo';
import CommercialTeamWorkspace from '../components/CommercialTeamWorkspace';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';

export default function CommercialCrmPage() {
  const { session, signOutAndClear } = useAuth();
  const token=session?.access_token || '';
  const api=useMemo(()=>createCommercialAssignmentsApi(token),[token]);
  const [available,setAvailable]=useState(false), [team,setTeam]=useState(false), [role,setRole]=useState(null);
  useEffect(()=>{setAvailable(false);setTeam(false);setRole(null);},[session?.user?.id]);
  useEffect(()=>{let active=true;if(token)api.getRole().then(r=>{if(!active)return;if(['manager','advisor'].includes(r.role)){setAvailable(true);setRole(r.role);if(r.role==='advisor')setTeam(true);}else{setAvailable(false);setTeam(false);setRole(null);}}).catch(error=>{if(active&&(error?.status===403||error?.status===404)){setAvailable(false);setTeam(false);setRole(null);}});return ()=>{active=false};},[api,token]);
  return <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '10px 20px', background: '#0b1324', color: '#fff' }}>
      {available&&role==='manager'&&<button type="button" onClick={()=>setTeam(!team)}>{team ? 'Volver a consultas actuales' : 'Área del equipo comercial'}</button>}
      <button type="button" onClick={signOutAndClear}>Cerrar sesión</button>
    </div>
    {team && available ? <CommercialTeamWorkspace api={api} currentUserId={session?.user?.id}/> : <WhatsappCrmDemo requiredScope="commercial" />}
  </>;
}
