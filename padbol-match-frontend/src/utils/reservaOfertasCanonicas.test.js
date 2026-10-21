import { resolverOfertasCanonicas } from './reservaOfertasCanonicas';
test('prioriza deporte activo, conserva base activa y excluye duración inactiva',()=>{
 const rows=[{duracion_minutos:60,precio:20000,deporte:null},{duracion_minutos:60,precio:26000,deporte:'padbol'}, {duracion_minutos:90,precio:24000,deporte:'padbol'}, {duracion_minutos:120,precio:30000,deporte:null,activo:false},{duracion_minutos:60,precio:1,deporte:'tenis'}];
 expect(resolverOfertasCanonicas(rows,'padbol')).toEqual([{duracion_minutos:60,precio:26000},{duracion_minutos:90,precio:24000}]);
});
