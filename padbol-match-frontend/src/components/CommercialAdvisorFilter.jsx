import React from 'react';

export function matchesAdvisor(item,filter,currentUserId){
  if(!filter)return true;
  if(!item)return false; // Missing relationship is not an unassigned case.
  const id=item.assignedAdvisor?.id||null;
  return filter==='unassigned'?!id:filter==='mine'?Boolean(currentUserId)&&id===currentUserId:id===filter;
}
export default function CommercialAdvisorFilter({value,onChange,cases=[],advisors=[],currentUserId='',disabled=false}){
  const options=new Map(advisors.map(a=>[a.id,a.name||a.email||'Asesor']));
  cases.forEach(c=>{if(c.assignedAdvisor?.id&&!options.has(c.assignedAdvisor.id))options.set(c.assignedAdvisor.id,c.assignedAdvisor.name||'Asesor asignado');});
  return <label className="crm-advisor-filter">Asesor<select aria-label="Filtrar por asesor" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">Todos los asesores</option>{currentUserId&&<option value="mine">Mis consultas</option>}<option value="unassigned">Sin asignar</option>{[...options].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
}
