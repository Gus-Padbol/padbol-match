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
 expect(result.current.pending).toBeNull();expect(result.current.error).toMatch(/odd-numbered game/);expect(client.read).toHaveBeenCalledTimes(2);
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

test('acknowledged save with a failed refresh is never retried; it stays locked until authoritative refresh succeeds',async()=>{
 const {result}=renderHook(()=>useNationsReferee({scoreboardId:'one'}));await waitFor(()=>expect(result.current.loading).toBe(false));
 client.send.mockResolvedValueOnce({revision:3});client.read.mockRejectedValueOnce(new Error('refresh down'));
 await act(async()=>{expect(await result.current.act('substitution',{swaps:[]})).toBe(true);});
 expect(result.current.snapshot).toBe(snapshot);expect(result.current.pending).toBeNull();expect(result.current.syncing).toBe(true);expect(result.current.error).toMatch(/Saved/);
 await act(async()=>{expect(await result.current.act('retry')).toBe(false);});expect(client.send).toHaveBeenCalledTimes(1);
 client.read.mockResolvedValueOnce({...snapshot,revision:3});await act(async()=>{await result.current.refresh();});
 expect(result.current.syncing).toBe(false);expect(result.current.error).toBe('');expect(result.current.snapshot.revision).toBe(3);
});

test('a slow periodic read is not starved by subsequent five-second polls',async()=>{
 jest.useFakeTimers();let finish;
 try {
  const {result,unmount}=renderHook(()=>useNationsReferee({scoreboardId:'one'}));await act(async()=>{});
  client.read.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  await act(async()=>{jest.advanceTimersByTime(5000);});expect(client.read).toHaveBeenCalledTimes(2);
  await act(async()=>{jest.advanceTimersByTime(15000);});expect(client.read).toHaveBeenCalledTimes(2);
  await act(async()=>{finish({...snapshot,revision:5});});expect(result.current.snapshot.revision).toBe(5);
  await act(async()=>{jest.advanceTimersByTime(5000);});expect(client.read).toHaveBeenCalledTimes(3);unmount();
 }finally{jest.useRealTimers();}
});
test('a pre-command poll cannot confirm or replace the fresh post-acknowledgement snapshot',async()=>{
 jest.useFakeTimers();let finishRead,finishSend;
 try {
  const {result,unmount}=renderHook(()=>useNationsReferee({scoreboardId:'one'}));await act(async()=>{});
  client.read.mockImplementationOnce(()=>new Promise(resolve=>{finishRead=resolve;})).mockResolvedValueOnce({...snapshot,revision:3});
  await act(async()=>{jest.advanceTimersByTime(5000);});
  client.send.mockImplementationOnce(()=>new Promise(resolve=>{finishSend=resolve;}));
  let action;act(()=>{action=result.current.act('substitution',{swaps:[]});});
  await act(async()=>{finishRead({...snapshot,revision:99});});expect(result.current.snapshot.revision).toBe(2);
  await act(async()=>{finishSend({revision:3});await action;});
  expect(client.read).toHaveBeenCalledTimes(3);expect(result.current.snapshot.revision).toBe(3);expect(result.current.syncing).toBe(false);unmount();
 }finally{jest.useRealTimers();}
});

test('green substitution acknowledgement appears only after send succeeds and clears four seconds after refresh',async()=>{
 let finishSend,finishRead;const {result,unmount}=renderHook(()=>useNationsReferee({scoreboardId:'one'}));await waitFor(()=>expect(result.current.loading).toBe(false));
 jest.useFakeTimers();try{
  client.send.mockImplementationOnce(()=>new Promise(resolve=>{finishSend=resolve;}));client.read.mockImplementationOnce(()=>new Promise(resolve=>{finishRead=resolve;}));
  let action;act(()=>{action=result.current.act('substitution',{swaps:[]});});expect(result.current.feedback).toBe('Saving change…');
  await act(async()=>{finishSend({revision:3});});expect(result.current.feedback).toBe('Substitution saved.');expect(result.current.syncing).toBe(true);
  await act(async()=>{finishRead({...snapshot,revision:3});await action;});expect(result.current.feedback).toBe('Substitution saved.');
  await act(async()=>{jest.advanceTimersByTime(4000);});expect(result.current.feedback).toBe('');unmount();
 }finally{jest.useRealTimers();}
});

test('point acknowledgement displays the committed score before the slower full refresh, keeping mutations locked',async()=>{
 const before={...snapshot,board:{id:'board',score_a:0,score_b:0,games_a:1,games_b:0,sets_a:0,sets_b:0,estado:'en_curso',display:{displayA:'0',displayB:'0'}},coherent:true,window:{allowed:true}};
 const acknowledgement={...before.board,score_a:1,display:{displayA:'15',displayB:'0'},gamesEpoch:1};
 client.read.mockResolvedValueOnce(before);client.attempt.mockReturnValueOnce({path:'/api/scoreboard/control/private/punto/A',body:{requestId:'same',epoch:1}});
 const {result}=renderHook(()=>useNationsReferee({scoreboardId:'board'}));await waitFor(()=>expect(result.current.loading).toBe(false));
 let finishRead;client.send.mockResolvedValueOnce(acknowledgement);client.read.mockImplementationOnce(()=>new Promise(resolve=>{finishRead=resolve;}));
 let action;await act(async()=>{action=result.current.act('point',{side:'A'});});
 expect(result.current.snapshot.board.display.displayA).toBe('15');expect(result.current.snapshot.coherent).toBe(false);expect(result.current.snapshot.window).toBeNull();expect(result.current.busy).toBe(true);expect(result.current.syncing).toBe(true);
 await act(async()=>{finishRead({...before,board:acknowledgement,revision:3});await action;});expect(result.current.snapshot.coherent).toBe(true);expect(client.send).toHaveBeenCalledTimes(1);
});

test.each(['wrong board','wrong epoch','missing display','partial score'])('point response %s cannot replace the displayed score',async kind=>{
 const before={...snapshot,board:{id:'board',score_a:0,score_b:0,games_a:1,games_b:0,sets_a:0,sets_b:0,estado:'en_curso',display:{displayA:'0',displayB:'0'}},coherent:true};
 const ack={...before.board,score_a:1,display:{displayA:'15',displayB:'0'},gamesEpoch:1};
 if(kind==='wrong board')ack.id='other';if(kind==='wrong epoch')ack.gamesEpoch=2;if(kind==='missing display')delete ack.display;if(kind==='partial score')delete ack.sets_a;
 client.read.mockResolvedValueOnce(before);client.attempt.mockReturnValueOnce({path:'/api/scoreboard/control/private/punto/A',body:{requestId:'same',epoch:1}});
 const {result}=renderHook(()=>useNationsReferee({scoreboardId:'board'}));await waitFor(()=>expect(result.current.loading).toBe(false));
 let finishRead;client.send.mockResolvedValueOnce(ack);client.read.mockImplementationOnce(()=>new Promise(resolve=>{finishRead=resolve;}));
 let action;await act(async()=>{action=result.current.act('point',{side:'A'});});expect(result.current.snapshot.board.score_a).toBe(0);
 await act(async()=>{finishRead(before);await action;});expect(client.send).toHaveBeenCalledTimes(1);
});
