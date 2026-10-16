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
function setup(finalized=false, team={id:179,nombre:'QA Equipo',jugadores:[pending,guest,legacy]}) {
 return render(<MemoryRouter><TorneoTabbedView torneo={{id:48,nombre:'QA',estado:finalized?'finalizado':'abierto',deporte:'padbol'}} torneoId="48" equipos={[team]} partidos={[]} setPartidos={jest.fn()} isAdmin puedeGestionarEquiposTorneo session={{user:{id:'admin'},access_token:'qa'}} navigate={jest.fn()} abrirTabResultadosInicial={finalized} clasificacionFinalFilas={finalized ? [{posicion:1,equipoNombre:'QA Primero',jugadores:[pending,guest,legacy],puntos:0},{posicion:4,equipoNombre:'QA Cuarto',jugadores:[pending,guest,legacy],puntos:0}] : undefined} /></MemoryRouter>);
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

// Actual QA team 179 (event 48), mapped by canonical backend mapTournamentTeamReadRow at 873405c2.
const actualSelectionDtos = {
  "admin": {
    "id": 179,
    "torneo_id": 48,
    "nombre": "QA Equipo 1 — Cuatro y cuatro",
    "sede_id": 8,
    "puntos_totales": 0,
    "puntos_ranking": null,
    "grupo": null,
    "jugadores": [
      {
        "id": null,
        "user_id": null,
        "participante_id": "86e94d64-2e2c-49cc-a855-cd9eceb2001b",
        "nombre": "QA Invitado 1",
        "estado": "confirmado",
        "tipo_identidad": "generico"
      },
      {
        "id": null,
        "user_id": null,
        "participante_id": "a4a9b9fe-e503-4707-b213-392d3acfedf5",
        "nombre": "QA Invitado 2",
        "estado": "confirmado",
        "tipo_identidad": "generico"
      },
      {
        "id": null,
        "user_id": null,
        "participante_id": "66ce470a-f740-4b58-8018-64be6e4f6e6c",
        "nombre": "QA Invitado 3",
        "estado": "confirmado",
        "tipo_identidad": "generico"
      },
      {
        "id": null,
        "user_id": null,
        "participante_id": "5075f834-ee18-4ef3-9038-097090b75a87",
        "nombre": "QA Invitado 4",
        "estado": "confirmado",
        "tipo_identidad": "generico"
      },
      {
        "id": null,
        "user_id": null,
        "participante_id": "a064e55a-a70a-44a2-b80c-36993d4a1f4d",
        "nombre": "",
        "estado": "pendiente",
        "tipo_identidad": "plaza_pendiente"
      },
      {
        "id": null,
        "user_id": null,
        "participante_id": "145c032c-4b4f-45d1-956c-aa08091f176c",
        "nombre": "",
        "estado": "pendiente",
        "tipo_identidad": "plaza_pendiente"
      },
      {
        "id": null,
        "user_id": null,
        "participante_id": "7345ee11-712e-4538-8fc7-49f977565af9",
        "nombre": "",
        "estado": "pendiente",
        "tipo_identidad": "plaza_pendiente"
      },
      {
        "id": null,
        "user_id": null,
        "participante_id": "04cdd9e3-bf03-41ee-a747-3ce65004d1f2",
        "nombre": "",
        "estado": "pendiente",
        "tipo_identidad": "plaza_pendiente"
      }
    ],
    "capitan_nombre": "QA Invitado 1",
    "jugadores_count": 8,
    "estado": "confirmado",
    "posicion_final": null,
    "tipo_equipo": null,
    "inscripcion_estado": "confirmado",
    "modalidad_plantel": "selecciones"
  },
  "public": {
    "id": 179,
    "torneo_id": 48,
    "nombre": "QA Equipo 1 — Cuatro y cuatro",
    "sede_id": 8,
    "puntos_totales": 0,
    "puntos_ranking": null,
    "grupo": null,
    "jugadores": [
      {
        "id": null,
        "user_id": null,
        "nombre": "QA Invitado 1",
        "estado": "confirmado",
        "tipo_identidad": "generico"
      },
      {
        "id": null,
        "user_id": null,
        "nombre": "QA Invitado 2",
        "estado": "confirmado",
        "tipo_identidad": "generico"
      },
      {
        "id": null,
        "user_id": null,
        "nombre": "QA Invitado 3",
        "estado": "confirmado",
        "tipo_identidad": "generico"
      },
      {
        "id": null,
        "user_id": null,
        "nombre": "QA Invitado 4",
        "estado": "confirmado",
        "tipo_identidad": "generico"
      },
      {
        "id": null,
        "user_id": null,
        "nombre": "",
        "estado": "pendiente",
        "tipo_identidad": "plaza_pendiente"
      },
      {
        "id": null,
        "user_id": null,
        "nombre": "",
        "estado": "pendiente",
        "tipo_identidad": "plaza_pendiente"
      },
      {
        "id": null,
        "user_id": null,
        "nombre": "",
        "estado": "pendiente",
        "tipo_identidad": "plaza_pendiente"
      },
      {
        "id": null,
        "user_id": null,
        "nombre": "",
        "estado": "pendiente",
        "tipo_identidad": "plaza_pendiente"
      }
    ],
    "capitan_nombre": "QA Invitado 1",
    "jugadores_count": 8,
    "estado": "confirmado",
    "posicion_final": null,
    "tipo_equipo": null
  }
};
test.each(Object.entries(actualSelectionDtos))('actual %s selection DTO preserves sporting identity labels without profile or QR', (audience, dto) => {
 setup(false, dto);
 expect(screen.getAllByText('Plaza pendiente')).toHaveLength(4);
 expect(screen.getAllByText('Participante sin cuenta')).toHaveLength(4);
 expect(screen.queryByRole('button',{name:'QR',exact:true})).not.toBeInTheDocument();
 dto.jugadores.forEach(player=>{
  const identity=tournamentRosterPresentation(player);
  expect(identity.canOpenProfile).toBe(false);
  if(player.tipo_identidad==='generico') expect(screen.getByText(player.nombre).closest('button')).toBeNull();
 });
 if(audience==='admin') expect(dto.inscripcion_estado).toBe('confirmado');
 else expect(dto).not.toHaveProperty('inscripcion_estado');
});
