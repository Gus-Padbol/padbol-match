import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import NationsInscripcion from './NationsInscripcion';
import {NATIONS_PROFILE_PATH,NATIONS_RETURN_PATH,nationsSelectionKey} from '../utils/nationsEssentialProfile';
const mockUseAuth=jest.fn();const mockFetch=jest.fn();
jest.mock('../context/AuthContext',()=>({useAuth:()=>mockUseAuth()}));
jest.mock('../i18n/tSafe',()=>({useSafeTranslation:()=>({i18n:{language:'es'},t:key=>key})}));
const participants=[{selectionId:'ro',name:'Romanian Player',country:'RO'},{selectionId:'dk',name:'Danish Player',country:'DK'},{selectionId:'at',name:'Austrian Player',country:'AT'}];
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const mount=(slug='nations-cup-napoli-2026')=>render(<MemoryRouter initialEntries={[`/nations-cup/${slug}/inscripcion`]}><Routes><Route path="/nations-cup/:slug/inscripcion" element={<NationsInscripcion/>}/><Route path="/mi-perfil" element={<p>Essential player form</p>}/></Routes></MemoryRouter>);
beforeEach(()=>{sessionStorage.clear();jest.clearAllMocks();global.fetch=mockFetch;mockUseAuth.mockReturnValue({session:null,loading:false});mockFetch.mockImplementation(async url=>response(String(url).endsWith('/selector')?{participants}:{requests:[]}));});
test('Napoli shows exactly two selectors, alphabetic countries with Denmark flag, and no search/full-name/profile/history boilerplate',async()=>{
 mount();await screen.findByRole('option',{name:'Danish Player'});
 expect(screen.getAllByRole('combobox')).toHaveLength(2);expect(screen.queryByRole('textbox')).toBeNull();
 expect(screen.getAllByRole('option').slice(1,4).map(row=>row.textContent)).toEqual(['🇦🇹 Austria','🇩🇰 Denmark','🇷🇴 Romania']);
 expect(document.body.textContent).not.toMatch(/FIPA|history|link points|incomplete|age is verified/i);
 expect(screen.getByRole('button',{name:'Sign in or create an account'})).toBeDisabled();
});
test('selection is canonical public intent, persists through normal login redirect and opens essential form after authenticated return',async()=>{
 const view=mount();await screen.findByRole('option',{name:'Danish Player'});
 fireEvent.change(screen.getByLabelText('Country'),{target:{value:'DK'}});fireEvent.change(screen.getByLabelText('Your name'),{target:{value:'dk'}});
 const link=screen.getByRole('link',{name:'Sign in or create an account'});expect(link).toHaveAttribute('href',`/login?redirect=${encodeURIComponent(NATIONS_RETURN_PATH)}&lang=en`);
 expect(JSON.parse(sessionStorage.getItem(nationsSelectionKey))).toEqual(participants[1]);view.unmount();
 mockUseAuth.mockReturnValue({session:{user:{id:'actor',email:'own@example.test',email_confirmed_at:'now'},access_token:'own-token'},loading:false});mount();
 expect(await screen.findByText('Essential player form')).toBeInTheDocument();expect(mockFetch.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
});
test('changing country clears the selected intent and stale stored IDs never prefill another identity',async()=>{
 sessionStorage.setItem(nationsSelectionKey,JSON.stringify({selectionId:'removed',name:'Wrong private name',country:'DK'}));mount();await screen.findByRole('option',{name:'Danish Player'});
 await waitFor(()=>expect(sessionStorage.getItem(nationsSelectionKey)).toBeNull());expect(screen.queryByText('Wrong private name')).toBeNull();
 fireEvent.change(screen.getByLabelText('Your name'),{target:{value:'dk'}});fireEvent.change(screen.getByLabelText('Country'),{target:{value:'RO'}});
 expect(screen.getByLabelText('Your name')).toHaveValue('');expect(sessionStorage.getItem(nationsSelectionKey)).toBeNull();
});
test('existing registration restores one short receipt with profile edit, without forms or duplicate POST',async()=>{
 mockUseAuth.mockReturnValue({session:{user:{id:'actor'},access_token:'own'},loading:false});mockFetch.mockImplementation(async url=>response(String(url).endsWith('/selector')?{participants}:{requests:[{status:'pendiente'}],profile_readiness:{complete:true,missing:[]}}));mount();
 expect(await screen.findByText('Your registration has been received.')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Edit player details'})).toHaveAttribute('href',NATIONS_PROFILE_PATH);expect(screen.queryByRole('combobox')).toBeNull();expect(mockFetch.mock.calls.every(([,options])=>options?.method!=='POST')).toBe(true);
});
test('failed status read never offers another POST, retry is read only',async()=>{
 mockUseAuth.mockReturnValue({session:{user:{id:'actor'},access_token:'own'},loading:false});let failed=true;mockFetch.mockImplementation(async url=>String(url).endsWith('/selector')?response({participants}):response({requests:[]},failed?503:200));mount();
 expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your registration');failed=false;fireEvent.click(screen.getByRole('button',{name:'Try again'}));await screen.findByRole('option',{name:'Danish Player'});expect(mockFetch.mock.calls.every(([,options])=>options?.method!=='POST')).toBe(true);
});
test('other event slugs retain their existing generic registration and language',async()=>{
 mount('nations-cup-other');expect(screen.getByRole('link',{name:'Ingresar'}).getAttribute('href')).not.toContain('lang=en');
});

test('an existing incomplete request offers completion of its own ficha without a second registration',async()=>{
 mockUseAuth.mockReturnValue({session:{user:{id:'actor'},access_token:'own'},loading:false});mockFetch.mockImplementation(async url=>response(String(url).endsWith('/selector')?{participants}:{requests:[{status:'pendiente'}],profile_readiness:{complete:false,missing:['ciudad']}}));mount();expect(await screen.findByText('Complete your player details')).toBeInTheDocument();expect(screen.queryByText('Your registration has been received.')).toBeNull();expect(screen.getByRole('link',{name:'Complete player details'})).toHaveAttribute('href',NATIONS_PROFILE_PATH);expect(mockFetch.mock.calls.every(([,options])=>options?.method!=='POST')).toBe(true);
});

test('an existing request without readiness evidence offers completion rather than claiming a completed ficha',async()=>{mockUseAuth.mockReturnValue({session:{user:{id:'actor'},access_token:'own'},loading:false});mockFetch.mockImplementation(async url=>response(String(url).endsWith('/selector')?{participants}:{requests:[{status:'pendiente'}]}));mount();expect(await screen.findByText('Complete your player details')).toBeInTheDocument();expect(screen.queryByText('Your registration has been received.')).toBeNull();expect(screen.getByRole('link',{name:'Complete player details'})).toHaveAttribute('href',NATIONS_PROFILE_PATH);expect(mockFetch.mock.calls.every(([,options])=>options?.method!=='POST')).toBe(true);});

test('a positively complete active receipt offers the official store buttons without claiming test-account compatibility',async()=>{
 mockUseAuth.mockReturnValue({session:{user:{id:'actor'},access_token:'own'},loading:false});mockFetch.mockImplementation(async url=>response(String(url).endsWith('/selector')?{participants}:{requests:[{status:'pendiente'}],profile_readiness:{complete:true,missing:[]}}));mount();await screen.findByText('Your registration has been received.');expect(screen.getByText('Download Padbol Match to follow the tournament.')).toBeInTheDocument();expect(document.body.textContent).not.toMatch(/test registration|web demo/i);expect(screen.getByText('Sign in with the same email and password.')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Download for iPhone'})).toHaveAttribute('href','https://apps.apple.com/app/id6814243035');expect(screen.getByRole('link',{name:'Download for Android'})).toHaveAttribute('href','https://play.google.com/store/apps/details?id=com.padbolmatch.app');
});
test.each([undefined,{complete:false}])('incomplete or unconfirmed readiness never offers a success/download footer (%j)',async(profile_readiness)=>{mockUseAuth.mockReturnValue({session:{user:{id:'actor'},access_token:'own'},loading:false});mockFetch.mockImplementation(async url=>response(String(url).endsWith('/selector')?{participants}:{requests:[{status:'pendiente'}],profile_readiness}));mount();await screen.findByText('Complete your player details');expect(screen.queryByRole('link',{name:'Download for iPhone'})).toBeNull();expect(screen.queryByText('Download Padbol Match to follow the tournament.')).toBeNull();});
