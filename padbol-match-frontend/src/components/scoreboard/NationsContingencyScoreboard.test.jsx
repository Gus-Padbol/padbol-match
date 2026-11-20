import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import NationsContingencyScoreboard from './NationsContingencyScoreboard';
import {createPartido} from '../../utils/scoreboardApi';

// Keep actual translation dictionary and form; mock only its network boundary.
jest.mock('react-i18next',()=>({useTranslation:()=>({i18n:{language:'en',resolvedLanguage:'en'}})}));
jest.mock('../../utils/scoreboardApi',()=>({createPartido:jest.fn()}));
const courts=[{id:31,nombre:'Court 1'},{id:32,nombre:'Court 2'},{id:33,nombre:'Court 3'}];
function fill(){
 fireEvent.change(screen.getByLabelText('Court'),{target:{value:'Court 2'}});
 fireEvent.change(screen.getByLabelText('Team A'),{target:{value:'Italy'}});
 fireEvent.change(screen.getByLabelText('Team B'),{target:{value:'Spain'}});
 for(const side of ['A','B'])for(let n=1;n<=4;n++)fireEvent.change(screen.getByLabelText(`${n<=2?'Starter':'Substitute'} ${side}${n}`),{target:{value:`${side} Player ${n}`}});
}
beforeEach(()=>jest.clearAllMocks());

test('English four-player form uses authorised courts and creates an independent venue marker with both links',async()=>{
 createPartido.mockResolvedValue({id:'test-board'});
 render(<NationsContingencyScoreboard courts={courts}/>);
 expect(screen.getByText('The first two players on each team are starters; the other two are substitutes.')).toBeInTheDocument();
 expect(screen.getByText('Create a standalone scoreboard to play now. It is not linked to the tournament and does not add points.')).toBeInTheDocument();
 fill();fireEvent.click(screen.getByText('Create independent scoreboard'));
 await waitFor(()=>expect(createPartido).toHaveBeenCalledTimes(1));
 expect(createPartido).toHaveBeenCalledWith({sede_id:9,cancha:'Court 2',equipo_a_nombre:'Italy',equipo_b_nombre:'Spain',equipo_a_jugadores:[1,2,3,4].map(n=>({nombre:`A Player ${n}`})),equipo_b_jugadores:[1,2,3,4].map(n=>({nombre:`B Player ${n}`}))});
 expect(await screen.findByText('Scoreboard ready. Share these links:')).toBeInTheDocument();
 expect(screen.getByText('Private referee control')).toHaveAttribute('href','/admin/scoreboard/test-board');
 expect(screen.getByText('Public display / TV')).toHaveAttribute('href','/display/9/scoreboard/test-board');
});

test('incomplete setup is explained before any marker is created',()=>{
 render(<NationsContingencyScoreboard courts={courts}/>);
 fireEvent.click(screen.getByText('Create independent scoreboard'));
 expect(screen.getByRole('alert')).toHaveTextContent('Complete the court, both teams and at least two players per team.');
 expect(createPartido).not.toHaveBeenCalled();
});

test('creation failure remains visible and no unconfirmed control link is offered',async()=>{
 createPartido.mockRejectedValue(new Error('Connection lost. Try again.'));
 render(<NationsContingencyScoreboard courts={courts}/>);fill();fireEvent.click(screen.getByText('Create independent scoreboard'));
 expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost. Try again.');
 expect(screen.queryByText('Private referee control')).toBeNull();
 expect(screen.getByText('Create independent scoreboard')).not.toBeDisabled();
});
