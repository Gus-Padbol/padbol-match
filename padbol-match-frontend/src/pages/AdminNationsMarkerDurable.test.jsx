import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import AdminNationsMarkerDurable from './AdminNationsMarkerDurable';

let mockRole = 'super_admin';
jest.mock('../context/AuthContext', () => ({useAuth: () => ({session: {access_token: 'jwt-token', user: {id: 'u1', email: 'u@example.invalid'}}, loading: false})}));
jest.mock('../hooks/useUserRole', () => ({__esModule: true, default: () => ({rol: mockRole, loading: false})}));
jest.mock('../utils/apiPublicBaseUrl', () => ({getApiBaseUrl: () => 'https://qa.example.invalid'}));

const context = {canStart: true, gamesEpoch: 0, teamIds: ['team-a'], membership: {A: 'team-a', B: 'team-b'}, teams: {'team-a': {lineup: {iniciales: ['p1','p3'], suplentes: ['p2','p4']}}}};
function mount() {
  return render(<MemoryRouter initialEntries={['/admin/nations-marker/sb-1']}><Routes><Route path="/admin/nations-marker/:scoreboardId" element={<AdminNationsMarkerDurable />} /></Routes></MemoryRouter>);
}
function installFetch() {
  let revision = 0; let epoch = 0;
  global.fetch = jest.fn(async (url, opts) => {
    const path = String(url);
    if (path.endsWith('/context')) return {ok: true, json: async () => context};
    if (path.includes('?teamId=')) return {ok: true, json: async () => ({matchRevision: revision, gamesEpoch: epoch, trackingStatus: 'active', substitution_window: {allowed:true,completed_games:1,set_number:1}})};
    if (opts?.method === 'POST') {
      if (path.includes('/pause')) revision += 1;
      if (path.includes('/resume')) revision += 1;
      if (path.includes('/global/commands') || path.includes('/team/')) revision += 1;
      return {ok: true, json: async () => ({ok: true, revision})};
    }
    return {ok: true, json: async () => ({})};
  });
  return {getRevision: () => revision, getEpoch: () => epoch};
}
beforeEach(() => { mockRole = 'super_admin'; });

