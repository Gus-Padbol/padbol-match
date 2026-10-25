import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import CommercialAgendaAlerts,{agendaItems} from './CommercialAgendaAlerts';
const at=Date.parse('2030-01-10T12:00:00Z');
const item={id:'case',conversationId:'conversation',channel:'whatsapp',contact:{name:'Tomislav'},nextContactAt:new Date(at).toISOString(),reminderHours:[24,8],progressState:'en_espera'};
test('defaults produce distinct 24 hour and 8 hour stages and an overdue warning',()=>{
 expect(agendaItems([item],at-25*3600000)[0].reminder).toBeNull();
 expect(agendaItems([item],at-24*3600000)[0].reminder).toBe(24);
 expect(agendaItems([item],at-8*3600000)[0].reminder).toBe(8);
 expect(agendaItems([item],at+1)[0].overdue).toBe(true);
 expect(agendaItems([{...item,progressState:'cerrado'}],at)).toEqual([]);
});
test('advisor can choose one hour and reminder uses the absolute appointment instant',()=>{
 const custom={...item,reminderHours:[1],nextContactAt:'2030-01-10T09:00:00-03:00'};
 expect(agendaItems([custom],at-2*3600000)[0].reminder).toBeNull();
 expect(agendaItems([custom],at-3600000)[0].reminder).toBe(1);
});
test('agenda opens the stored case and its history without sending messages',async()=>{
 const onOpen=jest.fn(),api={listCases:jest.fn().mockResolvedValue({cases:[{...item,nextContactAt:new Date(Date.now()+2*3600000).toISOString()}]})};
 render(<CommercialAgendaAlerts api={api} onOpen={onOpen}/>);fireEvent.click(screen.getByText('Agenda'));
 await screen.findByText('Prepárate para tu charla con Tomislav');fireEvent.click(screen.getByText('Abrir ficha e historial'));
 expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({id:'case',conversationId:'conversation'}));
});
