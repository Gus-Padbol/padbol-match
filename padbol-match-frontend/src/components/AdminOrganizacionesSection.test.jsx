import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import AdminOrganizacionesSection from './AdminOrganizacionesSection';
jest.mock('../i18n/adminTranslation',()=>({stripAdminEmoji:value=>value}));
const response=(data,ok=true)=>({ok,json:async()=>data});
const props={apiBaseUrl:'https://qa.example.invalid',accessToken:'synthetic'};
afterEach(()=>{cleanup();jest.restoreAllMocks();});
test('loading blocks creation and never declares empty before a successful read',async()=>{
 let resolve;global.fetch=jest.fn(()=>new Promise(r=>{resolve=r;}));render(<AdminOrganizacionesSection {...props}/>);
 expect(screen.getByText('Cargando cadenas…')).toBeTruthy();expect(screen.getByText('Crear cadena').disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Nombre de la cadena *'),{target:{value:'Duplicate'}});fireEvent.submit(screen.getByText('Crear cadena').closest('form'));expect(fetch).toHaveBeenCalledTimes(1);
 await act(async()=>resolve(response([])));expect(await screen.findByText('Todavía no hay cadenas creadas.')).toBeTruthy();expect(screen.getByText('Crear cadena').disabled).toBe(false);
});
test('schema failure shows error, blocks writes and retry recovers to confirmed data',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(response({error:'Configuración multisede incompleta'},false)).mockResolvedValueOnce(response([{id:'org1',nombre:'Padbol Internacional',sedes:[],administradores:[]}]));
 render(<AdminOrganizacionesSection {...props}/>);await screen.findByRole('alert');expect(screen.queryByText('Todavía no hay cadenas creadas.')).toBeNull();expect(screen.getByText('Crear cadena').disabled).toBe(true);
 fireEvent.click(screen.getByText('Actualizar'));await screen.findByText('Sedes de Padbol Internacional');expect(screen.getByText('Crear cadena').disabled).toBe(false);expect(fetch).toHaveBeenCalledTimes(2);
});
test('malformed response never becomes a confirmed empty list',async()=>{
 global.fetch=jest.fn().mockResolvedValue(response({}));render(<AdminOrganizacionesSection {...props}/>);await screen.findByRole('alert');expect(screen.queryByText('Todavía no hay cadenas creadas.')).toBeNull();expect(screen.getByText('Crear cadena').disabled).toBe(true);
});
test('failed refresh removes stale organization controls until a valid reload',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(response([{id:'org1',nombre:'Padbol Internacional',sedes:[],administradores:[]}])).mockRejectedValueOnce(Error('Sin conexión'));
 render(<AdminOrganizacionesSection {...props}/>);await screen.findByText('Sedes de Padbol Internacional');fireEvent.click(screen.getByText('Actualizar'));await screen.findByRole('alert');expect(screen.queryByText('Guardar habilitación')).toBeNull();expect(screen.getByText('Crear cadena').disabled).toBe(true);
});
test('late response from previous session cannot unlock mutations',async()=>{
 let resolve;global.fetch=jest.fn(()=>new Promise(r=>{resolve=r;}));const view=render(<AdminOrganizacionesSection {...props}/>);view.rerender(<AdminOrganizacionesSection {...props} accessToken=""/>);await act(async()=>resolve(response([])));expect(screen.getByText('Crear cadena').disabled).toBe(true);expect(screen.queryByText('Todavía no hay cadenas creadas.')).toBeNull();
});

test('late mutation result from old session cannot expose an invitation or reload old data',async()=>{
 let complete; global.fetch=jest.fn().mockResolvedValueOnce(response([])).mockImplementationOnce(()=>new Promise(r=>{complete=r;}));
 const view=render(<AdminOrganizacionesSection {...props}/>);await screen.findByText('Todavía no hay cadenas creadas.');
 fireEvent.change(screen.getByLabelText('Nombre de la cadena *'),{target:{value:'Synthetic'}});fireEvent.submit(screen.getByText('Crear cadena').closest('form'));
 view.rerender(<AdminOrganizacionesSection {...props} accessToken=""/>);
 await act(async()=>complete(response({id:'old',magic_link:'https://example.invalid/private-invite'})));
 expect(screen.queryByText('Enlace de acceso del administrador:')).toBeNull();expect(fetch).toHaveBeenCalledTimes(2);expect(screen.getByText('Crear cadena').disabled).toBe(true);
});

test('successful administrator assignment retains its access link after refresh and clears it on logout',async()=>{
 const org={id:'org1',nombre:'Padbol Internacional',sedes:[],administradores:[]};
 global.fetch=jest.fn().mockResolvedValueOnce(response([org])).mockResolvedValueOnce(response({magic_link:'https://example.invalid/synthetic-invite'})).mockResolvedValueOnce(response([org]));
 const view=render(<AdminOrganizacionesSection {...props}/>);await screen.findByText('Sedes de Padbol Internacional');
 fireEvent.change(screen.getByLabelText('Email *'),{target:{value:'synthetic@example.invalid'}});fireEvent.submit(screen.getByText('Asignar administrador central').closest('form'));
 await screen.findByText('Enlace de acceso del administrador:');await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));
 await waitFor(()=>expect(screen.getByText('Crear cadena').disabled).toBe(false));expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.invalid/synthetic-invite');
 view.rerender(<AdminOrganizacionesSection {...props} accessToken=""/>);expect(screen.queryByRole('link')).toBeNull();
});
