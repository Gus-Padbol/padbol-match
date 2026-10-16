import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import AdminTournamentDeleteAction,{canDeleteAdminTournament} from './AdminTournamentDeleteAction';
test('configured Nations record cannot trigger deletion and explains preservation',()=>{
 const onDelete=jest.fn();render(<AdminTournamentDeleteAction torneo={{id:7,nombre:'QA',plan_nations:{enabled:true}}} onDelete={onDelete}/>);
 expect(screen.queryByRole('button',{name:'Eliminar'})).not.toBeInTheDocument();expect(onDelete).not.toHaveBeenCalled();expect(screen.getByText(/conserva su expediente/)).toBeInTheDocument();
 expect(canDeleteAdminTournament({plan_nations:{}})).toBe(false);
});
test('legacy deletion remains available while unconfigured selection is not treated as a saved Nations event',()=>{
 const onDelete=jest.fn();render(<AdminTournamentDeleteAction torneo={{id:8,nombre:'Legacy',modalidad_plantel:'selecciones',plan_nations:null}} onDelete={onDelete} language="en"/>);
 fireEvent.click(screen.getByRole('button',{name:'Delete'}));expect(onDelete).toHaveBeenCalledWith(8,'Legacy');expect(screen.queryByText(/keeps its event record/)).not.toBeInTheDocument();
});
