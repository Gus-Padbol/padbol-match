import { getLocaleFallbacks, interpolateTranslation, resolveTranslation } from './tSafe';

describe('traducciones seguras', () => {
  it('nunca deja variables de interpolación visibles', () => {
    expect(interpolateTranslation('{{filled}} of {{total}} spots', { filled: 3, total: 4 }))
      .toBe('3 of 4 spots');
    expect(interpolateTranslation('{{filled}} of {{total}} spots', { filled: 3 }))
      .toBe('3 of  spots');
  });

  it('usa el catálogo completo del idioma antes de exponer una clave técnica', () => {
    expect(resolveTranslation('publicSite.status.title', 'publicSite.status.title', undefined, 'it'))
      .toBe('Padbol Match aggiunge nuovi sport');
  });

  it('no deja que un default histórico en español mezcle una interfaz en inglés', () => {
    expect(resolveTranslation(
      'publicSite.status.title',
      'publicSite.status.title',
      'Padbol Match incorpora nuevos deportes',
      'en',
    )).toBe('Padbol Match adds new sports');
  });

  it('conserva el catálogo público español en vez de reemplazarlo por inglés', () => {
    expect(getLocaleFallbacks('es')['publicSite.nav.players']).toBe('Para jugadores');
    expect(getLocaleFallbacks('es')['publicSite.hero.claim']).toBe('La aplicación deportiva que conecta todo');
  });

  it.each([
    ['it', 'Per i giocatori'],
    ['ro', 'Pentru jucători'],
    ['fr', 'Pour les joueurs'],
  ])('aplica el catálogo público completo de %s', (code, expected) => {
    expect(getLocaleFallbacks(code)['publicSite.nav.players']).toBe(expected);
  });
});
