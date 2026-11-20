import React from 'react';
import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import NationsOperatorDashboard from './NationsOperatorDashboard';
import NationsOperatorGrants from './NationsOperatorGrants';
import {useAuth} from '../context/AuthContext';
import {createNationsOperatorApi} from '../utils/nationsOperatorApi';
jest.mock('../context/AuthContext',()=>({useAuth:jest.fn()}));
jest.mock('../utils/nationsOperatorApi',()=>({createNationsOperatorApi:jest.fn()}));
jest.mock('react-i18next',()=>({useTranslation:()=>({i18n:{language:'en'}})}));
const snapshot={torneo:{id:57},timezone:'Europe/Rome',revision:2,partidos:[{id:77,equipo_a_id:101,equipo_b_id:102,estado:'pendiente',cancha_id:13,scoreboards:[]}],equipos:[{id:101,nombre:'Italy',jugadores:[]},{id:102,nombre:'Spain',jugadores:[]}],canchas:[{id:13,nombre:'Court 1'}],alineaciones:[]};
beforeEach(()=>{jest.clearAllMocks();useAuth.mockReturnValue({session:{access_token:'operator'}});});
test('normal account opens exclusive dashboard; no global administration controls',async()=>{const api={dashboard:jest.fn().mockResolvedValue(snapshot)};createNationsOperatorApi.mockReturnValue(api);render(<NationsOperatorDashboard/>);expect(await screen.findByText('Italy — Spain')).toBeTruthy();expect(screen.getByText('Players and lineups')).toBeTruthy();expect(screen.queryByText('Operator email')).toBeNull();expect(api.dashboard).toHaveBeenCalledTimes(1);});
test('changing account clears old private dashboard and ignores late responses',async()=>{let resolve;const old={dashboard:jest.fn(()=>new Promise(r=>{resolve=r;}))},denied={dashboard:jest.fn().mockRejectedValue(Error('Denied'))};createNationsOperatorApi.mockImplementation(token=>token==='operator'?old:denied);const view=render(<NationsOperatorDashboard/>);useAuth.mockReturnValue({session:{access_token:'other'}});view.rerender(<NationsOperatorDashboard/>);expect(await screen.findByRole('alert')).toHaveTextContent('Denied');resolve(snapshot);await waitFor(()=>expect(screen.queryByText('Italy — Spain')).toBeNull());});
test('grant form only appears after server confirms organiser permission',async()=>{createNationsOperatorApi.mockReturnValue({grants:jest.fn().mockRejectedValue(Error('Denied'))});render(<NationsOperatorGrants/>);expect(await screen.findByRole('alert')).toHaveTextContent('Denied');expect(screen.queryByLabelText('Operator email')).toBeNull();});
test('verified grant form submits exactly entered email and can revoke existing access',async()=>{const api={grants:jest.fn().mockResolvedValue({grants:[]}),grant:jest.fn().mockResolvedValue({ok:true})};createNationsOperatorApi.mockReturnValue(api);render(<NationsOperatorGrants/>);const field=await screen.findByLabelText('Operator email');fireEvent.change(field,{target:{value:'person@example.invalid'}});fireEvent.click(screen.getByText('Enable tournament 57 only'));await waitFor(()=>expect(api.grant).toHaveBeenCalledWith('person@example.invalid'));expect(await screen.findByText('Access updated. The account’s general role is unchanged.')).toBeTruthy();});

test('prepare is blocked until both saved lineups exist and a board freezes lineup editing',async()=>{
 const withBoard={...snapshot,partidos:[{...snapshot.partidos[0],scoreboards:[{id:'board-77'}]}],equipos:[{id:101,nombre:'Italy',jugadores:[{id:'a1',nombre:'A1'},{id:'a2',nombre:'A2'}]},{id:102,nombre:'Spain',jugadores:[{id:'b1',nombre:'B1'},{id:'b2',nombre:'B2'}]}]};
 const api={dashboard:jest.fn().mockResolvedValue(withBoard),lineup:jest.fn()};createNationsOperatorApi.mockReturnValue(api);
 render(<NationsOperatorDashboard/>);await screen.findByText('Italy — Spain');
 expect(screen.queryByText('Prepare scoreboard on selected court')).toBeNull();
 expect(screen.getAllByRole('checkbox',{name:'Starter'})[0]).toBeDisabled();
});

test('prepare is enabled only with both saved lineups before the board exists',async()=>{
 const ready={...snapshot,equipos:[{id:101,nombre:'Italy',jugadores:[]},{id:102,nombre:'Spain',jugadores:[]}],alineaciones:[{partido_id:77,equipo_id:101,iniciales:['a1','a2'],suplentes:[],revision:1},{partido_id:77,equipo_id:102,iniciales:['b1','b2'],suplentes:[],revision:1}]};
 const api={dashboard:jest.fn().mockResolvedValue(ready)};createNationsOperatorApi.mockReturnValue(api);
 render(<NationsOperatorDashboard/>);await screen.findByText('Italy — Spain');
 await waitFor(()=>expect(screen.getByText('Prepare scoreboard on selected court').closest('button')).toBeEnabled());
});
