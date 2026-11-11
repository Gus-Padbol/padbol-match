import React from 'react';
import {render, screen} from '@testing-library/react';
import NationsStandings from './NationsStandings';
jest.mock('../../i18n/tSafe',()=>({useSafeTranslation:()=>({i18n:{language:'es'}})}));
test('renders confirmed standings, thirds and seeded qualifiers without client recalculation',()=>{
 const row={equipo_id:5,group:'A',position:3,seed:7,jugados:4,puntos:8,diferencia_sets:2,sets_favor:6,diferencia_games:12,games_favor:40};
 render(<NationsStandings data={{teams:[{id:5,nombre:'Equipo confirmado'}],standings:[{group:'A',rows:[row]}],thirds:[row],qualified:[row]}}/>);
 expect(screen.getByText('Posiciones del grupo A')).toBeInTheDocument();
 expect(screen.getAllByText('Equipo confirmado')).toHaveLength(3);
 expect(screen.getAllByRole('table')).toHaveLength(3);
 expect(screen.getByText('Comparación de terceros')).toBeInTheDocument();
});
test('missing state remains explicit instead of invented standings',()=>{
 render(<NationsStandings data={null}/>);expect(screen.getByRole('status')).toHaveTextContent('Consultando posiciones confirmadas');expect(screen.queryByRole('table')).toBeNull();
});


test('muestra los grupos A/B/C guardados antes de resultados, sin inventar posiciones',()=>{
 const groups=[{label:'A',team_ids:[282,290]},{label:'B',team_ids:[292,280]},{label:'C',team_ids:[284,294]}];
 const teams=[{id:282,nombre:'Rumania'},{id:290,nombre:'Alemania'},{id:292,nombre:'Portugal'},{id:280,nombre:'Catar'},{id:284,nombre:'España'},{id:294,nombre:'Italia'}];
 render(<NationsStandings data={{groups,teams,standings:[]}}/>);
 expect(screen.getByText('Grupos del sorteo')).toBeInTheDocument();
 for(const g of ['A','B','C'])expect(screen.getByText(`Grupo ${g}`)).toBeInTheDocument();
 expect(screen.getByText('Rumania')).toBeInTheDocument();
 expect(screen.getByText('Italia')).toBeInTheDocument();
 expect(screen.queryByText(/Las posiciones aún no están disponibles/)).toBeInTheDocument();
 expect(screen.queryByRole('table')).toBeNull();
});
