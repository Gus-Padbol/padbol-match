import { resolverOfertasCanonicas, resolverOfertasLegacy } from './reservaOfertasCanonicas';
test('prioriza deporte activo, conserva base activa y excluye duración inactiva',()=>{
 const rows=[{duracion_minutos:60,precio:20000,deporte:null},{duracion_minutos:60,precio:26000,deporte:'padbol'}, {duracion_minutos:90,precio:24000,deporte:'padbol'}, {duracion_minutos:120,precio:30000,deporte:null,activo:false},{duracion_minutos:60,precio:1,deporte:'tenis'}];
 expect(resolverOfertasCanonicas(rows,'padbol')).toEqual([{duracion_minutos:60,precio:26000},{duracion_minutos:90,precio:24000}]);
});

test('solo la ruta legacy usa precios anteriores sin rescatar ofertas antiguas',()=>{
 expect(resolverOfertasLegacy({precio_60min:25000,precio_90min:30000,duraciones_oferta:[{duracion_minutos:120,precio:1}]})).toEqual([{duracion_minutos:60,precio:25000},{duracion_minutos:90,precio:30000}]);
});
