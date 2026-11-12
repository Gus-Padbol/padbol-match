import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import NationsRefereeLink from './NationsRefereeLink';
import {issueRefereeControlLink} from '../../utils/refereeControlLink';
import {getAuthHeaders} from '../../utils/scoreboardApi';
jest.mock('../../utils/scoreboardApi',()=>({getAuthHeaders:jest.fn()}));
jest.mock('../../utils/apiPublicBaseUrl',()=>({getApiBaseUrl:()=>'/same-origin-api'}));
const token='synthetic_private_capability_12345678901234567890';
const result={ok:true,scoreboard_id:'board',control_token:token,control_path:`/scoreboard/control/${token}`};
const ok=data=>({ok:true,json:async()=>data});
beforeEach(()=>{jest.clearAllMocks();getAuthHeaders.mockResolvedValue({'Content-Type':'application/json',Authorization:'Bearer SDK-current'});global.fetch=jest.fn().mockResolvedValueOnce(ok(result)).mockResolvedValueOnce(ok({scoreboardId:'board'}));});
test('normal authenticated staff issuance sends no authority and verifies exact-board capability before presenting same-site link',async()=>{
 const href=await issueRefereeControlLink({scoreboardId:'board',origin:'https://padbol.example'});
 expect(href).toBe(`https://padbol.example${result.control_path}`);expect(fetch.mock.calls[0][1]).toMatchObject({method:'POST',body:'{}',headers:{Authorization:'Bearer SDK-current'}});expect(fetch.mock.calls[1][1].headers).toBeUndefined();
});
test('control capability cannot issue; missing session and mismatched board/path fail closed',async()=>{
 await expect(issueRefereeControlLink({scoreboardId:'board',controlToken:'existing-capability'})).rejects.toThrow();expect(getAuthHeaders).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
 getAuthHeaders.mockResolvedValue({});await expect(issueRefereeControlLink({scoreboardId:'board'})).rejects.toThrow('AUTH_REQUIRED');expect(fetch).not.toHaveBeenCalled();
 getAuthHeaders.mockResolvedValue({Authorization:'Bearer SDK-current'});fetch.mockReset().mockResolvedValueOnce(ok({...result,scoreboard_id:'different'}));await expect(issueRefereeControlLink({scoreboardId:'board'})).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);
});
test('staff action displays and copies only after successful authoritative verification, without browser storage',async()=>{
 const refresh=jest.fn(async()=>{}),storage=jest.spyOn(Storage.prototype,'setItem');const copy=jest.fn(async()=>{});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:copy}});
 render(<NationsRefereeLink scoreboardId="board" onIssued={refresh}/>);expect(screen.queryByLabelText('Enlace privado del árbitro')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Crear enlace del árbitro'}));await screen.findByLabelText('Enlace privado del árbitro');expect(refresh).toHaveBeenCalledTimes(1);expect(screen.getByRole('link',{name:'Abrir panel del árbitro'})).toHaveAttribute('rel','noopener noreferrer');
 fireEvent.click(screen.getByRole('button',{name:'Copiar enlace'}));await screen.findByText('Enlace copiado.');expect(copy).toHaveBeenCalledWith(expect.stringContaining(result.control_path));expect(storage).not.toHaveBeenCalled();storage.mockRestore();
});
test('forbidden issuance or failed capability verification never shows a link and keeps a clear error',async()=>{
 fetch.mockReset().mockResolvedValueOnce({ok:false,json:async()=>({code:'FORBIDDEN'})});render(<NationsRefereeLink scoreboardId="board"/>);
 fireEvent.click(screen.getByRole('button',{name:'Crear enlace del árbitro'}));await screen.findByRole('alert');expect(screen.queryByLabelText('Enlace privado del árbitro')).toBeNull();await waitFor(()=>expect(screen.getByRole('button',{name:'Crear enlace del árbitro'})).toBeEnabled());
});
test('a minted token with wrong-board or rejected authoritative context remains undisclosed',async()=>{
 fetch.mockReset().mockResolvedValueOnce(ok(result)).mockResolvedValueOnce(ok({scoreboardId:'different'}));await expect(issueRefereeControlLink({scoreboardId:'board'})).rejects.toThrow('REFEREE_LINK_SCOPE_INVALID');
 fetch.mockReset().mockResolvedValueOnce(ok({...result,control_path:'https://untrusted.invalid/'}));await expect(issueRefereeControlLink({scoreboardId:'board'})).rejects.toThrow('REFEREE_LINK_SCOPE_INVALID');expect(fetch).toHaveBeenCalledTimes(1);
});
