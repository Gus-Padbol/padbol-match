import fixtureMapping from '../../utils/__fixtures__/napoliFixturePdfMapping.json';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TorneoTabbedView from './TorneoTabbedView';
jest.mock('../../i18n/tSafe', () => ({ useSafeTranslation: () => ({ t: (key, values) => values?.defaultValue || key, i18n: { language: 'es' } }) }));
jest.mock('../../hooks/usePadbolLang', () => ({ usePadbolLangVersion: () => 0 }));
jest.mock('../../supabaseClient', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../SponsorBannerFade', () => () => null);
jest.mock('../SponsorTicker', () => () => null);
jest.mock('../common/SportIcon', () => () => null);
jest.mock('../icons/GeroIcons', () => ({ IconGeroUbicacion: () => null }));
jest.mock('./SorteoGruposModal', () => ({ __esModule: true, default: () => null, equiposConfirmadosParaSorteo: rows => rows }));
jest.mock('../JugadorPreviewModal', () => ({ data }) => data ? <div data-testid="profile-preview">Registered profile</div> : null);
jest.mock('../JugadorQrModal', () => () => null);

const names={280:'Qatar',281:'Francia',282:'Rumania',283:'Bélgica',284:'España',285:'Suecia',286:'Emiratos Árabes Unidos',287:'Dinamarca',288:'Ucrania',289:'México',290:'Alemania',291:'Egipto',292:'Portugal',293:'Austria',294:'Italia'};
const draw={A:[282,290,281,291,287],B:[292,280,283,289,285],C:[284,294,293,286,288]};
const equipos=Object.keys(names).map(id=>({id:Number(id),nombre:names[id],grupo:Object.keys(draw).find(group=>draw[group].includes(Number(id))),jugadores:Number(id)===282?[{participante_id:'not-public-id',tipo_identidad:'generico',user_id:null,nombre:'Jugador de Rumania',alias:'NO-EXPOSE'}]:[]}));
const torneo={id:57,nombre:'Nations Cup',estado:'en_curso',deporte:'padbol',modalidad_plantel:'selecciones',tipo_torneo:'grupos_knockout'};
beforeEach(()=>{window.matchMedia=jest.fn(()=>({matches:false}));});
const setup=(partidos=[])=>render(<MemoryRouter><TorneoTabbedView torneo={torneo} torneoId="57" equipos={equipos} partidos={partidos} setPartidos={jest.fn()} navigate={jest.fn()} nationsEnabled={false} nationsState={null}/></MemoryRouter>);
test('actual legacy API-shaped team list and all three pending groups display the draw when nationsState is absent',()=>{
 const {container}=setup([{id:1,grupo:'A',equipo_a_id:281,equipo_b_id:282,estado:'pendiente'}]);
 fireEvent.click(screen.getByRole('button',{name:'torneos.vista.tabEquipos'}));
 const teamTitles=Array.from(container.querySelectorAll('button[title]')).map(node=>node.title).filter(name=>Object.values(names).includes(name));
 expect(teamTitles).toEqual(Object.values(draw).flat().map(id=>names[id]));
 fireEvent.click(screen.getByRole('button',{name:'torneos.vista.tabGrupos'}));
 const blocks=Array.from(container.querySelectorAll('.torneo-grupos-block'));
 expect(blocks).toHaveLength(3);
 expect(blocks[0]).toHaveTextContent('Jugador de Rumania');expect(container.textContent).not.toMatch(/NO-EXPOSE|not-public-id/);
 blocks.forEach((block,index)=>expect(Array.from(block.querySelectorAll('.torneo-grupos-equipo-nombre')).map(node=>node.textContent)).toEqual(Object.values(draw)[index].map(id=>names[id])));
});
test('a completed match preserves legacy earned positions instead of forcing draw order',()=>{
 const {container}=setup([{id:1,grupo:'A',equipo_a_id:281,equipo_b_id:282,estado:'finalizado',resultado:{sets:['6-2','6-3'],ganador_id:281}}]);
 fireEvent.click(screen.getByRole('button',{name:'torneos.vista.tabGrupos'}));
 const rows=container.querySelector('.torneo-grupos-block').querySelectorAll('.torneo-grupos-equipo-nombre');
 expect(rows[0].textContent).toBe('Francia');
});

const fixtures=fixtureMapping.matches.map(row=>({id:row.match_id,grupo:row.group,equipo_a_id:Number(Object.keys(names).find(id=>names[id]===row.a)),equipo_b_id:Number(Object.keys(names).find(id=>names[id]===row.b)),estado:'pendiente',fecha_hora:null,court_id:null}));
test('fixture renders the30 existing match links by Friday21 and Saturday9, with pairing references and no invented times/courts',()=>{
 const {container}=setup(fixtures);
 fireEvent.click(screen.getByRole('button',{name:'torneos.vista.tabFixture'}));
 const friday=screen.getByRole('region',{name:'Viernes 20 de noviembre'}),saturday=screen.getByRole('region',{name:'Sábado 21 de noviembre · por la mañana'});
 expect(friday.querySelectorAll('.torneo-match-link')).toHaveLength(21);expect(saturday.querySelectorAll('.torneo-match-link')).toHaveLength(9);
 const links=Array.from(container.querySelectorAll('.torneo-match-link'));expect(new Set(links.map(node=>node.getAttribute('href'))).size).toBe(30);
 expect(screen.getByText('Partido 1 · 2A–5A')).toBeInTheDocument();expect(screen.getByText('Partido 10 · 2C–4C')).toBeInTheDocument();
 expect(screen.getAllByText('Cancha por confirmar')).toHaveLength(30);expect(screen.getAllByText(/Horario por confirmar/)).toHaveLength(30);
 expect(container.textContent).toContain('no el orden de juego');
});
test('fixture respects actual Saturday afternoon scheduling and assigned cancha_id without claiming morning/TBC court',()=>{
 const {container}=setup([{...fixtures.find(match=>match.id===584),fecha_hora:'2026-11-21T14:00:00Z',cancha_id:123}]);
 fireEvent.click(screen.getByRole('button',{name:'torneos.vista.tabFixture'}));
 expect(screen.getByRole('region',{name:'Sábado 21 de noviembre'})).toBeInTheDocument();expect(screen.queryByRole('region',{name:/por la mañana/})).toBeNull();
 expect(screen.getByText('Cancha asignada')).toBeInTheDocument();expect(screen.queryByText('Cancha por confirmar')).toBeNull();expect(container.textContent).toContain('15:00');
});
