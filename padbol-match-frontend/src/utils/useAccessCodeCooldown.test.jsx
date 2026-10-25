import React from 'react';
import {render,screen,fireEvent,act} from '@testing-library/react';
import {useAccessCodeCooldown} from './useAccessCodeCooldown';
function Probe(){const state=useAccessCodeCooldown();return <button onClick={state.start}>{state.remaining}</button>;}
afterEach(()=>jest.useRealTimers());
test('waits sixty seconds before resend and clears the interval on expiry',()=>{jest.useFakeTimers();const view=render(<Probe/>);fireEvent.click(screen.getByRole('button'));expect(screen.getByRole('button')).toHaveTextContent('60');act(()=>jest.advanceTimersByTime(59000));expect(screen.getByRole('button')).toHaveTextContent('1');act(()=>jest.advanceTimersByTime(1000));expect(screen.getByRole('button')).toHaveTextContent('0');expect(jest.getTimerCount()).toBe(0);view.unmount();});
test('unmount clears a still-running countdown',()=>{jest.useFakeTimers();const view=render(<Probe/>);fireEvent.click(screen.getByRole('button'));expect(jest.getTimerCount()).toBe(1);view.unmount();expect(jest.getTimerCount()).toBe(0);});
