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

 for(const g of ['A','B','C'])expect(screen.getByText(`Grupo ${g}`)).toBeInTheDocument();
 expect(screen.getByText('Rumania')).toBeInTheDocument();
 expect(screen.getByText('Italia')).toBeInTheDocument();
 expect(screen.queryByText(/Las posiciones aún no están disponibles/)).toBeInTheDocument();
 expect(screen.getAllByRole('table')).toHaveLength(3);
});

test('each confirmed country contains only its actual public players, including all seven Italian names',()=>{
 const participants=[{selectionId:'ro1',country:'RO',name:'Romanian player'},...Array.from({length:7},(_,i)=>({selectionId:`it${i}`,country:'IT',name:`Italian player ${i}`})),{selectionId:'other',country:'DE',name:'Other group player'}];
 const {container}=render(<NationsStandings participants={participants} data={{config:{country_by_team:{282:'RO',294:'IT'}},groups:[{label:'C',team_ids:[282,294]}],teams:[{id:282,nombre:'Rumania'},{id:294,nombre:'Italia'}],standings:[]}}/>);
 const rows=container.querySelectorAll('tbody tr');
 expect(rows[0]).toHaveTextContent('Romanian player');expect(rows[0]).not.toHaveTextContent('Italian player');
 for(let i=0;i<7;i++)expect(rows[1]).toHaveTextContent(`Italian player ${i}`);
 expect(screen.queryByText('Other group player')).not.toBeInTheDocument();
 expect(screen.queryByText('282')).not.toBeInTheDocument();
 expect(container.textContent).not.toContain('undefined');
});
