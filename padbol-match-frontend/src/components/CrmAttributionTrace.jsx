import React from 'react';

export default function CrmAttributionTrace({conversation,activities,status,onRetry}) {
  const fields=conversation?.qualification_data?.form_submission?.fields;
  const value=key=>typeof fields?.[key]==='string'&&fields[key].trim()?fields[key].trim():null;
  const source=value('utm_source'),campaign=value('utm_id')||value('utm_campaign');
  const hasSede=Object.prototype.hasOwnProperty.call(conversation||{},'sede_id');
  return <section className="wa-panel" aria-label="Trazabilidad de la consulta">
    <h3>Origen y seguimiento</h3>
    <dl>
      <div><dt>Fuente guardada</dt><dd>{source||'Sin UTM de fuente'}{value('utm_medium')?` · ${value('utm_medium')}`:''}</dd></div>
      <div><dt>Campaña guardada</dt><dd>{campaign||'Sin UTM de campaña'}</dd></div>
      <div><dt>Consulta recibida</dt><dd>{conversation?.received_at||conversation?.created_at||'Fecha no disponible'}</dd></div>
      <div><dt>Sede vinculada</dt><dd>{hasSede?(conversation.sede_id?`Sede ${conversation.sede_id}`:'Sin sede todavía'):'Vínculo de sede no disponible en esta vista'}</dd></div>
    </dl>
    {status==='loaded'?<p>{activities.length===0?'Sin actividad registrada':`${activities.length} actividad${activities.length===1?'':'es'} registrada${activities.length===1?'':'s'}`}</p>:status==='error'?<p role="alert">No se pudo consultar la actividad. <button type="button" onClick={onRetry}>Reintentar actividad</button></p>:<p role="status">{status==='loading'?'Consultando actividad…':'Actividad no disponible en esta vista'}</p>}
    <small>Los UTM indican el origen guardado; no confirman atribución de la plataforma. Una nota o una sede vinculada no acredita una reserva, venta o actividad deportiva.</small>
  </section>;
}
