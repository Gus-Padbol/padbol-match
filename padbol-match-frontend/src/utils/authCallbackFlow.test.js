import {authFlowForCallbackLocation,navigateAfterAuth} from './authCallbackFlow';
const implicit='#access_token=test-access&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=magiclink';
test('accepts the SDK implicit flow only for a complete callback fragment',()=>{expect(authFlowForCallbackLocation({pathname:'/auth/callback',hash:implicit})).toBe('implicit');});
test.each(['/','/login','/crm-leads','/auth/callback-other'])('keeps PKCE on the ordinary route %s',pathname=>{expect(authFlowForCallbackLocation({pathname,hash:implicit})).toBe('pkce');});
test('PKCE code callbacks and incomplete fragments retain the existing flow',()=>{expect(authFlowForCallbackLocation({pathname:'/auth/callback',search:'?code=test',hash:''})).toBe('pkce');expect(authFlowForCallbackLocation({pathname:'/auth/callback',hash:'#access_token=test'})).toBe('pkce');expect(authFlowForCallbackLocation(null)).toBe('pkce');});

test('successful implicit access reloads the safe destination to restore PKCE for later auth',()=>{const replace=jest.fn(),navigate=jest.fn();navigateAfterAuth('/crm-leads',{flowType:'implicit',replace,navigate});expect(replace).toHaveBeenCalledWith('/crm-leads');expect(navigate).not.toHaveBeenCalled();navigateAfterAuth('/hub',{flowType:'pkce',replace,navigate});expect(navigate).toHaveBeenCalledWith('/hub',{replace:true});});
