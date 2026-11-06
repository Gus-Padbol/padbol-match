jest.mock('./commercialAssignmentsApi',()=>({createCommercialAssignmentsApi:()=>({getRole:async()=>({role:null})})}));
import { resolveRoleAwarePostLoginPath } from './postLoginDestination';

describe('resolveRoleAwarePostLoginPath', () => {
  const session = { access_token: 'token' };

  test('envia un admin_club directamente al panel cuando entra sin destino', async () => {
    await expect(
      resolveRoleAwarePostLoginPath('/', session, async () => ({ rol: 'admin_club' })),
    ).resolves.toBe('/admin');
  });

  test('envia un usuario común al hub cuando entra sin destino', async () => {
    await expect(
      resolveRoleAwarePostLoginPath('/', session, async () => ({ rol: 'jugador' })),
    ).resolves.toBe('/hub');
  });

  test.each(['super_admin', 'admin_nacional', 'admin_cadena', 'admin_club', 'empleado', 'editor_contenido'])(
    'reconoce el rol administrativo %s al entrar desde la web pública',
    async (rol) => {
      await expect(
        resolveRoleAwarePostLoginPath('/', session, async () => ({ rol })),
      ).resolves.toBe('/admin');
    },
  );

  test('normaliza variantes heredadas del rol admin_club', async () => {
    await expect(
      resolveRoleAwarePostLoginPath('/', session, async () => ({ rol: 'Admin Club' })),
    ).resolves.toBe('/admin');
  });

  test('sin sesión utilizable evita volver a la presentación pública', async () => {
    const fetcher = jest.fn();
    await expect(resolveRoleAwarePostLoginPath('/', null, fetcher)).resolves.toBe('/hub');
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('conserva un destino explícito sin consultar el rol', async () => {
    const fetcher = jest.fn();
    await expect(resolveRoleAwarePostLoginPath('/reservar?sedeId=1', session, fetcher))
      .resolves.toBe('/reservar?sedeId=1');
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('si falla la consulta nunca devuelve a la presentación pública', async () => {
    await expect(
      resolveRoleAwarePostLoginPath('/', session, async () => { throw new Error('offline'); }),
    ).resolves.toBe('/hub');
  });
});

test.each(['manager','advisor'])('sends a confirmed commercial %s without a venue to CRM', async role=>{const membership=jest.fn().mockResolvedValue({role});await expect(resolveRoleAwarePostLoginPath('/',{access_token:'commercial-session'},async()=>({rol:'jugador',sedeId:null}),membership)).resolves.toBe('/crm-leads');expect(membership).toHaveBeenCalledWith('commercial-session');});
test('does not infer commercial access from a claimed role or email',async()=>{const membership=jest.fn().mockRejectedValue({status:403});await expect(resolveRoleAwarePostLoginPath('/',{access_token:'session',user:{email:'sm@padbol.com'}},async()=>({rol:'commercial_operator'}),membership)).resolves.toBe('/hub');});
test('explicit CRM return is kept without requesting membership before the protected route',async()=>{const membership=jest.fn();await expect(resolveRoleAwarePostLoginPath('/crm-leads',{access_token:'session'},jest.fn(),membership)).resolves.toBe('/crm-leads');expect(membership).not.toHaveBeenCalled();});
test('an ordinary player or a failed commercial lookup stays in the player hub',async()=>{await expect(resolveRoleAwarePostLoginPath('/',{access_token:'session'},async()=>({rol:'jugador'}),async()=>({role:'none'}))).resolves.toBe('/hub');});

describe('old CRM storage cannot override destinations',()=>{
 beforeEach(()=>{localStorage.setItem('padbol_crm_app','1');localStorage.setItem('padbol_crm_return','/crm-leads');});
 afterEach(()=>localStorage.clear());
 test.each(['super_admin','superadmin','admin_club'])('admin %s reaches panel',async rol=>{await expect(resolveRoleAwarePostLoginPath('/',{access_token:'s'},async()=>({rol}))).resolves.toBe('/admin');});
 test.each(['/crm-leads','/fipa/documentos','/reservar?sedeId=1'])('preserves explicit %s',async dest=>{const fetcher=jest.fn();await expect(resolveRoleAwarePostLoginPath(dest,{access_token:'s'},fetcher)).resolves.toBe(dest);expect(fetcher).not.toHaveBeenCalled();});
 test.each(['manager','advisor'])('commercial %s keeps CRM',async role=>{await expect(resolveRoleAwarePostLoginPath('/',{access_token:'s'},async()=>({rol:'jugador'}),async()=>({role}))).resolves.toBe('/crm-leads');});
 test('player stays in hub',async()=>{await expect(resolveRoleAwarePostLoginPath('/',{access_token:'s'},async()=>({rol:'jugador'}),async()=>({role:null}))).resolves.toBe('/hub');});
 test('failure and missing session do not grant admin',async()=>{await expect(resolveRoleAwarePostLoginPath('/',{access_token:'s'},async()=>{throw Error('offline')})).resolves.toBe('/hub');await expect(resolveRoleAwarePostLoginPath('/',null)).resolves.toBe('/hub');});
});
