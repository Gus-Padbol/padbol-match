import React from 'react';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReservaForm from './ReservaForm';
import { saveReservaPendiente } from '../utils/reservaReturnUrl';
import es from '../i18n/locales/es.json';
import { useAuth } from '../context/AuthContext';
import { fetchSurgePrecio } from '../utils/surgePrecio';
jest.mock('../context/AuthContext',()=>({useAuth:jest.fn()}));
jest.mock('../context/HubNavLayoutContext',()=>({useHubNavLayout:()=>({navDock:'bottom'})}));
jest.mock('../hooks/usePadbolLang',()=>({usePadbolLangVersion:()=>0}));
jest.mock('../hooks/usePadcoinsActiveCampaign',()=>({usePadcoinsActiveCampaign:()=>({campaign:null})}));
jest.mock('../components/ReputacionJugadorPanel',()=>({useJugadorReputacionReserva:()=>({suspendido:false,cancelaciones:0})}));
jest.mock('../components/icons/GeroIcons',()=>({IconGeroUbicacion:()=>null}));
jest.mock('../components/common/SportIcon',()=>()=>null);
jest.mock('../components/AppHeader',()=>()=>null);
jest.mock('../components/BottomNav',()=>()=>null);
jest.mock('../components/PadbolBrandLogo',()=>()=>null);
jest.mock('../components/ReservaCalendarioMes',()=>()=>null);
jest.mock('../components/ConfirmCancelReservaModal',()=>()=>null);
jest.mock('../utils/surgePrecio',()=>({fetchSurgePrecio:jest.fn(),surgeBadgeFromQuote:()=>null}));
jest.mock('@stripe/stripe-js',()=>({loadStripe:jest.fn()}));
jest.mock('@stripe/react-stripe-js',()=>({Elements:()=>null,PaymentElement:()=>null,useStripe:()=>null,useElements:()=>null}));
jest.mock('../supabaseClient',()=>({supabase:{auth:{getSession:async()=>({data:{session:null}})}}}));
jest.mock('../i18n/tSafe',()=>{ const t=(key,fallback,opts)=>{
 const locale=require('../i18n/locales/es.json'); const value=key.split('.').reduce((v,k)=>v?.[k],locale); const text=value|| (typeof fallback==='string'?fallback:key); const args=typeof fallback==='object'?fallback:opts;
 return String(text).replace(/\{\{(\w+)\}\}/g,(_,k)=>args?.[k]??'');
}; return {useSafeTranslation:()=>({t})}; });
const venue={id:7,nombre:'QA free fixture',pais:'Argentina',ciudad:'La Plata',cantidad_canchas:1,moneda:'ARS',metodo_pago:'efectivo',stripe_account_id:null,horario_apertura:'10:00',horario_cierre:'23:00',timezone:'America/Argentina/Buenos_Aires',precio_60min:0,precio_90min:0,duraciones_oferta:[{duracion_minutos:60,precio:0,activo:true,deporte:'padbol'}],deportes_disponibles:['padbol']};
const futureDate=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
const fixtureUrl=`/reservar?sedeId=7&fecha=${futureDate}&hora=18%3A00&canchaId=1&deporte=padbol`;
const auth={session:{access_token:'qa-visible-test-token',user:{id:'qa-owner',email:'qa@example.invalid',user_metadata:{}}},loading:false,userProfile:{nombre:'QA',apellido:'Prueba',genero:'masculino',whatsapp:'+5491199901013'}};
beforeEach(()=>{
 window.history.replaceState(null,'',fixtureUrl);
 localStorage.clear();sessionStorage.clear();useAuth.mockReturnValue(auth);fetchSurgePrecio.mockReset();fetchSurgePrecio.mockResolvedValue({precio:0,surge_activo:false});
 window.scrollTo=jest.fn(); window.alert=jest.fn(); Element.prototype.scrollIntoView=jest.fn();
 const response=data=>({ok:true,json:async()=>data,text:async()=>JSON.stringify(data)});
 global.fetch=jest.fn(async(url,options)=>{
  const path=new URL(String(url),'https://test.invalid').pathname;
  if(path==='/api/reservas/price-capabilities') return response({strict_price_confirmation:true,version:2});
  if(path==='/api/crear-preferencia') return response({free_booking:true,reserva_id:123,reserva:{estado:'confirmada',precio:0}});
  if(path.endsWith('/duraciones-disponibles')) return response({duraciones:venue.duraciones_oferta});
  if(path.endsWith('/precios-deporte')) return response({precios:[]});
  if(path.endsWith('/extras'))return response([]);
  if(path==='/api/sedes/7') return response(venue);
  if(path==='/api/sedes')return response([venue]);
  if(path.includes('disponibilidad'))return response([]);
  return response([]);
 });
 saveReservaPendiente({pantalla:4,filtros:{pais:'Argentina',ciudad:'La Plata',sede_id:7},formData:{fecha:futureDate,hora:'18:00',cancha:'1',duracion:'60',numeroTel:'+5491199901013',codigoPais:'+54'},deporte:'padbol'});
});
test('real checkout button uses authenticated zero-price booking and receipt without Stripe account',async()=>{
 render(<MemoryRouter initialEntries={[fixtureUrl]}><ReservaForm/></MemoryRouter>);
 await screen.findByText(venue.nombre);
 const button=await screen.findByRole('button',{name:es.reservas.confirmFreeBooking});
 await waitFor(()=>expect(screen.getByRole('button',{name:button.textContent})).toBeEnabled());
 expect(screen.queryByText(es.reservas.stripeNotConnected)).not.toBeInTheDocument();
 await waitFor(()=>{const current=screen.getByRole('button',{name:button.textContent});expect(current).toBeEnabled();fireEvent.click(current);});
 await waitFor(()=>expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('123')));
 const [url,options]=global.fetch.mock.calls.find(([url])=>String(url).includes('/api/crear-preferencia'));
 expect(options.headers.Authorization).toBe('Bearer qa-visible-test-token');
 const payload=JSON.parse(options.body);expect(payload.precio).toBe(0);expect(payload.price_confirmation_strict).toBe(true);expect(payload.reservaData.deporte).toBe('padbol');expect(payload.reservaData.duracion).toBe(60);
 expect(global.fetch.mock.calls.some(([url])=>String(url).includes('/stripe/crear-payment-intent'))).toBe(false);
 expect(global.fetch.mock.calls.some(([url])=>String(url).includes('/api/v2/sedes/'))).toBe(true);
 expect(fetchSurgePrecio).toHaveBeenCalledWith(7,'padbol',60,expect.any(String),expect.any(String),{version2:true});
});

