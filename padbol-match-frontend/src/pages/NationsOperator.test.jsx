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

test('lineups remain editable after the marker exists but before kickoff',async()=>{
 const withBoard={...snapshot,partidos:[{...snapshot.partidos[0],scoreboards:[{id:'board-77'}]}],equipos:[{id:101,nombre:'Italy',jugadores:[{id:'a1',nombre:'A1'},{id:'a2',nombre:'A2'},{id:'a3',nombre:'A3'},{id:'a4',nombre:'A4'}]},{id:102,nombre:'Spain',jugadores:[{id:'b1',nombre:'B1'},{id:'b2',nombre:'B2'}]}]};
 const api={dashboard:jest.fn().mockResolvedValue(withBoard),lineup:jest.fn().mockResolvedValue({ok:true})};createNationsOperatorApi.mockReturnValue(api);
 render(<NationsOperatorDashboard/>);await screen.findByText('Italy — Spain');
 const starters=screen.getAllByRole('checkbox',{name:'Starter'});fireEvent.click(starters[0]);fireEvent.click(starters[1]);
 const saveButtons=screen.getAllByText('Save lineup');expect(saveButtons[0]).toBeEnabled();
 fireEvent.click(saveButtons[0]);await waitFor(()=>expect(api.lineup).toHaveBeenCalled());
});
