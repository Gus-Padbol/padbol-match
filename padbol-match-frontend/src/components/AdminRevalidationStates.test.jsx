import { render, screen, fireEvent } from '@testing-library/react';
import AdminClasesClubSection from './AdminClasesClubSection';
import AdminJugadoresSection from './AdminJugadoresSection';
import { fetchAdminClases, fetchAdminProfesores } from '../utils/clasesAdminApi';
import { fetchAdminJugadoresList } from '../utils/adminJugadoresApi';
import { adminErrorMessage } from './adminErrorMessage';
jest.mock('../i18n/adminTranslation', () => {
 const copy={'admin.jugadores.selectSede':'Selecciona una sede','admin.jugadores.empty':'No hay jugadores con historial en esta sede.','admin.common.classesLoadFailed':'No se pudieron cargar las clases. Vuelve a intentarlo.','general.retry':'Reintentar'};
 const t=(key,fallback)=>copy[key]||(typeof fallback==='string'?fallback:key);
 return {useSafeTranslation:()=>({t,i18n:{language:'es'}}),stripAdminEmoji:value=>value};
});
jest.mock('../utils/clasesAdminApi',()=>({fetchAdminClases:jest.fn(),fetchAdminProfesores:jest.fn(),crearClaseAdmin:jest.fn(),fetchAdminClaseAsistencia:jest.fn(),patchAdminClaseAsistencia:jest.fn(),patchClaseActivoAdmin:jest.fn()}));
jest.mock('../utils/adminJugadoresApi',()=>({...jest.requireActual('../utils/adminJugadoresApi'),fetchAdminJugadoresList:jest.fn()}));
beforeEach(()=>jest.clearAllMocks());
test('sin sede elegida solicita selección sin afirmar que no existen jugadores',async()=>{
 render(<AdminJugadoresSection accessToken="fixture-token" isSuperAdmin sedesMap={{}}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Selecciona una sede');
 expect(screen.queryByText('No hay jugadores con historial en esta sede.')).not.toBeInTheDocument();
 expect(fetchAdminJugadoresList).not.toHaveBeenCalled();
});
test('clases oculta SQL y el vacío falso y permite reintentar',async()=>{
 fetchAdminClases.mockResolvedValue([]);fetchAdminProfesores.mockRejectedValueOnce(new Error('column profesores.especialidad does not exist')).mockResolvedValue([]);
 render(<AdminClasesClubSection accessToken="fixture-token" sedeId={1}/>);
 expect(await screen.findByText('No se pudieron cargar las clases. Vuelve a intentarlo.')).toBeInTheDocument();
 expect(screen.queryByText('No hay clases creadas.')).not.toBeInTheDocument();expect(screen.queryByText(/especialidad/)).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));expect(await screen.findByText('No hay clases creadas.')).toBeInTheDocument();expect(fetchAdminClases).toHaveBeenCalledTimes(2);
});
test('errores operativos se conservan y detalles internos se sustituyen',()=>{
 expect(adminErrorMessage(new Error('No tienes acceso a esta sede.'),'Error de carga')).toBe('No tienes acceso a esta sede.');
 expect(adminErrorMessage(new Error('Could not find table public.sede_programas_beneficios in schema cache'),'Error de carga')).toBe('Error de carga');
});
