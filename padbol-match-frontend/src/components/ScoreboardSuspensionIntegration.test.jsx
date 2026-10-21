/* Real component + HTTP routes + isolated PostgreSQL candidate, synthetic data only. */
import React, {useState} from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {spawn} from 'child_process';
import http from 'http';
import {randomUUID} from 'crypto';
jest.mock('../utils/apiPublicBaseUrl',()=>({getApiBaseUrl:()=>global.__SCOREBOARD_QA_URL__}));
jest.mock('../supabaseClient',()=>({supabase:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}}}));
jest.setTimeout(30000);
const root=process.env.SCOREBOARD_INTEGRATION_BACKEND;
(root ? describe : describe.skip)('Suspension integration with isolated backend',()=>{
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';let processHandle,Component,api;
function nodeFetch(url,options={}){return new Promise((resolve,reject)=>{const req=http.request(url,{method:options.method||'GET',headers:options.headers||{}},res=>{let body='';res.on('data',x=>{body+=x});res.on('end',()=>resolve({ok:res.statusCode>=200&&res.statusCode<300,status:res.statusCode,json:async()=>JSON.parse(body)}))});req.on('error',reject);if(options.body)req.write(options.body);req.end()})}
beforeAll(async()=>{
 processHandle=spawn(process.execPath,['sql/tests/20261021_scoreboard_ui_harness_candidate.mjs'],{cwd:root,stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{let out='',err='';processHandle.stdout.on('data',d=>{out+=d;const m=out.match(/READY (\d+)/);if(m)resolve(m[1])});processHandle.stderr.on('data',d=>{err+=d});processHandle.once('exit',code=>reject(new Error(`Harness exited ${code}: ${err}`)));});
 global.__SCOREBOARD_QA_URL__=`http://127.0.0.1:${port}`;global.fetch=nodeFetch;
 Component=require('./ScoreboardSuspensionCandidate').default;api=require('../utils/scoreboardApi');
});
afterAll(async()=>{if(processHandle&&!processHandle.killed){processHandle.kill('SIGTERM');await new Promise(r=>processHandle.once('exit',r))}delete global.fetch;delete global.__SCOREBOARD_QA_URL__});
beforeEach(()=>{localStorage.clear();Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID}});});
function Harness({initial}){const [board,setBoard]=useState(initial);const [pending,setPending]=useState(false);return <Component partido={board} pending={pending} onPending={setPending} onConfirmed={setBoard} refresh={async()=>setBoard(await api.fetchPartido(id,{authenticated:true}))}/>}
test('real UI suspends then resumes same persisted scoreboard on another court',async()=>{
 const initial=await api.fetchPartido(id,{authenticated:true});expect(initial.scoreboard_suspension_candidate_enabled).toBe(true);expect(initial.score_a).toBe(40);
 render(<Harness initial={initial}/>);fireEvent.change(screen.getByLabelText('Motivo de suspensión'),{target:{value:'Lluvia'}});fireEvent.click(screen.getByRole('button',{name:'Suspender partido'}));
 await screen.findByText(/Partido suspendido/);const frozen=await api.fetchPartido(id,{authenticated:true});expect(frozen.estado).toBe('suspendido');expect(frozen.score_a).toBe(40);expect(frozen.cancha).toBe('1');
 await screen.findByRole('option',{name:'Cancha 2'});fireEvent.change(screen.getByLabelText('Cancha'),{target:{value:'14'}});fireEvent.click(screen.getByRole('button',{name:'Reanudar en esta cancha'}));
 await screen.findByLabelText('Motivo de suspensión');const resumed=await api.fetchPartido(id,{authenticated:true});expect(resumed.estado).toBe('en_curso');expect(resumed.cancha).toBe('2');expect(resumed.score_a).toBe(40);expect(resumed.cronometro_pausado).toBe(true);
});
test('lost HTTP response after commit remains blocked even when server confirms suspension',async()=>{
 const initial=await api.fetchPartido(id,{authenticated:true});global.fetch=async(url,options)=>{const response=await nodeFetch(url,options);if(String(url).endsWith('/suspend'))throw new Error('synthetic network loss after commit');return response};
 const view=render(<Harness initial={initial}/>);fireEvent.change(screen.getByLabelText('Motivo de suspensión'),{target:{value:'Lluvia'}});fireEvent.click(screen.getByRole('button',{name:'Suspender partido'}));
 await screen.findByText(/No se pudo confirmar el resultado/);const actual=await api.fetchPartido(id,{authenticated:true});expect(actual.estado).toBe('suspendido');expect(actual.score_a).toBe(40);expect((Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).find(k=>k.startsWith(`padbol:scoreboard:suspension-uncertain:${id}:action:`)) ?? null)).not.toBeNull();global.fetch=nodeFetch;fireEvent.click(screen.getByRole('button',{name:'Recuperar operación'}));await screen.findByText(/Partido suspendido/);expect((Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).find(k=>k.startsWith(`padbol:scoreboard:suspension-uncertain:${id}:action:`)) ?? null)).toBeNull();view.unmount();
});
test('a lost request before dispatch can be recovered once with the same reference',async()=>{
 const initial=await api.fetchPartido(id,{authenticated:true});expect(initial.estado).toBe('suspendido');let dropped=false;
 global.fetch=async(url,options)=>{if(String(url).endsWith('/resume')&&!dropped){dropped=true;throw new Error('synthetic loss before dispatch')}return nodeFetch(url,options)};
 render(<Harness initial={initial}/>);await screen.findByRole('option',{name:'Cancha 2'});fireEvent.change(screen.getByLabelText('Cancha'),{target:{value:'14'}});fireEvent.click(screen.getByRole('button',{name:'Reanudar en esta cancha'}));
 await screen.findByText(/No se pudo confirmar el resultado/);expect((await api.fetchPartido(id,{authenticated:true})).estado).toBe('suspendido');
 fireEvent.click(screen.getByRole('button',{name:'Recuperar operación'}));await screen.findByLabelText('Motivo de suspensión');expect((await api.fetchPartido(id,{authenticated:true})).estado).toBe('en_curso');expect((Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).find(k=>k.startsWith(`padbol:scoreboard:suspension-uncertain:${id}:action:`)) ?? null)).toBeNull();global.fetch=nodeFetch;
});
test('reconciliation reports a committed transition after the HTTP response is lost',async()=>{
 const initial=await api.fetchPartido(id,{authenticated:true});global.fetch=async(url,options)=>{const response=await nodeFetch(url,options);if(String(url).endsWith('/suspend'))throw new Error('lost response');return response};
 render(<Harness initial={initial}/>);fireEvent.change(screen.getByLabelText('Motivo de suspensión'),{target:{value:'Lluvia'}});fireEvent.click(screen.getByRole('button',{name:'Suspender partido'}));await screen.findByText(/No se pudo confirmar el resultado/);
 global.fetch=nodeFetch;fireEvent.click(screen.getByRole('button',{name:'Verificar y cancelar si sigue pendiente'}));await screen.findByText(/ya se había realizado/);expect((await api.fetchPartido(id,{authenticated:true})).estado).toBe('suspendido');expect(localStorage.length).toBe(0);
});
test('reconciliation cancels a request lost before dispatch without changing the match',async()=>{
 const initial=await api.fetchPartido(id,{authenticated:true});global.fetch=async(url,options)=>{if(String(url).endsWith('/resume'))throw new Error('lost before dispatch');return nodeFetch(url,options)};
 render(<Harness initial={initial}/>);await screen.findByRole('option',{name:'Cancha 2'});fireEvent.change(screen.getByLabelText('Cancha'),{target:{value:'14'}});fireEvent.click(screen.getByRole('button',{name:'Reanudar en esta cancha'}));await screen.findByText(/No se pudo confirmar el resultado/);
 global.fetch=nodeFetch;fireEvent.click(screen.getByRole('button',{name:'Verificar y cancelar si sigue pendiente'}));await screen.findByText(/quedó cancelada/);expect((await api.fetchPartido(id,{authenticated:true})).estado).toBe('suspendido');expect(localStorage.length).toBe(0);
});

});
