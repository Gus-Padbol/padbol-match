import React from 'react';
import {act,render,screen,within} from '@testing-library/react';
import ScoreboardBoard from './ScoreboardBoard';
jest.mock('../../utils/scoreboardApi',()=>({fetchJugadoresTemp:jest.fn(async()=>[])}));
const policy={id:'napoli_groups_super_tiebreak_10_v1',phase:'groups',best_of:3,deciding_set:'super_tiebreak',target:10,win_by:1};
const board={id:'offline-fixture',equipo_a_nombre:'Italy',equipo_b_nombre:'Spain',equipo_a_jugadores:[],equipo_b_jugadores:[],estado:'en_curso',sets_a:1,sets_b:1,games_a:0,games_b:0,scoring_policy:policy,historial_sets:[{set:1,a:6,b:2},{set:2,a:3,b:6}],display:{mode:'super_tiebreak',displayA:9,displayB:9},es_tiebreak:false};
test('production TV shows trusted STB numeric points, ordinary knockout and typed final history',async()=>{
 const {container,rerender}=render(<ScoreboardBoard partido={board}/>);
 expect(screen.getByText('Super tie-break · First to 10')).toBeInTheDocument();
 expect(within(container.querySelector('.sb-sets-history')).getByText('STB')).toBeInTheDocument();
 expect(container.querySelector('.sb-sets-history')).toHaveTextContent('9 – 9');
 rerender(<ScoreboardBoard partido={{...board,scoring_policy:null,es_tiebreak:true,display:{mode:'tiebreak',displayA:6,displayB:6}}}/>);
 expect(screen.queryByText('Super tie-break · First to 10')).toBeNull();expect(screen.getByText('Tie-Break')).toBeInTheDocument();
 expect(within(container.querySelector('.sb-sets-history')).queryByText('STB')).toBeNull();
 rerender(<ScoreboardBoard partido={{...board,estado:'finalizado',sets_a:2,historial_sets:[...board.historial_sets,{set:3,a:1,b:0,type:'super_tiebreak',points_a:10,points_b:9,target:10,win_by:1}]}}/>);
 expect(container.querySelector('.sb-sets-history')).toHaveTextContent('STB10 – 9');
 await act(async()=>{});
});
