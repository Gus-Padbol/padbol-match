import {useCallback,useEffect,useRef,useState} from 'react';

// Activity belongs to the exact session/case read, never the previously selected case.
export function useCrmActivityRead({token,conversationId,enabled,read}) {
  const [snapshot,setSnapshot]=useState(null);
  const current=useRef(null),version=useRef(0);
  current.current={token,conversationId,enabled};
  const reload=useCallback(async id=>{
    const target=id??conversationId;
    if(current.current.token!==token||current.current.conversationId!==target||current.current.enabled!==enabled)return;
    const request=++version.current;
    const isCurrent=()=>request===version.current&&current.current.token===token&&current.current.conversationId===target&&current.current.enabled===enabled;
    if(!enabled||!token||!target)return;
    setSnapshot({token,id:target,status:'loading',rows:[]});
    try {
      const rows=await read(token,target);
      if(!Array.isArray(rows))throw Error('ACTIVITY_READ_INVALID');
      if(isCurrent())setSnapshot({token,id:target,status:'loaded',rows});
    }catch {
      if(isCurrent())setSnapshot({token,id:target,status:'error',rows:[]});
    }
  },[token,conversationId,enabled,read]);
  useEffect(()=>{void reload(conversationId);return()=>{version.current+=1;};},[conversationId,reload]);
  if(!enabled||!token||!conversationId)return {rows:[],status:'unavailable',reload};
  const valid=snapshot?.token===token&&snapshot?.id===conversationId;
  return {rows:valid?snapshot.rows:[],status:valid?snapshot.status:'loading',reload};
}
