import {insertOwnProfileRow,loadCanonicalProfile} from '../utils/canonicalProfile';
import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import NationsPlayerProfile from './NationsPlayerProfile';
import {NATIONS_PROFILE_PATH,NATIONS_RETURN_PATH,nationsSelectionKey,nationsRequestKey} from '../utils/nationsEssentialProfile';
const mockUseAuth=jest.fn(),mockFetch=jest.fn();
jest.mock('../supabaseClient',()=>({supabase:{}}));
jest.mock('../utils/canonicalProfile',()=>({insertOwnProfileRow:jest.fn(),loadCanonicalProfile:jest.fn()}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>mockUseAuth()}));
jest.mock('../utils/apiPublicBaseUrl',()=>({getApiBaseUrl:()=>''}));
const selected={selectionId:'synthetic-player',name:'Gustavo Miguens',country:'AR'};
let profile,latest,readiness,receipt;
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const mount=()=>render(<MemoryRouter initialEntries={[NATIONS_PROFILE_PATH]}><Routes><Route path="/mi-perfil" element={<NationsPlayerProfile/>}/><Route path={NATIONS_RETURN_PATH} element={<p>Registration status</p>}/></Routes></MemoryRouter>);
const posts=()=>mockFetch.mock.calls.filter(([,options])=>options?.method==='POST');
const puts=()=>mockFetch.mock.calls.filter(([,options])=>options?.method==='PUT');
const complete=async()=>{await screen.findByLabelText('Name');fireEvent.change(screen.getByLabelText('Competition gender'),{target:{value:'masculino'}});fireEvent.click(screen.getByLabelText('I confirm that I am 18 or older.'));fireEvent.click(screen.getByLabelText('I agree to the use of my details for this registration.'));};
beforeEach(()=>{
 jest.clearAllMocks();insertOwnProfileRow.mockResolvedValue({data:{id:1,user_id:'actor'},error:null});loadCanonicalProfile.mockResolvedValue({row:{id:1,user_id:'actor'}});sessionStorage.clear();sessionStorage.setItem(nationsSelectionKey,JSON.stringify(selected));
 profile={nombre:'',apellido:'',pais:'',genero:'',nivel:'Avanzado',categoria_deportiva:'General original'};latest=null;readiness={complete:true,missing:[]};receipt={status:'pendiente',selectionStatus:'verificacion_pendiente'};
 mockUseAuth.mockReturnValue({session:{user:{id:'actor',email:'own@example.test',email_confirmed_at:'2026-01-01'},access_token:'own-token'},loading:false});
 mockFetch.mockImplementation(async(url,options={})=>{
  if(options.method==='PUT'){profile={...profile,...JSON.parse(options.body)};return response(profile);}
  if(options.method==='POST')return response(receipt);
  if(url.endsWith('/selector'))return response({participants:[selected]});
  if(url.endsWith('/profile-request'))return response({requests:latest?[latest]:[]});
  if(url.endsWith('/profile-readiness'))return response(readiness);
  if(url.endsWith('/perfil'))return response(profile);
  throw new Error('Unexpected local fixture URL');
 });global.fetch=mockFetch;
});
test('one event-only form reuses selected names/country, verified account email and only four required player fields',async()=>{
 mount();await screen.findByLabelText('Name');
 expect(screen.getByLabelText('Name')).toHaveValue('Gustavo');expect(screen.getByLabelText('Surname')).toHaveValue('Miguens');expect(screen.getByLabelText('Country')).toHaveValue('AR');
 expect(screen.getByLabelText('Account email')).toHaveValue('own@example.test');expect(screen.getByLabelText('Account email')).toHaveAttribute('readonly');
 expect(screen.getByText('Nations Cup · Elite')).toBeInTheDocument();expect(screen.getByLabelText('WhatsApp / phone (optional)')).not.toBeRequired();
 expect(Array.from(screen.getByLabelText('Competition gender').options).map(option=>option.value)).toEqual(['','masculino','femenino']);
 expect(document.body.textContent).not.toMatch(/birth|document|nationality|city|laterality|position|bring your|partner|federat|reserva|instructor/i);
 expect(document.querySelectorAll('form')).toHaveLength(1);
});
test('explicit confirmation saves only owned minimal fields then normal registration with stable ID and no extra profile form',async()=>{
 mount();await complete();fireEvent.submit(document.querySelector('form'));
 expect(await screen.findByText('Registration status')).toBeInTheDocument();
 expect(puts()).toHaveLength(1);expect(JSON.parse(puts()[0][1].body)).toEqual({nombre:'Gustavo',apellido:'Miguens',pais:'AR',genero:'masculino'});
 expect(puts()[0][1].headers.Authorization).toBe('Bearer own-token');expect(posts()).toHaveLength(1);
 expect(JSON.parse(posts()[0][1].body)).toEqual({request_id:expect.any(String),selection_id:selected.selectionId,declared_name:'Gustavo Miguens',declared_country:'AR',age_status:'adulto',guardian_consent:false,profile_consent:true});
 expect(profile.nivel).toBe('Avanzado');expect(profile.categoria_deportiva).toBe('General original');expect(sessionStorage.getItem(nationsSelectionKey)).toBeNull();
});
test('18+ and consent are never invented or checked automatically, even if submit is dispatched directly',async()=>{
 mount();await screen.findByLabelText('Name');fireEvent.change(screen.getByLabelText('Competition gender'),{target:{value:'masculino'}});fireEvent.submit(document.querySelector('form'));
 expect(await screen.findByRole('alert')).toHaveTextContent('Confirm that you are 18 or older');expect(puts()).toHaveLength(0);expect(posts()).toHaveLength(0);
});
test('optional phone is supplied only when declared and never replaces unrelated profile/identity fields',async()=>{
 mount();await complete();fireEvent.change(screen.getByLabelText('WhatsApp / phone (optional)'),{target:{value:'+5491123456789'}});fireEvent.submit(document.querySelector('form'));await screen.findByText('Registration status');
 expect(JSON.parse(puts()[0][1].body)).toEqual({nombre:'Gustavo',apellido:'Miguens',pais:'AR',genero:'masculino',telefono:'+5491123456789'});
});
test('two rapid submits send one registration; unconfirmed network retry retains the same fresh ID after rejection',async()=>{
 latest={status:'rechazada',request_id:'old-rejected'};sessionStorage.setItem(nationsRequestKey('actor'),'old-rejected');
 const original=mockFetch.getMockImplementation();let finish;
 mockFetch.mockImplementation((url,options={})=>options.method==='POST'?new Promise(resolve=>{finish=resolve;}):original(url,options));
 mount();await complete();fireEvent.submit(document.querySelector('form'));fireEvent.submit(document.querySelector('form'));
 await waitFor(()=>expect(posts()).toHaveLength(1));const body=JSON.parse(posts()[0][1].body);expect(body.request_id).not.toBe('old-rejected');
 await act(async()=>{finish(response({error:'temporary'},503));});expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
 mockFetch.mockImplementation(original);fireEvent.submit(document.querySelector('form'));await screen.findByText('Registration status');expect(posts()).toHaveLength(2);expect(JSON.parse(posts()[1][1].body).request_id).toBe(body.request_id);
});
test('existing active registration opens own editable profile without public selection or another registration POST',async()=>{
 sessionStorage.clear();latest={status:'pendiente'};profile={nombre:'Own',apellido:'Player',pais:'AR',genero:'masculino',nivel:'Avanzado'};
 mount();await screen.findByLabelText('Name');expect(screen.queryByRole('checkbox')).toBeNull();fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Own edited'}});fireEvent.submit(document.querySelector('form'));
 await screen.findByText('Registration status');expect(posts()).toHaveLength(0);expect(JSON.parse(puts()[0][1].body).nombre).toBe('Own edited');
});
test('stale missing selection, unverified email and incomplete backend readiness fail closed without a registration',async()=>{
 sessionStorage.setItem(nationsSelectionKey,JSON.stringify({selectionId:'stale',name:'Someone else',country:'IT'}));const first=mount();expect(await screen.findByRole('link',{name:'Choose your name'})).toBeInTheDocument();expect(puts()).toHaveLength(0);first.unmount();
 sessionStorage.setItem(nationsSelectionKey,JSON.stringify(selected));readiness={complete:false,missing:['genero']};mount();await complete();fireEvent.submit(document.querySelector('form'));expect(await screen.findByRole('alert')).toHaveTextContent('could not be confirmed');expect(posts()).toHaveLength(0);
});
test('an actor change discards the old profile read and never issues a write for the previous actor',async()=>{
 const original=mockFetch.getMockImplementation();let finish;mockFetch.mockImplementation((url,options)=>url.endsWith('/perfil')?new Promise(resolve=>{finish=resolve;}):original(url,options));
 const view=mount();await waitFor(()=>expect(finish).toBeDefined());mockUseAuth.mockReturnValue({session:null,loading:false});view.rerender(<MemoryRouter><NationsPlayerProfile/></MemoryRouter>);
 await act(async()=>{finish(response({nombre:'Old private actor',apellido:'No',pais:'AR',genero:'masculino'}));});expect(screen.queryByText('Old private actor')).toBeNull();expect(puts()).toHaveLength(0);expect(posts()).toHaveLength(0);
});

