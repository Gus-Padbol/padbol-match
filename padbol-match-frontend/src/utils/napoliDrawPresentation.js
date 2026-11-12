import {isPadbolSelection} from './padbolSelectionRoster';
import {partidoTieneResultadoCargado} from './torneoPartidoResultado';

// Gus's confirmed draw. Presentation only; never seeds, assigns or ranks teams.
const DRAW={A:['RO','DE','FR','EG','DK'],B:['PT','QA','BE','MX','SE'],C:['ES','IT','AT','AE','UA']};
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const aliases={romania:'RO',rumania:'RO',germany:'DE',alemania:'DE',france:'FR',francia:'FR',egypt:'EG',egipto:'EG',denmark:'DK',dinamarca:'DK',portugal:'PT',qatar:'QA',catar:'QA',belgium:'BE',belgica:'BE',mexico:'MX',sweden:'SE',suecia:'SE',spain:'ES',espana:'ES',italy:'IT',italia:'IT',austria:'AT',uae:'AE','united arab emirates':'AE','emiratos arabes unidos':'AE',ukraine:'UA',ucrania:'UA'};
const codes=new Set(Object.values(DRAW).flat());
const country=value=>{const iso=String(value||'').trim().toUpperCase();return codes.has(iso)?iso:aliases[normalized(value)]||null;};
export function napoliDrawPosition(team,group,countryByTeam={}) {
 const confirmed=countryByTeam[String(team?.id)];
 const iso=confirmed!=null?country(confirmed):country(team?.country||team?.pais)||country(team?.nombre);
 const index=(DRAW[group]||[]).indexOf(iso);
 return index<0?null:index+1;
}
export function napoliDrawPending(torneo,partidos=[]) {
 return String(torneo?.id)==='57' && isPadbolSelection(torneo)
  && !partidos.some(match=>partidoTieneResultadoCargado(match)||!['pendiente','programado'].includes(String(match?.estado||'').trim().toLowerCase()));
}
export function napoliDrawTeams(teams,torneo,{partidos=[],countryByTeam={},group}={}) {
 if(!Array.isArray(teams)||!napoliDrawPending(torneo,partidos))return teams;
 const order=group ? DRAW[group]||[] : Object.values(DRAW).flat();
 const ranks=new Map(order.map((iso,index)=>[iso,index]));
 const rank=team=>{
  const confirmed=countryByTeam[String(team.id)];
  const iso=confirmed!=null?country(confirmed):country(team.country||team.pais)||country(team.nombre);
  return ranks.get(iso)??Infinity;
 };
 return teams.map((team,index)=>({team,index,rank:rank(team)}))
  .sort((a,b)=>a.rank-b.rank||a.index-b.index).map(row=>row.team);
}
