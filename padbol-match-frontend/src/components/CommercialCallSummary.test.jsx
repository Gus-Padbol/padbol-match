import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import CommercialCallSummary from './CommercialCallSummary';
test('requires all three fields and confirms only after save',async()=>{
 const api={completeCall:jest.fn().mockResolvedValue({version:2})}, onSaved=jest.fn();
 render(<CommercialCallSummary api={api} caseId="x" channel="form" callId="call-1" onSaved={onSaved}/>);
 const button=screen.getByRole('button',{name:'Guardar resumen'});expect(button).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Situación del cliente'),{target:{value:'Busca una sede'}});
 fireEvent.change(screen.getByLabelText('Qué se habló'),{target:{value:'Revisamos opciones'}});
 expect(button).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Detalles importantes'),{target:{value:'Tiene club en Londres'}});
 fireEvent.click(button);await waitFor(()=>expect(onSaved).toHaveBeenCalledWith({version:2}));
 expect(api.completeCall).toHaveBeenCalledWith('x','call-1',{channel:'form',situation:'Busca una sede',discussed:'Revisamos opciones',distinguishing:'Tiene club en Londres'});
 expect(screen.getByText(/Resumen guardado/)).toBeInTheDocument();
});
test('keeps the summary pending when saving fails',async()=>{
 const api={completeCall:jest.fn().mockRejectedValue(new Error('offline'))};
 render(<CommercialCallSummary api={api} caseId="x" channel="whatsapp" callId="call-1"/>);
 for(const label of ['Situación del cliente','Qué se habló','Detalles importantes'])fireEvent.change(screen.getByLabelText(label),{target:{value:'dato'}});
 fireEvent.click(screen.getByText('Guardar resumen'));
 expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar');
 expect(screen.getByText('Resumen pendiente')).toBeInTheDocument();
});
test('advisor explicitly registers an external call before entering summary',async()=>{
 const api={startCall:jest.fn().mockResolvedValue({id:'call-2',status:'pending'}),completeCall:jest.fn()};
 render(<CommercialCallSummary api={api} caseId="x" channel="whatsapp"/>);
 expect(screen.getByText(/Antes de llamar desde tu dispositivo/)).toBeInTheDocument();
 expect(screen.queryByLabelText('Situación del cliente')).toBeNull();
 fireEvent.click(screen.getByText('Registrar videollamada'));
 await screen.findByLabelText('Situación del cliente');
 expect(api.startCall).toHaveBeenCalledWith('x','whatsapp');
 expect(screen.getByText('Resumen pendiente')).toBeInTheDocument();
});
