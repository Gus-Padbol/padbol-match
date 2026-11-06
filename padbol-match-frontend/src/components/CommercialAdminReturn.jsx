import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {fetchMiRol} from '../utils/fetchMiRol';
import {userCanAccessAdminPanel} from '../utils/adminPanelRoles';

// Navigation only. /admin retains its existing authenticated role gate.
export default function CommercialAdminReturn({token}) {
  const [verifiedToken,setVerifiedToken]=useState(null);
  useEffect(()=>{
    let active=true;
    setVerifiedToken(null);
    if(token) fetchMiRol(token).then(result=>{
      if(active&&userCanAccessAdminPanel(result?.rol)) setVerifiedToken(token);
    }).catch(()=>{});
    return ()=>{active=false;};
  },[token]);
  if(!token||verifiedToken!==token) return null;
  return <Link className="crm-admin-return" to="/admin"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14"/></svg>Panel de administración</Link>;
}
