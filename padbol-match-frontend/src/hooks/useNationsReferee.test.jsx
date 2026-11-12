import {act,renderHook,waitFor} from '@testing-library/react';
import useNationsReferee from './useNationsReferee';
import {createNationsRefereeClient} from '../utils/nationsRefereeClient';
jest.mock('../utils/apiPublicBaseUrl',()=>({getApiBaseUrl:()=>''}));
jest.mock('../utils/nationsRefereeClient',()=>({createNationsRefereeClient:jest.fn()}));
const snapshot={mode:'nations',epoch:1,revision:2};
let client;
beforeEach(()=>{jest.clearAllMocks();client={read:jest.fn(async()=>snapshot),attempt:jest.fn((kind,s,payload)=>({path:'fixed',body:{kind,...payload,epoch:s.epoch}})),send:jest.fn()};createNationsRefereeClient.mockReturnValue(client);});
test('uncertain submission retains exact frozen batch despite edited intent and successful polling',async()=>{
 const {result}=renderHook(()=>useNationsReferee({scoreboardId:'one'}));await waitFor(()=>expect(result.current.loading).toBe(false));
 client.send.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({});
 await act(async()=>{await result.current.act('substitution',{swaps:[{outId:'a',inId:'b'}]});});
 const original=client.send.mock.calls[0][0];expect(result.current.pending).toBe(original);expect(result.current.error).not.toBe('');
 await act(async()=>{await result.current.refresh();});expect(result.current.pending).toBe(original);expect(result.current.error).not.toBe('');
 await act(async()=>{await result.current.act('retry',{swaps:[{outId:'changed',inId:'changed'}]});});
 expect(client.attempt).toHaveBeenCalledTimes(1);expect(client.send.mock.calls[1][0]).toBe(original);expect(result.current.pending).toBeNull();
});
test('definitive conflict refreshes state, preserves visible explanation, then allows a new intent',async()=>{
 const {result}=renderHook(()=>useNationsReferee({scoreboardId:'one'}));await waitFor(()=>expect(result.current.loading).toBe(false));
 client.send.mockRejectedValueOnce({status:409,code:'CHANGE_ENDS_REQUIRED'});
 await act(async()=>{await result.current.act('substitution',{swaps:[]});});
 expect(result.current.pending).toBeNull();expect(result.current.error).toMatch(/game impar/);expect(client.read).toHaveBeenCalledTimes(2);
});
test('changing credential discards previous operation and late response cannot replace new board',async()=>{
 let finish;client.send.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const next={...client,read:jest.fn(async()=>({...snapshot,epoch:3})),send:jest.fn()};
 const {result,rerender}=renderHook(({id})=>useNationsReferee({scoreboardId:id}),{initialProps:{id:'one'}});await waitFor(()=>expect(result.current.loading).toBe(false));
 let pending;act(()=>{pending=result.current.act('point',{side:'A'});});
 createNationsRefereeClient.mockReturnValue(next);rerender({id:'two'});await waitFor(()=>expect(result.current.snapshot?.epoch).toBe(3));
 await act(async()=>{finish({});await pending;});expect(result.current.snapshot.epoch).toBe(3);expect(result.current.pending).toBeNull();expect(result.current.busy).toBe(false);
});
test('ordinary bearer refresh preserves uncertain intent while requests can use the latest credential',async()=>{
 const {result,rerender}=renderHook(({bearer})=>useNationsReferee({scoreboardId:'one',authUserId:'same-user',accessToken:bearer}),{initialProps:{bearer:'first'}});await waitFor(()=>expect(result.current.loading).toBe(false));
 client.send.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({});
 await act(async()=>{await result.current.act('point',{side:'A'});});const original=result.current.pending;
 rerender({bearer:'refreshed'});expect(createNationsRefereeClient).toHaveBeenCalledTimes(1);expect(createNationsRefereeClient.mock.calls[0][0].getAccessToken()).toBe('refreshed');
 await act(async()=>{await result.current.act('retry');});expect(client.send.mock.calls[1][0]).toBe(original);
});

test('point refresh retains server STB policy and terminal typed history without local result inference',async()=>{
 const scoring_policy={id:'napoli_groups_super_tiebreak_10_v1',phase:'groups',best_of:3,deciding_set:'super_tiebreak',target:10,win_by:1};
 const before={...snapshot,board:{id:'board',sets_a:1,sets_b:1,score_a:9,score_b:9,scoring_policy,display:{mode:'super_tiebreak',displayA:9,displayB:9}}};
 const after={...before,revision:3,board:{...before.board,sets_a:2,score_a:0,score_b:0,estado:'terminado',display:{displayA:0,displayB:0},historial_sets:[{set:3,a:1,b:0,type:'super_tiebreak',points_a:10,points_b:9,target:10,win_by:1}]}};
 client.read.mockResolvedValueOnce(before).mockResolvedValueOnce(after);client.send.mockResolvedValueOnce({});
 const {result}=renderHook(()=>useNationsReferee({scoreboardId:'board'}));await waitFor(()=>expect(result.current.loading).toBe(false));
 await act(async()=>{await result.current.act('point',{side:'A'});});
 expect(client.send).toHaveBeenCalledTimes(1);expect(result.current.snapshot.board).toEqual(after.board);
 expect(result.current.snapshot.board.historial_sets[0].a).toBe(1);expect(result.current.snapshot.board.historial_sets[0].points_b).toBe(9);
});
