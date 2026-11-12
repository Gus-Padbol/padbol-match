import {nationsRefereePresentation} from './nationsRefereePresentation';
const snapshot={mode:'nations',board:{id:'60ccb50a-7556-4920-9fd9-dd7ccb6244e9',torneo_nombre:'QA SYNTHETIC',equipo_a_nombre:'QA A',equipo_b_nombre:'QA B'}};
test('isolated demo uses readable English match labels and fictional names, without changing source records',()=>{
 const original=JSON.stringify(snapshot),p=nationsRefereePresentation(snapshot,{variant:'qa'});
 expect(p.title).toBe('Nations Cup · Demo');expect(p.teamName('A')).toBe('Italy');expect(p.teamName('B')).toBe('Spain');
 expect(p.playerName({id:'unchanged',name:'QA AE 02'})).toBe('Luca Bianchi');expect(p.playerName({name:'QA AT 01'})).toBe('Carlos Martín');
 expect(JSON.stringify(snapshot)).toBe(original);
});
test.each(['production','development',undefined])('production never substitutes real tournament or player names (%s)',variant=>{
 const p=nationsRefereePresentation(snapshot,{variant});expect(p.isDemo).toBe(false);expect(p.title).toBe('QA SYNTHETIC');expect(p.playerName({name:'QA AE 02'})).toBe('QA AE 02');
});
test('other boards and legacy matches preserve all original labels even in QA',()=>{
 for(const s of [{...snapshot,board:{...snapshot.board,id:'real-board'}},{...snapshot,mode:'legacy-token'}]){
  const p=nationsRefereePresentation(s,{variant:'qa'});expect(p.isDemo).toBe(false);expect(p.teamName('A')).toBe('QA A');
 }
});
