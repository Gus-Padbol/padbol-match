import React, {useCallback, useEffect, useMemo, useState} from 'react';
import './CommercialProspects.css';

const SECTORS = [['','Todos los sectores'],['soccer','Fútbol / fútbol reducido'],['futsal','Fútbol sala'],['sports_centre','Centro deportivo indoor'],['stadium','Estadio / arena'],['multisport','Multideporte'],['resort','Resort'],['franchise','Franquicia / cadena'],['investor','Inversor']];
const OPPORTUNITIES = [['','Todas las oportunidades'],['venue_sale','Comprador de canchas'],['representation','Representación nacional/regional'],['franchise','Franquiciado'],['investor','Inversor'],['chain','Cadena / multisede'],['venue_operator','Operador de instalaciones'],['sports_operator','Operador deportivo']];
const STATUSES = [['','Todos los estados'],['investigated','Investigado'],['verified','Verificado'],['pending_approval','Pendiente de aprobación'],['approved','Aprobado'],['contacted','Contactado'],['delivered','Entregado'],['responded','Respondió'],['interested','Interesado'],['negotiation','En negociación'],['no_response','Sin respuesta'],['rejected','Rechazado'],['opt_out','Baja solicitada'],['bounced','Rebote'],['paused','Pausado'],['closed','Cerrado'],['existing','Existente en CRM']];
const BUCKETS=[['','Todos'],['new','Nuevos'],['existing','Existentes'],['contacted','Contactados'],['discarded','Descartados']];
const STATUS_LABELS=Object.fromEntries(STATUSES);

