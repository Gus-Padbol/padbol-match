import {useEffect} from 'react';

function overflowAllowsScroll(el){
  if(!el||typeof getComputedStyle!=='function')return false;
  const y=getComputedStyle(el).overflowY;
  return ['auto','scroll','overlay'].includes(y)&&el.scrollHeight>el.clientHeight+1;
}
export function findScrollable(target,root=null){
  if(!target)return null;
  for(let el=target;el&&el!==document.documentElement;el=el.parentElement){
    if(root&&el!==root&&!root.contains(el))break;
    if(overflowAllowsScroll(el))return el;
    if(el===root)break;
  }
  return null;
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
export function findScrollTarget(target,root=null){
  const el=findScrollable(target,root);
  if(el)return el;
  if(typeof document==='undefined')return null;
  const doc=document.scrollingElement||document.documentElement;
  if(!doc||!doc.scrollHeight||doc.scrollHeight<=doc.clientHeight+1)return null;
  const bodyStyle=typeof getComputedStyle==='function'?getComputedStyle(document.body):null;
  if(bodyStyle&&['hidden','clip'].includes(bodyStyle.overflowY))return null;
  return doc;
}
export default function useCommercialWheelScroll(rootRef,active=true){
  useEffect(()=>{
    if(!active||typeof document==='undefined')return undefined;
    const root=rootRef?.current||document.querySelector('.crm-page--inbox')||document;
    if(!root)return undefined;
    const onWheel=(event)=>{
      if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
      if(Math.abs(Number(event.deltaX||0))>Math.abs(Number(event.deltaY||0)))return;
      if(isNativeControl(event.target))return;
      const target=findScrollTarget(event.target,root);
      if(target&&applyWheelScroll(target,event))event.preventDefault();
    };
    root.addEventListener('wheel',onWheel,{passive:false});
    return()=>root.removeEventListener('wheel',onWheel);
  },[rootRef,active]);
}
