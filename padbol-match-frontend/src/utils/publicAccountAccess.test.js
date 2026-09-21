import {
  DEFAULT_PADBOL_MATCH_WEB_ORIGIN,
  resolvePublicAccountAccessHref,
} from './publicAccountAccess';

describe('destino público de ingreso a Padbol Match', () => {
  it.each(['padbolmatch.com', 'www.padbolmatch.com', 'qa.padbolmatch.com', 'localhost'])(
    'usa la ruta interna desde %s',
    (hostname) => {
      expect(resolvePublicAccountAccessHref({ hostname })).toBe('/acceso');
    },
  );

  it.each(['padbol.com', 'www.padbol.com', 'dev.padbol.com'])(
    'cruza al dominio de la aplicación desde %s',
    (hostname) => {
      expect(resolvePublicAccountAccessHref({ hostname })).toBe(`${DEFAULT_PADBOL_MATCH_WEB_ORIGIN}/acceso`);
    },
  );

  it('admite un origen de aplicación por entorno y conserva modo/redirect', () => {
    expect(resolvePublicAccountAccessHref(
      { hostname: 'dev.padbol.com' },
      '/acceso?modo=registro&redirect=%2Fadmin',
      { REACT_APP_PADBOL_MATCH_WEB_URL: 'https://qa-match.example/' },
    )).toBe('https://qa-match.example/acceso?modo=registro&redirect=%2Fadmin');
  });

  it('no permite convertir el CTA en un redirect externo arbitrario', () => {
    expect(resolvePublicAccountAccessHref(
      { hostname: 'dev.padbol.com' },
      'https://evil.example/acceso?redirect=malicioso',
    )).toBe(`${DEFAULT_PADBOL_MATCH_WEB_ORIGIN}/acceso`);
  });
});