test('occupied slot response stays visible and never announces a confirmed reservation',async()=>{
 const original=global.fetch.getMockImplementation();
 global.fetch.mockImplementation(async(url,options)=>String(url).includes('/api/crear-preferencia')
   ? {ok:false,status:409,json:async()=>({error:'Este horario ya está reservado'})}
   : original(url,options));
 render(<MemoryRouter initialEntries={[fixtureUrl]}><ReservaForm/></MemoryRouter>);
 await screen.findByText(venue.nombre);
 const button=await screen.findByRole('button',{name:es.reservas.confirmFreeBooking}); await waitFor(()=>expect(screen.getByRole('button',{name:button.textContent})).toBeEnabled()); await waitFor(()=>{const current=screen.getByRole('button',{name:button.textContent});expect(current).toBeEnabled();fireEvent.click(current);});
 await screen.findByText('Este horario ya está reservado');
 expect(window.alert).not.toHaveBeenCalled();
});

test('occupied booking removes same and overlapping time buttons, preserving adjacency and sending venue id', async()=>{
 const original=global.fetch.getMockImplementation();
 global.fetch.mockImplementation(async(url, options)=>{
  if(String(url).includes('/api/disponibilidad/')) {
   const rows=[{cancha:1, hora:'18:00:00',duracion_minutos:60,estado:'confirmada'}];
   return {ok:true,json:async()=>rows,text:async()=>JSON.stringify(rows)};
  }
  return original(url, options);
 });
 saveReservaPendiente({pantalla:2,filtros:{pais:'Argentina',ciudad:'La Plata',sede_id:7},formData:{fecha:futureDate,hora:'',cancha:'',duracion:'60',numeroTel:'+5491199901013',codigoPais:'+54'},deporte:'padbol'});
 const availabilityUrl = '/reservar?sedeId=7&deporte=padbol';
 window.history.replaceState(null, '', availabilityUrl);
 render(<MemoryRouter initialEntries={[availabilityUrl]}><ReservaForm/></MemoryRouter>);
 await screen.findByRole('button',{name:/19:00 - 20:00/});
 expect(screen.queryByRole('button',{name:/18:00 - 19:00/})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:/17:30 - 18:30/})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:/18:30 - 19:30/})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:/17:00 - 18:00/})).toBeInTheDocument();
 const [url,opts]=global.fetch.mock.calls.find(([url])=>String(url).includes('/api/disponibilidad/'));
 expect(String(url)).toContain('sede_id=7');expect(opts.cache).toBe('no-store');
});

