import {useCallback,useEffect,useState} from 'react';
export function useAccessCodeCooldown(){
 const [until,setUntil]=useState(0),[remaining,setRemaining]=useState(0);
 const start=useCallback(()=>setUntil(Date.now()+60000),[]);
 useEffect(()=>{const tick=()=>setRemaining(Math.max(0,Math.ceil((until-Date.now())/1000)));tick();if(until<=Date.now())return undefined;const timer=window.setInterval(()=>{tick();if(Date.now()>=until)window.clearInterval(timer);},1000);return()=>window.clearInterval(timer);},[until]);
 return {remaining,start};
}
