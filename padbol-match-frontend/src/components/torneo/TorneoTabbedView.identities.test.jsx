import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TorneoTabbedView from './TorneoTabbedView';
import { tournamentRosterPresentation } from '../../utils/tournamentRosterPresentation';
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
const pending={ participante_id:'pending-pid',tipo_identidad:'plaza_pendiente',nombre:'',alias:'false-public-alias' };
const guest={ participante_id:'guest-pid',tipo_identidad:'generico',nombre:'QA Invitado',user_id:null,alias:'false-public-alias' };
const legacy={ id:'legacy-user',nombre:'Cuenta registrada',alias:'registered-alias' };
beforeEach(()=>{ window.matchMedia=jest.fn(query=>({matches:query.includes('prefers-reduced-motion')})); });
function setup(finalized=false) {
 return render(<MemoryRouter><TorneoTabbedView torneo={{id:48,nombre:'QA',estado:finalized?'finalizado':'abierto',deporte:'padbol'}} torneoId="48" equipos={[{id:179,nombre:'QA Equipo',jugadores:[pending,guest,legacy]}]} partidos={[]} setPartidos={jest.fn()} isAdmin puedeGestionarEquiposTorneo session={{user:{id:'admin'},access_token:'qa'}} navigate={jest.fn()} abrirTabResultadosInicial={finalized} clasificacionFinalFilas={finalized ? [{posicion:1,equipoNombre:'QA Primero',jugadores:[pending,guest,legacy],puntos:0},{posicion:4,equipoNombre:'QA Cuarto',jugadores:[pending,guest,legacy],puntos:0}] : undefined} /></MemoryRouter>);
}
test('registry sporting IDs do not provide account actions, even when an alias or id is supplied',()=>{
 expect(tournamentRosterPresentation({...pending,id:'some-id',user_id:'spoof'})).toEqual({name:'Plaza pendiente',badge:'',canOpenProfile:false});
 expect(tournamentRosterPresentation({...guest,id:'guest-pid'})).toEqual({name:'QA Invitado',badge:'Participante sin cuenta',canOpenProfile:false});
 expect(tournamentRosterPresentation(legacy).canOpenProfile).toBe(true);
 expect(tournamentRosterPresentation({...guest,user_id:'real-account'}).canOpenProfile).toBe(true);
});
test('team roster labels pending slots and guests without profile buttons or QR; legacy account remains interactive',()=>{
 setup();
 expect(screen.getByText('Plaza pendiente').closest('button')).toBeNull();
 expect(screen.getByText('QA Invitado').closest('button')).toBeNull();
 expect(screen.getByText('Participante sin cuenta')).toBeInTheDocument();
 expect(screen.getAllByRole('button',{name:'QR',exact:true})).toHaveLength(1);
 expect(screen.queryByText('@false-public-alias')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/Cuenta registrada/}));
 expect(screen.getByTestId('profile-preview')).toBeInTheDocument();
});
test('podium presentation does not turn a pending sporting place or guest into a registered profile',()=>{
 setup(true);
 expect(screen.getAllByText('Plaza pendiente').every(node=>!node.closest('button'))).toBe(true);
 expect(screen.getAllByText('QA Invitado').every(node=>!node.closest('button'))).toBe(true);
 expect(screen.getAllByText('Participante sin cuenta').length).toBeGreaterThan(0);
 expect(screen.getByRole('button',{name:'Ver Cuenta registrada'})).toBeInTheDocument();
});
