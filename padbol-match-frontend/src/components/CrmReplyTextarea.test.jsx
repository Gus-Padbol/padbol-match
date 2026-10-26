import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import CrmReplyTextarea from './CrmReplyTextarea';
test('draft grows with content, remains original and never submits while typing',()=>{
 const change=jest.fn();const {rerender}=render(<CrmReplyTextarea aria-label="Respuesta" value="" onChange={change}/>);
 const el=screen.getByLabelText('Respuesta');expect(el).toHaveAttribute('rows','7');expect(el).toHaveAttribute('translate','no');expect(el).toHaveClass('notranslate');
 Object.defineProperty(el,'scrollHeight',{configurable:true,value:260});rerender(<CrmReplyTextarea aria-label="Respuesta" value="Texto largo" onChange={change}/>);expect(el.style.height).toBe('260px');
 Object.defineProperty(el,'scrollHeight',{configurable:true,value:900});rerender(<CrmReplyTextarea aria-label="Respuesta" value="Más texto" onChange={change}/>);expect(el.style.height).toBe('360px');
 fireEvent.change(el,{target:{value:'Draft in original language'}});expect(change).toHaveBeenCalledTimes(1);
 Object.defineProperty(el,'scrollHeight',{configurable:true,value:40});rerender(<CrmReplyTextarea aria-label="Respuesta" value="" onChange={change}/>);expect(el.style.height).toBe('160px');
});
