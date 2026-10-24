import React from 'react';import {fireEvent,render,screen} from '@testing-library/react';import CommercialDictation from './CommercialDictation';
afterEach(()=>{delete window.SpeechRecognition;});
test('does not start microphone until the user requests dictation, and returns an editable draft',()=>{
 let instance;window.SpeechRecognition=class {constructor(){instance=this;this.start=jest.fn();this.abort=jest.fn();this.stop=jest.fn();}};
 const onText=jest.fn();render(<CommercialDictation onText={onText}/>);expect(instance).toBeUndefined();
 fireEvent.click(screen.getByText('Dictar nota'));expect(instance.start).toHaveBeenCalledTimes(1);
 instance.onresult({results:[Object.assign([{transcript:'detalle de la reunión'}],{isFinal:true})]});
 expect(onText).toHaveBeenCalledWith('detalle de la reunión');
});
test('offers text entry when dictation is unavailable',()=>{render(<CommercialDictation onText={()=>{}}/>);expect(screen.getByText(/dictado de tu dispositivo/)).toBeInTheDocument();});
