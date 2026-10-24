import React from 'react';import {render,screen,fireEvent,waitFor} from '@testing-library/react';import CommercialCaseDetail from './CommercialCaseDetail';
test('loads a pending call and prevents response to suspended case',async()=>{
 const api={listActivities:jest.fn().mockResolvedValue({activities:[]}),readCase:jest.fn().mockResolvedValue({status:'suspended',contact:{name:'Cliente'},inbound:[{id:'1',body:'Hola'}]}),listCalls:jest.fn().mockResolvedValue({calls:[{id:'c',status:'pending'}]})};
 render(<CommercialCaseDetail item={{id:'x',channel:'whatsapp'}} api={api}/>);
 await screen.findByText('Cliente');expect(screen.getByText(/en revisión/)).toBeInTheDocument();expect(screen.getByLabelText('Situación del cliente')).toBeInTheDocument();expect(screen.getByText('Enviar respuesta')).toBeDisabled();
});
test('muestra contacto y progreso guardado y mantiene advertencia sobre chats personales',async()=>{
 const api={listActivities:jest.fn().mockResolvedValue({activities:[]}),readCase:jest.fn().mockResolvedValue({status:'open',version:3,progressState:'en_espera',nextStep:'Llamar mañana',contact:{name:'Cliente',phone:'12345'},inbound:[],replies:[]}),listCalls:jest.fn().mockResolvedValue({calls:[]})};
 render(<CommercialCaseDetail item={{id:'x',channel:'whatsapp'}} api={api}/>);
 await screen.findByText('Cliente');expect(screen.getByText('12345')).toHaveAttribute('href','tel:12345');expect(screen.getByLabelText('Estado')).toHaveValue('en_espera');expect(screen.getByLabelText('Próximo paso')).toHaveValue('Llamar mañana');expect(screen.getByText(/no aparecen automáticamente/)).toBeInTheDocument();
});

test('guarda el próximo paso con la versión devuelta por el servidor',async()=>{
 const api={listActivities:jest.fn().mockResolvedValue({activities:[]}),readCase:jest.fn().mockResolvedValue({status:'open',version:3,progressState:'nuevo',nextStep:null,contact:{name:'Cliente'}}),listCalls:jest.fn().mockResolvedValue({calls:[]}),progress:jest.fn().mockResolvedValue({version:4})};
 render(<CommercialCaseDetail item={{id:'case',channel:'form'}} api={api}/>);await screen.findByText('Cliente');fireEvent.change(screen.getByLabelText('Estado'),{target:{value:'en_espera'}});fireEvent.change(screen.getByLabelText('Próximo paso'),{target:{value:'Llamar mañana'}});fireEvent.click(screen.getByText('Guardar estado'));await waitFor(()=>expect(api.progress).toHaveBeenCalledWith('case','form',3,'en_espera','Llamar mañana'));
});
