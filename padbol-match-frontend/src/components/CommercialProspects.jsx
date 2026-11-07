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
  const [territories,setTerritories]=useState([]);
  const [advisors,setAdvisors]=useState([]);
  const [campaignForm,setCampaignForm]=useState({name:'Piloto Estados Unidos',opportunityType:'venue_sale',language:'en',country:'US',dailyLimit:10});
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [tab,setTab]=useState('prospects');
  const [simulation,setSimulation]=useState(null);
  const [simulationBusy,setSimulationBusy]=useState('');
  const [campaignError,setCampaignError]=useState('');

  const load = useCallback(async()=>{
    setError('');
    try {
      const s=await api.prospectStatus(); setStatus(s);
      if(!s.enabled) return;
      const [list,board,cl,tl]=await Promise.all([api.listProspects(filters),api.prospectDashboard(),api.listProspectCampaigns(),api.listProspectTerritories?.()||Promise.resolve({territories:[]})]);
      setProspects(list.prospects||[]); setDashboard(board); setCampaigns(cl.campaigns||[]); setTerritories(tl?.territories||[]);
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
  async function saveTerritory(payload){
    setBusy(true);setCampaignError('');
    try{const result=await api.saveProspectTerritory(payload);setTerritories(current=>[result.territory,...current.filter(x=>x.territory_key!==result.territory?.territory_key)]);setNotice('Territorio protegido guardado.');}
    catch(e){setCampaignError(failure(e,'No se pudo guardar el territorio.'));}
    finally{setBusy(false);}
  }
  async function createCampaign(event){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{const result=await api.createProspectCampaign(campaignForm);setCampaigns(current=>[result.campaign,...current]);setNotice('Campaña creada en borrador. No se enviará nada sin aprobación y habilitación expresa.');}
    catch(e){setError(e?.message||'No se pudo crear la campaña.');}finally{setBusy(false);}
  }
  async function approveCampaign(id){setBusy(true);setError('');setNotice('');try{const result=await api.updateProspectCampaign(id,{status:'approved'});setCampaigns(current=>current.map(c=>c.id===id?{...c,...result.campaign}:c));setNotice(result.note);}catch(e){setError(e?.message||'No se pudo aprobar la campaña.');}finally{setBusy(false);}}
  function failure(e,fallback){
    const code=e?.code||e?.status?`${e?.status?`HTTP ${e.status} · `:''}${e?.code||''}`.trim():'';
    return [code, e?.userMessage||e?.message||fallback].filter(Boolean).join(' · ');
  }
  async function simulate(id){
    if(simulationBusy) return;
    if(simulation?.source==='simulate'&&simulation.campaignId===id) return;
    setSimulationBusy(id);setCampaignError('');setError('');
    try{
      const result=await api.simulateProspectCampaign(id);
      setSimulation({campaignId:id,source:'simulate',result});
      setNotice(`Simulación completada: ${result.created} mensaje(s) preparado(s), ${result.existing||0} ya existente(s), ${result.excluded||0} excluido(s). No se envió ningún correo.`);
    }catch(e){setCampaignError(failure(e,'No se pudo simular la campaña.'));}
    finally{setSimulationBusy('');}
    load().catch(()=>{});
  }
  async function previewMessages(id){
    if(simulationBusy) return;
    setSimulationBusy(id);setCampaignError('');
    try{
      const result=await api.campaignMessages(id);
      setSimulation({campaignId:id,source:'messages',result});
      setNotice(`Mensajes simulados: ${result.total||0}. Ninguno fue enviado.`);
    }catch(e){setCampaignError(failure(e,'No se pudieron leer los mensajes simulados.'));}
    finally{setSimulationBusy('');}
  }
  async function simulateFollowup(id){
    if(simulationBusy) return;
    setBusy(true);setCampaignError('');setNotice('');
    try{const result=await api.simulateProspectFollowup(id,14);setNotice(`Seguimiento simulado día ${result.day}: ${result.planned} seguimientos planificados, ${result.skipped} bloqueados por respuesta o restricción. ${result.message}`);}
    catch(e){setCampaignError(failure(e,'No se pudo simular el seguimiento.'));}finally{setBusy(false);}
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
          {!selected&&<div className="prospect-placeholder"><strong>Selecciona un prospecto</strong><span>Vas a ver la evidencia, la puntuación explicable, el estado y las acciones comerciales.</span></div>}
          {selected&&!detail&&<p>Cargando prospecto…</p>}
          {detail?.prospect&&<ProspectDetail data={detail} busy={busy} advisors={advisors} role={status?.role} onUpdate={patch=>update(detail.prospect.id,patch)} onResponse={text=>response(detail.prospect.id,text)}/>}
        </div>
      </section>
    </>}
    {tab==='dashboard'&&<section className="prospect-dashboard"><h2>Panel ejecutivo</h2><div className="prospect-metrics">{[
      ['Prospectos',metrics.prospects],['Verificados',metrics.verified],['Nuevos',metrics.new],['Existentes',metrics.existing],['Contactados',metrics.contacted],['Respuestas',metrics.responded],['Interesados',metrics.interested],['Negociaciones',metrics.negotiations],['Bajas',metrics.optOuts],['Rebotes',metrics.bounces],['Supresiones',metrics.suppressions],['Mensajes simulados',dashboard?.messages?.simulated],['Campañas',dashboard?.campaigns?.length]
    ].map(([label,value])=><article key={label}><span>{label}</span><strong>{value??0}</strong></article>)}</div><div className="prospect-dashboard-grid"><section><h3>Por país</h3>{byCountry.length?<ul>{byCountry.map(([k,v])=><li key={k}><span>{k}</span><b>{v}</b></li>)}</ul>:<p>Sin datos.</p>}</section><section><h3>Búsquedas recientes</h3>{(dashboard?.runs||[]).map(run=><article key={run.id}><strong>{run.city||run.state||run.country}</strong><span>{run.found_count} encontrados · {run.inserted_count} nuevos · {run.status}</span><small>{new Date(run.started_at).toLocaleString('es-AR')}</small></article>)}</section></div><p className="prospect-footnote">Costo de búsqueda registrado: USD {(dashboard?.sourceCostCents||0)/100}. Las aperturas de correo no se usan como interés. Envío real deshabilitado por defecto.</p></section>}
    {tab==='campaigns'&&<CampaignsView campaigns={campaigns} status={status} busy={busy} simulation={simulation} simulationBusy={simulationBusy} error={campaignError} form={campaignForm} setForm={setCampaignForm} onCreate={createCampaign} onApprove={approveCampaign} onSimulate={simulate} onPreview={previewMessages} onFollowup={simulateFollowup} territories={territories} onSaveTerritory={saveTerritory}/>}
  </main>;
}

function CampaignStatus({status}){
  const label={draft:'Borrador',approved:'Aprobada para simulación',paused:'Pausada',active:'Activa',stopped:'Detenida'}[status]||status;
  return <span className={`prospect-status prospect-status--${status||'draft'}`}>{label}</span>;
}

function CampaignMetrics({result,source}){
  if(source==='messages'){
    const counts=result.counts||{};
    return <div className="prospect-sim-metrics">
      <article><span>Mensajes simulados</span><strong>{result.total||0}</strong><small>solo lectura</small></article>
      <article><span>Simulados</span><strong>{counts.simulated||0}</strong><small>sin enviar</small></article>
      <article><span>Otros estados</span><strong>{Object.entries(counts).filter(([k])=>k!=='simulated').reduce((sum,[,v])=>sum+v,0)}</strong><small>revisar</small></article>
    </div>;
  }
  return <div className="prospect-sim-metrics">
    <article><span>Prospectos evaluados</span><strong>{result.evaluated??result.candidates??0}</strong><small>candidatos de la campaña</small></article>
    <article className="is-ok"><span>Mensajes preparados</span><strong>{result.created||0}</strong><small>listos para revisar</small></article>
    <article><span>Ya existentes</span><strong>{result.existing||0}</strong><small>sin duplicar</small></article>
    <article className="is-warn"><span>Excluidos</span><strong>{result.excluded||0}</strong><small>{result.noEmail||0} sin correo · {result.blocked||0} bloqueados{result.failed?` · ${result.failed} con error`:''}</small></article>
  </div>;
}

function SimulationResults({simulation}){
  if(!simulation) return null;
  const {result,source}=simulation;
  if(source==='messages'){
    const rows=result.messages||[];
    return <section className="prospect-simulation" aria-label="Mensajes simulados">
      <header><div><p>VISTA PREVIA · SOLO LECTURA</p><h3>{result.campaign?.name||'Mensajes simulados'}</h3></div><span className="prospect-status prospect-status--approved">Sin enviar</span></header>
      <CampaignMetrics result={result} source="messages"/>
      {!rows.length&&<p className="prospect-empty">No hay mensajes preparados. Ejecutá una simulación para crear la vista previa.</p>}
      <div className="prospect-sim-list">{rows.map(m=><details className="prospect-mail" key={m.id||`${m.prospect_id}-${m.step_day}`}>
        <summary><span>Día {m.step_day}</span><strong>{m.subject}</strong><small>{m.prospect?.name||m.recipient} · {m.recipient}</small></summary>
        <div className="prospect-mail-meta"><span>Para: {m.recipient}</span><span>Estado: {m.status}</span><span>Programado: {m.scheduled_at?new Date(m.scheduled_at).toLocaleString('es-AR'):'sin fecha'}</span></div>
        <pre>{m.body}</pre>
      </details>)}</div>
    </section>;
  }
  const rows=result.results||[];
  const problems=rows.filter(r=>r.outcome!=='prepared'&&r.outcome!=='already_prepared');
  return <section className="prospect-simulation" aria-label="Resultado de simulación">
    <header><div><p>RESULTADO DE SIMULACIÓN</p><h3>{result.campaign?.name||'Campaña'}</h3><span>{result.message}</span></div><span className="prospect-status prospect-status--sim">Ningún correo enviado</span></header>
    <CampaignMetrics result={result} source="simulate"/>
    {!!problems.length&&<div className="prospect-sim-block"><h4>Excluidos y motivos</h4><ul className="prospect-exclusions">{problems.map(r=><li key={r.prospectId}><strong>{r.name}</strong><span>{r.reason}</span>{r.email&&<small>{r.email}</small>}</li>)}</ul></div>}
    <div className="prospect-sim-block"><h4>Mensajes preparados · abre cada correo antes de aprobar cualquier envío</h4>
      {!rows.some(r=>r.messages?.length)&&<p className="prospect-empty">No hay mensajes para previsualizar.</p>}
      <div className="prospect-sim-list">{rows.filter(r=>r.messages?.length).map(r=><div className="prospect-sim-prospect" key={r.prospectId}>
        <header><strong>{r.name}</strong><span>{r.email} · {r.outcome==='prepared'?'preparado':'ya existente'}</span></header>
        {r.messages.map((m,i)=><details className="prospect-mail" key={m.id||`${r.prospectId}-${m.step_day}-${i}`}>
          <summary><span>Día {m.step_day}</span><strong>{m.subject}</strong><small>{m.existing?'Ya existía · no se duplicó':'Preparado ahora'}</small></summary>
          <div className="prospect-mail-meta"><span>Para: {m.recipient}</span><span>Estado: {m.status}</span><span>{m.scheduled_at?new Date(m.scheduled_at).toLocaleString('es-AR'):'sin fecha'}</span></div>
          <pre>{m.body}</pre>
        </details>)}
      </div>)}</div>
    </div>
  </section>;
}

function CampaignsView({campaigns,status,busy,simulation,simulationBusy,error,form,setForm,onCreate,onApprove,onSimulate,onPreview,onFollowup,territories,onSaveTerritory}){
  const [territory,setTerritory]=useState({country:'',region:'',city:'',reason:'',source:''});
  return <section className="prospect-campaigns">
    <header className="prospect-section-head"><div><p>CAMPAÑAS PILOTO · MODO SIMULACIÓN</p><h2>Campañas</h2><span>Prepara y lee cada correo antes de cualquier envío. El envío real permanece deshabilitado.</span></div><span className="prospect-mode is-sim">Sin envíos reales</span></header>
    {error&&<div className="prospect-alert prospect-inline-alert" role="alert"><strong>No se pudo completar la operación</strong><span>{error}</span></div>}
    <div className="prospect-campaign-grid">
      <form onSubmit={onCreate} className="prospect-create-card">
        <h3>Nueva campaña</h3>
        <p>Crea un borrador. No se envía nada sin aprobación y credenciales autorizadas.</p>
        <label>Nombre<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label>Perfil<select value={form.opportunityType} onChange={e=>setForm({...form,opportunityType:e.target.value})}>{OPPORTUNITIES.filter(([v])=>v).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>Idioma<select value={form.language} onChange={e=>setForm({...form,language:e.target.value})}><option value="en">Inglés</option><option value="es">Español</option></select></label>
        <label>Límite diario<input type="number" min="1" max="200" value={form.dailyLimit} onChange={e=>setForm({...form,dailyLimit:e.target.value})}/></label>
        <button type="submit" className="prospect-primary" disabled={busy}>{busy?'Guardando…':'Crear borrador'}</button>
      </form>
      <div className="prospect-campaign-list">
        <h3>Campañas existentes <span>{campaigns.length}</span></h3>
        {!campaigns.length&&<p className="prospect-empty">Sin campañas.</p>}
        {campaigns.map(c=>{
          const isCurrent=simulation?.campaignId===c.id;
          const isSimulating=simulationBusy===c.id;
          const hasSimulation=isCurrent&&simulation?.source==='simulate';
          return <article className="prospect-campaign-card" key={c.id}>
            <header><div><strong>{c.name}</strong><span>{c.language?.toUpperCase()} · límite {c.daily_limit}/día · {Array.isArray(c.crm_prospect_campaign_steps)?`${c.crm_prospect_campaign_steps.length} pasos`:'sin pasos'}</span></div><CampaignStatus status={c.status}/></header>
            <div className="prospect-campaign-actions">
              {status?.role==='manager'&&<button type="button" onClick={()=>onApprove(c.id)} disabled={busy||isSimulating||c.status==='approved'}>Aprobar</button>}
              <button type="button" className="prospect-primary" onClick={()=>onSimulate(c.id)} disabled={busy||isSimulating||hasSimulation}>{isSimulating?'Simulando…':hasSimulation?'Simulación lista':'Simular'}</button>
              <button type="button" onClick={()=>onPreview(c.id)} disabled={busy||isSimulating}>Leer mensajes</button>
              <button type="button" onClick={()=>onFollowup(c.id)} disabled={busy||isSimulating}>Simular seguimiento</button>
            </div>
            {isCurrent&&<SimulationResults simulation={simulation}/>}
          </article>;
        })}
      </div>
    </div>
    <section className="prospect-territories"><header><div><p>CONTROL DE TERRITORIOS</p><h3>Cuentas y territorios protegidos</h3><span>Los prospectos de estas áreas quedan excluidos de la simulación y de cualquier envío.</span></div><span className="prospect-status prospect-status--sim">{territories.length} protegidos</span></header><div className="prospect-territory-grid"><form onSubmit={e=>{e.preventDefault();onSaveTerritory(territory);setTerritory({country:'',region:'',city:'',reason:'',source:''});}}><input required placeholder="País" value={territory.country} onChange={e=>setTerritory({...territory,country:e.target.value})}/><input placeholder="Región / estado" value={territory.region} onChange={e=>setTerritory({...territory,region:e.target.value})}/><input placeholder="Ciudad" value={territory.city} onChange={e=>setTerritory({...territory,city:e.target.value})}/><input required placeholder="Motivo contractual" value={territory.reason} onChange={e=>setTerritory({...territory,reason:e.target.value})}/><input required placeholder="Fuente / referencia" value={territory.source} onChange={e=>setTerritory({...territory,source:e.target.value})}/><button type="submit" className="prospect-primary" disabled={busy}>Proteger</button></form><div>{!territories.length?<p className="prospect-empty">Sin territorios protegidos cargados.</p>:territories.map(t=><article key={t.territory_key||`${t.country}-${t.region}-${t.city}`}><strong>{[t.city,t.region,t.country].filter(Boolean).join(' · ')}</strong><span>{t.reason}</span><small>{t.source}</small></article>)}</div></div></section>
  </section>;
}

const SCORE_MEANINGS = {
  sport: 'Mide la afinidad del negocio con fútbol, fútbol sala o instalaciones deportivas compatibles con Padbol.',
  investment: 'Estima si la organización tiene señales de escala o capacidad para invertir en una cancha o un proyecto Padbol.',
  facilities: 'Evalúa si hay información pública sobre instalaciones existentes o posibilidades de expansión.',
  locations: 'Considera cuántas sedes o ubicaciones gestiona la organización.',
  compatibility: 'Mide qué tan compatible es la actividad declarada con el Sistema Padbol.',
  representation: 'Estima el potencial de representar Padbol en una ciudad, región o cadena.',
  franchise: 'Evalúa señales de un modelo de franquicia, cadena o expansión multisede.',
  contactability: 'Comprueba si existe un canal comercial verificable para contactar a la organización.',
  activity: 'Busca evidencia pública de que la organización está activa o en crecimiento.',
};

function confirmedStatus(prospect, key) {
  const value = prospect?.data_status?.[key];
  return value === 'confirmed' || value === 'verified' || value === true;
}

function explicitChainSignal(prospect) {
  const value = [prospect?.name, prospect?.trade_name, prospect?.legal_name, prospect?.activities, prospect?.facility_notes].filter(Boolean).join(' ');
  return /(franchise|franquicia|chain|cadena|group|grupo|operator|operador|resort|multisede|multi-sede)/i.test(value);
}

function hasFacilityEvidence(prospect) {
  return Boolean(String(prospect?.facility_notes || '').trim() || String(prospect?.data_status?.facilities || '').match(/confirmed|verified/i));
}

function evidenceFor(row, prospect) {
  const locations = Number(prospect?.locations_count || 1);
  switch (row.key) {
    case 'sport':
    case 'compatibility':
      return confirmedStatus(prospect, 'name') || confirmedStatus(prospect, 'sector') || confirmedStatus(prospect, 'activities');
    case 'activity':
      return Boolean(prospect?.website) && confirmedStatus(prospect, 'website');
    case 'contactability':
      return Boolean(prospect?.email) && confirmedStatus(prospect, 'email');
    case 'locations':
      return locations > 1 && confirmedStatus(prospect, 'locations');
    case 'facilities':
      return hasFacilityEvidence(prospect);
    case 'investment':
    case 'representation':
    case 'franchise':
      return explicitChainSignal(prospect) || locations > 1;
    default:
      return !row.inferred;
  }
}

function scoreExplanation(row, prospect, isEvidence) {
  const p = prospect || {};
  const locations = Number(p.locations_count || 1);
  const common = {
    sport: { source: 'Etiquetas de actividad / nombre confirmado', why: `La regla asignó ${row.points}/${row.max} por la actividad y el nombre del negocio; no se usaron datos de intención de compra.`, support: [p.sector, p.activities, p.name].filter(Boolean).join(' · ') || 'Sin actividad declarada.' },
    investment: { source: explicitChainSignal(p) || locations > 1 ? 'Señal textual de escala / operador' : 'Inferencia por nombre genérico; sin fuente de inversión', why: `La regla asignó ${row.points}/${row.max}. ${explicitChainSignal(p) || locations > 1 ? 'Se encontraron señales de escala, pero no equivalen a capacidad financiera verificada.' : 'No hay evidencia de cadena o escala; el nombre genérico "Club" no se considera prueba de inversión.'}`, support: `Sedes declaradas: ${locations}. ${explicitChainSignal(p) ? 'Señal textual de cadena/operador.' : 'Sin señal explícita de cadena.'}` },
    facilities: { source: hasFacilityEvidence(p) ? 'Notas públicas de instalaciones' : 'Dirección pública; sin notas de instalaciones', why: `La regla asignó ${row.points}/${row.max} por los datos de dirección e instalaciones disponibles.`, support: p.facility_notes ? `Notas: ${p.facility_notes}` : p.address ? `Dirección pública: ${p.address}. No hay notas específicas de instalaciones.` : 'Sin dirección ni notas de instalaciones.' },
    locations: { source: locations > 1 ? 'Dato de sedes' : 'Inferencia: una sola sede conocida', why: `La regla asignó ${row.points}/${row.max} según la cantidad de sedes conocida.`, support: `Sedes declaradas: ${locations}. ${p.data_status?.locations ? `Estado del dato: ${p.data_status.locations}.` : ''}` },
    compatibility: { source: 'Actividad declarada', why: `La regla asignó ${row.points}/${row.max} por la actividad declarada y su compatibilidad con el Sistema Padbol.`, support: [p.sector, p.activities].filter(Boolean).join(' · ') || 'Sin actividad declarada.' },
    representation: { source: explicitChainSignal(p) ? 'Señal textual de escala' : 'Inferencia; sin fuente de escala territorial', why: `La regla asignó ${row.points}/${row.max}. ${explicitChainSignal(p) ? 'Hay una señal textual de escala, todavía no confirmada.' : 'No hay evidencia de escala territorial suficiente.'}`, support: `Sedes: ${locations}. ${explicitChainSignal(p) ? 'Señal de cadena/operador.' : 'Sin cadena o escala explícita.'}` },
    franchise: { source: explicitChainSignal(p) ? 'Señal textual de cadena/franquicia' : 'Inferencia; sin fuente de franquicia', why: `La regla asignó ${row.points}/${row.max} por el modelo de negocio declarado.`, support: explicitChainSignal(p) ? 'Señal textual de cadena/franquicia.' : 'No se encontró un modelo de franquicia o cadena.' },
    contactability: { source: p.email ? 'Correo público confirmado' : p.phone || p.website ? 'Canal público' : 'Sin contacto público', why: `La regla asignó ${row.points}/${row.max} por los canales públicos disponibles.`, support: [p.email ? 'Correo público' : null, p.phone ? 'Teléfono público' : null, p.website ? 'Sitio web público' : null].filter(Boolean).join(' · ') || 'Sin contacto público.' },
    activity: { source: p.website ? 'Sitio web público' : 'Sin sitio web', why: `La regla asignó ${row.points}/${row.max} por la presencia de un sitio web público; no se interpreta como intención de compra.`, support: p.website ? `Sitio web: ${p.website}` : 'Sin sitio web.' },
  };
  const value = common[row.key] || { source: row.source, why: `La regla asignó ${row.points}/${row.max}.`, support: row.source || 'Sin detalle adicional.' };
  return { ...value, isEvidence };
}

function formatScoreDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Fecha no informada';
  return new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function ScoreBreakdown({ prospect }) {
  const rows = prospect?.score_breakdown || [];
  const [open, setOpen] = useState('');
  const totalMax = rows.reduce((sum, row) => sum + Number(row.max || 0), 0);
  const rawPoints = rows.reduce((sum, row) => sum + Number(row.points || 0), 0);
  const evidenceRows = rows.filter(row => evidenceFor(row, prospect));
  const evidencePoints = evidenceRows.reduce((sum, row) => sum + Number(row.points || 0), 0);
  const confidence = rawPoints ? Math.round(evidencePoints / rawPoints * 100) : 0;
  const sourceDate = formatScoreDate(prospect?.source_checked_at || prospect?.last_verified_at);
  return <section className="prospect-scorecard" aria-label="Puntuación explicable">
    <header className="prospect-score-head">
      <div><h3>Puntuación explicable</h3><p>Cada punto indica qué se midió y cuánto respaldo verificable tiene. Toca un criterio para ver el detalle.</p></div>
      <div className="prospect-score-summary"><strong>{prospect?.score ?? 0}<small>/100</small></strong><span>{rawPoints} / {totalMax} puntos de criterios</span><span className={confidence < 60 ? 'is-low' : 'is-good'}>Confianza de evidencia <b>{confidence}%</b></span></div>
    </header>
    <p className="prospect-score-formula">El total se normaliza a 100 sobre {totalMax} puntos posibles. La confianza mide únicamente los puntos respaldados por evidencia verificable; no es una probabilidad de compra.</p>
    <div className="prospect-score-list">{rows.map(row => {
      const isEvidence = evidenceFor(row, prospect);
      const detail = scoreExplanation(row, prospect, isEvidence);
      const expanded = open === row.key;
      return <div className={`prospect-score-item ${expanded ? 'is-open' : ''}`} key={row.key}>
        <button type="button" className="prospect-score-row" onClick={() => setOpen(expanded ? '' : row.key)} aria-expanded={expanded} aria-controls={`score-${row.key}`}>
          <span className="prospect-score-label"><strong>{row.label}</strong><small>{detail.source || row.source}</small></span>
          <span className="prospect-score-bar" aria-hidden="true"><i style={{ width: `${Math.round(row.points / Math.max(1, row.max) * 100)}%` }} /></span>
          <span className="prospect-score-points">{row.points}<small>/{row.max}</small></span>
          <span className={`prospect-evidence ${isEvidence ? 'is-evidence' : 'is-inferred'}`}>{isEvidence ? 'Evidencia' : 'Inferido'}</span>
          <span className="prospect-score-chevron" aria-hidden="true">{expanded ? '−' : '+'}</span>
        </button>
        {expanded && <div className="prospect-score-explain" id={`score-${row.key}`}>
          <div><span>Qué significa</span><p>{SCORE_MEANINGS[row.key] || 'Criterio de la puntuación comercial.'}</p></div>
          <div><span>Por qué recibió {row.points}/{row.max}</span><p>{detail.why}</p></div>
          <div><span>Información que lo respalda</span><p>{detail.support}</p></div>
          <div><span>Fuente y fecha</span><p>{detail.source || row.source || 'Fuente no informada'} · <a href={prospect.source_url || prospect.website || '#'} target="_blank" rel="noreferrer">{prospect.source_url || prospect.website || 'Sin URL'}</a> · Verificado: {sourceDate}</p></div>
          <div className={isEvidence ? 'is-evidence-note' : 'is-inferred-note'}><span>Evidencia vs inferencia</span><p>{isEvidence ? 'Este criterio tiene respaldo en un dato confirmado de la ficha. No implica intención de compra ni una oportunidad validada por Padbol.' : 'Este valor es una inferencia de la regla de puntuación. No se presenta como un hecho confirmado ni reemplaza la verificación comercial.'}</p></div>
        </div>}
      </div>;
    })}</div>
    <p className="prospect-footnote">La puntuación no es una probabilidad de compra. La confianza de evidencia de {confidence}% refleja {evidencePoints} de {rawPoints} puntos respaldados; el resto son inferencias de la regla.</p>
  </section>;
}

function ProspectDetail({data,busy,advisors,role,onUpdate,onResponse}) {
  const p=data.prospect;
  const [text,setText]=useState('');
  return <article className="prospect-card">
    <header><span className={`prospect-grade grade-${p.grade}`}>{p.grade}</span><div><h2>{p.name||'Prospecto'}</h2><p>{[p.sector,p.city,p.state,p.country].filter(Boolean).join(' · ')}</p></div><strong className="prospect-score">{p.score}<small>/100</small></strong></header>
    <div className="prospect-badges"><span>{STATUS_LABELS[p.status]||p.status}</span>{p.is_padel_only&&<b>Excluido: pádel exclusivo</b>}{p.contact_block_reason&&<b className="prospect-blocked">{p.contact_block_reason}</b>}</div>
    <div className="prospect-facts"><div><span>Web</span>{p.website?<a href={p.website} target="_blank" rel="noreferrer">{p.website}</a>:'Sin dato'}</div><div><span>Correo</span>{p.email||'Sin dato'}</div><div><span>Teléfono</span>{p.phone||'Sin dato'}</div><div><span>Dirección</span>{p.address||'Sin dato'}</div><div><span>Fuente</span><a href={p.source_url} target="_blank" rel="noreferrer">OpenStreetMap</a></div><div><span>Verificado</span>{p.last_verified_at?new Date(p.last_verified_at).toLocaleDateString('es-AR'):'Sin fecha'}</div></div>
    <ScoreBreakdown prospect={p}/>
    <section className="prospect-management">
      <div className="prospect-section-head prospect-section-head--small"><div><h3>Gestión comercial</h3><span>Actualiza el estado y el responsable sin disparar envíos.</span></div><span className="prospect-status prospect-status--draft">Solo CRM</span></div>
      <div className="prospect-management-grid">
        <label className="prospect-field"><span>Estado</span><select value={p.status} onChange={e=>onUpdate({status:e.target.value})} disabled={busy}>{STATUSES.filter(([v])=>v).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        {role==='manager'&&<label className="prospect-field"><span>Responsable</span><select value={p.assigned_user_id||''} onChange={e=>onUpdate({assignedUserId:e.target.value||null})} disabled={busy}><option value="">Sin asignar</option>{advisors.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name||a.email}</option>)}</select></label>}
        <label className="prospect-field prospect-field--wide"><span>Nota de respuesta simulada</span><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Pegá una respuesta para clasificarla sin enviar nada."/></label>
      </div>
      <div className="prospect-management-actions"><button type="button" className="prospect-primary" onClick={()=>onResponse(text)} disabled={busy||!text.trim()}>Clasificar respuesta</button></div>
    </section>
    <section><h3>Mensajes de campaña</h3>{(data.messages||[]).length?<div className="prospect-messages">{data.messages.map(m=><details key={m.id}><summary><span>Día {m.step_day} · {m.status}</span><strong>{m.subject}</strong><small>{m.recipient}</small></summary><p>{m.body}</p></details>)}</div>:<p>Sin mensajes preparados. La simulación solo crea mensajes si hay correo verificado y la ficha no está bloqueada.</p>}</section>
    <section><h3>Historial</h3>{(data.events||[]).length?<ul className="prospect-history">{data.events.map(e=><li key={e.id}><span>{e.event_type}</span><small>{new Date(e.created_at).toLocaleString('es-AR')}</small></li>)}</ul>:<p>Sin eventos todavía.</p>}</section>
  </article>;
}
