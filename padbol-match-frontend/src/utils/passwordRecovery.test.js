import { buildPasswordRecoveryRedirectUrl, requestPasswordRecovery } from './passwordRecovery';

describe('passwordRecovery', () => {
  it('encadena callback permitido con destino recovery interno', () => {
    expect(buildPasswordRecoveryRedirectUrl('https://qa.example/', '/admin')).toBe(
      'https://qa.example/auth/callback?redirect=%2Fauth%2Frecovery%3Fredirect%3D%252Fadmin'
    );
  });
  it('no admite destinos externos', () => {
    expect(buildPasswordRecoveryRedirectUrl('https://qa.example', '//evil.test')).toContain('redirect%3D%252Fadmin');
  });
  it('normaliza email y solicita recovery', async () => {
    const resetPasswordForEmail = jest.fn().mockResolvedValue({ data: {}, error: null });
    await requestPasswordRecovery({ auth: { resetPasswordForEmail }, email: ' Admin@Example.com ', origin: 'https://qa.example' });
    expect(resetPasswordForEmail).toHaveBeenCalledWith('admin@example.com', {
      redirectTo: 'https://qa.example/auth/callback?redirect=%2Fauth%2Frecovery%3Fredirect%3D%252Fadmin',
    });
  });
});