export default function CommercialProspects({api,embedded=false}) {
  const [status,setStatus]=useState(null);
  const [filters,setFilters]=useState({country:'US',state:'',city:'',region:'',sector:'',opportunity:'',limit:50,minScore:0,status:'',bucket:'',assigned:'',source:'',lastVerified:''});
  const [prospects,setProspects]=useState([]);
  const [selected,setSelected]=useState(null);
  const [detail,setDetail]=useState(null);
  const [dashboard,setDashboard]=useState(null);
  const [campaigns,setCampaigns]=useState([]);
  const [advisors,setAdvisors]=useState([]);
  const [campaignForm,setCampaignForm]=useState({name:'Piloto Estados Unidos',opportunityType:'venue_sale',language:'en',country:'US',dailyLimit:10});
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [tab,setTab]=useState('prospects');

  const load = useCallback(async()=>{
    setError('');
    try {
      const s=await api.prospectStatus(); setStatus(s);
      if(!s.enabled) return;
      const [list,board,cl]=await Promise.all([api.listProspects(filters),api.prospectDashboard(),api.listProspectCampaigns()]);
      setProspects(list.prospects||[]); setDashboard(board); setCampaigns(cl.campaigns||[]);
      if(s.role==='manager'&&api.listAdvisors){try{const a=await api.listAdvisors();setAdvisors(a.advisors||[]);}catch{setAdvisors([]);}}
    } catch(e) { setError(e?.code==='PROSPECT_DISABLED'?'PADBOL PROSPECT todavía no está habilitado.':(e?.message||'No se pudo abrir PADBOL PROSPECT.')); }
  },[api,filters]);
  useEffect(()=>{load();},[load]);

  async function search(){
    setBusy(true);setError('');setNotice('');
    try {
      const result=await api.searchProspects({country:filters.country,state:filters.state,city:filters.city,sector:filters.sector,opportunity:filters.opportunity,limit:filters.limit});
      setNotice(`Búsqueda completada: ${result.found ?? result.prospects ?? 0} encontrados · ${result.inserted||0} nuevos · ${result.updated||0} actualizados · ${result.excluded||0} excluidos. Fuente: ${result.attribution||'OpenStreetMap'}.`);
      await load();
    } catch(e){setError(e?.message||'No se pudo completar la búsqueda pública.');}
    finally{setBusy(false);}
  }
  async function open(id){
    setSelected(id);setDetail(null);setError('');
    try{setDetail(await api.readProspect(id));}catch(e){setError(e?.message||'No se pudo abrir el prospecto.');}
  }
  async function update(id,patch){
    setBusy(true);setError('');setNotice('');
    try{const result=await api.updateProspect(id,patch);setDetail(current=>current?{...current,prospect:result.prospect}:current);await load();setNotice('Prospecto actualizado.');}
    catch(e){setError(e?.message||'No se pudo actualizar.');}finally{setBusy(false);}
  }
  async function createCampaign(event){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{const result=await api.createProspectCampaign(campaignForm);setCampaigns(current=>[result.campaign,...current]);setNotice('Campaña creada en borrador. No se enviará nada sin aprobación y habilitación expresa.');}
    catch(e){setError(e?.message||'No se pudo crear la campaña.');}finally{setBusy(false);}
  }
  async function approveCampaign(id){setBusy(true);setError('');setNotice('');try{const result=await api.updateProspectCampaign(id,{status:'approved'});setCampaigns(current=>current.map(c=>c.id===id?{...c,...result.campaign}:c));setNotice(result.note);}catch(e){setError(e?.message||'No se pudo aprobar la campaña.');}finally{setBusy(false);}}
  async function simulate(id){
    setBusy(true);setError('');setNotice('');
    try{const result=await api.simulateProspectCampaign(id);setNotice(`Simulación: ${result.created} mensajes preparados, ${result.noEmail||0} sin correo, ${result.blocked||0} bloqueados. ${result.message}`);await load();}
    catch(e){setError(e?.message||'No se pudo simular la campaña.');}finally{setBusy(false);}
  }
  async function simulateFollowup(id){
    setBusy(true);setError('');setNotice('');
    try{const result=await api.simulateProspectFollowup(id,14);setNotice(`Seguimiento simulado día ${result.day}: ${result.planned} seguimientos planificados, ${result.skipped} bloqueados por respuesta o restricción. ${result.message}`);await load();}
    catch(e){setError(e?.message||'No se pudo simular el seguimiento.');}finally{setBusy(false);}
  }
  async function response(id,text){
    setBusy(true);setError('');setNotice('');
    try{const r=await api.prospectResponse(id,text);setNotice(`Respuesta clasificada: ${r.classification}${r.requiresReview?' · requiere revisión humana':''}.`);await open(id);await load();}
    catch(e){setError(e?.message||'No se pudo registrar la respuesta.');}finally{setBusy(false);}
  }

  const metrics=dashboard?.totals||{};
  const byCountry=useMemo(()=>dashboard?.byCountry||[],[dashboard]);
  if(status&&!status.enabled) return <main className={`prospect-shell${embedded?' prospect-shell--embedded':''}`}><section className="prospect-disabled"><h1>PADBOL PROSPECT</h1><p>El módulo está deshabilitado por configuración. El CRM existente sigue funcionando normalmente.</p></section></main>;

  return <main className={`prospect-shell${embedded?' prospect-shell--embedded':''}`}>
    <header className="prospect-top">
      <div><p>PADBOL INTERNACIONAL · PROSPECCIÓN COMERCIAL</p><h1>PADBOL PROSPECT</h1><span>Investigación de mercados, evidencia pública y oportunidades para el Sistema Padbol.</span></div>
      <div className="prospect-top-actions"><span className={`prospect-mode ${status?.sendEnabled?'is-live':'is-sim'}`}>{status?.sendEnabled?'Envío habilitado':'Modo simulación · sin envíos'}</span><button type="button" onClick={load} disabled={busy}>Actualizar</button></div>
    </header>
    <nav className="prospect-tabs" role="tablist" aria-label="Vistas de PADBOL PROSPECT">
      <button type="button" role="tab" aria-selected={tab==='prospects'} className={tab==='prospects'?'is-active':''} onClick={()=>setTab('prospects')}>Prospectos</button>
      <button type="button" role="tab" aria-selected={tab==='dashboard'} className={tab==='dashboard'?'is-active':''} onClick={()=>setTab('dashboard')}>Panel ejecutivo</button>
      <button type="button" role="tab" aria-selected={tab==='campaigns'} className={tab==='campaigns'?'is-active':''} onClick={()=>setTab('campaigns')}>Campañas piloto</button>
    </nav>
    {error&&<p className="prospect-alert" role="alert">{error}</p>}
    {notice&&<p className="prospect-notice" role="status">{notice}</p>}
    {tab==='prospects'&&<>
      <section className="prospect-filters" aria-label="Filtros de prospección">
        <div className="prospect-filter-grid">
          <label>País<input value={filters.country} maxLength={2} onChange={e=>setFilters({...filters,country:e.target.value.toUpperCase()})}/></label>
          <label>Estado / provincia<input value={filters.state} onChange={e=>setFilters({...filters,state:e.target.value})} placeholder="Florida"/></label>
          <label>Ciudad<input value={filters.city} onChange={e=>setFilters({...filters,city:e.target.value})} placeholder="Miami"/></label>
          <label>Región<input value={filters.region} onChange={e=>setFilters({...filters,region:e.target.value})} placeholder="Opcional"/></label>
          <label>Sector<select value={filters.sector} onChange={e=>setFilters({...filters,sector:e.target.value})}>{SECTORS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label>Oportunidad<select value={filters.opportunity} onChange={e=>setFilters({...filters,opportunity:e.target.value})}>{OPPORTUNITIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label>Máximo de resultados<input type="number" min="1" max="50" value={filters.limit} onChange={e=>setFilters({...filters,limit:e.target.value})}/></label>
          <label>Puntuación mínima<input type="number" min="0" max="100" value={filters.minScore} onChange={e=>setFilters({...filters,minScore:e.target.value})}/></label>
          <label>Estado<select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}>{STATUSES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label>Grupo<select value={filters.bucket} onChange={e=>setFilters({...filters,bucket:e.target.value})}>{BUCKETS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label>Responsable<input value={filters.assigned} onChange={e=>setFilters({...filters,assigned:e.target.value})} placeholder="UUID del asesor"/></label>
          <label>Fuente<input value={filters.source} onChange={e=>setFilters({...filters,source:e.target.value})} placeholder="openstreetmap"/></label>
          <label>Última verificación<input type="date" value={filters.lastVerified} onChange={e=>setFilters({...filters,lastVerified:e.target.value})}/></label>
        </div>
        <div className="prospect-filter-actions"><button type="button" className="prospect-primary" onClick={search} disabled={busy}>{busy?'Buscando…':'Buscar prospectos ahora'}</button><button type="button" onClick={load} disabled={busy}>Aplicar filtros</button><small>La búsqueda pública usa OpenStreetMap/Nominatim con atribución ODbL. No se inventan datos faltantes.</small></div>
      </section>
      <section className="prospect-layout">
        <div className="prospect-list" aria-label="Prospectos">
          <header><h2>Prospectos <span>{prospects.length}</span></h2><small>Ordenados por puntuación; la puntuación no es intención de compra confirmada.</small></header>
          {!prospects.length&&<p className="prospect-empty">No hay prospectos con estos filtros. Ejecutá una búsqueda o ampliá el mercado.</p>}
          <ul>{prospects.map(p=><li key={p.id}><button type="button" className={selected===p.id?'is-active':''} onClick={()=>open(p.id)}><span className={`prospect-grade grade-${p.grade}`}>{p.grade}</span><div><strong>{p.name||p.legal_name||'Prospecto sin nombre'}</strong><span>{[p.city,p.state,p.country].filter(Boolean).join(' · ')}</span><small>{p.sector||'Sector sin dato'} · {p.score}/100 · {STATUS_LABELS[p.status]||p.status}</small></div>{p.contact_block_reason&&<b className="prospect-blocked">Revisar</b>}</button></li>)}</ul>
        </div>
        <div className="prospect-detail">
          {!selected&&<div className="prospect-placeholder"><strong>Seleccioná un prospecto</strong><span>Vas a ver la evidencia, la puntuación explicable, el estado y las acciones comerciales.</span></div>}
          {selected&&!detail&&<p>Cargando prospecto…</p>}
          {detail?.prospect&&<ProspectDetail data={detail} busy={busy} advisors={advisors} role={status?.role} onUpdate={patch=>update(detail.prospect.id,patch)} onResponse={text=>response(detail.prospect.id,text)}/>}
        </div>
      </section>
    </>}
    {tab==='dashboard'&&<section className="prospect-dashboard"><h2>Panel ejecutivo</h2><div className="prospect-metrics">{[
      ['Prospectos',metrics.prospects],['Verificados',metrics.verified],['Nuevos',metrics.new],['Existentes',metrics.existing],['Contactados',metrics.contacted],['Respuestas',metrics.responded],['Interesados',metrics.interested],['Negociaciones',metrics.negotiations],['Bajas',metrics.optOuts],['Rebotes',metrics.bounces],['Supresiones',metrics.suppressions],['Mensajes simulados',dashboard?.messages?.simulated],['Campañas',dashboard?.campaigns?.length]
    ].map(([label,value])=><article key={label}><span>{label}</span><strong>{value??0}</strong></article>)}</div><div className="prospect-dashboard-grid"><section><h3>Por país</h3>{byCountry.length?<ul>{byCountry.map(([k,v])=><li key={k}><span>{k}</span><b>{v}</b></li>)}</ul>:<p>Sin datos.</p>}</section><section><h3>Búsquedas recientes</h3>{(dashboard?.runs||[]).map(run=><article key={run.id}><strong>{run.city||run.state||run.country}</strong><span>{run.found_count} encontrados · {run.inserted_count} nuevos · {run.status}</span><small>{new Date(run.started_at).toLocaleString('es-AR')}</small></article>)}</section></div><p className="prospect-footnote">Costo de búsqueda registrado: USD {(dashboard?.sourceCostCents||0)/100}. Las aperturas de correo no se usan como interés. Envío real deshabilitado por defecto.</p></section>}
    {tab==='campaigns'&&<section className="prospect-campaigns"><h2>Campañas piloto</h2><div className="prospect-campaign-grid"><form onSubmit={createCampaign}><h3>Nueva campaña</h3><label>Nombre<input required value={campaignForm.name} onChange={e=>setCampaignForm({...campaignForm,name:e.target.value})}/></label><label>Perfil<select value={campaignForm.opportunityType} onChange={e=>setCampaignForm({...campaignForm,opportunityType:e.target.value})}>{OPPORTUNITIES.filter(([v])=>v).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Idioma<select value={campaignForm.language} onChange={e=>setCampaignForm({...campaignForm,language:e.target.value})}><option value="en">Inglés</option><option value="es">Español</option></select></label><label>Límite diario<input type="number" min="1" max="200" value={campaignForm.dailyLimit} onChange={e=>setCampaignForm({...campaignForm,dailyLimit:e.target.value})}/></label><button type="submit" className="prospect-primary" disabled={busy}>Crear borrador</button><p>Los mensajes quedan en simulación. No se envía ningún correo sin aprobación y credenciales autorizadas.</p></form><section><h3>Campañas existentes</h3>{!campaigns.length&&<p>Sin campañas.</p>}{campaigns.map(c=><article key={c.id}><div><strong>{c.name}</strong><span>{c.language.toUpperCase()} · {c.status} · límite {c.daily_limit}/día</span></div>{status?.role==='manager'&&<button type="button" onClick={()=>approveCampaign(c.id)} disabled={busy||c.status==='approved'}>Aprobar</button>}<button type="button" onClick={()=>simulate(c.id)} disabled={busy}>Simular</button><button type="button" onClick={()=>simulateFollowup(c.id)} disabled={busy}>Simular seguimiento</button></article>)}</section></div></section>}
  </main>;
}

function ProspectDetail({data,busy,advisors,role,onUpdate,onResponse}) {
  const p=data.prospect; const breakdown=p.score_breakdown||[];
  const [text,setText]=useState('');
  return <article className="prospect-card">
    <header><span className={`prospect-grade grade-${p.grade}`}>{p.grade}</span><div><h2>{p.name||'Prospecto'}</h2><p>{[p.sector,p.city,p.state,p.country].filter(Boolean).join(' · ')}</p></div><strong className="prospect-score">{p.score}<small>/100</small></strong></header>
    <div className="prospect-badges"><span>{STATUS_LABELS[p.status]||p.status}</span>{p.is_padel_only&&<b>Excluido: pádel exclusivo</b>}{p.contact_block_reason&&<b className="prospect-blocked">{p.contact_block_reason}</b>}</div>
    <div className="prospect-facts"><div><span>Web</span>{p.website?<a href={p.website} target="_blank" rel="noreferrer">{p.website}</a>:'Sin dato'}</div><div><span>Correo</span>{p.email||'Sin dato'}</div><div><span>Teléfono</span>{p.phone||'Sin dato'}</div><div><span>Dirección</span>{p.address||'Sin dato'}</div><div><span>Fuente</span><a href={p.source_url} target="_blank" rel="noreferrer">OpenStreetMap</a></div><div><span>Verificado</span>{p.last_verified_at?new Date(p.last_verified_at).toLocaleDateString('es-AR'):'Sin fecha'}</div></div>
    <section><h3>Puntuación explicable</h3><p className="prospect-footnote">Confianza de evidencia: {p.score_breakdown?.reduce?.((s,x)=>s,0)===0?0:Math.round(breakdown.filter(x=>!x.inferred).reduce((s,x)=>s+x.points,0)/Math.max(1,breakdown.reduce((s,x)=>s+x.points,0))*100)}%. Los puntos inferidos están marcados.</p>{breakdown.map(row=><div className="prospect-criterion" key={row.key}><span>{row.label}{row.inferred?' · inferido':' · evidencia'}</span><div><i style={{width:`${Math.round(row.points/Math.max(1,row.max)*100)}%`}}/></div><b>{row.points}/{row.max}</b></div>)}</section>
    <section><h3>Gestión</h3><label>Estado<select value={p.status} onChange={e=>onUpdate({status:e.target.value})} disabled={busy}>{STATUSES.filter(([v])=>v).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>{role==='manager'&&<label>Responsable<select value={p.assigned_user_id||''} onChange={e=>onUpdate({assignedUserId:e.target.value||null})} disabled={busy}><option value="">Sin asignar</option>{advisors.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name||a.email}</option>)}</select></label>}<label>Nota de respuesta simulada<textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Pegá una respuesta para clasificarla sin enviar nada."/></label><button type="button" onClick={()=>onResponse(text)} disabled={busy||!text.trim()}>Clasificar respuesta</button></section>
    <section><h3>Mensajes de campaña</h3>{(data.messages||[]).length?<div className="prospect-messages">{data.messages.map(m=><details key={m.id}><summary><span>Día {m.step_day} · {m.status}</span><strong>{m.subject}</strong><small>{m.recipient}</small></summary><p>{m.body}</p></details>)}</div>:<p>Sin mensajes preparados. La simulación solo crea mensajes si hay correo verificado y la ficha no está bloqueada.</p>}</section>
    <section><h3>Historial</h3>{(data.events||[]).length?<ul className="prospect-history">{data.events.map(e=><li key={e.id}><span>{e.event_type}</span><small>{new Date(e.created_at).toLocaleString('es-AR')}</small></li>)}</ul>:<p>Sin eventos todavía.</p>}</section>
  </article>;
}
