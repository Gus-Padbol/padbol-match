import React from 'react';import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import TournamentFixturePlanner from './TournamentFixturePlanner';
const torneo={id:91,tipo_torneo:'knockout'},equipos=[1,2,3,4].map(id=>({id,nombre:`Equipo${id}`,inscripcion_estado:'confirmada'}));
afterEach(()=>jest.restoreAllMocks());
test('external draw is reviewed before exact authenticated save and never starts event',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({ok:true,partidos:[{id:1}],estado:'abierto'})});const onSaved=jest.fn();render(<TournamentFixturePlanner {...{torneo,equipos,onSaved}} apiBaseUrl="https://api.test" accessToken="qa-token"/>);
 fireEvent.change(screen.getByLabelText('Origen del sorteo'),{target:{value:'manual'}});
 for(const [label,value] of [['Cruce 1 equipo A','1'],['Cruce 1 equipo B','4'],['Cruce 2 equipo A','2'],['Cruce 2 equipo B','3']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 fireEvent.click(screen.getByText('Revisar fixture antes de guardar'));expect(fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Confirmar y guardar fixture'));
 await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1));const [url,options]=fetch.mock.calls[0];expect(url).toContain('/planificar-fixture');expect(options.headers.Authorization).toBe('Bearer qa-token');expect(JSON.parse(options.body)).toEqual({origen:'manual',cruces:[{equipo_a_id:1,equipo_b_id:4},{equipo_a_id:2,equipo_b_id:3}]});
});
test('duplicate or incomplete matchups cannot reach confirmation',()=>{
 render(<TournamentFixturePlanner {...{torneo,equipos}}/>);fireEvent.change(screen.getByLabelText('Origen del sorteo'),{target:{value:'manual'}});
 ['Cruce 1 equipo A','Cruce 1 equipo B','Cruce 2 equipo A','Cruce 2 equipo B'].forEach(label=>fireEvent.change(screen.getByLabelText(label),{target:{value:'1'}}));expect(screen.getByText('Revisar fixture antes de guardar')).toBeDisabled();
});
test('rejected write remains visible and never announces saved state',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:false,json:async()=>({error:'El fixture ya existe'})});const onSaved=jest.fn();render(<TournamentFixturePlanner {...{torneo,equipos,onSaved}} accessToken="qa"/>);fireEvent.click(screen.getByText('Revisar fixture antes de guardar'));fireEvent.click(screen.getByText('Confirmar y guardar fixture'));await screen.findByRole('alert');expect(onSaved).not.toHaveBeenCalled();
});
