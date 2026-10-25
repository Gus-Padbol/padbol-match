import {resolvePostLoginNavigatePath,safeCommercialCrmPathFromLoginRedirect} from './reservaReturnUrl';
import {resolveRoleAwarePostLoginPath} from './postLoginDestination';
beforeEach(()=>{localStorage.clear();sessionStorage.clear();});
test('preserves the commercial link through the complete login destination pipeline',async()=>{const destination=resolvePostLoginNavigatePath('?redirect=%2Fcrm-leads');expect(destination).toBe('/crm-leads');await expect(resolveRoleAwarePostLoginPath(destination,{access_token:'valid-session'},jest.fn(),jest.fn())).resolves.toBe('/crm-leads');});
test.each(['https://evil.test/crm-leads','//evil.test/crm-leads','/crm-leads-extra','/admin','/crm-leads/../../admin'])('rejects non-exact commercial return %s',path=>{expect(safeCommercialCrmPathFromLoginRedirect('?redirect='+encodeURIComponent(path))).toBeNull();});
test('explicit commercial access is not replaced with an old pending player operation',()=>{localStorage.setItem('padbol_reserva_return','/reservar?sedeId=5');expect(resolvePostLoginNavigatePath('?redirect=%2Fcrm-leads')).toBe('/crm-leads');});
