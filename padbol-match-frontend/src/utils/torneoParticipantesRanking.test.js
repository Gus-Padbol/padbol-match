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
