import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import OpenTournamentRegistration from './OpenTournamentRegistration';
import {openConfirmedTournamentRegistration} from '../../utils/adminTournamentRegistration';
jest.mock('../../utils/adminTournamentRegistration',()=>({openConfirmedTournamentRegistration:jest.fn()}));
const t=(key,args)=>args?.defaultValue || key;
const setup=(available=true)=>{const onSaved=jest.fn();render(<OpenTournamentRegistration available={available} apiBaseUrl="https://fixture.invalid" torneoId={35} t={t} onSaved={onSaved}/>);return onSaved;};
beforeEach(()=>jest.clearAllMocks());
test('accessible inline confirmation can cancel without invoking the API',()=>{setup();fireEvent.click(screen.getByRole('button',{name:'torneos.vista.openRegistration'}));expect(screen.getByRole('group')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(screen.queryByRole('group')).not.toBeInTheDocument();expect(openConfirmedTournamentRegistration).not.toHaveBeenCalled();});
test('API error is visible and preserves confirmation for retry without announcing success',async()=>{openConfirmedTournamentRegistration.mockRejectedValue(new Error('Guardado no confirmado'));const onSaved=setup();fireEvent.click(screen.getByRole('button',{name:'torneos.vista.openRegistration'}));fireEvent.click(screen.getByRole('button',{name:'torneos.vista.openRegistration'}));expect(await screen.findByRole('alert')).toHaveTextContent('Guardado no confirmado');expect(screen.getByRole('group')).toBeInTheDocument();expect(onSaved).not.toHaveBeenCalled();expect(screen.queryByRole('status')).not.toBeInTheDocument();});
test('confirmed saved row updates the page and displays success; pending disables repeated save and cancel',async()=>{let resolve;openConfirmedTournamentRegistration.mockImplementation(()=>new Promise(r=>{resolve=r;}));const onSaved=setup();fireEvent.click(screen.getByRole('button',{name:'torneos.vista.openRegistration'}));fireEvent.click(screen.getByRole('button',{name:'torneos.vista.openRegistration'}));expect(screen.getByRole('button',{name:'torneos.vista.openingRegistration'})).toBeDisabled();expect(screen.getByRole('button',{name:'Cancelar'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'torneos.vista.openingRegistration'}));resolve({id:35,estado:'abierto'});await waitFor(()=>expect(onSaved).toHaveBeenCalledWith({id:35,estado:'abierto'}));expect(screen.getByRole('status')).toHaveTextContent('Inscripción abierta');expect(openConfirmedTournamentRegistration).toHaveBeenCalledTimes(1);});
test('unavailable action never offers mutation controls',()=>{setup(false);expect(screen.queryByRole('button')).not.toBeInTheDocument();expect(openConfirmedTournamentRegistration).not.toHaveBeenCalled();});

test('a response after route replacement cannot overwrite the next tournament page',async()=>{
 let resolve;
 openConfirmedTournamentRegistration.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 function Page() {
   const [row,setRow]=React.useState({id:35,nombre:'Torneo35',estado:'planificacion'});
   return <><p data-testid="current-tournament">{row.id}:{row.nombre}:{row.estado}</p>
     <button onClick={()=>setRow({id:36,nombre:'Torneo36',estado:'planificacion'})}>Ir al36</button>
     <OpenTournamentRegistration key={row.id} available apiBaseUrl="https://fixture.invalid" torneoId={row.id} t={t} onSaved={saved=>setRow(prev=>({...prev,...saved}))}/></>;
 }
 render(<Page/>);
 fireEvent.click(screen.getByRole('button',{name:'torneos.vista.openRegistration'}));
 fireEvent.click(screen.getByRole('button',{name:'torneos.vista.openRegistration'}));
 fireEvent.click(screen.getByRole('button',{name:'Ir al36'}));
 await act(async()=>resolve({id:35,nombre:'Torneo35',estado:'abierto'}));
 expect(screen.getByTestId('current-tournament')).toHaveTextContent('36:Torneo36:planificacion');
 expect(screen.queryByRole('status')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'torneos.vista.openRegistration'})).toBeEnabled();
});
