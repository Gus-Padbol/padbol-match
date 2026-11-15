import React from 'react';
import {render,screen,act} from '@testing-library/react';
import useServerCronometro from './useServerCronometro';
function Clock({seconds,active=true,start='start-a'}) {
 const time=useServerCronometro({display:{cronometroSegundos:seconds,cronometroActivo:active},cronometro_pausado:!active,cronometro_inicio:start});
 return <output aria-label="clock">{time}</output>;
}
beforeEach(()=>{jest.useFakeTimers();jest.setSystemTime(new Date('2026-11-15T12:00:00.000Z'));});
afterEach(()=>jest.useRealTimers());
test('new server snapshot between local ticks never subtracts a second',()=>{
 const view=render(<Clock seconds={10}/>);expect(screen.getByLabelText('clock')).toHaveTextContent('10');
 act(()=>jest.advanceTimersByTime(500));view.rerender(<Clock seconds={11}/>);
 expect(screen.getByLabelText('clock')).toHaveTextContent('11');
 act(()=>jest.advanceTimersByTime(1500));expect(screen.getByLabelText('clock')).toHaveTextContent('12');
 view.rerender(<Clock seconds={13}/>);expect(screen.getByLabelText('clock')).toHaveTextContent('13');
});
test('server pause stays frozen; resume and restart cannot use an old negative elapsed interval',()=>{
 const view=render(<Clock seconds={10}/>);act(()=>jest.advanceTimersByTime(2000));
 view.rerender(<Clock seconds={12} active={false}/>);act(()=>jest.advanceTimersByTime(10000));expect(screen.getByLabelText('clock')).toHaveTextContent('12');
 view.rerender(<Clock seconds={12}/>);expect(screen.getByLabelText('clock')).toHaveTextContent('12');act(()=>jest.advanceTimersByTime(1000));expect(screen.getByLabelText('clock')).toHaveTextContent('13');
 view.rerender(<Clock seconds={0} start="new-practice-run"/>);expect(screen.getByLabelText('clock')).toHaveTextContent('0');act(()=>jest.advanceTimersByTime(1000));expect(screen.getByLabelText('clock')).toHaveTextContent('1');
});
