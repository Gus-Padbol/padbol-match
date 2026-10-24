import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import CommercialFollowupActivation from './CommercialFollowupActivation';

test('requires explicit consent and evidence before a followup can start', async () => {
  const api={startFollowup:jest.fn().mockResolvedValue({status:'waiting'}),cancelFollowup:jest.fn()};
  render(<CommercialFollowupActivation caseId="case-1" channel="whatsapp" api={api}/>);
  const start=screen.getByRole('button',{name:'Activar seguimiento'});
  expect(start).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/Confirmo que autorizó/));
  fireEvent.change(screen.getByLabelText('Cómo lo autorizó'),{target:{value:'Lo autorizó por WhatsApp'}});
  await waitFor(() => expect(start).not.toBeDisabled());
  fireEvent.click(start);
  await waitFor(()=>expect(api.startFollowup).toHaveBeenCalledWith('case-1','whatsapp',{consent:true,evidence:'Lo autorizó por WhatsApp',language:'es'}));
  expect(await screen.findByRole('status')).toHaveTextContent('Seguimiento activado');
});

test('does not show WhatsApp followup controls for form cases',()=>{
  const {container}=render(<CommercialFollowupActivation caseId="case-1" channel="form" api={{}}/>);
  expect(container).toBeEmptyDOMElement();
});
