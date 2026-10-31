import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import PagoExitoso from './PagoExitoso';
import PagoFallido from './PagoFallido';
import {readPaymentConfirmation} from '../utils/paymentReturn';
import {useAuth} from '../context/AuthContext';
import {supabase} from '../supabaseClient';
import {saveMpReservaPendingSlot,readMpReservaPendingSlot} from '../utils/reservaReturnUrl';
jest.mock('../utils/paymentReturn',()=>({...jest.requireActual('../utils/paymentReturn'),readPaymentConfirmation:jest.fn()}));
jest.mock('../supabaseClient',()=>({supabase:{auth:{getSession:jest.fn()}}}));
jest.mock('../components/AppHeader',()=>()=>null);jest.mock('../components/BottomNav',()=>()=>null);
jest.mock('../components/SuccessPaymentHeroCheck',()=>()=>null);
jest.mock('../components/SponsorBannerReserva',()=>()=>null);jest.mock('../components/HubSponsorsTicker',()=>()=>null);
jest.mock('../hooks/useSponsor',()=>({useSponsor:()=>({sponsor:null})}));
jest.mock('../hooks/useSedeTickerSponsors',()=>({useSedeTickerSponsors:()=>({sponsors:[]})}));
jest.mock('../hooks/useHubJugarSponsorSlots',()=>({useHubJugarSponsorSlots:()=>({getSlot:()=>null})}));
jest.mock('../components/HubJugarSponsorSurfaces',()=>({HubJugarSlotRect:()=>null}));
jest.mock('../context/HubNavLayoutContext',()=>({useHubNavLayout:()=>({navDock:'bottom'})}));
jest.mock('../context/AuthContext',()=>({useAuth:jest.fn()}));
jest.mock('../hooks/usePadcoinsActiveCampaign',()=>({usePadcoinsActiveCampaign:()=>({campaign:null})}));
jest.mock('../components/PadcoinsCampaignPlayerSurfaces',()=>({PadcoinsCampaignPlayerHint:()=>null}));
jest.mock('../i18n/tSafe',()=>{const t=key=>key;return {useSafeTranslation:()=>({t})};});
jest.mock('../components/icons/GeroIcons',()=>({IconGeroUbicacion:()=>null}));
jest.mock('qrcode.react',()=>({QRCodeCanvas:()=>null}));
const pending={reserva_id:7,release_token:'local-capability',sedeId:1};
beforeEach(()=>{useAuth.mockReturnValue({session:null});sessionStorage.clear();saveMpReservaPendingSlot(pending);global.fetch=jest.fn();readPaymentConfirmation.mockReset();supabase.auth.getSession.mockReset();supabase.auth.getSession.mockResolvedValue({data:{session:null}});});
const mountSuccess=()=>render(<MemoryRouter initialEntries={['/pago-exitoso?payment_id=fixture']}><PagoExitoso/></MemoryRouter>);
test('pending does not clear checkout or display a false confirmation; manual retry performs read only',async()=>{readPaymentConfirmation.mockResolvedValue({confirmed:false});mountSuccess();await screen.findByText('Pago pendiente de confirmación');expect(screen.queryByText('¡Pago exitoso!')).not.toBeInTheDocument();expect(readMpReservaPendingSlot()).toEqual(pending);expect(global.fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Volver a consultar'));await waitFor(()=>expect(readPaymentConfirmation).toHaveBeenCalledTimes(2));expect(readMpReservaPendingSlot()).toEqual(pending);});
test('network error does not claim paid or clear recovery',async()=>{readPaymentConfirmation.mockRejectedValue(Error('offline'));mountSuccess();await screen.findByText('No pudimos comprobar el pago');expect(screen.queryByText(/procesado correctamente/)).not.toBeInTheDocument();expect(readMpReservaPendingSlot()).toEqual(pending);});
test('confirmed status clears only the matching pending; personal detail requires existing owner session',async()=>{readPaymentConfirmation.mockResolvedValue({confirmed:true,data:{confirmed:true,reserva_id:7}});mountSuccess();await screen.findByText('¡Pago exitoso!');expect(readMpReservaPendingSlot()).toBeNull();expect(global.fetch).not.toHaveBeenCalled();expect(screen.getByRole('status')).toHaveTextContent('Inicia sesión');});
test('confirmed different booking never clears current pending',async()=>{readPaymentConfirmation.mockResolvedValue({confirmed:true,data:{reserva_id:9}});mountSuccess();await screen.findByText('¡Pago exitoso!');expect(readMpReservaPendingSlot()).toEqual(pending);});
test('unmount aborts and ignores late confirmation',async()=>{let done;readPaymentConfirmation.mockImplementation(()=>new Promise(resolve=>{done=resolve}));const view=mountSuccess();const signal=readPaymentConfirmation.mock.calls[0][0].signal;view.unmount();expect(signal.aborted).toBe(true);await act(async()=>done({confirmed:true,data:{reserva_id:7}}));expect(readMpReservaPendingSlot()).toEqual(pending);expect(global.fetch).not.toHaveBeenCalled();});
async function cancel(){render(<MemoryRouter initialEntries={['/pago-fallido']}><PagoFallido/></MemoryRouter>);fireEvent.click(screen.getByText('reservas.cancelar'));fireEvent.click(screen.getByText('reservas.cancelModalConfirm'));}
test('failed release retains pending and displays error',async()=>{global.fetch.mockResolvedValue({ok:false,json:async()=>({error:'expired'})});await cancel();await screen.findByRole('alert');expect(readMpReservaPendingSlot()).toEqual(pending);expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({release_token:pending.release_token});});
test('confirmed release clears pending',async()=>{global.fetch.mockResolvedValue({ok:true,json:async()=>({ok:true,deleted:1})});await cancel();await waitFor(()=>expect(readMpReservaPendingSlot()).toBeNull());});

test('late owner details are ignored when the authenticated account changes',async()=>{
 useAuth.mockReturnValue({session:{user:{id:'owner-a'}}});supabase.auth.getSession.mockResolvedValue({data:{session:{access_token:'local-a',user:{id:'owner-a'}}}});readPaymentConfirmation.mockResolvedValue({confirmed:true,data:{reserva_id:7}});
 let finish;global.fetch.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const view=mountSuccess();await waitFor(()=>expect(global.fetch).toHaveBeenCalledTimes(1));
 useAuth.mockReturnValue({session:{user:{id:'owner-b'}}});view.rerender(<MemoryRouter initialEntries={['/pago-exitoso?payment_id=fixture']}><PagoExitoso/></MemoryRouter>);
 await act(async()=>finish({ok:true,json:async()=>[{id:7,sede:'private-owner-a'}]}));expect(screen.queryByText('private-owner-a')).not.toBeInTheDocument();expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('release of an older checkout cannot clear a replacement checkout',async()=>{
 let finish;global.fetch.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));await cancel();await waitFor(()=>expect(global.fetch).toHaveBeenCalledTimes(1));const newer={reserva_id:8,release_token:'new-local-capability'};saveMpReservaPendingSlot(newer);
 await act(async()=>finish({ok:true,json:async()=>({ok:true,deleted:1})}));expect(readMpReservaPendingSlot()).toEqual(newer);expect(screen.getByRole('alert')).toHaveTextContent('nuevo proceso');
});

test('confirmed booking details are read through owner JWT and QR uses only that matched booking',async()=>{
 useAuth.mockReturnValue({session:{user:{id:'owner-a'}}});supabase.auth.getSession.mockResolvedValue({data:{session:{access_token:'local-a',user:{id:'owner-a'}}}});readPaymentConfirmation.mockResolvedValue({confirmed:true,data:{reserva_id:7}});
 global.fetch.mockImplementation(async(url,opts)=>String(url).includes('mis-reservas')?{ok:true,json:async()=>[{id:8,sede:'other-booking'},{id:7,sede:'owned-booking'}]}:{ok:true,json:async()=>({qr_token:'local-qr'})});
 mountSuccess();await screen.findByText('owned-booking');await waitFor(()=>expect(global.fetch).toHaveBeenCalledTimes(2));expect(screen.queryByText('other-booking')).not.toBeInTheDocument();expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer local-a');expect(global.fetch.mock.calls[1][0]).toMatch('/api/reservas/7/generar-qr');
});

test('a new payment reference hides old confirmation and ignores an old late detail response',async()=>{
 useAuth.mockReturnValue({session:{user:{id:'owner-a'}}});supabase.auth.getSession.mockResolvedValue({data:{session:{access_token:'local-a',user:{id:'owner-a'}}}});
 let nextStatus,oldDetails;readPaymentConfirmation.mockResolvedValueOnce({confirmed:true,data:{reserva_id:7}}).mockImplementationOnce(()=>new Promise(resolve=>{nextStatus=resolve}));global.fetch.mockImplementation(()=>new Promise(resolve=>{oldDetails=resolve}));
 function Switch(){const navigate=useNavigate();return <><button onClick={()=>navigate('/pago-exitoso?payment_id=second')}>Switch reference</button><PagoExitoso/></>;}
 render(<MemoryRouter initialEntries={['/pago-exitoso?payment_id=fixture']}><Switch/></MemoryRouter>);await screen.findByText('¡Pago exitoso!');await waitFor(()=>expect(global.fetch).toHaveBeenCalledTimes(1));fireEvent.click(screen.getByText('Switch reference'));expect(screen.queryByText('¡Pago exitoso!')).not.toBeInTheDocument();
 await act(async()=>{oldDetails({ok:true,json:async()=>[{id:7,sede:'old-receipt'}]});nextStatus({confirmed:false});});await screen.findByText('Pago pendiente de confirmación');expect(screen.queryByText('old-receipt')).not.toBeInTheDocument();expect(readMpReservaPendingSlot()).toBeNull();
});
