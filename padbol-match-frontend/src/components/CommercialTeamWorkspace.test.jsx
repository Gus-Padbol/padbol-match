import React from 'react';
import {render, screen, waitFor, fireEvent} from '@testing-library/react';
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

test('manager can isolate own, another advisor and unassigned cases without changing assignments',async()=>{
 const cases=[{id:'a',channel:'form',contact:{name:'Lead Nico'},assignedAdvisor:{id:'nico',name:'Nico'}},{id:'b',channel:'form',contact:{name:'Lead JP'},assignedAdvisor:{id:'jp',name:'Juan Pablo'}},{id:'c',channel:'form',contact:{name:'Lead sin asesor'},assignedAdvisor:{id:null}}];
 const api={getRole:jest.fn().mockResolvedValue({role:'manager'}),listCases:jest.fn().mockResolvedValue({cases})};
 render(<CommercialTeamWorkspace api={api} currentUserId="nico"/>);await screen.findByRole('button',{name:/Lead Nico/});const initialReads=api.listCases.mock.calls.length;
 fireEvent.change(screen.getByLabelText('Filtrar por asesor'),{target:{value:'mine'}});expect(screen.queryByRole('button',{name:/Lead JP/})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:/Lead Nico/})).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Filtrar por asesor'),{target:{value:'jp'}});expect(screen.getByRole('button',{name:/Lead JP/})).toBeInTheDocument();expect(screen.queryByRole('button',{name:/Lead Nico/})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Filtrar por asesor'),{target:{value:'unassigned'}});expect(screen.getByRole('button',{name:/Lead sin asesor/})).toBeInTheDocument();expect(api.listCases).toHaveBeenCalledTimes(initialReads);
});

test('el área comercial ofrece el alta manual desde un único acceso',async()=>{
 const api={getRole:jest.fn().mockResolvedValue({role:'manager'}),listCases:jest.fn().mockResolvedValue({cases:[]}),listAdvisors:jest.fn().mockResolvedValue({advisors:[]})};
 render(<CommercialTeamWorkspace api={api} currentUserId="nico"/>);await screen.findByRole('button',{name:'Nuevo lead'});fireEvent.click(screen.getByRole('button',{name:'Nuevo lead'}));await screen.findByRole('dialog',{name:'Nuevo lead manual'});expect(screen.getByText('Registra una oportunidad aunque todavía no haya conversación.')).toBeInTheDocument();
});
