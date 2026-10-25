import React from 'react';import {render,screen} from '@testing-library/react';import CommercialCaseDetail from './CommercialCaseDetail';
jest.mock('./CommercialLeadManagement',()=>({caseItem})=><div>Gestión y agenda de {caseItem.id}</div>);
test('loads a pending call and prevents response to suspended case',async()=>{
 const api={listActivities:jest.fn().mockResolvedValue({activities:[]}),readCase:jest.fn().mockResolvedValue({status:'suspended',contact:{name:'Cliente'},inbound:[{id:'1',body:'Hola'}]}),listCalls:jest.fn().mockResolvedValue({calls:[{id:'c',status:'pending'}]})};
 render(<CommercialCaseDetail item={{id:'x',channel:'whatsapp'}} api={api}/>);
 await screen.findByText('Cliente');expect(screen.getByText(/en revisión/)).toBeInTheDocument();expect(screen.getByText('Gestión y agenda de x')).toBeInTheDocument();expect(screen.getByText('Enviar respuesta')).toBeDisabled();
});
test('muestra contacto y progreso guardado y mantiene advertencia sobre chats personales',async()=>{
 const api={listActivities:jest.fn().mockResolvedValue({activities:[]}),readCase:jest.fn().mockResolvedValue({status:'open',version:3,progressState:'en_espera',nextStep:'Llamar mañana',contact:{name:'Cliente',phone:'12345'},inbound:[],replies:[]}),listCalls:jest.fn().mockResolvedValue({calls:[]})};
 render(<CommercialCaseDetail item={{id:'x',channel:'whatsapp'}} api={api}/>);
 await screen.findByText('Cliente');expect(screen.getByText('12345')).toHaveAttribute('href','tel:12345');expect(screen.getByText('Gestión y agenda de x')).toBeInTheDocument();expect(screen.getByText(/no aparecen automáticamente/)).toBeInTheDocument();
});

test('uses the same scoped management and agenda for advisor case details',async()=>{
 const api={listActivities:jest.fn().mockResolvedValue({activities:[]}),readCase:jest.fn().mockResolvedValue({status:'open',version:3,progressState:'nuevo',contact:{name:'Cliente'}}),listCalls:jest.fn().mockResolvedValue({calls:[]})};
 render(<CommercialCaseDetail item={{id:'case',channel:'form'}} api={api}/>);await screen.findByText('Cliente');expect(screen.getByText('Gestión y agenda de case')).toBeInTheDocument();
});
