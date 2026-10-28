import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {createWebAnalyticsApi} from '../../utils/webAnalyticsApi';
import './WebAnalyticsPanel.css';
export function useWebAnalyticsAccess({api:providedApi,enabled=true}={}){
 const {session}=useAuth();
 const api=useMemo(()=>providedApi||createWebAnalyticsApi(session?.access_token||''),[providedApi,session?.access_token]);
 const [snapshot,setSnapshot]=useState({api:null,value:null}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const setStatus=useCallback(value=>setSnapshot({api,value}),[api]);
 useEffect(()=>{if(!enabled)return undefined;let active=true;setLoading(true);setStatus(null);setError('');api.status().then(value=>{if(active)setStatus(value);}).catch(err=>{if(active&&err.status!==403)setError(err.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[api,enabled,setStatus]);
 const current=snapshot.api===api,status=current?snapshot.value:null;
 return {api,status,loading:!current||loading,error:current?error:'',canRead:status?.canRead===true,setStatus};
}
const metricNames=[['activeUsers','Usuarios activos'],['sessions','Sesiones'],['pageViews','Vistas de páginas'],['leads','Consultas medidas']];
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?new Intl.NumberFormat('es',{maximumFractionDigits:0}).format(value):'No informado';
const completeDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export default function WebAnalyticsPanel({access,api:providedApi}){
 const localAccess=useWebAnalyticsAccess({api:providedApi||access?.api,enabled:!access});
 const permission=access||localAccess,api=providedApi||permission.api;
 const [draft,setDraft]=useState({since:'',until:''}),[query,setQuery]=useState({}),[data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const configured=permission.status?.connection?.status==='configured';
 useEffect(()=>{
  setData(null);setError('');if(!permission.canRead||!configured)return undefined;
  let active=true;setLoading(true);
  api.summary(query).then(value=>{if(active){setData(value);setDraft({since:value.range?.since||'',until:value.range?.until||''});}}).catch(err=>{if(active)setError(err.message);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[api,permission.canRead,configured,query,refresh]);
 async function reload(){setError('');setData(null);setLoading(true);try{const next=await api.status();permission.setStatus?.(next);setRefresh(v=>v+1);}catch(err){setError(err.message);}finally{setLoading(false);}}
 if(permission.loading)return <p role="status">Comprobando acceso a la analítica web…</p>;
 if(!permission.canRead)return <p role="alert">{permission.error||'Tu cuenta no tiene acceso a la analítica web.'}</p>;
 return <section className="web-analytics" aria-label="Analítica web"><header><div><h2>Analítica web</h2><p>Visitas y consultas de padbol.com, leídas desde Google Analytics.</p></div><button type="button" disabled={loading} onClick={reload}>Actualizar analítica</button></header>
 <p className="web-analytics__connection" role="status">{configured?'Lectura configurada · La recepción se comprueba al consultar los resultados.':'Lectura automática no conectada.'}</p>
 <p className="web-analytics__identity">Propiedad: {permission.status?.propertyId||'435359413'} · Etiqueta: {permission.status?.measurementId||'G-YSJQXF18JV'}</p>
 {!configured&&<div className="web-analytics__notice"><h3>Falta autorizar la lectura de los informes</h3><p>La etiqueta instalada en la web y el permiso para leer los informes son conexiones diferentes. Cuando se habilite la lectura, los resultados aparecerán en esta vista.</p><p>Mientras tanto, no se muestran cifras estimadas ni se interpreta la falta de conexión como ausencia de visitas.</p></div>}
 <form className="web-analytics__filters" onSubmit={event=>{event.preventDefault();if(!completeDate(draft.since)||!completeDate(draft.until)||draft.since>draft.until||Date.parse(draft.until)-Date.parse(draft.since)>91*86400000){setError('Elige un período válido de hasta 92 días completos.');return;}setError('');setQuery({...draft});}}>
 <label>Desde<input type="date" value={draft.since} disabled={!configured||loading} required onChange={e=>setDraft(current=>({...current,since:e.target.value}))}/></label>
 <label>Hasta<input type="date" value={draft.until} disabled={!configured||loading} required onChange={e=>setDraft(current=>({...current,until:e.target.value}))}/></label>
 <button type="submit" disabled={!configured||loading}>Consultar período</button>
 </form>
 {loading&&<p role="status">Consultando Google Analytics…</p>}{error&&<p className="web-analytics__error" role="alert">{error}</p>}
 {!loading&&data&&<><p>Período: {data.range?.since} — {data.range?.until} · Horario del informe: {data.range?.timezone||'No informado'}</p><p className="web-analytics__identity">Fuente: Google Analytics · Consulta realizada: {data.meta?.queriedAt?new Date(data.meta.queriedAt).toLocaleString('es'):'No informada'}</p>
 <div className="web-analytics__metrics">{metricNames.map(([key,label])=><article key={key}><span>{label}</span><strong>{number(data.totals?.[key])}</strong></article>)}</div>
 <p className="web-analytics__notice">Las consultas medidas corresponden a envíos confirmados de los formularios de la web nueva y solo incluyen visitantes que aceptaron la medición. No equivalen al total de consultas del CRM ni a ventas. Los períodos anteriores o sin medición activa pueden no estar representados.</p>
 {(data.meta?.warnings||[]).map((warning,index)=><p className="web-analytics__notice" key={index}>{warning}</p>)}
 {data.daily?.length>0?<div className="web-analytics__table"><table><caption>Detalle por día</caption><thead><tr><th>Día</th>{metricNames.map(([key,label])=><th key={key} scope="col">{label}</th>)}</tr></thead><tbody>{data.daily.map(row=><tr key={row.date}><th scope="row">{row.date}</th>{metricNames.map(([key])=><td key={key}>{number(row[key])}</td>)}</tr>)}</tbody></table></div>:<p>No hay filas diarias para este período en la respuesta de Google Analytics.</p>}
 <p className="web-analytics__identity">Los usuarios activos del período se consultan a Google Analytics; no se calculan sumando los usuarios de cada día.</p></>}
 </section>;
}
