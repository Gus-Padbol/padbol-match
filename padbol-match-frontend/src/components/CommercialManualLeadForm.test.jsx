import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import CommercialManualLeadForm from './CommercialManualLeadForm';

function api(overrides={}) {
  return {
    getRole: jest.fn().mockResolvedValue({role:'manager'}),
    listAdvisors: jest.fn().mockResolvedValue({advisors:[{id:'advisor-1',name:'Juan Pablo',email:'juan@example.com',active:true}]}),
    searchManual: jest.fn().mockResolvedValue({matches:[]}),
    createManual: jest.fn().mockResolvedValue({ok:true,existing:false,conversationId:'case-new',caseId:'case-new'}),
    readManual: jest.fn().mockResolvedValue({
      id:'case-edit', contact:{nombre:'Ada',email_normalized:'ada@example.com',phone_normalized:'5491112345678'},
      manualData:{company:'Club Ada',country:'Argentina',city:'La Plata',interest:'club',source_detail:'Referido'},
      status:'en_atencion',nextStep:'Enviar propuesta',nextContactAt:'2026-11-12T19:30:00Z',reminderHours:[24,8],
      fields:{}, notes:'Nota original', assignedAdvisor:{id:'advisor-1',name:'Juan Pablo'}, closureOutcome:null,
    }),
    updateManual: jest.fn().mockResolvedValue({id:'case-edit'}),
    ...overrides,
  };
}

test('crea un lead manual completo y lo abre en el seguimiento', async()=>{
  const mocked=api(); const created=jest.fn(), closed=jest.fn();
  render(<CommercialManualLeadForm api={mocked} mode="create" onCreated={created} onClose={closed}/>);
  fireEvent.change(screen.getByLabelText('Nombre y apellido'),{target:{value:'Juan Pérez'}});
  fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'juan@example.com'}});
  fireEvent.change(screen.getByLabelText('Empresa, club o sede'),{target:{value:'Club Norte'}});
  fireEvent.change(screen.getByLabelText('País'),{target:{value:'Argentina'}});
  fireEvent.change(screen.getByLabelText('Ciudad o región'),{target:{value:'La Plata'}});
  fireEvent.change(screen.getByLabelText('Procedencia conocida Opcional'),{target:{value:'Referido'}});
  fireEvent.change(screen.getByLabelText('Notas iniciales'),{target:{value:'Quiere sumar una cancha.'}});
  fireEvent.change(screen.getByLabelText('Próximo paso'),{target:{value:'Enviar propuesta'}});
  fireEvent.click(screen.getByRole('button',{name:'Crear lead y abrir seguimiento'}));
  await waitFor(()=>expect(mocked.createManual).toHaveBeenCalled());
  const payload=mocked.createManual.mock.calls[0][0];
  expect(payload).toMatchObject({name:'Juan Pérez',email:'juan@example.com',company:'Club Norte',country:'Argentina',city:'La Plata',interest:'club',sourceDetail:'Referido',notes:'Quiere sumar una cancha.',nextStep:'Enviar propuesta',status:'nuevo'});
  await waitFor(()=>expect(created).toHaveBeenCalledWith('case-new'));
});

test('busca coincidencias y abre una ficha existente sin crear otra', async()=>{
  const mocked=api({searchManual:jest.fn().mockResolvedValue({matches:[{id:'contact-1',nombre:'Juan Pérez',email_normalized:'juan@example.com',phone_normalized:'5491112345678',case_id:'case-existing'}]})});
  const open=jest.fn();
  render(<CommercialManualLeadForm api={mocked} mode="create" onOpenExisting={open} onClose={()=>{}}/>);
  fireEvent.change(screen.getByLabelText('Correo electrónico'),{target:{value:'juan@example.com'}});
  fireEvent.click(screen.getByRole('button',{name:'Buscar coincidencias'}));
  await screen.findByText('Juan Pérez');
  fireEvent.click(screen.getByRole('button',{name:'Abrir ficha existente'}));
  expect(open).toHaveBeenCalledWith('case-existing');
  expect(mocked.createManual).not.toHaveBeenCalled();
});

test('edita una ficha existente sin modificar el responsable desde este formulario', async()=>{
  const mocked=api();
  render(<CommercialManualLeadForm api={mocked} mode="edit" caseId="case-edit" onCreated={jest.fn()} onClose={()=>{}}/>);
  await screen.findByDisplayValue('Ada');
  expect(screen.getByLabelText('Responsable comercial')).toHaveValue('Juan Pablo');
  fireEvent.change(screen.getByLabelText('Ciudad o región'),{target:{value:'Berisso'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));
  await waitFor(()=>expect(mocked.updateManual).toHaveBeenCalledWith('case-edit',expect.objectContaining({city:'Berisso',name:'Ada',email:'ada@example.com'})));
});
