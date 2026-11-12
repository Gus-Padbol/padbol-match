import mapping from './__fixtures__/napoliFixturePdfMapping.json';
import {napoliFixturePresentation,napoliFixtureDayLabel} from './napoliFixturePresentation';
const torneo={id:57,deporte:'padbol',modalidad_plantel:'selecciones'};
const ids={Rumania:282,Alemania:290,Francia:281,Egipto:291,Dinamarca:287,Portugal:292,Qatar:280,'Bélgica':283,'México':289,Suecia:285,'España':284,Italia:294,Austria:293,'Emiratos Árabes Unidos':286,Ucrania:288};
const equipos=Object.entries(ids).map(([nombre,id])=>({id,nombre}));
const partidos=mapping.matches.map(row=>({id:row.match_id,grupo:row.group,equipo_a_id:ids[row.a],equipo_b_id:ids[row.b],estado:'pendiente',fecha_hora:null,court_id:null,resultado:null})).reverse();
const rows=view=>view.sections.flatMap(section=>section.groups.flatMap(group=>group.matches));
test('all30 original IDs match official reference numbers/pairs and21Friday+9Saturday allocation without schedule mutation',()=>{
 const before=JSON.stringify(partidos);const view=napoliFixturePresentation({torneo,partidos,equipos});
 expect(view.sections.map(section=>section.groups.flatMap(group=>group.matches).length)).toEqual([21,9]);
 expect(view.sections.map(section=>section.day)).toEqual(['2026-11-20','2026-11-21']);expect(view.sections[1].morning).toBe(true);
 expect(new Set(rows(view).map(row=>row.match.id)).size).toBe(30);expect(view.other).toEqual([]);
 mapping.matches.forEach(reference=>{const row=rows(view).find(item=>item.match.id===reference.match_id);expect(row.number).toBe(reference.fixture);expect(row.codes).toBe(reference.codes);expect(row.match).toBe(partidos.find(match=>match.id===reference.match_id));});
 expect(JSON.stringify(partidos)).toBe(before);expect(partidos.every(match=>match.fecha_hora===null&&match.court_id===null)).toBe(true);
 expect(napoliFixtureDayLabel(view.sections[0],'en')).toBe('Friday 20 November');expect(napoliFixtureDayLabel(view.sections[1],'es')).toContain('por la mañana');
});
test('reversed sides retain their actual code/name association, IDs and reference pairing number',()=>{
 const original=partidos.find(match=>match.id===584);const reversed={...original,equipo_a_id:original.equipo_b_id,equipo_b_id:original.equipo_a_id};
 const row=rows(napoliFixturePresentation({torneo,partidos:[reversed],equipos}))[0];expect(row.number).toBe(1);expect(row.codes).toBe('5A–2A');expect(row.match).toBe(reversed);
});
test('real event-zone schedule takes precedence over PDF day, including Saturday afternoon',()=>{
 const actual={...partidos.find(match=>match.id===584),fecha_hora:'2026-11-21T14:00:00Z',court_id:123,resultado:{sets:['6-2','6-3']}};
 const view=napoliFixturePresentation({torneo,partidos:[actual],equipos});expect(view.sections[0].day).toBe('2026-11-21');expect(view.sections[0].morning).toBe(false);expect(rows(view)[0].match).toBe(actual);expect(napoliFixtureDayLabel(view.sections[0],'en')).not.toContain('morning');
});
test('trusted normalized country map works without names; unknown matches, KO and other events retain the legacy view',()=>{
 const match=partidos.find(row=>row.id===584);const teams=equipos.map(team=>({...team,nombre:'Unidentified'}));
 expect(rows(napoliFixturePresentation({torneo,partidos:[match],equipos:teams,state:{config:{country_by_team:{290:' de ',287:'dk'}}}}))[0].number).toBe(1);
 for(const extra of [{grupo:null,bracket_round:1},{bracket_position:2},{ronda:2},{partido_siguiente_id:100},{partido_siguiente_slot:'A'},{equipo_a_id:999}])expect(napoliFixturePresentation({torneo,partidos:[{...match,...extra}],equipos})).toBeNull();
 for(const other of [{...torneo,id:58},{...torneo,deporte:'padel'},{...torneo,modalidad_plantel:'parejas'}])expect(napoliFixturePresentation({torneo:other,partidos,equipos})).toBeNull();
 const ko={...match,id:999,grupo:null,bracket_round:1};const view=napoliFixturePresentation({torneo,partidos:[ko,match],equipos});expect(view.other).toEqual([ko]);expect(rows(view)[0].match).toBe(match);
});
