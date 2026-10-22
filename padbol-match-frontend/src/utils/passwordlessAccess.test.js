import {
  buildPasswordlessRedirectUrl,
  requestPasswordlessAccess,
  passwordlessAccessErrorTranslationKey,
} from './passwordlessAccess';

describe('passwordlessAccess', () => {
  it('construye un callback que conserva el destino interno', () => {
    expect(buildPasswordlessRedirectUrl('https://www.padbolmatch.com/', '/admin')).toBe(
      'https://www.padbolmatch.com/auth/callback?redirect=%2Fadmin',
    );
  });

  it('conserva el documento FIPA exacto en el enlace mágico', () => {
    expect(buildPasswordlessRedirectUrl(
      'https://www.padbolmatch.com',
      '/fipa/documentos?document=codigo-conducta',
    )).toBe(
      'https://www.padbolmatch.com/auth/callback?redirect=%2Ffipa%2Fdocumentos%3Fdocument%3Dcodigo-conducta',
    );
  });

  it('impide destinos externos', () => {
    expect(buildPasswordlessRedirectUrl('https://www.padbolmatch.com', '//otro-sitio.com')).toBe(
      'https://www.padbolmatch.com/auth/callback?redirect=%2Fhub',
    );
  });

  it('solicita un enlace sin crear usuarios nuevos', async () => {
    const signInWithOtp = jest.fn().mockResolvedValue({ error: null });
    const result = await requestPasswordlessAccess({
      auth: { signInWithOtp },
      email: ' JERO@EXAMPLE.COM ',
      origin: 'https://www.padbolmatch.com',
      destination: '/admin',
    });

    expect(result).toEqual({ error: null });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'jero@example.com',
      options: {
        shouldCreateUser: false,
        emailRedirectTo: 'https://www.padbolmatch.com/auth/callback?redirect=%2Fadmin',
      },
    });
  });
});

it('returns thrown network errors so the screen can recover instead of leaving an unhandled rejection', async () => {
  const error = new TypeError('Failed to fetch');
  const signInWithOtp = jest.fn().mockRejectedValue(error);
  await expect(requestPasswordlessAccess({ auth: { signInWithOtp }, email: 'qa@example.com', origin: 'https://padbolmatch.com' })).resolves.toEqual({ error });
});

 it.each([{ status: 429 }, { code: 'over_email_send_rate_limit' }, { code: 'over_request_rate_limit' }])('explains temporary email limits without blaming the address: %p', (error) => {
   expect(passwordlessAccessErrorTranslationKey(error)).toBe('auth.accessLinkRateLimited');
 });
 it('keeps provider failure generic and does not expose internals', () => {
   expect(passwordlessAccessErrorTranslationKey({ code: 'unexpected_failure', message: 'smtp secret internals' })).toBe('auth.accessLinkFailed');
 });

it('explains that passwordless access requires registration without creating an account', () => {
  expect(passwordlessAccessErrorTranslationKey({ status: 422, code: 'otp_disabled' })).toBe('auth.accessLinkRegistrationRequired');
});
