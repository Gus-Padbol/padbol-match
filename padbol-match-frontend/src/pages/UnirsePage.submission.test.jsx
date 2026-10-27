import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import UnirsePage from './UnirsePage';
import i18n from '../i18n';
jest.mock('../components/AppHeader',()=>function Header(){return <header/>;});
jest.mock('../context/HubNavLayoutContext',()=>({useHubNavLayout:()=>({navDock:'top'})}));
const values={club_nombre:'Example venue',responsable_nombre:'Example person',email:'OWNER@EXAMPLE.TEST',whatsapp:'+46 123456789'};
async function setup(language='en'){
 await i18n.changeLanguage(language);window.scrollTo=jest.fn();
 const rendered=render(<MemoryRouter initialEntries={['/unirse?plan=starter']}><UnirsePage/></MemoryRouter>);
 for(const [key,value]of Object.entries(values))fireEvent.change(rendered.container.querySelector('#join-'+key),{target:{value}});
 return {...rendered,form:rendered.container.querySelector('form')};
}
afterEach(()=>jest.restoreAllMocks());
test('Starter permite comentario vacío y envía los cuatro datos sin exigir ubicación ni sesión',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,status:201,json:async()=>({id:'synthetic'})});const {form}=await setup();fireEvent.submit(form);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));const [url,options]=fetch.mock.calls[0],body=JSON.parse(options.body);
 expect(url).toMatch(/\/api\/solicitudes-licencia$/);expect(body).toMatchObject({club_nombre:values.club_nombre,responsable_nombre:values.responsable_nombre,email:'owner@example.test',whatsapp:values.whatsapp,solicitud_inicial:true});expect(body).not.toHaveProperty('pais');expect(body).not.toHaveProperty('ciudad');expect(options.headers).not.toHaveProperty('Authorization');expect(options.headers['Idempotency-Key']).toMatch(/^[\x21-\x7e]{8,200}$/);
 await waitFor(()=>expect(form.querySelector('#join-club_nombre')).toHaveValue(''));
});
test('reintentar tras503 mantiene datos y la misma clave; cambiar datos inicia otro intento',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:false,status:503,json:async()=>({code:'LICENSE_REQUESTS_NOT_CONFIGURED'})});const {form}=await setup('sv');fireEvent.submit(form);
 expect(await screen.findByText(/Registreringen är tillfälligt otillgänglig/)).toBeInTheDocument();expect(screen.getByLabelText(/Sportklubb eller klubbnamn/)).toHaveValue(values.club_nombre);const key=fetch.mock.calls[0][1].headers['Idempotency-Key'];fireEvent.submit(form);await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));expect(fetch.mock.calls[1][1].headers['Idempotency-Key']).toBe(key);await waitFor(()=>expect(screen.getByRole('button',{name:'Skicka registreringsförfrågan'})).toBeEnabled());fireEvent.change(screen.getByLabelText(/Sportklubb eller klubbnamn/),{target:{value:'Another venue'}});fireEvent.submit(form);await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));expect(fetch.mock.calls[2][1].headers['Idempotency-Key']).not.toBe(key);
});
test('doble envío mientras la respuesta está pendiente no produce otra petición',async()=>{
 let finish;global.fetch=jest.fn().mockReturnValue(new Promise(resolve=>{finish=resolve;}));const {form}=await setup();fireEvent.submit(form);fireEvent.submit(form);expect(fetch).toHaveBeenCalledTimes(1);await act(async()=>finish({ok:true,status:201,json:async()=>({id:'synthetic'})}));
});
test('el recorrido Starter sueco no mezcla introducción inglesa ni funciones españolas',async()=>{
 global.fetch=jest.fn();const {container}=await setup('sv');expect(screen.getByText('Börja registrera din anläggning')).toBeInTheDocument();expect(screen.getByText(/Obegränsat antal spelare och kunder/)).toBeInTheDocument();expect(container.textContent).not.toMatch(/Start your venue registration|What happens next|What this includes|Jugadores y clientes ilimitados|Reservas online y carga manual/);expect(container.querySelector('textarea')).toHaveValue('');
});
test('la validación obligatoria permanece local y no llama a la API con datos incompletos',async()=>{
 global.fetch=jest.fn();const {container,form}=await setup();fireEvent.change(container.querySelector('#join-club_nombre'),{target:{value:''}});fireEvent.submit(form);expect(fetch).not.toHaveBeenCalled();
});

test('un error de red conserva la misma clave para reintentar sin multiplicar la solicitud',async()=>{global.fetch=jest.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce({ok:true,status:200,json:async()=>({id:'synthetic',idempotent:true})});const {form}=await setup();fireEvent.submit(form);await screen.findByText(i18n.t('clubOnboarding.error.submit'));const first=fetch.mock.calls[0][1];fireEvent.submit(form);await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));expect(fetch.mock.calls[1][1].headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key']);expect(fetch.mock.calls[1][1].body).toBe(first.body);});