test('staff ejecuta start, pause, resume y substitución con epoch/revision frescos', async () => {
  const state = installFetch();
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: 'Iniciar reloj y línea base'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: 'Iniciar reloj y línea base'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url, o]) => String(url).endsWith('/start') && o?.method === 'POST')).toBe(true));
  const startPost = global.fetch.mock.calls.find(([url, o]) => String(url).endsWith('/start') && o?.method === 'POST');
  expect(JSON.parse(startPost[1].body)).not.toHaveProperty('epoch');

  fireEvent.click(screen.getByRole('button', {name: 'Pausar'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/global/commands'))).toBe(true));
  const pausePost = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/global/commands'));
  expect(JSON.parse(pausePost[1].body)).toMatchObject({type: 'pause', epoch: 0, expectedRevision: 0});

  fireEvent.click(screen.getByRole('button', {name: 'Reanudar'}));
  await waitFor(() => expect(global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/global/commands')).length).toBeGreaterThan(1));
  const resumePost = global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/global/commands'))[1];
  expect(JSON.parse(resumePost[1].body)).toMatchObject({type: 'resume', epoch: 0, expectedRevision: 1});

  await waitFor(() => expect(screen.getByRole('button', {name: 'Registrar cambio'})).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Sale'), {target: {value: 'p1'}});
  fireEvent.change(screen.getByLabelText('Entra'), {target: {value: 'p2'}});
  fireEvent.click(screen.getByRole('button', {name: 'Registrar cambio'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/team/team-a/commands'))).toBe(true));
  const subPost = global.fetch.mock.calls.find(([url]) => String(url).includes('/team/team-a/commands'));
  const sub = JSON.parse(subPost[1].body);
  expect(sub).toMatchObject({type: 'substitution', epoch: 0, expectedRevision: 2, swaps: [{outId: 'p1', inId: 'p2'}]});
  expect(sub).toHaveProperty('eventId');
  expect(sub).toHaveProperty('idempotencyKey');
  expect(state.getRevision()).toBe(3);
});

test('rol no staff queda bloqueado', async () => { mockRole = 'jugador'; mount(); expect(screen.getByRole('alert')).toHaveTextContent('Sin permiso para operar el marcador durable.'); });

test('punto usa epoch y requestId estable del contrato', async () => {
  installFetch(); mount();
  await waitFor(() => expect(screen.getByRole('button', {name: 'Punto A'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: 'Punto A'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/punto/A'))).toBe(true));
  const post = global.fetch.mock.calls.find(([url]) => String(url).includes('/punto/A'));
  const body = JSON.parse(post[1].body);
  expect(body).toHaveProperty('requestId');
  expect(body.epoch).toBe(0);
  expect(body).not.toHaveProperty('actor');
});


test('un POST fallido conserva el error aunque el GET posterior sea exitoso', async () => {
  installFetch();
  global.fetch.mockImplementation(async (url, opts) => {
    if (String(url).endsWith('/context')) return {ok: true, json: async () => context};
    if (String(url).includes('?teamId=')) return {ok: true, json: async () => ({matchRevision: 0, gamesEpoch: 0, trackingStatus: 'active', substitution_window: {allowed:true,completed_games:1,set_number:1}})};
    if (opts?.method === 'POST') return {ok: false, status: 409, json: async () => ({code: 'REVISION_CONFLICT'})};
    return {ok: true, json: async () => ({})};
  });
  mount();
  await waitFor(() => expect(screen.getByRole('button', {name: 'Pausar'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: 'Pausar'}));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('REVISION_CONFLICT'));
  expect(screen.getByRole('alert')).toHaveTextContent('REVISION_CONFLICT');
});

test('both replacements use one atomic POST in the server-confirmed odd-game window', async () => {
 installFetch(); mount();
 await waitFor(() => expect(screen.getByRole('button', {name:'Registrar cambio'})).toBeEnabled());
 expect(screen.getByText(/Cambio de lado: game 1 terminado/)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Sale'), {target:{value:'p1'}});
 fireEvent.change(screen.getByLabelText('Entra'), {target:{value:'p2'}});
 fireEvent.click(screen.getByLabelText('Sustituir ambos jugadores'));
 fireEvent.change(screen.getByLabelText('Segundo jugador que sale'), {target:{value:'p3'}});
 fireEvent.change(screen.getByLabelText('Segundo jugador que entra'), {target:{value:'p4'}});
 fireEvent.click(screen.getByRole('button', {name:'Registrar cambio'}));
 await waitFor(() => expect(fetch.mock.calls.filter(([u,o]) => u.includes('/team/') && o?.method==='POST')).toHaveLength(1));
 const body=JSON.parse(fetch.mock.calls.find(([u,o]) => u.includes('/team/') && o?.method==='POST')[1].body);
 expect(body.swaps).toEqual([{outId:'p1',inId:'p2'},{outId:'p3',inId:'p4'}]);
 expect(body).not.toHaveProperty('outId'); expect(body).not.toHaveProperty('inId');
});
test('missing authoritative substitution window never enables a change', async () => {
 installFetch();const original=fetch.getMockImplementation();fetch.mockImplementation(async(u,o)=>String(u).includes('?teamId=')?{ok:true,json:async()=>({matchRevision:0,gamesEpoch:0,trackingStatus:'active'})}:original(u,o));
 mount();await waitFor(()=>expect(screen.getByRole('button',{name:'Registrar cambio'})).toBeDisabled());
 expect(fetch.mock.calls.some(([,o])=>o?.method==='POST')).toBe(false);
});

test('uncertain change retries its identical atomic payload and key after refresh',async()=>{
 installFetch();const original=fetch.getMockImplementation();let attempts=0;
 fetch.mockImplementation(async(u,o)=>{if(String(u).includes('/team/')&&o?.method==='POST'){attempts++;if(attempts===1)throw new Error('lost response');}return original(u,o);});
 mount();await waitFor(()=>expect(screen.getByRole('button',{name:'Registrar cambio'})).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Sale'),{target:{value:'p1'}});fireEvent.change(screen.getByLabelText('Entra'),{target:{value:'p2'}});
 fireEvent.click(screen.getByRole('button',{name:'Registrar cambio'}));
 await screen.findByText('NETWORK_ERROR');expect(screen.getByLabelText('Sale')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Reintentar el mismo cambio'}));
 await waitFor(()=>expect(fetch.mock.calls.filter(([u,o])=>u.includes('/team/')&&o?.method==='POST')).toHaveLength(2));
 const posts=fetch.mock.calls.filter(([u,o])=>u.includes('/team/')&&o?.method==='POST');expect(posts[1][1].body).toBe(posts[0][1].body);
});
test.each([false,true])('server denial or clock mismatch keeps changes closed: drift %s',async drift=>{
 installFetch();const original=fetch.getMockImplementation();fetch.mockImplementation(async(u,o)=>String(u).includes('?teamId=')?{ok:true,json:async()=>({matchRevision:0,gamesEpoch:0,trackingStatus:'active',...(drift?{code:'CLOCK_OUT_OF_SYNC'}:{}),substitution_window:{allowed:drift,reason:drift?null:'CHANGE_ENDS_REQUIRED',completed_games:2,set_number:1}})}:original(u,o));
 mount();await waitFor(()=>expect(fetch.mock.calls.some(([u])=>u.includes('?teamId='))).toBe(true));expect(screen.getByRole('button',{name:'Registrar cambio'})).toBeDisabled();
});
