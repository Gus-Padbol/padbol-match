import React from 'react';import {render,screen,fireEvent,waitFor} from '@testing-library/react';import TournamentMatchOperations from './TournamentMatchOperations';
const initial={ok:true,timezone:'Europe/Rome',partido:{id:3,estado:'pendiente',fecha_hora:null,cancha:null},schedule:null,canchas:[{id:9,nombre:'Cancha9'}],equipos:[{id:1,nombre:'Uno',jugadores:[{nombre:'Invitado sin cuenta'}]}],can_open:true,requirements:[]};
beforeEach(()=>jest.spyOn(window,'open').mockReturnValue(null));
afterEach(()=>jest.restoreAllMocks());
test('schedule uses event timezone, then linked marker route opens confirmed scoreboard',async()=>{
 global.fetch=jest.fn().mockImplementation(async url=>({ok:true,json:async()=>url.endsWith('/operacion')?initial:url.endsWith('/programacion')?{ok:true,partido_id:3,court_id:9,cancha:'1',fecha_hora:'2026-11-20T10:00:00Z',duration_minutes:60}:{ok:true,scoreboard_id:'qa-scoreboard'}}));const navigate=jest.fn();render(<TournamentMatchOperations torneoId={91} partidoId={3} apiBaseUrl="https://api.test" accessToken="qa" navigate={navigate}/>);
 await screen.findByText(/Invitado sin cuenta/);expect(screen.getByText('Abrir marcador ahora')).toBeDisabled();fireEvent.change(screen.getByLabelText('Fecha y hora'),{target:{value:'2026-11-20T11:00'}});fireEvent.change(screen.getByLabelText('Cancha'),{target:{value:'9'}});fireEvent.click(screen.getByText('Guardar fecha y cancha'));await screen.findByText('Fecha y cancha guardadas.');
 expect(JSON.parse(fetch.mock.calls[1][1].body).fecha_hora).toBe('2026-11-20T10:00:00Z');fireEvent.click(screen.getByText('Abrir marcador ahora'));await waitFor(()=>expect(screen.getByRole('link',{name:'Continuar marcador existente'})).toHaveAttribute('href','/admin/scoreboard/qa-scoreboard'));expect(fetch.mock.calls[2][0]).toBe('https://api.test/api/torneos/91/partidos/3/marcador');
});
test('missing readiness or server error never navigates to an invented marker',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({...initial,can_open:false,requirements:['Faltan participantes']})});const navigate=jest.fn();render(<TournamentMatchOperations torneoId={91} partidoId={3} accessToken="qa" navigate={navigate}/>);await screen.findByText(/Faltan participantes/);expect(screen.getByText('Abrir marcador ahora')).toBeDisabled();expect(navigate).not.toHaveBeenCalled();
});

test('court selection opens unscheduled marker with prefilled teams and no schedule request',async()=>{global.fetch=jest.fn().mockImplementation(async url=>({ok:true,json:async()=>url.endsWith('/operacion')?initial:{ok:true,scoreboard_id:'qa-now'}}));const navigate=jest.fn();render(<TournamentMatchOperations torneoId={91} partidoId={3} apiBaseUrl="https://api.test" accessToken="qa" navigate={navigate}/>);await screen.findByText(/Invitado sin cuenta/);fireEvent.change(screen.getByLabelText('Cancha'),{target:{value:'9'}});expect(screen.getByLabelText('Fecha y hora').value).toBe('');fireEvent.click(screen.getByText('Abrir marcador ahora'));await waitFor(()=>expect(screen.getByRole('link',{name:'Continuar marcador existente'})).toHaveAttribute('href','/admin/scoreboard/qa-now'));expect(fetch).toHaveBeenCalledTimes(2);expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({court_id:9});expect(screen.getByText(/horario estimado nunca inicia/)).toBeInTheDocument();});
test('occupied court server response shows error and does not navigate',async()=>{global.fetch=jest.fn().mockImplementation(async url=>({ok:url.endsWith('/operacion'),json:async()=>url.endsWith('/operacion')?initial:{ok:false,error:'Cancha ocupada'}}));const navigate=jest.fn();render(<TournamentMatchOperations torneoId={91} partidoId={3} accessToken="qa" navigate={navigate}/>);await screen.findByText(/Invitado sin cuenta/);fireEvent.change(screen.getByLabelText('Cancha'),{target:{value:'9'}});fireEvent.click(screen.getByText('Abrir marcador ahora'));await screen.findByRole('alert');expect(screen.getByRole('alert')).toHaveTextContent('Cancha ocupada');expect(navigate).not.toHaveBeenCalled();});

test('reopening unscheduled match retains its assigned official court',async()=>{global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({...initial,partido:{...initial.partido,cancha_id:9,cancha:'1'}})});render(<TournamentMatchOperations torneoId={91} partidoId={3} accessToken="qa" navigate={jest.fn()}/>);await screen.findByText(/Invitado sin cuenta/);expect(screen.getByLabelText('Cancha').value).toBe('9');expect(screen.getByText('Abrir marcador ahora')).toBeEnabled();});


test('al volver a un cruce en curso enlaza al mismo marcador sin pedir su creación',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({...initial,partido:{...initial.partido,estado:'en_curso'},scoreboard_id:'partial-marker'})});
 render(<TournamentMatchOperations torneoId={91} partidoId={3} accessToken="qa" navigate={jest.fn()}/>);
 const link=await screen.findByRole('link',{name:'Continuar marcador existente'});expect(link).toHaveAttribute('href','/admin/scoreboard/partial-marker');expect(screen.queryByText('Abrir marcador ahora')).not.toBeInTheDocument();expect(fetch).toHaveBeenCalledTimes(1);
});

test('abre marcador en otra pestaña sin abandonar fixture',async()=>{const tab={opener:{},location:{href:''},close:jest.fn()};window.open.mockReturnValue(tab);global.fetch=jest.fn().mockImplementation(async url=>({ok:true,json:async()=>url.endsWith('/operacion')?initial:{ok:true,scoreboard_id:'abc'}}));const navigate=jest.fn();render(<TournamentMatchOperations torneoId={91} partidoId={3} accessToken="qa" navigate={navigate}/>);await screen.findByText(/Invitado sin cuenta/);fireEvent.change(screen.getByLabelText('Cancha'),{target:{value:'9'}});fireEvent.click(screen.getByText('Abrir marcador ahora'));await waitFor(()=>expect(tab.location.href).toBe('/admin/scoreboard/abc'));expect(tab.opener).toBeNull();expect(navigate).not.toHaveBeenCalled();expect(screen.getByRole('link',{name:'Continuar marcador existente'})).toHaveAttribute('target','_blank');});

test('el acceso para continuar permanece en el pie del diálogo',async()=>{
 const {ScoreboardFooterContext}=require('./PartidoDetalleModal');
 const footer=document.createElement('div');document.body.appendChild(footer);
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({...initial,partido:{...initial.partido,estado:'en_curso'},scoreboard_id:'persistente'})});
 const {unmount}=render(<ScoreboardFooterContext.Provider value={footer}><TournamentMatchOperations torneoId={91} partidoId={3} accessToken="qa" /></ScoreboardFooterContext.Provider>);
 const link=await screen.findByRole('link',{name:'Continuar marcador existente'});
 expect(footer).toContainElement(link);expect(link).toHaveAttribute('target','_blank');
 unmount();footer.remove();
});
