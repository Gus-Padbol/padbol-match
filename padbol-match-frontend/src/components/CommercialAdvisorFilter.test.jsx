import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import CommercialAdvisorFilter,{matchesAdvisor} from './CommercialAdvisorFilter';
test('filters exact assigned identity and does not mistake missing case metadata for unassigned',()=>{
 const nico={assignedAdvisor:{id:'nico',name:'Nico'}},juan={assignedAdvisor:{id:'jp',name:'Juan Pablo'}};
 expect(matchesAdvisor(nico,'mine','nico')).toBe(true);expect(matchesAdvisor(juan,'mine','nico')).toBe(false);expect(matchesAdvisor(juan,'jp','nico')).toBe(true);
 expect(matchesAdvisor({assignedAdvisor:{id:null}},'unassigned','nico')).toBe(true);expect(matchesAdvisor(undefined,'unassigned','nico')).toBe(false);
 expect(matchesAdvisor(juan,'','nico')).toBe(true);
 const onChange=jest.fn();render(<CommercialAdvisorFilter cases={[nico,juan]} currentUserId="nico" value="" onChange={onChange}/>);
 expect(screen.getByRole('option',{name:'Mis consultas'})).toBeInTheDocument();fireEvent.change(screen.getByLabelText('Filtrar por asesor'),{target:{value:'jp'}});expect(onChange).toHaveBeenCalledWith('jp');
});