test.each([
 ['server failure', {ok:false, text:async()=>JSON.stringify({error:'QA failure'}),json:async()=>({error:'QA failure'})}],
 ['malformed payload', {ok:true,text:async()=>JSON.stringify({error:'not a booking list'}),json:async()=>({error:'not a booking list'})}],
])('availability fails closed on %s instead of showing free courts',async(_label,response)=>{
 const original=global.fetch.getMockImplementation();
 global.fetch.mockImplementation(async(url,options)=>String(url).includes('/api/disponibilidad/')?response:original(url,options));
 const availabilityUrl='/reservar?sedeId=7&deporte=padbol';
 window.history.replaceState(null,'',availabilityUrl);
 saveReservaPendiente({pantalla:2,filtros:{pais:'Argentina',ciudad:'La Plata',sede_id:7},formData:{fecha:futureDate,hora:'18:00',cancha:'',duracion:'60'},deporte:'padbol'});
 render(<MemoryRouter initialEntries={[availabilityUrl]}><ReservaForm/></MemoryRouter>);
 await waitFor(()=>expect(global.fetch.mock.calls.some(([url])=>String(url).includes('/api/disponibilidad/'))).toBe(true));
 await waitFor(()=>expect(screen.queryByRole('button',{name:/18:00 - 19:00/})).not.toBeInTheDocument());
 expect(screen.queryByRole('button',{name:/19:00 - 20:00/})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:/Cancha 1.*Libre/i})).not.toBeInTheDocument();
});

test('muestra el nuevo total y requiere una segunda confirmación explícita', async()=>{
 const originalMethod=venue.metodo_pago;venue.metodo_pago='efectivo';
 try {
  const original=global.fetch.getMockImplementation();let attempts=0;
  global.fetch.mockImplementation(async(url,options)=>{
    if(String(url).includes('/api/crear-preferencia')) {
      attempts++;
      return attempts===1 ? {ok:false,status:400,json:async()=>({error:'Precio diferente',serverTotal:26000})}
        : {ok:true,json:async()=>({efectivo_payment:true})};
    }
    return original(url,options);
  });
  render(<MemoryRouter initialEntries={[fixtureUrl]}><ReservaForm/></MemoryRouter>);
  const first=await screen.findByRole('button',{name:es.reservas.confirmFreeBooking});
  await waitFor(()=>{const current=screen.getByRole('button',{name:first.textContent});expect(current).toBeEnabled();fireEvent.click(current);});
  await screen.findByText(/La tarifa cambió a 26.000 ARS/);
  expect(attempts).toBe(1);
  expect(screen.getByText(/26.000/)).toBeInTheDocument();
  const next=screen.getByRole('button',{name:es.reservas.pago_sede});
  fireEvent.click(next);
  await waitFor(()=>expect(attempts).toBe(2));
  const requests=global.fetch.mock.calls.filter(([url])=>String(url).includes('/api/crear-preferencia'));
  expect(JSON.parse(requests[0][1].body).precio).toBe(0);
  expect(JSON.parse(requests[1][1].body).precio).toBe(26000);
 } finally {venue.metodo_pago=originalMethod;}
});

