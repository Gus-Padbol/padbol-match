import { buildSignUpEmailRedirectUrl } from './handleAuthOnce';

describe('confirmación de alta', () => {
  it('vuelve al documento FIPA exacto después de confirmar el email', () => {
    expect(buildSignUpEmailRedirectUrl('https://padbolmatch.com/', {
      emailRedirectPath: '/fipa/documentos?document=reglamento-oficial',
    })).toBe(
      'https://padbolmatch.com/login?redirect=%2Ffipa%2Fdocumentos%3Fdocument%3Dreglamento-oficial',
    );
  });

  it('no acepta un dominio externo como callback', () => {
    expect(buildSignUpEmailRedirectUrl('https://padbolmatch.com', {
      emailRedirectPath: '//example.com/fipa/documentos',
    })).toBe('https://padbolmatch.com/login');
  });
});
