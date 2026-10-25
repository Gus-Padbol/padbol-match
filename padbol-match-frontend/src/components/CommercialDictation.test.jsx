import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import CommercialDictation from './CommercialDictation';
let sessions;
function engine(){sessions=[];window.SpeechRecognition=class{constructor(){sessions.push(this);this.start=jest.fn();this.abort=jest.fn();this.stop=jest.fn();}};}
const result=(text,final=true)=>Object.assign([{transcript:text}],{isFinal:final});
afterEach(()=>{delete window.SpeechRecognition;jest.useRealTimers();});
test('microphone starts only on request and cumulative final results are appended once',()=>{
 engine();const onText=jest.fn();render(<CommercialDictation onText={onText}/>);expect(sessions).toHaveLength(0);
 fireEvent.click(screen.getByText('Dictar resumen'));expect(sessions[0].continuous).toBe(true);expect(sessions[0].interimResults).toBe(true);
 act(()=>sessions[0].onresult({results:[result('primera frase')]}));
 act(()=>sessions[0].onresult({results:[result('primera frase'),result('segunda frase')]}));
 expect(onText.mock.calls).toEqual([['primera frase'],['segunda frase']]);
});
test('a browser pause restarts listening and manual finish prevents another restart',()=>{
 jest.useFakeTimers();engine();const listening=jest.fn();render(<CommercialDictation onText={()=>{}} onListeningChange={listening}/>);
 fireEvent.click(screen.getByText('Dictar resumen'));act(()=>sessions[0].onerror({error:'no-speech'}));act(()=>sessions[0].onend());act(()=>jest.advanceTimersByTime(300));expect(sessions).toHaveLength(2);
 expect(listening).not.toHaveBeenCalledWith(false);
 fireEvent.click(screen.getByText('Terminar dictado'));expect(sessions[1].stop).toHaveBeenCalledTimes(1);
 act(()=>sessions[1].onend());act(()=>jest.advanceTimersByTime(1000));expect(sessions).toHaveLength(2);expect(listening).toHaveBeenLastCalledWith(false);
});
test('shows interim text and preserves it if browser ends before final result',()=>{
 jest.useFakeTimers();engine();const onText=jest.fn();render(<CommercialDictation onText={onText}/>);fireEvent.click(screen.getByText('Dictar resumen'));
 act(()=>sessions[0].onresult({results:[result('quiere dos canchas',false)]}));expect(screen.getByText('quiere dos canchas')).toBeInTheDocument();expect(onText).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Terminar dictado'));act(()=>sessions[0].onend());expect(onText).toHaveBeenCalledWith('quiere dos canchas');
});
test('permission failure does not loop and navigation aborts the microphone',()=>{
 jest.useFakeTimers();engine();const view=render(<CommercialDictation onText={()=>{}}/>);fireEvent.click(screen.getByText('Dictar resumen'));
 act(()=>sessions[0].onerror({error:'not-allowed'}));act(()=>sessions[0].onend());act(()=>jest.advanceTimersByTime(1000));expect(sessions).toHaveLength(1);expect(screen.getByRole('alert')).toHaveTextContent('permiso');
 fireEvent.click(screen.getByText('Dictar resumen'));view.unmount();expect(sessions[1].abort).toHaveBeenCalled();expect(sessions[1].onresult).toBeNull();
});
test('offers text entry when dictation is unavailable',()=>{render(<CommercialDictation onText={()=>{}}/>);expect(screen.getByText(/dictado de tu dispositivo/)).toBeInTheDocument();});

test('a transient connection error reconnects and preserves its draft exactly once',()=>{
 jest.useFakeTimers();engine();const onText=jest.fn();render(<CommercialDictation onText={onText}/>);fireEvent.click(screen.getByText('Dictar resumen'));
 act(()=>sessions[0].onresult({results:[result('retomar el próximo mes',false)]}));act(()=>sessions[0].onerror({error:'network'}));expect(screen.getByRole('status')).toHaveTextContent('Reconectando');
 act(()=>sessions[0].onend());expect(onText).toHaveBeenCalledTimes(1);act(()=>jest.advanceTimersByTime(500));expect(sessions).toHaveLength(2);
 act(()=>sessions[1].onresult({results:[result('para hablar del proyecto')]}));expect(onText.mock.calls).toEqual([['retomar el próximo mes'],['para hablar del proyecto']]);expect(screen.getByRole('status')).toHaveTextContent('Escuchando');
});
test('repeated network failures stop after three retries without an infinite loop',()=>{
 jest.useFakeTimers();engine();render(<CommercialDictation onText={()=>{}}/>);fireEvent.click(screen.getByText('Dictar resumen'));
 for(let i=0;i<4;i++){act(()=>sessions[i].onerror({error:'network'}));act(()=>sessions[i].onend());act(()=>jest.advanceTimersByTime(2000));}
 expect(sessions).toHaveLength(4);expect(screen.getByRole('alert')).toHaveTextContent('se conserva');expect(screen.getByText('Dictar resumen')).toBeInTheDocument();
});
test('manual finish during reconnection cancels the pending retry',()=>{
 jest.useFakeTimers();engine();render(<CommercialDictation onText={()=>{}}/>);fireEvent.click(screen.getByText('Dictar resumen'));act(()=>sessions[0].onerror({error:'network'}));act(()=>sessions[0].onend());fireEvent.click(screen.getByText('Terminar dictado'));act(()=>jest.advanceTimersByTime(2000));expect(sessions).toHaveLength(1);expect(screen.getByText('Dictar resumen')).toBeInTheDocument();
});
