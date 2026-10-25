import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import CommercialAssignments from './CommercialAssignments';
test('assigns an active advisor to an API-provided case', async () => {
  const api = {listCases: jest.fn().mockResolvedValue({cases:[{id:'case-1',channel:'form',version:2,contact:{name:'Cliente'}}]}), listAdvisors:jest.fn().mockResolvedValue({advisors:[{id:'a',name:'Ana',active:true},{id:'b',name:'Inactivo',active:false}]}), assign:jest.fn().mockResolvedValue({}),addAdvisor:jest.fn()};
  render(<CommercialAssignments api={api}/>);
  await screen.findByText('Cliente');
  expect(screen.queryByRole('option',{name:'Inactivo'})).toBeNull();
  fireEvent.change(screen.getByLabelText('Asignar a'),{target:{value:'a'}});
  fireEvent.click(screen.getByText('Guardar asignación'));
  await waitFor(()=>expect(api.assign).toHaveBeenCalledWith('form','case-1','a',2));
  expect(await screen.findByRole('status')).toHaveTextContent('Asignación actualizada');
});
test('does not claim a failed advisor creation succeeded', async () => {
  const api = {listCases:jest.fn().mockResolvedValue({cases:[]}),listAdvisors:jest.fn().mockResolvedValue({advisors:[]}),assign:jest.fn(),addAdvisor:jest.fn().mockRejectedValue(new Error('offline'))};
  render(<CommercialAssignments api={api}/>);
  await screen.findByText('No hay asesores disponibles.');
  fireEvent.click(screen.getByText('Agregar asesor'));fireEvent.change(screen.getByLabelText('Correo del asesor'),{target:{value:'asesor@example.com'}});
  fireEvent.click(screen.getByText('Solicitar alta'));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar el alta');
  expect(screen.queryByText('Asesor habilitado.')).toBeNull();
});
test('shows conflict and blocks stale assignment until an explicit refresh',async()=>{
 const api={listCases:jest.fn().mockResolvedValue({cases:[{id:'x',channel:'whatsapp',version:1,contact:{name:'Cliente'}}]}),listAdvisors:jest.fn().mockResolvedValue({advisors:[{id:'a',name:'Ana',active:true}]}),assign:jest.fn().mockRejectedValue(Object.assign(new Error('conflict'),{status:409})),addAdvisor:jest.fn()};
 render(<CommercialAssignments api={api}/>);await screen.findByText('Cliente');
 fireEvent.change(screen.getByLabelText('Asignar a'),{target:{value:'a'}});fireEvent.click(screen.getByText('Guardar asignación'));
 expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar');
 expect(screen.queryByText('Guardar asignación')).toBeNull();
 fireEvent.click(screen.getByText('Actualizar lista'));await screen.findByText('Cliente');
 expect(api.assign).toHaveBeenCalledTimes(1);
});
