import {isPadbolSelection} from './padbolSelectionRoster';
import {napoliDrawPosition} from './napoliDrawPresentation';

// PDF page 5: reference numbers describe pairings, never chronological start slots.
const PAIRS=[[2,5],[3,4],[2,3],[1,4],[1,3],[1,2],[4,5],[1,5],[3,5],[2,4]];
const FRIDAY='2026-11-20',SATURDAY='2026-11-21';
function confirmedDate(value,timeZone) {
 if(!value)return null;
 const instant=new Date(value);
 if(Number.isNaN(instant.getTime()))return null;
 try {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(instant);
  const part=type=>parts.find(row=>row.type===type)?.value;
  return {day:`${part('year')}-${part('month')}-${part('day')}`,morning:Number(part('hour'))<12};
 }catch{return null;}
}
export function napoliFixturePresentation({torneo,partidos=[],equipos=[],state}) {
 if(String(torneo?.id)!=='57'||!isPadbolSelection(torneo))return null;
 const teams=new Map([...equipos,...(state?.teams||[])].map(team=>[String(team.id),team]));
 const countryByTeam=state?.config?.country_by_team||{};
 const timeZone=state?.config?.timezone||torneo?.plan_nations?.timezone||torneo?.plan_nations?.config?.timezone||'Europe/Rome';
 const groups=new Map(),other=[];
 for(const match of partidos) {
  const group=match.grupo;
  if(!['A','B','C'].includes(group)||match.bracket_round!=null||match.bracket_position!=null||match.partido_siguiente_id!=null||match.partido_siguiente_slot!=null||(match.ronda!=null&&Number(match.ronda)!==1)){other.push(match);continue;}
  const a=napoliDrawPosition(teams.get(String(match.equipo_a_id)),group,countryByTeam);
  const b=napoliDrawPosition(teams.get(String(match.equipo_b_id)),group,countryByTeam);
  const index=PAIRS.findIndex(pair=>pair.includes(a)&&pair.includes(b)&&a!==b);
  if(index<0){other.push(match);continue;}
  const actual=confirmedDate(match.fecha_hora,timeZone);
  if(match.fecha_hora&&!actual){other.push(match);continue;}
  const day=actual?.day||(index<7?FRIDAY:SATURDAY);
  const morning=day===SATURDAY&&(actual?actual.morning:true);
  const key=`${day}:${morning?'morning':'day'}`;
  if(!groups.has(key))groups.set(key,{day,morning,groups:[]});
  const section=groups.get(key);
  let bucket=section.groups.find(row=>row.group===group);
  if(!bucket){bucket={group,matches:[]};section.groups.push(bucket);}
  bucket.matches.push({match,number:index+1,codes:`${a}${group}–${b}${group}`,timeZone});
 }
 if(!groups.size)return null;
 const sections=[...groups.values()].sort((a,b)=>a.day.localeCompare(b.day)||Number(b.morning)-Number(a.morning));
 sections.forEach(section=>{section.groups.sort((a,b)=>a.group.localeCompare(b.group));section.groups.forEach(group=>group.matches.sort((a,b)=>a.number-b.number));});
 return {sections,other};
}
export function napoliFixtureDayLabel(section,language='es') {
 const en=String(language).startsWith('en');
 if(section.day===FRIDAY)return en?'Friday 20 November':'Viernes 20 de noviembre';
 if(section.day===SATURDAY)return (en?'Saturday 21 November':'Sábado 21 de noviembre')+(section.morning?(en?' · morning':' · por la mañana'):'');
 return new Intl.DateTimeFormat(en?'en-GB':'es-ES',{dateStyle:'full',timeZone:'UTC'}).format(new Date(`${section.day}T12:00:00Z`));
}
