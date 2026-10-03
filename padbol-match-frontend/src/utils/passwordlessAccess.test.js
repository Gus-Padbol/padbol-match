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

  it('mantiene el origen exacto de la preview QA y nunca deriva a localhost', () => {
    const previewOrigin = 'https://padbol-match-9abn-git-codex-admin-crm-notificati-68339f-padbol1.vercel.app';
    const redirectUrl = buildPasswordlessRedirectUrl(previewOrigin, '/admin?tab=crm');
    expect(redirectUrl).toBe(
      `${previewOrigin}/auth/callback?redirect=%2Fadmin%3Ftab%3Dcrm`,
    );
    expect(redirectUrl).not.toContain('localhost');
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
