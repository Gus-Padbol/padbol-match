import React from 'react';
import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import CommercialCrmPage from './CommercialCrmPage';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';
const mockSignOut = jest.fn();
let mockSession={access_token:'test',user:{id:'nico'}};
jest.mock('../context/AuthContext',()=>({useAuth:()=>({session:mockSession,signOutAndClear:mockSignOut})}));
jest.mock('./WhatsappCrmDemo',()=>({requiredScope})=> <div data-testid="crm">Consultas actuales {requiredScope}</div>);
jest.mock('../components/CommercialTeamWorkspace',()=>()=> <div>Vista del equipo</div>);
jest.mock('../utils/commercialAssignmentsApi',()=>({createCommercialAssignmentsApi:jest.fn()}));
beforeEach(()=>{global.fetch=jest.fn().mockResolvedValue({ok:false,status:403,json:async()=>({})});});
afterEach(()=>{jest.restoreAllMocks();});
test('conserva la bandeja anterior si el servicio comercial no está disponible',async()=>{
 createCommercialAssignmentsApi.mockReturnValue({getRole:jest.fn().mockRejectedValue(new Error('no disponible'))});render(<CommercialCrmPage/>);
 await waitFor(()=>expect(screen.getByTestId('crm')).toBeInTheDocument());expect(screen.queryByText('Área del equipo comercial')).not.toBeInTheDocument();
});
test('ofrece área de equipo solo con rol confirmado por servidor',async()=>{
 createCommercialAssignmentsApi.mockReturnValue({getRole:jest.fn().mockResolvedValue({role:'manager'})});render(<CommercialCrmPage/>);
 fireEvent.click(await screen.findByText('Área del equipo comercial'));expect(screen.getByText('Vista del equipo')).toBeInTheDocument();
});

test('mantiene el alcance comercial y permite cerrar sesión', async()=>{
 createCommercialAssignmentsApi.mockReturnValue({getRole:jest.fn().mockRejectedValue(new Error('no disponible'))});render(<CommercialCrmPage/>);expect(screen.getByTestId('crm')).toHaveTextContent('commercial');fireEvent.click(screen.getByRole('button',{name:'Cerrar sesión'}));expect(mockSignOut).toHaveBeenCalledTimes(1);await waitFor(()=>expect(screen.getByTestId('crm')).toBeInTheDocument());
});

test('el asesor entra directamente a sus consultas',async()=>{
 createCommercialAssignmentsApi.mockReturnValue({getRole:jest.fn().mockResolvedValue({role:'advisor'})});render(<CommercialCrmPage/>);expect(await screen.findByText('Vista del equipo')).toBeInTheDocument();
});
test('renovar token mantiene montada la vista elegida y no vuelve a consultas actuales',async()=>{
 const api={getRole:jest.fn().mockResolvedValue({role:'manager'})};createCommercialAssignmentsApi.mockReturnValue(api);const view=render(<CommercialCrmPage/>);
 fireEvent.click(await screen.findByText('Área del equipo comercial'));const detail=screen.getByText('Vista del equipo');
 mockSession={access_token:'renewed',user:{id:'nico'}};view.rerender(<CommercialCrmPage/>);expect(screen.getByText('Vista del equipo')).toBe(detail);await waitFor(()=>expect(api.getRole).toHaveBeenCalledTimes(2));expect(screen.getByText('Vista del equipo')).toBe(detail);
});
