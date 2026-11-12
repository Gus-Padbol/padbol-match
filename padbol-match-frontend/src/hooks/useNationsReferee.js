import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {getApiBaseUrl} from '../utils/apiPublicBaseUrl';
import {createNationsRefereeClient} from '../utils/nationsRefereeClient';

export const refereeMessage = error => ({CHANGE_ENDS_REQUIRED:'Wait until an odd-numbered game of the set has ended before substituting.',
 OUT_NOT_ACTIVE:'The outgoing player is no longer on court. Refresh the scoreboard.',IN_ALREADY_ACTIVE:'The incoming player is already on court.',
 IN_NOT_IN_LINEUP:'Choose a substitute from the confirmed lineup.',SUBSTITUTION_BATCH_INVALID:'Check the players in both substitutions.',
 MATCH_NOT_TERMINATED:'The match has not finished yet.',AUTH_REQUIRED:'Sign in to control this scoreboard.',
 CONTROL_TOKEN_INVALID:'The referee link is unavailable.',FORBIDDEN:'You do not have permission to control this scoreboard.',
 REVISION_CONFLICT:'The scoreboard changed. Check the updated state.',GAME_EPOCH_CONFLICT:'The scoreboard changed. Check the updated state.'}[error?.code] || 'The operation could not be confirmed. Refresh or retry the same attempt.');

export default function useNationsReferee({scoreboardId,controlToken,accessToken,authUserId}) {
 const bearerRef=useRef(accessToken);bearerRef.current=accessToken;
 const identity=controlToken?null:authUserId;
 const client=useMemo(()=>createNationsRefereeClient({apiBase:getApiBaseUrl(),scoreboardId,controlToken,authUserId:identity,getAccessToken:()=>bearerRef.current}),[scoreboardId,controlToken,identity]);
 const [snapshot,setSnapshot]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(null);
 const pendingRef=useRef(null),inFlight=useRef(false),sequence=useRef(0),mounted=useRef(true),clientRef=useRef(client);
 clientRef.current=client;
 const invalidate=useCallback(()=>{sequence.current+=1;},[]);
 const load=useCallback(async()=>{
  const ticket=++sequence.current;
  try {const value=await client.read();if(mounted.current&&clientRef.current===client&&ticket===sequence.current){setSnapshot(value);}return value;}
  catch(e){if(mounted.current&&clientRef.current===client&&ticket===sequence.current){setSnapshot(null);setError(refereeMessage(e));}throw e;}
  finally {if(mounted.current&&clientRef.current===client&&ticket===sequence.current)setLoading(false);}
 },[client]);
 useEffect(()=>{mounted.current=true;setSnapshot(null);setLoading(true);setBusy(false);setError('');setPending(null);pendingRef.current=null;inFlight.current=false;
  void load().catch(()=>{});const timer=setInterval(()=>{if(!inFlight.current)void load().catch(()=>{});},5000);
  return()=>{mounted.current=false;invalidate();clearInterval(timer);};},[load,invalidate]);
 const act=useCallback(async(kind,payload={})=>{
  if(inFlight.current||!snapshot)return false;
  inFlight.current=true;setBusy(true);setError('');
  const origin=client;
  try {
   if(!pendingRef.current){pendingRef.current=client.attempt(kind,snapshot,payload);setPending(pendingRef.current);}
   await origin.send(pendingRef.current);
   if(clientRef.current!==origin)return false;
   pendingRef.current=null;setPending(null);await load();return true;
  }catch(e){
   if(clientRef.current!==origin)return false;
   if(snapshot.mode==='legacy-token'||(e.status>=400&&e.status<500)){pendingRef.current=null;setPending(null);}
   await load().catch(()=>{});if(mounted.current)setError(refereeMessage(e));return false;
  }finally{if(clientRef.current===origin){inFlight.current=false;if(mounted.current)setBusy(false);}}
 },[client,snapshot,load]);
 return {snapshot,loading,busy,error,pending,act,refresh:()=>load().catch(()=>{})};
}
