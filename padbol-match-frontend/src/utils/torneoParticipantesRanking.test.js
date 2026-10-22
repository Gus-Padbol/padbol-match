import { equipoReconoceParticipacionJugador } from './torneoHistorialPuntosJugador';
jest.mock('../supabaseClient',()=>({supabase:{}}));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const roster=Array.from({length:8},(_,i)=>({id:id(i+1),nombre:`Jugador QA ${i+1}`,email:`qa${i+1}@fixture.invalid`}));
const equipo={modalidad_plantel:'selecciones',jugadores:roster,participantes_ranking:roster.slice(0,4).map(p=>p.id)};
test('only persisted declared participants receive profile recognition, not the other four roster members',()=>{roster.forEach((p,i)=>expect(equipoReconoceParticipacionJugador(equipo,{user_id:p.id,email:p.email,nombre:p.nombre})).toBe(i<4));});
test('selection identity does not fallback to email, alias or name and unknown ledger does not invent credit',()=>{
 expect(equipoReconoceParticipacionJugador(equipo,{email:roster[0].email,nombre:roster[0].nombre})).toBe(false);
 expect(equipoReconoceParticipacionJugador({...equipo,participantes_ranking:null},{user_id:id(1)})).toBe(false);
 expect(equipoReconoceParticipacionJugador({...equipo,participantes_ranking:[id(5)]},{user_id:id(1),email:roster[0].email})).toBe(false);
});
test('legacy two-player recognition remains unchanged',()=>{expect(equipoReconoceParticipacionJugador({modalidad_plantel:'dobles',jugadores:roster.slice(0,2)},{email:roster[0].email})).toBe(true);expect(equipoReconoceParticipacionJugador({jugadores:roster.slice(0,2)},{user_id:id(2)})).toBe(true);});

test('selection profile history is read from the sanitized ledger API, not other teams rosters',async()=>{
 const {fetchSelectionPointsForProfile}=require('./torneoHistorialPuntosJugador');
 const uid='00000000-0000-4000-8000-000000000001';global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({ok:true,jugador_id:uid,items:[{torneo_id:7,equipo_id:1,user_id:uid,torneo_nombre:'QA',fecha:'2026-11-22',posicion:1,puntos:300,nivel:'internacional',ranking_origen:'padbol_match_interno',ranking_oficial:false}]})});
 expect(await fetchSelectionPointsForProfile({user_id:uid})).toEqual([expect.objectContaining({torneo_id:7,puntos:300,nombreTorneo:'QA'})]);expect(fetch.mock.calls[0][0]).toContain(`/api/jugadores/${uid}/torneos-puntos`);
 fetch.mockResolvedValue({ok:true,json:async()=>({ok:true,jugador_id:uid,items:[{user_id:'different',ranking_oficial:false,ranking_origen:'padbol_match_interno'}]})});await expect(fetchSelectionPointsForProfile({user_id:uid})).rejects.toThrow();
});

test('unavailable selection history preserves confirmed legacy records and reports incomplete history',async()=>{
 const {combineProfileHistory}=require('./torneoHistorialPuntosJugador');const legacy=[{torneo_id:1,puntos:30},{torneo_id:2,puntos:20}],notice=jest.fn();
 expect(await combineProfileHistory(Promise.resolve(legacy),Promise.reject(new Error('503')),notice)).toEqual(legacy);expect(notice).toHaveBeenCalledTimes(1);
});
