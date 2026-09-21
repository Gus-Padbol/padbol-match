import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NuevaSedeSuperBottomSheet from './NuevaSedeSuperBottomSheet';
import { validateSedeRequiredConfiguration } from '../utils/sedeRequiredConfiguration';

jest.mock('../hooks/useGooglePlaces', () => ({ useGooglePlaces: () => ({ isLoaded:false, placesEnabled:false }) }));
jest.mock('../i18n/tSafe', () => ({ useSafeTranslation: () => ({ t:key=>key }) }));
const originalFetch = global.fetch;
const originalAlert = window.alert;
beforeEach(() => { global.fetch=jest.fn(async url => ({ok:true,json:async()=>url.endsWith('/api/plan-pricing')?[]:url.endsWith('/deportes')?{deportes:[]}:{id:123}}));window.alert=jest.fn(); });
afterEach(() => {global.fetch=originalFetch;window.alert=originalAlert;});

async function reachConfiguration(props={}) {
 const onSuccess=jest.fn();render(<NuevaSedeSuperBottomSheet open apiBaseUrl="https://api.qa.example" accessToken="fixture" onSuccess={onSuccess} {...props} />);
 await waitFor(()=>expect(global.fetch).toHaveBeenCalledTimes(1));
 fireEvent.change(screen.getByLabelText(/Nombre de la sede/),{target:{value:'QA fixture'}});
 fireEvent.change(screen.getByLabelText(/^País/),{target:{value:'🇦🇷 Argentina'}});
 fireEvent.change(screen.getByLabelText(/^Ciudad/),{target:{value:'La Plata'}});
 fireEvent.change(screen.getByLabelText(/^Dirección/),{target:{value:'QA fixture address'}});
 fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));
 fireEvent.click(screen.getByRole('checkbox',{name:'Padbol'}));
 fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));
 return onSuccess;
}
function fillConfiguration(price='1250') {
 fireEvent.change(screen.getByLabelText('admin.formularios.price *'),{target:{value:price}});
 fireEvent.change(screen.getByLabelText('admin.sedes.openingTime *'),{target:{value:'20:00'}});
 fireEvent.change(screen.getByLabelText('admin.sedes.closingTime *'),{target:{value:'02:00'}});
 fireEvent.change(screen.getByLabelText('admin.sedes.currency'),{target:{value:'USD'}});
 fireEvent.change(screen.getByLabelText(/Email de contacto/),{target:{value:'qa@example.invalid'}});
 fireEvent.change(screen.getByPlaceholderText('9 11 2345-6789'),{target:{value:'2215550000'}});
}

test('wizard blocks submission without explicit price or hours, shows error and preserves entered values',async()=>{
 await reachConfiguration();
 fireEvent.click(screen.getByRole('button',{name:'Crear sede'}));
 expect(screen.getByRole('alert')).toHaveTextContent('admin.formularios.validPriceRequired');expect(global.fetch).toHaveBeenCalledTimes(1);
 fireEvent.change(screen.getByLabelText('admin.formularios.price *'),{target:{value:'1250'}});
 fireEvent.click(screen.getByRole('button',{name:'Crear sede'}));
 expect(screen.getByRole('alert')).toHaveTextContent('admin.sedes.openingTime');expect(screen.getByLabelText('admin.formularios.price *')).toHaveValue(1250);expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('wizard sends the entered integer price, currency and overnight hours to the real create route',async()=>{
 const onSuccess=await reachConfiguration();fillConfiguration();fireEvent.click(screen.getByRole('button',{name:'Crear sede'}));
 await waitFor(()=>expect(onSuccess).toHaveBeenCalledTimes(1));
 const call=global.fetch.mock.calls.find(([url])=>url==='https://api.qa.example/api/sedes');expect(call).toBeDefined();
 expect(JSON.parse(call[1].body)).toMatchObject({precio_turno:1250,moneda:'USD',horario_apertura:'20:00',horario_cierre:'02:00',cantidad_canchas:1,telefono:'+54 2215550000'});
});

test('invitation completion sends an explicitly entered zero without substituting a tariff',async()=>{
 const onSuccess=await reachConfiguration({inviteToken:'qa-token',invitePrefill:{email:'qa@example.invalid'}});fillConfiguration('0');fireEvent.click(screen.getByRole('button',{name:'Guardar sede y activar mi rol'}));
 await waitFor(()=>expect(onSuccess).toHaveBeenCalledTimes(1));
 const call=global.fetch.mock.calls.find(([url])=>url.endsWith('/api/invitacion/qa-token/completar'));expect(call).toBeDefined();expect(call[1].headers.Authorization).toBeUndefined();
 expect(JSON.parse(call[1].body)).toMatchObject({precio_turno:0,horario_apertura:'20:00',horario_cierre:'02:00',deportes:[{deporte:'padbol',cantidad:1}]});
});

test.each(['',null,undefined,'-1','1.5','2147483648','not-a-price'])('schema validation rejects price %s instead of inventing or rounding it',price=>{
 expect(validateSedeRequiredConfiguration({precio_turno:price,horario_apertura:'08:00',horario_cierre:'23:00'})).toEqual({ok:false,error:'price'});
});
test.each(['','24:00','09:60','9:00','abc'])('schema validation rejects invalid opening time %s',time=>{
 expect(validateSedeRequiredConfiguration({precio_turno:0,horario_apertura:time,horario_cierre:'02:00'})).toEqual({ok:false,error:'hours'});
});
test('same-day, overnight and equal opening/closing are preserved without rewriting times',()=>{
 for(const [opening,closing] of [['08:00','23:00'],['20:00','02:00'],['00:00','00:00']])expect(validateSedeRequiredConfiguration({precio_turno:'0',horario_apertura:opening,horario_cierre:closing})).toEqual({ok:true,fields:{precio_turno:0,horario_apertura:opening,horario_cierre:closing}});
});
