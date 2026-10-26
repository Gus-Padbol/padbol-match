import React,{lazy,Suspense,useCallback,useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {fetchMiRol} from '../utils/fetchMiRol';
import {normalizeUserRole} from '../utils/adminPanelRoles';
import {getApiBaseUrl} from '../utils/apiPublicBaseUrl';
import './ContentVisualAssetsPanel.css';
const HubEditor=lazy(()=>import('./AdminHubPersonalizarSection'));
const PromotionsEditor=lazy(()=>import('./AdminSponsorsSection'));

/** Actual server role only. Never grants access from JWT metadata or a cached role. */
export function useContentVisualAssetsAccess({enabled=true}={}){
 const {session}=useAuth();
 const token=session?.access_token||'';
 const [result,setResult]=useState(null),[attempt,setAttempt]=useState(0);
 const retry=useCallback(()=>setAttempt(value=>value+1),[]);
 useEffect(()=>{
  if(!enabled||!token)return undefined;
  let active=true;setResult(null);
  fetchMiRol(token).then(data=>{if(active)setResult({token,role:normalizeUserRole(data?.rol),error:false});}).catch(()=>{if(active)setResult({token,role:null,error:true});});
  return()=>{active=false;};
 },[enabled,token,attempt]);
 const current=enabled&&token&&result?.token===token?result:null;
 const role=current?.role||null;
 return {loading:Boolean(enabled&&token&&!current),canEdit:['editor_contenido','super_admin'].includes(role),isSuperAdmin:role==='super_admin',role,error:Boolean(current?.error),retry};
}

/** Reuses the existing visual editors and their exact privileges and endpoints. */
export default function ContentVisualAssetsPanel({access,initialTab='photos'}){
 const {session}=useAuth();
 const localAccess=useContentVisualAssetsAccess({enabled:!access});
 const permission=access||localAccess;
 const [tab,setTab]=useState(initialTab==='promotions'?'promotions':'photos');
 if(permission.loading)return <p role="status">Cargando edición visual…</p>;
 if(permission.error)return <section className="content-visual-assets"><p role="alert">No pudimos comprobar el acceso a la edición visual.</p><button type="button" onClick={permission.retry}>Volver a intentar</button></section>;
 if(!permission.canEdit||!['editor_contenido','super_admin'].includes(permission.role)||!session?.access_token)return <p role="alert">No tenés habilitada la edición visual.</p>;
 const isSuperAdmin=permission.role==='super_admin';
 return <section className="content-visual-assets" aria-label="Imágenes y espacios de la app">
  <header><h2>Imágenes y espacios de la app</h2><p>Actualizá las fotos de las pantallas y sus espacios publicitarios desde este mismo lugar.</p></header>
  <div className="content-visual-assets__tabs" role="tablist" aria-label="Edición visual">
   <button id="content-visual-photos" type="button" role="tab" aria-selected={tab==='photos'} aria-controls="content-visual-panel" onClick={()=>setTab('photos')}>Fotos y burbujas</button>
   <button id="content-visual-promotions" type="button" role="tab" aria-selected={tab==='promotions'} aria-controls="content-visual-panel" onClick={()=>setTab('promotions')}>Publicidad y promociones</button>
  </div>
  <div id="content-visual-panel" role="tabpanel" aria-labelledby={`content-visual-${tab}`}>
   <Suspense fallback={<p role="status">Cargando herramientas…</p>}>
    {tab==='photos'?<HubEditor apiBaseUrl={getApiBaseUrl()} accessToken={session.access_token} isSuperAdmin={isSuperAdmin}/>:<PromotionsEditor isSuperAdmin={isSuperAdmin} canDelete={isSuperAdmin} canManageCupos={isSuperAdmin} canAutoApprove/>}
   </Suspense>
  </div>
 </section>;
}
