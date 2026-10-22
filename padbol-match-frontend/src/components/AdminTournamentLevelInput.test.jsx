import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import AdminTournamentLevelInput from './AdminTournamentLevelInput';
test('configured Nations level is frozen even before the draw and cannot invoke a programmatic change',()=>{
 const change=jest.fn();render(<AdminTournamentLevelInput torneo={{plan_nations:{status:'configured'}}} value="internacional" onChange={change} aria-label="Nivel"/>);
 const input=screen.getByRole('textbox',{name:'Nivel'});expect(input).toBeDisabled();fireEvent.change(input,{target:{value:'club_oficial'}});expect(change).not.toHaveBeenCalled();expect(screen.getByText(/antes de configurar/)).toBeInTheDocument();
});
test('legacy level stays editable without freezing unrelated tournaments',()=>{
 const change=jest.fn();render(<AdminTournamentLevelInput torneo={{plan_nations:null}} value="nacional" onChange={change} aria-label="Nivel"/>);const input=screen.getByRole('textbox',{name:'Nivel'});expect(input).not.toBeDisabled();fireEvent.change(input,{target:{value:'internacional'}});expect(change).toHaveBeenCalledWith('internacional');
});
