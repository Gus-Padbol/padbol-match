import {act,fireEvent,render,screen} from '@testing-library/react';
import CrmAttributionTrace from './CrmAttributionTrace';
import {useCrmActivityRead} from '../hooks/useCrmActivityRead';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const lead={id:'A',created_at:'2026-11-01T19:11:37Z',sede_id:null,qualification_data:{form_submission:{fields:{utm_source:'fb',utm_medium:'paid',utm_id:'120240275542960660'}}}};
function Harness({id='A',token='token-A',enabled=true,read,capture}) {
 const result=useCrmActivityRead({token,conversationId:id,enabled,read});
 capture?.(result.reload);
 return <><CrmAttributionTrace conversation={{...lead,id}} activities={result.rows} status={result.status} onRetry={()=>result.reload(id)}/>{result.rows.map(r=><span key={r.id}>{r.summary}</span>)}</>;
}
test('distinguishes zero from failure and retries',async()=>{
 const read=jest.fn().mockRejectedValueOnce(Error('503')).mockResolvedValue([]);render(<Harness read={read}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar');expect(screen.queryByText('Sin actividad registrada')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Reintentar actividad'}));expect(await screen.findByText('Sin actividad registrada')).toBeInTheDocument();expect(read).toHaveBeenCalledTimes(2);
});
test('discards late previous-case response',async()=>{
 const a=deferred(),b=deferred(),read=jest.fn((token,id)=>id==='A'?a.promise:b.promise);const {rerender}=render(<Harness read={read}/>);
 rerender(<Harness id="B" read={read}/>);await act(async()=>a.resolve([{id:1,summary:'A confidential'}]));expect(screen.queryByText('A confidential')).toBeNull();expect(screen.queryByText('Sin actividad registrada')).toBeNull();await act(async()=>b.resolve([]));expect(screen.getByText('Sin actividad registrada')).toBeInTheDocument();
});
test('discards late previous-session response for same case',async()=>{
 const a=deferred(),b=deferred(),read=jest.fn(token=>token==='token-A'?a.promise:b.promise);const {rerender}=render(<Harness read={read}/>);
 rerender(<Harness token="token-B" read={read}/>);await act(async()=>a.resolve([{id:1,summary:'previous session'}]));expect(screen.queryByText('previous session')).toBeNull();await act(async()=>b.resolve([{id:2,summary:'current verified'}]));expect(screen.getByText('current verified')).toBeInTheDocument();expect(screen.getByText('1 actividad registrada')).toBeInTheDocument();
});
test('hides loaded previous-case rows synchronously',async()=>{
 const b=deferred(),read=jest.fn((token,id)=>id==='A'?Promise.resolve([{id:1,summary:'A shown'}]):b.promise);const {rerender}=render(<Harness read={read}/>);await screen.findByText('A shown');rerender(<Harness id="B" read={read}/>);expect(screen.queryByText('A shown')).toBeNull();expect(screen.getByRole('status')).toHaveTextContent('Consultando');await act(async()=>b.resolve([]));
});
test('invalid response does not count as zero',async()=>{
 render(<Harness read={jest.fn().mockResolvedValue({error:'unexpected'})}/>);expect(await screen.findByRole('alert')).toBeInTheDocument();expect(screen.queryByText('Sin actividad registrada')).toBeNull();
});
test('no query or zero claim without access',()=>{
 const read=jest.fn();render(<Harness enabled={false} read={read}/>);expect(screen.getByText('Actividad no disponible en esta vista')).toBeInTheDocument();expect(read).not.toHaveBeenCalled();
});
test('null sede is legitimate incomplete stage, not failed sale',()=>{
 render(<CrmAttributionTrace conversation={lead} activities={[]} status="loaded"/>);expect(screen.getByText('Sin sede todavía')).toBeInTheDocument();expect(screen.getByText('fb · paid')).toBeInTheDocument();expect(screen.getByText('120240275542960660')).toBeInTheDocument();expect(screen.getByText(/no acredita una reserva/)).toBeInTheDocument();
});
test('unexposed sede does not become inferred null',()=>{
 const {sede_id,...unexposed}=lead;render(<CrmAttributionTrace conversation={unexposed} activities={[]} status="unavailable"/>);expect(screen.getByText('Vínculo de sede no disponible en esta vista')).toBeInTheDocument();expect(screen.queryByText('Sin sede todavía')).toBeNull();
});

test('an old save callback cannot clobber the new case read or cancel its result',async()=>{
 const b=deferred(),read=jest.fn((token,id)=>id==='A'?Promise.resolve([]):b.promise);let reload;const capture=fn=>{reload=fn};
 const {rerender}=render(<Harness read={read} capture={capture}/>);await screen.findByText('Sin actividad registrada');const oldReload=reload;
 rerender(<Harness id="B" read={read} capture={capture}/>);await act(async()=>oldReload('A'));expect(read).toHaveBeenCalledTimes(2);
 await act(async()=>b.resolve([{id:3,summary:'B current activity'}]));expect(screen.getByText('B current activity')).toBeInTheDocument();
});
