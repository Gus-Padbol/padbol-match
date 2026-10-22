import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import StripeSessionBoundary from './StripeSessionBoundary';

function FakeStripe({pending}) {
 const [secret,setSecret]=React.useState('');
 return <><button onClick={()=>pending.then(setSecret)}>prepare</button><span>{secret || 'no card'}</span></>;
}
test('booking change destroys previous session and ignores a late preparation result',async()=>{
 let resolve;const pending=new Promise(r=>{resolve=r});
 const view=render(<StripeSessionBoundary identity={[7,'18:00',60,100,[],true]}><FakeStripe pending={pending}/></StripeSessionBoundary>);
 fireEvent.click(screen.getByText('prepare'));
 view.rerender(<StripeSessionBoundary identity={[7,'19:00',60,100,[],true]}><FakeStripe pending={pending}/></StripeSessionBoundary>);
 await act(async()=>{resolve('old card');await pending});
 expect(screen.getByText('no card')).toBeInTheDocument();
 expect(screen.queryByText('old card')).not.toBeInTheDocument();
});
test('venue, time, duration, amount, extras or permission changes invalidate card session',async()=>{
 const initial=[7,'18:00',60,100,[],true];
 for(const changed of [[8,'18:00',60,100,[],true],[7,'19:00',60,100,[],true],[7,'18:00',90,100,[],true],[7,'18:00',60,200,[],true],[7,'18:00',60,100,[1],true],[7,'18:00',60,100,[],false]]) {
  const pending=Promise.resolve('card');const view=render(<StripeSessionBoundary identity={initial}><FakeStripe pending={pending}/></StripeSessionBoundary>);
  fireEvent.click(screen.getByText('prepare'));await act(async()=>{await pending});expect(screen.getByText('card')).toBeInTheDocument();
  view.rerender(<StripeSessionBoundary identity={changed}><FakeStripe pending={pending}/></StripeSessionBoundary>);expect(screen.getByText('no card')).toBeInTheDocument();view.unmount();
 }
});
