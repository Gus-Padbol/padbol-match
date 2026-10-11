import {readLegacyTournamentDrawTeams} from './adminLegacyTournamentDraw';
test('configured Nations never opens legacy draw or requests its teams',async()=>{
 const read=jest.fn();await expect(readLegacyTournamentDrawTeams({id:7,plan_nations:{enabled:true}},read)).rejects.toThrow(/panel Nations Cup/);expect(read).not.toHaveBeenCalled();
 await expect(readLegacyTournamentDrawTeams({id:7,plan_nations:{}},read)).rejects.toThrow();expect(read).not.toHaveBeenCalled();
});
test('legacy draw preserves the existing team read and its unmodified roster',async()=>{
 const teams=[{id:1,jugadores:[{id:'legacy-person'}]}],read=jest.fn(async()=>teams);await expect(readLegacyTournamentDrawTeams({id:8,plan_nations:null},read)).resolves.toEqual(teams);expect(read).toHaveBeenCalledTimes(1);
});
