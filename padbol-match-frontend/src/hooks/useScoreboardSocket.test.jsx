import {renderHook} from '@testing-library/react';
import {io} from 'socket.io-client';
import useScoreboardSocket from './useScoreboardSocket';
jest.mock('socket.io-client',()=>({io:jest.fn()}));
jest.mock('../utils/scoreboardApi',()=>({API_BASE:'https://fixture.invalid'}));
let socket;
beforeEach(()=>{socket={on:jest.fn(),emit:jest.fn(),disconnect:jest.fn(),connected:false,io:{on:jest.fn()}};io.mockReturnValue(socket);});
test('authenticated control supplies only its current session token and cleans the prior room when it changes',()=>{
 const {rerender,unmount}=renderHook(({token})=>useScoreboardSocket('00000000-0000-4000-8000-000000000001',jest.fn(),token),{initialProps:{token:'synthetic-session-A'}});
 expect(io.mock.calls[0][1].auth).toEqual({token:'synthetic-session-A'});rerender({token:'synthetic-session-B'});expect(socket.disconnect).toHaveBeenCalled();expect(io.mock.calls[1][1].auth).toEqual({token:'synthetic-session-B'});unmount();
});
test('public scoreboard retains the anonymous handshake and never receives a private control token',()=>{
 const {unmount}=renderHook(()=>useScoreboardSocket('00000000-0000-4000-8000-000000000001',jest.fn()));expect(io.mock.calls[0][1].auth).toBeUndefined();unmount();
});

test('guarded hosted QA uses the verified static polling function; production keeps the normal path',()=>{
 const previousVariant=process.env.REACT_APP_APP_VARIANT;
 const previousPolling=process.env.REACT_APP_QA_SOCKET_POLLING;
 try {
  process.env.REACT_APP_APP_VARIANT='qa';process.env.REACT_APP_QA_SOCKET_POLLING='true';
  let view=renderHook(()=>useScoreboardSocket('fixture-match',jest.fn(),'fixture-token'));
  expect(io.mock.calls.at(-1)[1]).toMatchObject({path:'/api/qa-socket',transports:['polling'],upgrade:false,addTrailingSlash:false,auth:{token:'fixture-token'}});view.unmount();
  process.env.REACT_APP_APP_VARIANT='production';
  view=renderHook(()=>useScoreboardSocket('fixture-match',jest.fn()));
  expect(io.mock.calls.at(-1)[1]).toMatchObject({path:'/socket.io',transports:['polling','websocket']});
  expect(io.mock.calls.at(-1)[1].upgrade).toBeUndefined();view.unmount();
 } finally {
  if(previousVariant===undefined)delete process.env.REACT_APP_APP_VARIANT;else process.env.REACT_APP_APP_VARIANT=previousVariant;
  if(previousPolling===undefined)delete process.env.REACT_APP_QA_SOCKET_POLLING;else process.env.REACT_APP_QA_SOCKET_POLLING=previousPolling;
 }
});
