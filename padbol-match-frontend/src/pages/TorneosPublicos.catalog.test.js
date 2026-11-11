import {readPublicTournamentCatalog} from './TorneosPublicos';
jest.mock('../supabaseClient',()=>({supabase:{}}));

test('public catalog excludes test rows server-side while retaining real Napoli and legacy NULL rows in date order',async()=>{
 const rows=[{id:39,es_prueba:true,fecha_inicio:'2027-01-01'},{id:41,es_prueba:true,fecha_inicio:'2027-02-01'},{id:48,es_prueba:true,fecha_inicio:'2027-03-01'},{id:57,es_prueba:false,fecha_inicio:'2026-11-20'},{id:12,es_prueba:null,fecha_inicio:'2026-10-01'}];
 const order=jest.fn(async(column,options)=>{expect(column).toBe('fecha_inicio');expect(options).toEqual({ascending:false});return {data:rows.filter(row=>row.es_prueba===false||row.es_prueba===null).sort((a,b)=>b.fecha_inicio.localeCompare(a.fecha_inicio)),error:null};});
 const or=jest.fn(filter=>{expect(filter).toBe('es_prueba.eq.false,es_prueba.is.null');return {order};});
 const select=jest.fn(columns=>{expect(columns).toBe('*');return {or};});const from=jest.fn(table=>{expect(table).toBe('torneos');return {select};});
 const result=await readPublicTournamentCatalog({from});
 expect(result.data.map(row=>row.id)).toEqual([57,12]);
 expect(or).toHaveBeenCalledTimes(1);expect(order).toHaveBeenCalledTimes(1);
 expect(result.data.some(row=>[39,41,48].includes(row.id))).toBe(false);
});
