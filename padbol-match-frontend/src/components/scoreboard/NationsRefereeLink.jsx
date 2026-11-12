import React,{useEffect,useRef,useState} from 'react';
import {issueRefereeControlLink} from '../../utils/refereeControlLink';

export default function NationsRefereeLink({scoreboardId,disabled,onIssued}) {
 const [link,setLink]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[copyNote,setCopyNote]=useState('');
 const scope=useRef(scoreboardId),mounted=useRef(true),inFlight=useRef(false),version=useRef(0);
 scope.current=scoreboardId;
 useEffect(()=>{mounted.current=true;setLink('');setError('');setCopyNote('');setBusy(false);inFlight.current=false;version.current+=1;return()=>{mounted.current=false;};},[scoreboardId]);
 const issue=async()=>{
  if(disabled||inFlight.current)return;
  const board=scoreboardId,ticket=++version.current;inFlight.current=true;setBusy(true);setLink('');setError('');setCopyNote('');
  try{const next=await issueRefereeControlLink({scoreboardId:board});await onIssued?.();if(mounted.current&&scope.current===board&&version.current===ticket)setLink(next);}
  catch{if(mounted.current&&scope.current===board&&version.current===ticket)setError('No se pudo crear y verificar el enlace. Actualiza el marcador e inténtalo de nuevo.');}
  finally{if(mounted.current&&scope.current===board&&version.current===ticket){inFlight.current=false;setBusy(false);}}
 };
 const copy=async()=>{try{await navigator.clipboard.writeText(link);setCopyNote('Enlace copiado.');}catch{setCopyNote('Selecciona el enlace y cópialo para compartirlo con el árbitro.');}};
 return <section className="sc-header nations-referee-link" aria-label="Enlace del árbitro">
  <h2>Árbitro de este partido</h2><p>El enlace permite operar sólo este marcador. Crear uno nuevo reemplaza el anterior; compártelo únicamente con su árbitro.</p>
  <button disabled={disabled||busy} onClick={issue}>{busy?'Verificando enlace…':'Crear enlace del árbitro'}</button>
  {error?<p role="alert">{error}</p>:null}
  {link?<div><label>Enlace privado del árbitro<input aria-label="Enlace privado del árbitro" readOnly value={link} onFocus={event=>event.target.select()}/></label><div className="nations-referee-actions"><button onClick={copy}>Copiar enlace</button><a href={link} target="_blank" rel="noopener noreferrer">Abrir panel del árbitro</a></div>{copyNote?<p role="status">{copyNote}</p>:null}</div>:null}
 </section>;
}
