import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import CommercialFollowupActivation from './CommercialFollowupActivation';

test('requires explicit consent and evidence before a followup can start', async () => {
  const api={getFollowupReadiness:jest.fn().mockResolvedValue({ready:true,templatesReady:true,enabled:true}),startFollowup:jest.fn().mockResolvedValue({status:'waiting'}),cancelFollowup:jest.fn()};
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

test('plantillas no verificadas bloquean la activación incluso con consentimiento',async()=>{const api={getFollowupReadiness:jest.fn().mockResolvedValue({ready:false,enabled:false,templatesReady:false,reason:'Faltan plantillas aprobadas por Meta.'}),startFollowup:jest.fn()};render(<CommercialFollowupActivation caseId="case-1" channel="whatsapp" api={api}/>);expect(await screen.findByText('Faltan plantillas aprobadas por Meta.')).toBeInTheDocument();fireEvent.click(screen.getByLabelText(/Confirmo que autorizó/));fireEvent.change(screen.getByLabelText('Cómo lo autorizó'),{target:{value:'Lo autorizó por WhatsApp'}});expect(screen.getByRole('button',{name:'Activar seguimiento'})).toBeDisabled();expect(api.startFollowup).not.toHaveBeenCalled();});
test('un seguimiento almacenado sin envío habilitado no se presenta como activo',async()=>{const api={getFollowupReadiness:jest.fn().mockResolvedValue({ready:false,reason:'Envío pendiente de habilitación.'})};render(<CommercialFollowupActivation caseId="case-1" channel="whatsapp" api={api} active/>);await screen.findByText('Envío pendiente de habilitación.');expect(screen.getByText(/no se enviarán mensajes/)).toBeInTheDocument();expect(screen.queryByText(/El seguimiento está activo/)).not.toBeInTheDocument();});
test('cambiar el idioma exige verificar sus plantillas y no reutiliza la disponibilidad anterior',async()=>{const api={getFollowupReadiness:jest.fn().mockImplementation((id,ch,lang)=>Promise.resolve(lang==='es'?{ready:true}:{ready:false,reason:'Plantillas en inglés pendientes.'})),startFollowup:jest.fn()};render(<CommercialFollowupActivation caseId="case-1" channel="whatsapp" api={api}/>);await screen.findByText(/Plantillas y envío verificados/);fireEvent.click(screen.getByLabelText(/Confirmo que autorizó/));fireEvent.change(screen.getByLabelText('Cómo lo autorizó'),{target:{value:'Autorizado'}});expect(screen.getByRole('button',{name:'Activar seguimiento'})).toBeEnabled();fireEvent.change(screen.getByLabelText('Idioma'),{target:{value:'en'}});expect(screen.getByRole('button',{name:'Activar seguimiento'})).toBeDisabled();await screen.findByText('Plantillas en inglés pendientes.');expect(api.getFollowupReadiness).toHaveBeenLastCalledWith('case-1','whatsapp','en');expect(api.startFollowup).not.toHaveBeenCalled();});
