import {savePointsConfig} from './pointsConfigApi';
import {getAuthHeaders} from './scoreboardApi';
jest.mock('./scoreboardApi',()=>({getAuthHeaders:jest.fn()}));
const fs = require('fs');
const path = require('path');

function readSource(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

describe('acciones administrativas sensibles', () => {
  it('envía el token al eliminar torneos', () => {
    const source = readSource('../pages/AdminDashboard.jsx');
    expect(source).toMatch(
      /eliminarTorneo[\s\S]*?headers\.Authorization = `Bearer \$\{session\.access_token\}`[\s\S]*?method: 'DELETE'/,
    );

  });

  it('delegated points save authenticates the actual request and rejects anonymous writes',async()=>{
    const policy={niveles:{nacional:100},posiciones:{1:100,2:60},tipos_custom:[],niveles_labels:{},niveles_hidden:[],source:'persisted',policy_version:'a'.repeat(64)};
    const body=Object.fromEntries(['niveles','posiciones','tipos_custom','niveles_labels','niveles_hidden'].map(key=>[key,policy[key]]));
    const originalFetch=global.fetch;
    getAuthHeaders.mockResolvedValue({Authorization:'Bearer actual-session-fixture'});
    global.fetch=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({ok:true,config:policy})}).mockResolvedValueOnce({ok:true,json:async()=>policy});
    try{
      await savePointsConfig({apiBaseUrl:'https://fixture.invalid'},body);
      expect(global.fetch.mock.calls[0][1]).toMatchObject({method:'PUT',headers:{Authorization:'Bearer actual-session-fixture'}});
      getAuthHeaders.mockResolvedValue({});await expect(savePointsConfig({apiBaseUrl:'https://fixture.invalid'},body)).rejects.toThrow(/Ingresa/);expect(global.fetch).toHaveBeenCalledTimes(2);
    }finally{global.fetch=originalFetch;}
  });

  it('envía el token al finalizar un torneo', () => {
    const source = readSource('../pages/TorneoVista.jsx');
    expect(source).toMatch(
      /finalizarTorneo[\s\S]*?headers\.Authorization = `Bearer \$\{session\.access_token\}`[\s\S]*?\/finalizar/,
    );
  });
});
