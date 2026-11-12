import React from 'react';
import {render,screen,within} from '@testing-library/react';
import ScoreboardBoard from './ScoreboardBoard';
import {fetchJugadoresTemp} from '../../utils/scoreboardApi';
jest.mock('../../i18n/tSafe',()=>({useSafeTranslation:()=>({i18n:{language:'en'},t:key=>key})}));
jest.mock('../../utils/scoreboardApi',()=>({fetchJugadoresTemp:jest.fn(async()=>[])}));
const team=prefix=>[1,2,3,4].map(n=>({nombre:`QA ${prefix} 0${n}`,role:n<=2?'on_court':'bench',foto_url:'https://private.invalid/personal.jpg'}));
const board={id:'60ccb50a-7556-4920-9fd9-dd7ccb6244e9',nations_lineup_status:'current',estado:'en_curso',torneo_nombre:'QA SYNTHETIC',equipo_a_nombre:'QA A',equipo_b_nombre:'QA B',equipo_a_jugadores:team('AE'),equipo_b_jugadores:team('AT'),display:{displayA:'0',displayB:'0'},games_a:1,games_b:0,sets_a:0,sets_b:0};
let previous;
beforeEach(()=>{previous=process.env.REACT_APP_APP_VARIANT;process.env.REACT_APP_APP_VARIANT='qa';jest.clearAllMocks();});
afterEach(()=>{if(previous===undefined)delete process.env.REACT_APP_APP_VARIANT;else process.env.REACT_APP_APP_VARIANT=previous;});
test('public demo shows the same fictional names, larger on-court portraits and separate bench from server roles',()=>{
 const original=JSON.stringify(board);const {container,rerender}=render(<ScoreboardBoard partido={board} timerSeconds={45}/>);
 const court=screen.getAllByRole('list',{name:'On court'}),bench=screen.getAllByRole('list',{name:'Bench'});
 expect(court).toHaveLength(2);expect(bench).toHaveLength(2);expect(within(court[0]).getByText('Marco Rossi')).toBeInTheDocument();expect(within(bench[0]).getByText('Paolo Conti')).toBeInTheDocument();
 expect(screen.getAllByRole('img',{name:/Demo portrait of/})).toHaveLength(8);expect(container.querySelector('img[src="https://private.invalid/personal.jpg"]')).toBeNull();expect(fetchJugadoresTemp).not.toHaveBeenCalled();
 const swapped={...board,equipo_a_jugadores:board.equipo_a_jugadores.map(p=>({...p,role:p.role==='on_court'?'bench':'on_court'}))};
 rerender(<ScoreboardBoard partido={swapped} timerSeconds={46}/>);
 expect(within(screen.getAllByRole('list',{name:'On court'})[0]).getByText('Paolo Conti')).toBeInTheDocument();expect(within(screen.getAllByRole('list',{name:'Bench'})[0]).getByText('Marco Rossi')).toBeInTheDocument();expect(JSON.stringify(board)).toBe(original);
});
test('real boards never receive fictional names, demo portraits, or private profile photos',()=>{
 const {container}=render(<ScoreboardBoard partido={{...board,id:'real-board'}}/>);
 expect(screen.queryByRole('img',{name:/Demo portrait of/})).toBeNull();expect(screen.queryByText('Marco Rossi')).toBeNull();expect(container.querySelector('img[src="https://private.invalid/personal.jpg"]')).toBeNull();
});
