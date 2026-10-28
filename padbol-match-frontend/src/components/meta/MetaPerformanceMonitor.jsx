import React,{useEffect,useState} from 'react';
const kinds={impressions_drop:'Caída de impresiones',link_clicks_drop:'Caída de clics en enlaces',cost_per_link_click_increase:'Aumento del costo por clic',coverage_gap:'Falta de datos para comparar'};
const states={succeeded:'Completada',completed:'Completada',success:'Completada',failed:'No completada',running:'En proceso',pending:'Pendiente',skipped:'Sin ejecución'};
const numeric=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?new Intl.NumberFormat('es',{maximumFractionDigits:2}).format(Number(value)):'No informado';
export default function MetaPerformanceMonitor({api}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{if(typeof api?.monitor!=='function')return undefined;let active=true;setData(null);setError('');setLoading(true);api.monitor().then(value=>{if(active)setData(value);}).catch(()=>{if(active)setError('No se pudo consultar el control diario de Meta. Puedes volver a intentarlo.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[api,refresh]);
 if(typeof api?.monitor!=='function')return null;
 return <section className="meta-results__monitor" aria-label="Avisos de rendimiento de Meta"><div className="meta-results__actions"><h3>Avisos de rendimiento</h3><button type="button" disabled={loading} onClick={()=>setRefresh(v=>v+1)}>Actualizar avisos</button></div>
 <p>Control diario: compara los últimos 7 días completos con los 7 anteriores, a nivel de campaña. No representa un aviso en tiempo real ni modifica campañas o presupuestos.</p>
 {loading&&<p role="status">Consultando el control diario…</p>}{error&&<p role="alert" className="meta-results__error">{error}</p>}
 {data&&<><p className="meta-results__notice">{!data.configured?'Falta autorizar la lectura de Meta.':data.actorAuthorized===false?'Falta habilitar la coordinación para el control diario.':!data.enabled?'Control diario todavía no activado.':'Control diario activado.'} Horario del informe: {data.timezone||'No informado'}.</p>{data.notice&&<p>{data.notice}</p>}
 {data.latest?.comparison?.current&&data.latest?.comparison?.previous&&<p>Período actual: {data.latest.comparison.current.since} — {data.latest.comparison.current.until} · Período anterior: {data.latest.comparison.previous.since} — {data.latest.comparison.previous.until}.</p>}
 {data.latest?<p>Último control: {states[data.latest.status]||'Estado no informado'}{data.latest.until_day?` · Hasta ${data.latest.until_day}`:''}{data.latest.finished_at?` · ${new Date(data.latest.finished_at).toLocaleString('es')}`:''}.</p>:<p>Todavía no hay una ejecución registrada.</p>}
 {data.alerts?.length>0?<ul className="meta-results__alerts">{data.alerts.map((alert,index)=><li key={`${alert.until_day}:${alert.entity_id}:${alert.kind}:${index}`}><strong>{kinds[alert.kind]||'Cambio de rendimiento'}</strong><p>{alert.details?.campaignName||'Campaña sin nombre'}{alert.until_day?` · ${alert.until_day}`:''}</p>{alert.kind!=='coverage_gap'&&<p>Período anterior: {numeric(alert.details?.previousValue)} · Período actual: {numeric(alert.details?.currentValue)} · Variación: {numeric(alert.details?.changePercent)} %</p>}{alert.details?.notice&&<p>{alert.details.notice}</p>}</li>)}</ul>:<p>No hay avisos registrados. Esto no confirma buen rendimiento si todavía no se ha ejecutado el control o falta la conexión.</p>}
 </>}
 </section>;
}
