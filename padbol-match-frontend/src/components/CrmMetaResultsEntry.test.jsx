import React from 'react';
import {render, screen, act, cleanup} from '@testing-library/react';
import CrmMetaResultsEntry from './CrmMetaResultsEntry';
let mockSession={access_token:'synthetic-a'};
jest.mock('../context/AuthContext',()=>({useAuth:()=>({session:mockSession})}));
const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
afterEach(()=>{cleanup();mockSession={access_token:'synthetic-a'};jest.restoreAllMocks();});
test('backend-confirmed Meta access exposes only the existing panel route',async()=>{
 global.fetch=jest.fn().mockResolvedValue(response({canRead:true}));render(<CrmMetaResultsEntry/>);
 expect((await screen.findByRole('link',{name:'Resultados de Meta'})).getAttribute('href')).toBe('/contenido-campanas?view=meta');
 expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][1].method).toBe('GET');
});
test('denied commercial account gains no entry',async()=>{
 global.fetch=jest.fn().mockResolvedValue(response({},403));await act(async()=>render(<CrmMetaResultsEntry/>));
 expect(screen.queryByRole('link')).toBeNull();expect(fetch).toHaveBeenCalledTimes(1);
});
test('loading exposes no entry',()=>{
 global.fetch=jest.fn(()=>new Promise(()=>{}));render(<CrmMetaResultsEntry/>);expect(screen.queryByRole('link')).toBeNull();
});
test('runtime error exposes no entry or operational success',async()=>{
 global.fetch=jest.fn().mockRejectedValue(Error('synthetic offline'));await act(async()=>render(<CrmMetaResultsEntry/>));expect(screen.queryByRole('link')).toBeNull();
});
test('logout removes confirmed access without a new query',async()=>{
 global.fetch=jest.fn().mockResolvedValue(response({canRead:true}));const view=render(<CrmMetaResultsEntry/>);await screen.findByRole('link');
 mockSession=null;view.rerender(<CrmMetaResultsEntry/>);expect(screen.queryByRole('link')).toBeNull();expect(fetch).toHaveBeenCalledTimes(1);
});
test('late permission response cannot unlock a replacement session',async()=>{
 let resolve;global.fetch=jest.fn().mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue(response({},403));const view=render(<CrmMetaResultsEntry/>);
 mockSession={access_token:'synthetic-b'};await act(async()=>view.rerender(<CrmMetaResultsEntry/>));await act(async()=>resolve(response({canRead:true})));
 expect(screen.queryByRole('link')).toBeNull();expect(fetch).toHaveBeenCalledTimes(2);
});
