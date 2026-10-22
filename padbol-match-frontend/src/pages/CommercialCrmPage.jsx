import React, {useEffect, useMemo, useState} from 'react';
import { useAuth } from '../context/AuthContext';
import WhatsappCrmDemo from './WhatsappCrmDemo';
import CommercialTeamWorkspace from '../components/CommercialTeamWorkspace';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';

export default function CommercialCrmPage() {
  const { session, signOutAndClear } = useAuth();
  const token=session?.access_token || '';
  const api=useMemo(()=>createCommercialAssignmentsApi(token),[token]);
  const [available,setAvailable]=useState(false), [team,setTeam]=useState(false);
  useEffect(()=>{let active=true;setAvailable(false);setTeam(false);if(token)api.getRole().then(r=>{if(active&&['manager','advisor'].includes(r.role))setAvailable(true);}).catch(()=>{});return ()=>{active=false};},[api,token]);
  return <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '10px 20px', background: '#0b1324', color: '#fff' }}>
      {available&&<button type="button" onClick={()=>setTeam(!team)}>{team ? 'Volver a consultas actuales' : 'Área del equipo comercial'}</button>}
      <button type="button" onClick={signOutAndClear}>Cerrar sesión</button>
    </div>
    {team && available ? <CommercialTeamWorkspace api={api}/> : <WhatsappCrmDemo requiredScope="commercial" />}
  </>;
}
