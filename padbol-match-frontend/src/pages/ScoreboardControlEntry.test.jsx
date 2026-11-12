import React from 'react';import {render,screen}from'@testing-library/react';
import ScoreboardControlEntry from './ScoreboardControlEntry';
import {useParams}from'react-router-dom';
jest.mock('react-router-dom',()=>({useParams:jest.fn()}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({session:{access_token:'staff-session',user:{id:'staff'}}})}));
jest.mock('../hooks/useNationsReferee',()=>()=>({snapshot:{mode:'nations'}}));
jest.mock('./ScoreboardControl',()=>()=> <div>Legacy control</div>);
jest.mock('../components/scoreboard/NationsRefereePanel',()=>({allowIssueLink})=><div>{allowIssueLink?'Staff may issue':'Capability cannot issue'}</div>);
test('token entry never exposes staff issuance even with a signed-in browser session',()=>{useParams.mockReturnValue({token:'local-capability'});const {rerender}=render(<ScoreboardControlEntry/>);expect(screen.getByText('Capability cannot issue')).toBeInTheDocument();useParams.mockReturnValue({partidoId:'board'});rerender(<ScoreboardControlEntry/>);expect(screen.getByText('Staff may issue')).toBeInTheDocument();});
