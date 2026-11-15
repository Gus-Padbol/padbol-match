import React from 'react';
import {render, screen, act, fireEvent} from '@testing-library/react';
import NationsPostmatchAnalysis from './NationsPostmatchAnalysis';
jest.mock('../../i18n/tSafe',()=>({useSafeTranslation:()=>({t:key=>key})}));
const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
const ready=summary=>response(200,{state:'ready',resumen:{summary,highlights:[{text:'Observed result'}],observed:{players:[{name:'A1',team:'A',points_observed:4,on_court_seconds:95}]}}});
const flush=async()=>{await act(async()=>{await Promise.resolve();await Promise.resolve();});};
beforeEach(()=>{jest.useFakeTimers();global.fetch=jest.fn();});
afterEach(()=>{jest.useRealTimers();});
test('polls queued match through ready, renders observed facts and keeps ready on failed refresh',async()=>{
 global.fetch.mockResolvedValueOnce(response(202,{state:'queued'})).mockResolvedValueOnce(ready('Analysis A'));
 render(<NationsPostmatchAnalysis partidoId={57} accessToken="test" apiBaseUrl="https://api.example.invalid"/>);
 await flush();expect(screen.getByRole('status')).toHaveTextContent('nationsPostmatch.pending');
 await act(async()=>{jest.advanceTimersByTime(5000);});await flush();
 expect(screen.getByText('Analysis A')).toBeInTheDocument();expect(screen.getByText(/1:35/)).toBeInTheDocument();
 expect(global.fetch.mock.calls.map(([url])=>url)).toEqual(Array(2).fill('https://api.example.invalid/api/nations/partidos/57/resumen'));
 global.fetch.mockRejectedValueOnce(new Error('offline'));
 fireEvent.click(screen.getByRole('button'));await flush();
 expect(screen.getByText('Analysis A')).toBeInTheDocument();expect(screen.getByRole('alert')).toHaveTextContent('nationsPostmatch.failed');
});
test('polling is bounded and can be restarted explicitly',async()=>{
 global.fetch.mockResolvedValue(response(202,{state:'generating'}));
 render(<NationsPostmatchAnalysis partidoId={57} accessToken="test"/>);await flush();
 for(let n=0;n<11;n++){await act(async()=>{jest.advanceTimersByTime(5000);});await flush();}
 expect(global.fetch).toHaveBeenCalledTimes(12);expect(screen.getByRole('button')).toBeEnabled();
 await act(async()=>{jest.advanceTimersByTime(60000);});expect(global.fetch).toHaveBeenCalledTimes(12);
 fireEvent.click(screen.getByRole('button'));await flush();expect(global.fetch).toHaveBeenCalledTimes(13);
});
test.each(['insufficient','uncertain'])('renders explicit %s without inventing a summary',async state=>{
 global.fetch.mockResolvedValue(response(409,{state}));render(<NationsPostmatchAnalysis partidoId={57} accessToken="test"/>);await flush();
 expect(screen.getByRole('note')).toHaveTextContent('nationsPostmatch.'+state);
});
test('old account or match response cannot replace current match; logout clears summary',async()=>{
 const pending=[];global.fetch.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
 const view=render(<NationsPostmatchAnalysis partidoId={57} accessToken="a"/>);await flush();
 view.rerender(<NationsPostmatchAnalysis partidoId={58} accessToken="b"/>);await flush();
 await act(async()=>{pending[1](ready('B'));});await flush();
 await act(async()=>{pending[0](ready('A'));});await flush();expect(screen.getByText('B')).toBeInTheDocument();expect(screen.queryByText('A')).toBeNull();
 view.rerender(<NationsPostmatchAnalysis partidoId={58} accessToken={null}/>);await flush();expect(screen.queryByText('B')).toBeNull();expect(screen.getByRole('note')).toHaveTextContent('nationsPostmatch.signIn');expect(global.fetch).toHaveBeenCalledTimes(2);
});
