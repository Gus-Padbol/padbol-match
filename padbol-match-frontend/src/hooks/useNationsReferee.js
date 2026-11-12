import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {getApiBaseUrl} from '../utils/apiPublicBaseUrl';
import {createNationsRefereeClient} from '../utils/nationsRefereeClient';

export const refereeMessage = error => ({CHANGE_ENDS_REQUIRED:'Espera a que termine un game impar del set para hacer el cambio.',
 OUT_NOT_ACTIVE:'El jugador que sale ya no está en cancha. Actualiza el marcador.',IN_ALREADY_ACTIVE:'El jugador que entra ya está en cancha.',
 IN_NOT_IN_LINEUP:'Elige un suplente de la alineación confirmada.',SUBSTITUTION_BATCH_INVALID:'Revisa los jugadores de ambos cambios.',
 MATCH_NOT_TERMINATED:'El partido todavía no ha terminado.',AUTH_REQUIRED:'Inicia sesión para operar el marcador.',
 CONTROL_TOKEN_INVALID:'El enlace del árbitro no está disponible.',FORBIDDEN:'No tienes permiso para operar este marcador.',
 REVISION_CONFLICT:'El marcador cambió. Revisa el estado actualizado.',GAME_EPOCH_CONFLICT:'El marcador cambió. Revisa el estado actualizado.'}[error?.code] || 'No se pudo confirmar la operación. Actualiza o reintenta el mismo intento.');

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
