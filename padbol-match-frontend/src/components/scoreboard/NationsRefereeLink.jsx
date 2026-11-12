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
  catch{if(mounted.current&&scope.current===board&&version.current===ticket)setError('The referee link could not be verified. Refresh the scoreboard and try again.');}
  finally{if(mounted.current&&scope.current===board&&version.current===ticket){inFlight.current=false;setBusy(false);}}
 };
 const copy=async()=>{try{await navigator.clipboard.writeText(link);setCopyNote('Link copied.');}catch{setCopyNote('Select and copy the link to share it with the referee.');}};
 return <section className="sc-header nations-referee-link" aria-label="Referee link">
  <h2>Match referee</h2><p>This link controls this scoreboard only. Creating a new link replaces the old one. Share it only with the match referee.</p>
  <button disabled={disabled||busy} onClick={issue}>{busy?'Verifying link…':'Create referee link'}</button>
  {error?<p role="alert">{error}</p>:null}
  {link?<div><label>Private referee link<input aria-label="Private referee link" readOnly value={link} onFocus={event=>event.target.select()}/></label><div className="nations-referee-actions"><button onClick={copy}>Copy link</button><a href={link} target="_blank" rel="noopener noreferrer">Open referee panel</a></div>{copyNote?<p role="status">{copyNote}</p>:null}</div>:null}
 </section>;
}