test('a genuinely missing own profile is created through the existing UUID/RLS helper using only session email and declared names/country, then official gender PUT',async()=>{
 const original=mockFetch.getMockImplementation();mockFetch.mockImplementation((url,options)=>url.endsWith('/perfil')&&!options?.method?response({},404):original(url,options));
 mount();await complete();fireEvent.submit(document.querySelector('form'));await screen.findByText('Registration status');
 expect(insertOwnProfileRow).toHaveBeenCalledTimes(1);expect(insertOwnProfileRow.mock.calls[0][0]).toMatchObject({userId:'actor',payload:{email:'own@example.test',nombre:'Gustavo',apellido:'Miguens',pais:'AR'}});
 expect(Object.keys(insertOwnProfileRow.mock.calls[0][0].payload).sort()).toEqual(['apellido','email','nombre','pais']);expect(puts()).toHaveLength(1);expect(JSON.parse(puts()[0][1].body).genero).toBe('masculino');expect(posts()).toHaveLength(1);
});
test('a duplicate creation race may continue only after canonical reread proves the same session UUID',async()=>{
 const original=mockFetch.getMockImplementation();mockFetch.mockImplementation((url,options)=>url.endsWith('/perfil')&&!options?.method?response({},404):original(url,options));insertOwnProfileRow.mockResolvedValue({error:{code:'23505'}});loadCanonicalProfile.mockResolvedValue({row:{id:1,user_id:'another-actor'}});
 mount();await complete();fireEvent.submit(document.querySelector('form'));expect(await screen.findByRole('alert')).toHaveTextContent('own player details');expect(puts()).toHaveLength(0);expect(posts()).toHaveLength(0);
});
test('profile creation waits for the normal AuthContext profile load and stale actor writes never continue to registration',async()=>{
 mockUseAuth.mockReturnValue({session:{user:{id:'actor',email:'own@example.test',email_confirmed_at:'now'},access_token:'own-token'},loading:false,profileLoading:true});
 const view=mount();expect(screen.getByRole('status')).toHaveTextContent('Loading');expect(mockFetch).not.toHaveBeenCalled();
 view.unmount();mockUseAuth.mockReturnValue({session:{user:{id:'actor',email:'own@example.test',email_confirmed_at:'now'},access_token:'own-token'},loading:false});
 const original=mockFetch.getMockImplementation();mockFetch.mockImplementation((url,options)=>url.endsWith('/perfil')&&!options?.method?response({},404):original(url,options));let finish;insertOwnProfileRow.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const active=mount();await complete();fireEvent.submit(document.querySelector('form'));await waitFor(()=>expect(finish).toBeDefined());mockUseAuth.mockReturnValue({session:null,loading:false});active.rerender(<MemoryRouter><NationsPlayerProfile/></MemoryRouter>);
 await act(async()=>finish({data:{id:1,user_id:'actor'}}));expect(puts()).toHaveLength(0);expect(posts()).toHaveLength(0);
});
