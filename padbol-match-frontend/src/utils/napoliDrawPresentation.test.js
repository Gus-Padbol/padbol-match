import {napoliDrawTeams} from './napoliDrawPresentation';
const torneo={id:57,deporte:'padbol',modalidad_plantel:'selecciones'};
const teams=[{id:281,nombre:'Francia',grupo:'A'},{id:282,nombre:'Rumania',grupo:'A'},{id:290,nombre:'Alemania',grupo:'A'},{id:291,nombre:'Egipto',grupo:'A'},{id:287,nombre:'Dinamarca',grupo:'A'}];
const pending=[{estado:'pendiente'}];
test('pending legacy countries follow the approved draw without trusted state, preserving identities and membership',()=>{
 const before=JSON.stringify(teams);
 const result=napoliDrawTeams(teams,torneo,{partidos:pending,group:'A'});
 expect(result.map(row=>row.nombre)).toEqual(['Rumania','Alemania','Francia','Egipto','Dinamarca']);
 expect(JSON.stringify(teams)).toBe(before);expect(result[0]).toBe(teams[1]);
});
test('normalized confirmed country mapping wins; unknown countries are stable and never silently replaced',()=>{
 const rows=[{id:9,nombre:'Unknown one'},{id:2,nombre:'Germany'},{id:1,nombre:'France'},{id:8,nombre:'Unknown two'}];
 expect(napoliDrawTeams(rows,torneo,{countryByTeam:{1:' ro ',2:' de '}}).map(row=>row.id)).toEqual([1,2,9,8]);
 expect(napoliDrawTeams(rows,torneo,{countryByTeam:{1:'XX'},group:'A'}).map(row=>row.id)).toEqual([2,9,1,8]);
 expect(napoliDrawTeams([{id:1,nombre:' MÉXICO '},{id:2,nombre:'Bélgica'},{id:3,nombre:'Qatar'}],torneo,{group:'B'}).map(row=>row.id)).toEqual([3,2,1]);
});
test('played results, active matches, other events/sports and non-selection tournaments retain their original order',()=>{
 for(const changed of [{...torneo,id:58},{...torneo,deporte:'padel'},{...torneo,modalidad_plantel:'parejas'}])expect(napoliDrawTeams(teams,changed,{partidos:pending})).toBe(teams);
 for(const partidos of [[{estado:'finalizado'}],[{estado:'en_curso'}],[{estado:'pendiente',resultado:{sets:['6-2','6-3']}}]])expect(napoliDrawTeams(teams,torneo,{partidos})).toBe(teams);
});
