import {useEffect} from 'react';

export function findScrollable(target){
  const el=target?.closest?.('.wa-list,.wa-messages,.wa-detail');
  if(!el)return null;
  return el.scrollHeight>el.clientHeight+1?el:null;
}
export function isNativeControl(target){
  return Boolean(target?.closest?.('textarea,select,[contenteditable="true"],.wa-composer'));
}
export function wheelPixels(event,el){
  const d=Number(event?.deltaY||0);
  if(event?.deltaMode===1)return d*16;
  if(event?.deltaMode===2)return d*(el?.clientHeight||1);
  return d;
}
export function applyWheelScroll(el,event){
  if(!el||!event)return false;
  const delta=wheelPixels(event,el);
  if(!Number.isFinite(delta)||delta===0)return false;
  const before=el.scrollTop;
  const max=Math.max(0,el.scrollHeight-el.clientHeight);
  const next=Math.max(0,Math.min(max,before+delta));
  if(next===before)return false;
  el.scrollTop=next;
  return true;
}
export default function useCommercialWheelScroll(rootRef,active=true){
  useEffect(()=>{
    if(!active||typeof document==='undefined')return undefined;
    const root=rootRef?.current||document.querySelector('.crm-page--inbox')||document;
    const onWheel=(event)=>{
      if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
      if(Math.abs(Number(event.deltaX||0))>Math.abs(Number(event.deltaY||0)))return;
      if(isNativeControl(event.target))return;
      const el=findScrollable(event.target);
      if(!el)return;
      if(applyWheelScroll(el,event))event.preventDefault();
    };
    root.addEventListener('wheel',onWheel,{passive:false});
    return()=>root.removeEventListener('wheel',onWheel);
  },[rootRef,active]);
}
