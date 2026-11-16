import React from 'react';
import {render,screen,within} from '@testing-library/react';
import PracticeSpectatorView from './PracticeSpectatorView';
jest.mock('../../hooks/useServerCronometro',()=>()=>65);
const copy={spectator:'Spectator view',note:'Isolated practice',teamA:'Team A',teamB:'Team B',onCourt:'On court',bench:'Substitutes',set:'Set',sets:'Sets',games:'Games',time:'Time',points:'Points',live:'Live',pending:'Ready',offline:'Offline',finished:'Finished',paused:'Paused',refreshing:'Refreshing',serve:'Serving',setsWon:'Sets won',updatedLive:'Updated live',reconnecting:'Reconnecting…',choose:'Choose a court',court:'Court'};
const board={id:'b',estado:'en_curso',display:{displayA:'30',displayB:'15'},score_a:30,score_b:15,games_a:2,games_b:1,sets_a:1,sets_b:0,saque_actual:'A',equipo_a_nombre:'Equipo Práctica 1',equipo_b_nombre:'Equipo Práctica 2',equipo_a_jugadores:[{nombre:'Titular A1',on_court:true},{nombre:'Titular A2',on_court:true},{nombre:'Banco A1',on_court:false}],equipo_b_jugadores:[{nombre:'Titular B1',on_court:true},{nombre:'Titular B2',on_court:true},{nombre:'Banco B1',on_court:false}],historial_sets:[{set:1,a:6,b:4}]};
test('public view shows only two starters per side and a collapsed bench without controls',()=>{
 const {container}=render(<PracticeSpectatorView board={board} status="ready" copy={copy}/>);
 expect(screen.getByText('Titular A1')).toBeInTheDocument();expect(screen.getByText('Titular A2')).toBeInTheDocument();
 const details=container.querySelector('details'); expect(details.open).toBe(false); expect(within(details).getByText('Banco A1')).toBeInTheDocument();
 expect(container.textContent).toContain('SET 2');
 expect(container.textContent).toContain('Sets won 1–0');
 expect(container.textContent).not.toContain('01:05');
 expect(container.querySelector('button')).toBeNull();
});

test('flags cover any public ISO from canonical metadata and omit when absent',()=>{
 const copyEn={...copy,live:'Live',serve:'Serving',setsWon:'Sets won',updatedLive:'Updated live'};
 const withIso={...board,equipo_a_pais_iso:'QA',equipo_b_pais_iso:'GB'};
 const {container}=render(<PracticeSpectatorView board={withIso} status="ready" copy={copyEn}/>);
 expect(container.textContent).toContain('🇶🇦'); expect(container.textContent).toContain('🇬🇧');
 const {container:noIso}=render(<PracticeSpectatorView board={{...board,equipo_a_pais_iso:null,equipo_b_pais_iso:null}} status="ready" copy={copyEn}/>);
 expect(noIso.querySelector('.np-public__flag')).toBeNull();
});
