import { supabase } from '../supabaseClient';
import { registerCurrentAccountEligibility, accountEligibilityErrorTranslationKey } from './legalDocuments';
import { assessAgeEligibility } from './ageEligibility';
jest.mock('../supabaseClient', () => ({ supabase: { rpc: jest.fn() } }));
beforeEach(() => supabase.rpc.mockReset());
it('registers an adult ISO date using the actual RPC contract', async () => {
  supabase.rpc.mockResolvedValue({ data: { allowed: true, age_band: 'adult' }, error: null });
  await expect(registerCurrentAccountEligibility(' 1990-01-20 ', 'web_profile_completion')).resolves.toEqual({ allowed: true, age_band: 'adult' });
  expect(supabase.rpc).toHaveBeenCalledWith('registrar_elegibilidad_cuenta_actual', { p_fecha_nacimiento: '1990-01-20', p_fuente: 'web_profile_completion' });
});
it.each([
  [{ allowed: false, age_band: 'requires_verified_parent' }, 'verified_parental_authorization_required'],
  [{ allowed: false, age_band: 'under_13' }, 'account_not_available_under_13'],
  [null, 'account_eligibility_verification_failed'],
  [{ allowed: 'false', age_band: 'adult' }, 'account_eligibility_verification_failed'],
])('does not bypass a denial or malformed response %p', async (data, message) => {
  supabase.rpc.mockResolvedValue({ data, error: null });
  await expect(registerCurrentAccountEligibility('1990-01-20')).rejects.toThrow(message);
});
it.each([
  [{ code: 'PGRST202', message: 'Could not find the function' }, 'profileCompletion.eligibilityCheckFailed'],
  [{ code: '42501', message: 'permission denied' }, 'profileCompletion.eligibilityCheckFailed'],
  [new TypeError('Failed to fetch'), 'profileCompletion.eligibilityCheckFailed'],
  [{ code: '22007', message: 'birth_date_invalid' }, 'auth.ageEligibilityInvalid'],
  [{ message: 'verified_parental_authorization_required' }, 'auth.ageEligibilityParental'],
  [{ code: 'PGRST301' }, 'profileCompletion.sessionExpired'],
])('distinguishes age rejection from infrastructure errors %p', (error, key) => {
  expect(accountEligibilityErrorTranslationKey(error)).toBe(key);
});
it('preserves the sixteenth birthday boundary and impossible-date rejection', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  expect(assessAgeEligibility('2010-10-13', now).allowed).toBe(true);
  expect(assessAgeEligibility('2010-10-14', now)).toMatchObject({ allowed: false, band: 'requires_verified_parent' });
  expect(assessAgeEligibility('1990-02-31', now)).toMatchObject({ allowed: false, band: 'invalid' });
});

it('propagates a missing RPC without claiming the valid adult date was rejected', async () => {
  const error = { code: 'PGRST202', message: 'Could not find the function public.registrar_elegibilidad_cuenta_actual' };
  supabase.rpc.mockResolvedValue({ data: null, error });
  try { await registerCurrentAccountEligibility('1990-01-20'); throw new Error('Unexpected success'); }
  catch (failure) {
    expect(failure).toBe(error);
    expect(accountEligibilityErrorTranslationKey(failure)).toBe('profileCompletion.eligibilityCheckFailed');
  }
});