test('usa la cotización por franja del servidor aun sin precio dinámico',async()=>{
 const originalMethod=venue.metodo_pago;venue.metodo_pago='efectivo';
 try {
  fetchSurgePrecio.mockResolvedValue({precio:26000,surge_activo:false});
  render(<MemoryRouter initialEntries={[fixtureUrl]}><ReservaForm/></MemoryRouter>);
  const button=await screen.findByRole('button',{name:es.reservas.pago_sede});
  await waitFor(()=>expect(screen.getByRole('button',{name:button.textContent})).toBeEnabled());
  expect(screen.getAllByText(/26.000/).length).toBeGreaterThan(0);
  await waitFor(()=>{const current=screen.getByRole('button',{name:button.textContent});expect(current).toBeEnabled();fireEvent.click(current);});
  await waitFor(()=>expect(global.fetch.mock.calls.some(([url])=>String(url).includes('/api/crear-preferencia'))).toBe(true));
  const request=global.fetch.mock.calls.find(([url])=>String(url).includes('/api/crear-preferencia'));
  expect(JSON.parse(request[1].body).precio).toBe(26000);
 } finally {venue.metodo_pago=originalMethod;}
});

test('no confirma cuando el servidor no anuncia validación estricta',async()=>{
 const original=global.fetch.getMockImplementation();
 global.fetch.mockImplementation(async(url,options)=>String(url).includes('/api/reservas/price-capabilities') ? {ok:false,status:404,json:async()=>({})} : original(url,options));
 render(<MemoryRouter initialEntries={[fixtureUrl]}><ReservaForm/></MemoryRouter>);
 const button=await screen.findByRole('button',{name:es.reservas.confirmFreeBooking});
 await waitFor(()=>expect(fetchSurgePrecio).toHaveBeenCalled());
 expect(button).toBeDisabled();fireEvent.click(button);
 expect(global.fetch.mock.calls.some(([url])=>String(url).includes('/api/crear-preferencia'))).toBe(false);
});


test('legacy Stripe free booking does not adopt v2 pricing or strict checkout',async()=>{
 const old=venue.metodo_pago;venue.metodo_pago='stripe';
 try {
  render(<MemoryRouter initialEntries={[fixtureUrl]}><ReservaForm/></MemoryRouter>);
  const button=await screen.findByRole('button',{name:es.reservas.confirmFreeBooking});await waitFor(()=>expect(screen.getByRole('button',{name:button.textContent})).toBeEnabled());await waitFor(()=>{const current=screen.getByRole('button',{name:button.textContent});expect(current).toBeEnabled();fireEvent.click(current);});
  await waitFor(()=>expect(global.fetch.mock.calls.some(([url])=>String(url).includes('/api/crear-preferencia'))).toBe(true));
  const request=global.fetch.mock.calls.find(([url])=>String(url).includes('/api/crear-preferencia'));
  expect(JSON.parse(request[1].body).price_confirmation_strict).toBeUndefined();
  expect(global.fetch.mock.calls.some(([url])=>String(url).includes('/api/v2/'))).toBe(false);
 } finally {venue.metodo_pago=old;}
});

test('Stripe pagado conserva tarifa legacy y no depende de capacidad v2',async()=>{
 const previous={...venue};Object.assign(venue,{metodo_pago:'stripe',stripe_account_id:'acct_fixture',precio_60min:25000,duraciones_oferta:[{duracion_minutos:60,precio:25000,activo:true,deporte:'padbol'}],surge_activo:false});
 try {
  const original=global.fetch.getMockImplementation();
  global.fetch.mockImplementation(async(url,options)=>String(url).includes('price-capabilities')?{ok:false,status:404,json:async()=>({})}:original(url,options));
  render(<MemoryRouter initialEntries={[fixtureUrl]}><ReservaForm/></MemoryRouter>);
  await screen.findByText(venue.nombre);
  await waitFor(()=>expect(screen.getAllByText(/25.000/).length).toBeGreaterThan(0));
  expect(global.fetch.mock.calls.some(([url])=>String(url).includes('/api/v2/'))).toBe(false);
  expect(fetchSurgePrecio).not.toHaveBeenCalled();
  expect(global.fetch.mock.calls.some(([url])=>String(url).includes('/stripe/crear-payment-intent'))).toBe(false);
 } finally {Object.assign(venue,previous);}
});
