import React from 'react';
import {render,screen,within} from '@testing-library/react';
import PracticeSpectatorView from './PracticeSpectatorView';
jest.mock('../../hooks/useServerCronometro',()=>()=>65);
const copy={spectator:'Vista de espectador',note:'Práctica aislada',teamA:'Equipo A',teamB:'Equipo B',onCourt:'En cancha',bench:'Banco de suplentes',set:'Set',sets:'Sets',time:'Tiempo',points:'Puntos',live:'En vivo',pending:'Preparado',offline:'Sin conexión',finished:'Finalizado',paused:'Pausado',refreshing:'Actualizando'};
const board={id:'b',estado:'en_curso',display:{displayA:'30',displayB:'15'},score_a:30,score_b:15,games_a:2,games_b:1,sets_a:1,sets_b:0,saque_actual:'A',equipo_a_nombre:'Equipo Práctica 1',equipo_b_nombre:'Equipo Práctica 2',equipo_a_jugadores:[{nombre:'Titular A1',on_court:true},{nombre:'Titular A2',on_court:true},{nombre:'Banco A1',on_court:false}],equipo_b_jugadores:[{nombre:'Titular B1',on_court:true},{nombre:'Titular B2',on_court:true},{nombre:'Banco B1',on_court:false}],historial_sets:[{set:1,a:6,b:4}]};
test('public view shows only two starters per side and a collapsed bench without controls',()=>{
 const {container}=render(<PracticeSpectatorView board={board} status="ready" copy={copy}/>);
 expect(screen.getByText('Titular A1')).toBeInTheDocument();expect(screen.getByText('Titular A2')).toBeInTheDocument();
 const details=container.querySelector('details'); expect(details.open).toBe(false); expect(within(details).getByText('Banco A1')).toBeInTheDocument();
 expect(container.querySelector('.np-spectator__sets strong').textContent).toContain('2');
 expect(screen.getByText('01:05')).toBeInTheDocument();
 expect(container.querySelector('button')).toBeNull();
});
