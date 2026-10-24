import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import CommercialTeamWorkspace from './CommercialTeamWorkspace';
jest.mock('./CommercialAssignments',()=>()=> <div>Administración de asesores</div>);
jest.mock('./CommercialCaseDetail',()=>()=> <div>Detalle</div>);
test('solo muestra administración cuando el servidor confirma rol de gerente',async()=>{
 const api={getRole:jest.fn().mockResolvedValue({role:'advisor'}),listCases:jest.fn().mockResolvedValue({cases:[]})};
 render(<CommercialTeamWorkspace api={api}/>);await screen.findByText('No hay consultas disponibles.');expect(screen.queryByText('Administración de asesores')).not.toBeInTheDocument();
});
test('rol desconocido no abre el área',async()=>{
 const api={getRole:jest.fn().mockResolvedValue({role:'unknown'}),listCases:jest.fn().mockResolvedValue({cases:[]})};
 render(<CommercialTeamWorkspace api={api}/>);await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('No se pudo abrir'));
});
