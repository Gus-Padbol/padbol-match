import React from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import CommercialFollowupActivation from './CommercialFollowupActivation';

const ready=language=>({ready:true,enabled:true,templatesReady:true,language,templateKey:`commercial_waiting_${language}_v1`});
const active=()=>({id:'plan-synthetic',status:'active',conversationId:'conversation-synthetic',language:'es',templateKey:'commercial_waiting_es_v1'});
const cancelled=()=>({id:'plan-synthetic',status:'cancelled',conversationId:'conversation-synthetic'});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function begin(operation){
 if(operation==='cancel'){fireEvent.click(screen.getByRole('button',{name:'Detener seguimiento'}));return;}
 await screen.findByText(/Plantillas y envío verificados/);
 fireEvent.click(screen.getByLabelText(/Confirmo que autorizó/));
 fireEvent.change(screen.getByLabelText('Cómo lo autorizó'),{target:{value:'Evidencia sintética explícita'}});
 fireEvent.click(screen.getByRole('button',{name:'Activar seguimiento'}));
}
function fixture(operation,pending){return {
 getFollowupReadiness:jest.fn((_id,_channel,language)=>Promise.resolve(ready(language))),
 startFollowup:jest.fn(()=>operation==='start'?pending.promise:Promise.resolve(active())),
 cancelFollowup:jest.fn(()=>operation==='cancel'?pending.promise:Promise.resolve(cancelled())),
};}
test.each([['start','resolve'],['start','reject'],['cancel','resolve'],['cancel','reject']])('%s after unmount (%s) never calls obsolete callback',async(operation,settle)=>{
 const pending=deferred(),api=fixture(operation,pending),onChanged=jest.fn();
 const view=render(<CommercialFollowupActivation caseId="case-a" channel="whatsapp" api={api} active={operation==='cancel'} onChanged={onChanged}/>);
 await begin(operation);
 expect(api[operation==='start'?'startFollowup':'cancelFollowup']).toHaveBeenCalledTimes(1);
 view.unmount();
 await act(async()=>{if(settle==='resolve')pending.resolve(operation==='start'?active():cancelled());else pending.reject(new Error('synthetic failure'));await pending.promise.catch(()=>{});});
 expect(onChanged).not.toHaveBeenCalled();
});
test.each(['start','cancel'])('old %s finally cannot unlock new pending operation or call obsolete callback',async operation=>{
 const first=deferred(),second=deferred(),api=fixture(operation,first),oldCallback=jest.fn(),newCallback=jest.fn();
 const method=operation==='start'?'startFollowup':'cancelFollowup';
 api[method].mockImplementationOnce(()=>first.promise).mockImplementationOnce(()=>second.promise);
 const view=render(<CommercialFollowupActivation caseId="case-a" channel="whatsapp" api={api} active={operation==='cancel'} onChanged={oldCallback}/>);
 await begin(operation);
 view.rerender(<CommercialFollowupActivation caseId="case-b" channel="whatsapp" api={api} active={operation==='cancel'} onChanged={newCallback}/>);
 await begin(operation);
 const button=screen.getByRole('button',{name:operation==='start'?'Activar seguimiento':'Detener seguimiento'});
 expect(button).toBeDisabled();
 await act(async()=>{first.resolve(operation==='start'?active():cancelled());await first.promise;});
 expect(button).toBeDisabled();expect(oldCallback).not.toHaveBeenCalled();expect(newCallback).not.toHaveBeenCalled();
 expect(screen.queryByText(operation==='start'?'Seguimiento activado. Se detendrá si la persona responde.':'Seguimiento detenido.')).not.toBeInTheDocument();
 await act(async()=>{second.resolve(operation==='start'?active():cancelled());await second.promise;});
 await waitFor(()=>expect(newCallback).toHaveBeenCalledTimes(1));expect(oldCallback).not.toHaveBeenCalled();
});
test('old language start response cannot update the current language view',async()=>{
 const pending=deferred(),api=fixture('start',pending),onChanged=jest.fn();
 render(<CommercialFollowupActivation caseId="case-a" channel="whatsapp" api={api} onChanged={onChanged}/>);
 await begin('start');fireEvent.change(screen.getByLabelText('Idioma'),{target:{value:'en'}});
 await screen.findByText(/Plantillas y envío verificados/);
 await act(async()=>{pending.resolve(active());await pending.promise;});
 expect(onChanged).not.toHaveBeenCalled();expect(screen.queryByText(/Seguimiento activado\./)).not.toBeInTheDocument();
});
