import {render,screen,fireEvent} from '@testing-library/react';
import FipaClaimInvitation from './FipaClaimInvitation';
let mockSession={access_token:'test-token'};
jest.mock('../context/AuthContext',()=>({useAuth:()=>({session:mockSession})}));
jest.mock('react-router-dom',()=>({useNavigate:()=>jest.fn(),useSearchParams:()=>[new URLSearchParams()],useLocation:()=>({hash:'#token=personal-token'})}));
jest.mock('../components/AppHeader',()=>()=>null);
beforeEach(()=>{mockSession={access_token:'test-token'};global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({jugador:{nombre_completo:'Official Player',pais:'Romania',puntos:2180,posicion:1},vence_at:'2026-12-01'})});});
test('valida token del fragmento y acepta solo por acción del jugador con su sesión',async()=>{render(<FipaClaimInvitation/>);expect(await screen.findByText('Official Player')).toBeInTheDocument();expect(screen.getByText(/2180 puntos oficiales/)).toBeInTheDocument();expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({token:'personal-token'});fireEvent.click(screen.getByText('Sí, este perfil es mío'));expect(await screen.findByText('Tu perfil quedó vinculado')).toBeInTheDocument();expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer test-token');});
test('un rechazo del servidor conserva la cuenta sin presentar vinculación exitosa',async()=>{fetch.mockResolvedValue({ok:false,json:async()=>({error:'La invitación no está disponible'})});render(<FipaClaimInvitation/>);expect(await screen.findByText('Invitación no disponible')).toBeInTheDocument();expect(screen.queryByText('Sí, este perfil es mío')).not.toBeInTheDocument();});
