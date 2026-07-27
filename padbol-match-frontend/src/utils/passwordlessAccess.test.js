import {
  buildPasswordlessRedirectUrl,
  requestPasswordlessAccess,
} from './passwordlessAccess';

describe('passwordlessAccess', () => {
  it('construye un callback que conserva el destino interno', () => {
    expect(buildPasswordlessRedirectUrl('https://www.padbolmatch.com/', '/admin')).toBe(
      'https://www.padbolmatch.com/auth/callback?redirect=%2Fadmin',
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
