import React from 'react';
import {render,screen} from '@testing-library/react';
import ScoreboardScoreBug from './ScoreboardScoreBug';
import ScoreboardWinnerScreen from './ScoreboardWinnerScreen';
import ScoreboardPartialCorrection from '../ScoreboardPartialCorrection';
const scoring_policy={id:'napoli_groups_super_tiebreak_10_v1',phase:'groups',best_of:3,deciding_set:'super_tiebreak',target:10,win_by:1};
const historial_sets=[{set:1,a:6,b:4},{set:2,a:3,b:6},{set:3,a:1,b:0,type:'super_tiebreak',points_a:10,points_b:9,target:10,win_by:1}];
const partido={id:'offline',equipo_a_nombre:'Italy',equipo_b_nombre:'Spain',sets_a:2,sets_b:1,estado:'terminado',historial_sets,display:{displayA:0,displayB:0},scoring_policy};
test('winner and broadcast overlay retain explicit STB point result',()=>{
 const {container,unmount}=render(<ScoreboardWinnerScreen partido={partido}/>);
 expect(container.querySelector('.sb-winner-sets').textContent).toContain('10 — 9 (STB)');unmount();
 const next=render(<ScoreboardScoreBug partido={partido}/>);
 expect(next.container.querySelector('.sb-scorebug__row--a').textContent).toContain('10 (STB)');
 expect(next.container.querySelector('.sb-scorebug__row--b').textContent).toContain('9 (STB)');
});
test('legacy correction cannot strip typed history or alter server policy',()=>{
 const onConfirm=jest.fn();const {rerender}=render(<ScoreboardPartialCorrection partido={partido} onConfirm={onConfirm}/>);
 expect(screen.queryByRole('button',{name:'Corregir marcador parcial'})).toBeNull();
 rerender(<ScoreboardPartialCorrection partido={{...partido,scoring_policy:null}} onConfirm={onConfirm}/>);
 expect(screen.queryByRole('button',{name:'Corregir marcador parcial'})).toBeNull();expect(onConfirm).not.toHaveBeenCalled();
 rerender(<ScoreboardPartialCorrection partido={{...partido,scoring_policy:null,historial_sets:[]}} onConfirm={onConfirm}/>);
 expect(screen.getByRole('button',{name:'Corregir marcador parcial'})).toBeEnabled();
 rerender(<ScoreboardPartialCorrection partido={{...partido,historial_sets:historial_sets.slice(0,2)}} onConfirm={onConfirm}/>);expect(screen.getByRole('button',{name:'Corregir marcador parcial'})).toBeEnabled();
 rerender(<ScoreboardPartialCorrection partido={{...partido,historial_sets:[],display:{mode:'super_tiebreak',displayA:0,displayB:0}}} onConfirm={onConfirm}/>);expect(screen.queryByRole('button',{name:'Corregir marcador parcial'})).toBeNull();
});
