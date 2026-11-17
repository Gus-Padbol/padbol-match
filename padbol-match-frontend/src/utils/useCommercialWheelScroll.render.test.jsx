import React,{useRef} from 'react';
import {render,fireEvent,cleanup} from '@testing-library/react';
import useCommercialWheelScroll,{findScrollTarget} from './useCommercialWheelScroll';
function Harness({active,ctrl=false}){
 const ref=useRef(null);useCommercialWheelScroll(ref,active);
 return <div ref={ref} className="crm-page--inbox"><div className="wa-messages" data-testid="scroll"><textarea data-testid="ta"/></div></div>;
}
function makeScrollable(el,height=500,client=100){el.style.overflowY='auto';Object.defineProperty(el,'scrollHeight',{value:height,configurable:true});Object.defineProperty(el,'clientHeight',{value:client,configurable:true});el.scrollTop=0;}
test('mounts late, reacts to active, handles delta modes/limits, skips ctrl and native controls, cleans up',async()=>{
 const {rerender}=render(<Harness active={false}/>);const scroller=document.querySelector('.wa-messages');makeScrollable(scroller);
 fireEvent.wheel(scroller,{deltaY:50});expect(scroller.scrollTop).toBe(0);
 rerender(<Harness active/>);fireEvent.wheel(scroller,{deltaY:50});expect(scroller.scrollTop).toBe(50);
 fireEvent.wheel(scroller,{deltaY:1,deltaMode:1});expect(scroller.scrollTop).toBe(66);
 fireEvent.wheel(scroller,{deltaY:-100});expect(scroller.scrollTop).toBe(0);
 fireEvent.wheel(scroller,{deltaY:50,ctrlKey:true});expect(scroller.scrollTop).toBe(0);
 const ta=document.querySelector('textarea');fireEvent.wheel(ta,{deltaY:50});expect(scroller.scrollTop).toBe(0);
 cleanup();const detached=document.querySelector('.wa-messages');if(detached){fireEvent.wheel(detached,{deltaY:50});expect(detached.scrollTop).toBe(0);}
});

test('nested non-overflow .wa-messages falls back to outer document scroll',()=>{
 const root=document.createElement('div');root.className='crm-page--inbox';document.body.appendChild(root);const target=document.createElement('p');root.appendChild(target);const doc=document.scrollingElement||document.documentElement;makeScrollable(doc,800,100);
 expect(findScrollTarget(target,root)).toBe(doc); root.remove();
});
