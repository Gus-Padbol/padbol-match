import React from 'react';
import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import CommercialCrmPage from './CommercialCrmPage';
import {createCommercialAssignmentsApi} from '../utils/commercialAssignmentsApi';
const mockSignOut = jest.fn();
jest.mock('../context/AuthContext',()=>({useAuth:()=>({session:{access_token:'test'},signOutAndClear:mockSignOut})}));
jest.mock('./WhatsappCrmDemo',()=>({requiredScope})=> <div data-testid="crm">Consultas actuales {requiredScope}</div>);
jest.mock('../components/CommercialTeamWorkspace',()=>()=> <div>Vista del equipo</div>);
jest.mock('../utils/commercialAssignmentsApi',()=>({createCommercialAssignmentsApi:jest.fn()}));
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
