import {render,screen,fireEvent} from '@testing-library/react';
import FipaClaimInvitation from './FipaClaimInvitation';
let mockSession={access_token:'test-token'};
const mockNavigate=jest.fn();
let mockHash='#token=personal-token';
jest.mock('../context/AuthContext',()=>({useAuth:()=>({session:mockSession})}));
jest.mock('react-router-dom',()=>({useNavigate:()=>mockNavigate,useSearchParams:()=>[new URLSearchParams()],useLocation:()=>({hash:mockHash})}));
jest.mock('../components/AppHeader',()=>()=>null);
jest.mock('react-i18next',()=>({useTranslation:()=>({i18n:{language:'es'}})}));
beforeEach(()=>{mockHash='#token=personal-token';window.sessionStorage.clear();mockNavigate.mockClear();mockSession={access_token:'test-token'};global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({jugador:{nombre_completo:'Official Player',pais:'Romania',puntos:2180,posicion:1},vence_at:'2026-12-01'})});});
test('valida token del fragmento y acepta solo por acción del jugador con su sesión',async()=>{render(<FipaClaimInvitation/>);expect(await screen.findByText('Official Player')).toBeInTheDocument();expect(screen.getByText(/2180 puntos oficiales/)).toBeInTheDocument();expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({token:'personal-token'});fireEvent.click(screen.getByText('Sí, este perfil es mío'));expect(await screen.findByText('Tu perfil quedó vinculado')).toBeInTheDocument();expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer test-token');});
test('un rechazo del servidor conserva la cuenta sin presentar vinculación exitosa',async()=>{fetch.mockResolvedValue({ok:false,json:async()=>({error:'La invitación no está disponible'})});render(<FipaClaimInvitation/>);expect(await screen.findByText('Invitación no disponible')).toBeInTheDocument();expect(screen.queryByText('Sí, este perfil es mío')).not.toBeInTheDocument();});

test('sin sesión abre el ingreso explícito y conserva el enlace privado como retorno interno',async()=>{mockSession=null;render(<FipaClaimInvitation/>);fireEvent.click(await screen.findByText('Ingresar y aceptar'));expect(mockNavigate).toHaveBeenCalledWith('/login?login=1&redirect=%2Ffipa%2Freclamar');expect(fetch).toHaveBeenCalledTimes(1);expect(window.sessionStorage.getItem('padbol-fipa-pending-invitation')).toBe('personal-token');});

test('al volver del ingreso recupera la invitación sin poner su token en la URL de login',async()=>{mockHash='';window.sessionStorage.setItem('padbol-fipa-pending-invitation','private-saved-token');render(<FipaClaimInvitation/>);await screen.findByText('Official Player');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({token:'private-saved-token'});});
test('la guía sin invitación no intenta aceptar ni validar un token vacío',async()=>{mockHash='';mockSession=null;render(<FipaClaimInvitation/>);expect(await screen.findByText('Vincular mis puntos FIPA')).toBeInTheDocument();expect(fetch).not.toHaveBeenCalled();});

test('permite dejar una invitación vieja y usar la solicitud propia',async()=>{mockSession=null;window.sessionStorage.setItem('padbol-fipa-pending-invitation','personal-token');render(<FipaClaimInvitation/>);fireEvent.click(screen.getByText('Buscar mi perfil sin invitación'));expect(await screen.findByText('Vincular mis puntos FIPA')).toBeInTheDocument();expect(window.sessionStorage.getItem('padbol-fipa-pending-invitation')).toBeNull();});
