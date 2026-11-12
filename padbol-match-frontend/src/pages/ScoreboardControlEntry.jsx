import React from 'react';
import {useParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import useNationsReferee from '../hooks/useNationsReferee';
import ScoreboardControl from './ScoreboardControl';
import NationsRefereePanel from '../components/scoreboard/NationsRefereePanel';

/** Same referee entry: non-Nations staff controls retain the established implementation. */
export default function ScoreboardControlEntry(){
 const {partidoId,token}=useParams();const {session}=useAuth();
 const controller=useNationsReferee({scoreboardId:partidoId,controlToken:token,accessToken:session?.access_token,authUserId:session?.user?.id});
 if(controller.snapshot?.mode==='legacy')return <ScoreboardControl/>;
 return <NationsRefereePanel key={`${partidoId||'control'}:${session?.user?.id||'guest'}`} controller={controller} allowIssueLink={!token&&Boolean(session?.access_token)}/>;
}
