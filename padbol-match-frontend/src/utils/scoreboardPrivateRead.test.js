import {fetchPartido} from './scoreboardApi';
import {supabase} from '../supabaseClient';
jest.mock('../supabaseClient',()=>({supabase:{auth:{getSession:jest.fn()}}}));
beforeEach(()=>{supabase.auth.getSession.mockResolvedValue({data:{session:{access_token:'fresh-sdk-token'}}});global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({id:'QA-board'})});});
test('private control reads use current SDK authorization before public reveal',async()=>{await fetchPartido('QA-board',{authenticated:true});expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fresh-sdk-token');});
test('private read without current authorization does not make an anonymous request',async()=>{supabase.auth.getSession.mockResolvedValue({data:{session:null}});await expect(fetchPartido('QA-board',{authenticated:true})).rejects.toThrow(/Ingresa/);expect(fetch).not.toHaveBeenCalled();});
test('public display remains anonymous even when this browser has a session',async()=>{await fetchPartido('QA-board');expect(fetch.mock.calls[0]).toHaveLength(1);expect(supabase.auth.getSession).not.toHaveBeenCalled();});
