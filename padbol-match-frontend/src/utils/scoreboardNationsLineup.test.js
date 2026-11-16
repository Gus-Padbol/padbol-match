import {nationsTvLineup,scoreboardPublicPollInterval} from './scoreboardNationsLineup';
const team=prefix=>[1,2,3,4].map(n=>({nombre:`${prefix}${n}`,numero:n,role:n>2?'on_court':'bench'}));
const board=()=>({nations_lineup_status:'current',nations_lineup_revision:3,equipo_a_jugadores:team('A'),equipo_b_jugadores:team('B')});
test('effective pair comes from roles, never roster order or confirmed eligibility',()=>{
 const dto=board();const result=nationsTvLineup(dto);
 expect(result.current).toBe(true);expect(result.teams[0].active.map(p=>p.nombre)).toEqual(['A3','A4']);expect(result.teams[0].bench.map(p=>p.nombre)).toEqual(['A1','A2']);
 dto.equipo_a_jugadores[0].role='on_court';dto.equipo_a_jugadores[2].role='bench';
 expect(nationsTvLineup(dto).teams[0].active.map(p=>p.nombre)).toEqual(['A1','A4']);expect(nationsTvLineup(dto).teams[1].active.map(p=>p.nombre)).toEqual(['B3','B4']);
});
test.each(['unavailable',undefined])('missing/unknown projection never infers starters: %s',status=>{
 const dto=board();dto.nations_lineup_status=status;
 expect(nationsTvLineup(dto).current).toBe(false);expect(nationsTvLineup(dto).teams[0].active).toEqual([]);
});
test('malformed current projection fails closed for both sides',()=>{
 const dto=board();delete dto.equipo_b_jugadores[3].role;
 expect(nationsTvLineup(dto).current).toBe(false);expect(nationsTvLineup(dto).teams[0].active).toEqual([]);
});
test('Nations fallback preserves the shared public read budget; healthy WS needs no added polling',()=>{
 expect(scoreboardPublicPollInterval(board(),true)).toBeNull();expect(scoreboardPublicPollInterval(board(),false)).toBe(30000);
 expect(3*15*60*1000/scoreboardPublicPollInterval(board(),false)).toBe(90);
 expect(scoreboardPublicPollInterval({},false)).toBe(3000);expect(scoreboardPublicPollInterval({},true)).toBeNull();
});
