import {nationsRefereePresentation,nationsDemoPublicBoard} from './nationsRefereePresentation';
const snapshot={mode:'nations',board:{id:'60ccb50a-7556-4920-9fd9-dd7ccb6244e9',torneo_nombre:'QA SYNTHETIC',equipo_a_nombre:'QA A',equipo_b_nombre:'QA B'}};
test('isolated demo uses readable English match labels and fictional names, without changing source records',()=>{
 const original=JSON.stringify(snapshot),p=nationsRefereePresentation(snapshot,{variant:'qa'});
 expect(p.title).toBe('V Padbol Nations Cup · Naples 2026');expect(p.teamName('A')).toBe('Italy');expect(p.teamName('B')).toBe('Spain');
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

test('public aliases preserve authoritative court/bench roles and use exact QA board scope',()=>{
 const publicBoard={...snapshot.board,nations_lineup_status:'current',equipo_a_jugadores:[{nombre:'QA AE 03',role:'on_court'},{nombre:'QA AE 01',role:'bench'}],equipo_b_jugadores:[{nombre:'QA AT 04',role:'on_court'}]};
 const original=JSON.stringify(publicBoard),p=nationsDemoPublicBoard(publicBoard,{variant:'qa'});
 expect(p.equipo_a_nombre).toBe('Italy');expect(p.equipo_a_jugadores[0]).toMatchObject({nombre:'Paolo Conti',role:'on_court',demoPortraitIndex:2});expect(p.equipo_a_jugadores[1].role).toBe('bench');
 expect(JSON.stringify(publicBoard)).toBe(original);expect(nationsDemoPublicBoard(publicBoard,{variant:'production'})).toBe(publicBoard);
 expect(nationsDemoPublicBoard({...publicBoard,nations_lineup_status:undefined},{variant:'qa'}).equipo_a_nombre).toBe('QA A');
});
