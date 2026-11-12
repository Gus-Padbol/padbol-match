import {hasGroupsSuperTiebreakPolicy,isActiveSuperTiebreak,superTiebreakSetPoints} from './scoreboardScoringPolicy';
import {formatSetsLineaNeutral,formatMarcadorPartidoDetalle,parseResultadoPartido} from './torneoPartidoResultado';
const policy={id:'napoli_groups_super_tiebreak_10_v1',phase:'groups',best_of:3,deciding_set:'super_tiebreak',target:10,win_by:1};
const third={set:3,a:1,b:0,type:'super_tiebreak',points_a:10,points_b:9,target:10,win_by:1};
test('exact server policy plus explicit active mode, including pre-firstpoint',()=>{
 expect(isActiveSuperTiebreak({scoring_policy:policy,display:{mode:'super_tiebreak'},es_tiebreak:false})).toBe(true);
 for(const scoring_policy of [null,{...policy,phase:'knockout'},{...policy,target:7},{...policy,win_by:2},{...policy,id:'other'}]) expect(hasGroupsSuperTiebreakPolicy({scoring_policy})).toBe(false);
 expect(isActiveSuperTiebreak({scoring_policy:policy,display:{mode:'tiebreak'}})).toBe(false);
 expect(isActiveSuperTiebreak({torneo_nombre:'Napoli',sets_a:1,sets_b:1,es_tiebreak:true})).toBe(false);
});
test('typed10–9 ends without difference while statistics retain one deciding game',()=>{
 const partido={resultado:{historial_sets:[{set:1,a:6,b:4},{set:2,a:3,b:6},third]}};
 expect(formatSetsLineaNeutral(partido)).toBe('6-4 / 3-6 / 10-9 (STB)');
 expect(parseResultadoPartido(partido)).toEqual(['6-4','3-6','1-0']);
 expect(superTiebreakSetPoints({...third,a:0,b:1,points_a:8,points_b:10})).toEqual({a:8,b:10});
 for(const entry of [{...third,type:'tiebreak'},{...third,set:2},{...third,points_a:9},{...third,points_a:'10'},{...third,a:0},{...third,points_b:10}]) expect(superTiebreakSetPoints(entry)).toBeNull();
 expect(formatSetsLineaNeutral({resultado:{historial_sets:[{set:3,a:7,b:6}]}})).toBe('7-6');
});

test('detailed results present typed STB points with correct winner orientation without changing numeric game statistics',()=>{
 const regular=[{set:1,a:6,b:2},{set:2,a:3,b:6}];
 const forward={resultado:{historial_sets:[...regular,third]}};
 expect(formatMarcadorPartidoDetalle(forward,'Italy','Spain')).toBe('Italy 6-2 / 3-6 Spain / Italy 10-9 (STB)');
 const reverse={resultado:JSON.stringify({sets:[...regular,{...third,a:0,b:1,points_a:9,points_b:10}]})};
 expect(formatMarcadorPartidoDetalle(reverse,'Italy','Spain')).toBe('Italy 6-2 / 3-6 Spain / 9-10 (STB) Spain');
 expect(parseResultadoPartido(reverse)).toEqual(['6-2','3-6','0-1']);
 const knockout={resultado:{historial_sets:[...regular,{set:3,a:7,b:6}]}};
 expect(formatMarcadorPartidoDetalle(knockout,'Italy','Spain')).toBe('Italy 6-2 / 3-6 Spain / Italy 7-6');
 expect(formatMarcadorPartidoDetalle({resultado:{historial_sets:[...regular,{...third,type:'tiebreak'}]}},'Italy','Spain')).toBe('Italy 6-2 / 3-6 Spain / Italy 1-0');
});
