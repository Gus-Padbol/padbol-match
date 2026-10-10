import { confirmedSelectionPlayers, isPadbolSelection, selectionTeamReady, validateSelectionLineup } from './padbolSelectionRoster';
import { jugadoresMinimosEquipoTorneo } from './torneoDeporteFormato';
import { equiposConfirmadosParaSorteo } from '../components/torneo/SorteoGruposModal';
const ids = Array.from({length:9},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const players = ids.map((id,i)=>({user_id:id,id,nombre:`QA ${i+1}`,estado:'confirmado'}));
const tournament = {deporte:'padbol',modalidad_plantel:'selecciones'};
test('only explicit Padbol selection mode changes roster minimum, never another sport or legacy doubles',()=>{
 expect(isPadbolSelection(tournament)).toBe(true);expect(jugadoresMinimosEquipoTorneo(tournament)).toBe(4);
 for(const torneo of [{deporte:'padbol'}, {deporte:'padel',modalidad_plantel:'selecciones'},{deporte:'tenis',formato_equipo:'singles',modalidad_plantel:'selecciones'}]) expect(isPadbolSelection(torneo)).toBe(false);
 expect(jugadoresMinimosEquipoTorneo({deporte:'padbol'})).toBe(2);expect(jugadoresMinimosEquipoTorneo({deporte:'tenis',formato_equipo:'singles'})).toBe(1);
});
test('maximum eight is not a requirement to fill eight; four confirmed players qualify even with capacity eight',()=>{
 const team={id:1,cupo_maximo:8,inscripcion_estado:'confirmado',jugadores:players.slice(0,4)};
 expect(selectionTeamReady(team,tournament)).toBe(true);expect(equiposConfirmadosParaSorteo([team],tournament)).toEqual([team]);
 expect(equiposConfirmadosParaSorteo([{...team,inscripcion_estado:'pendiente'}],tournament)).toEqual([]);expect(equiposConfirmadosParaSorteo([team])).toEqual([]);expect(selectionTeamReady({...team,jugadores:players.slice(0,3)},tournament)).toBe(false);
 expect(selectionTeamReady({...team,jugadores:players.slice(0,8)},tournament)).toBe(true);expect(selectionTeamReady({...team,jugadores:players},tournament)).toBe(false);
});
test('duplicate, pending and unidentified players never satisfy confirmed roster readiness',()=>{
 for(const list of [[...players.slice(0,3),players[0]], [...players.slice(0,3),{...players[3],estado:'pendiente'}],[...players.slice(0,3),{nombre:'No ID'}]]) expect(selectionTeamReady({jugadores:list},tournament)).toBe(false);
 expect(confirmedSelectionPlayers(JSON.stringify(players.slice(0,4)))).toHaveLength(4);
});
test('match declaration chooses exactly four different confirmed roster UUIDs, separate from roster',()=>{
 const original=JSON.stringify(players);expect(validateSelectionLineup({iniciales:ids.slice(0,2),suplentes:ids.slice(2,4)},players)).toEqual({iniciales:ids.slice(0,2),suplentes:ids.slice(2,4)});expect(JSON.stringify(players)).toBe(original);
 for(const lineup of [{iniciales:[ids[0]],suplentes:ids.slice(1,3)},{iniciales:ids.slice(0,2),suplentes:[ids[0],ids[3]]},{iniciales:ids.slice(0,2),suplentes:[ids[2],ids[8]]},{iniciales:['not-a-player',ids[1]],suplentes:ids.slice(2,4)}]) expect(()=>validateSelectionLineup(lineup,players.slice(0,8))).toThrow();
});
