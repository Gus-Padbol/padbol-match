import {
  PUBLIC_ARTICLES,
  canAccessReserved,
  getPublicArticle,
  isPublicVerified,
  publicArticles,
  searchHelp,
} from './helpCenterContent';
import {articleCopy} from './helpCenterUI';

const fixture = {
  ...PUBLIC_ARTICLES[0],
  id: 'fixture-player-booking',
  status: 'fixture',
  fixture: true,
  module: 'fixture',
  slug: 'fixture-player-booking',
};

const restricted = {
  ...PUBLIC_ARTICLES[0],
  id: 'restricted-club',
  visibility: 'restricted',
  scope: {type: 'club', id: 'club-a'},
  module: 'club',
  slug: 'restricted-club',
};

const pending = {
  ...PUBLIC_ARTICLES[0],
  id: 'pending-draft',
  status: 'pending',
  module: 'cuenta',
  slug: 'pending-draft',
};

describe('help center public content', () => {
  test('ships only the verified public/global open-registration article', () => {
    expect(PUBLIC_ARTICLES).toHaveLength(1);
    expect(publicArticles()).toHaveLength(1);
    expect(PUBLIC_ARTICLES[0]).toMatchObject({
      id: 'open-registration',
      status: 'verified',
      fixture: false,
      visibility: 'public',
      module: 'cuenta',
      slug: 'abrir-registro',
      scope: {type: 'global'},
    });
    expect(JSON.stringify(PUBLIC_ARTICLES)).not.toMatch(/fixture-player-booking|restricted\.json|account-drafts/);
  });

  test('uniform filter rejects fixture, restricted, pending and non-global rows', () => {
    expect(publicArticles([...PUBLIC_ARTICLES, fixture, restricted, pending])).toHaveLength(1);
    expect(isPublicVerified(fixture)).toBe(false);
    expect(isPublicVerified(restricted)).toBe(false);
    expect(isPublicVerified(pending)).toBe(false);
    expect(isPublicVerified({...PUBLIC_ARTICLES[0], scope: {type: 'club', id: 'x'}})).toBe(false);
  });

  test('only the known deep link resolves; unknown modules/slugs return null (404)', () => {
    expect(getPublicArticle('cuenta', 'abrir-registro')).toMatchObject({id: 'open-registration'});
    expect(getPublicArticle('cuenta', 'no-existe')).toBeNull();
    expect(getPublicArticle('otro', 'abrir-registro')).toBeNull();
    expect(getPublicArticle('cuenta', 'fixture-player-booking')).toBeNull();
  });

  test('search finds the article in ES/EN/PT without falling back to the first result', () => {
    expect(searchHelp('crear cuenta', 'es').results.map((item) => item.id)).toContain('open-registration');
    expect(searchHelp('create account', 'en').results.map((item) => item.id)).toContain('open-registration');
    expect(searchHelp('criar conta', 'pt').results.map((item) => item.id)).toContain('open-registration');
    const empty = searchHelp('qqqq', 'es');
    expect(empty.results).toEqual([]);
    expect(empty.fallback).toBe('support');
    expect(empty.reason).toBe('insufficient_verified_content');
    expect(searchHelp('qqqq', 'en').results).toEqual([]);
    expect(searchHelp('', 'es').results).toHaveLength(1);
  });

  test('search never returns fixture/restricted/draft rows', () => {
    const result = searchHelp('abrir', 'es', [...PUBLIC_ARTICLES, fixture, restricted, pending]);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe('open-registration');
    expect(result.results.some((item) => item.id === 'fixture-player-booking')).toBe(false);
  });

  test('EN/PT state that quoted button names are from the verified Spanish UI', () => {
    expect(PUBLIC_ARTICLES[0].requirements.en.join(' ')).toMatch(/Spanish interface/);
    expect(PUBLIC_ARTICLES[0].requirements.pt.join(' ')).toMatch(/interface em espanhol/);
    expect(PUBLIC_ARTICLES[0].translations.en.note).toMatch(/NOT VERIFIED/);
    expect(PUBLIC_ARTICLES[0].translations.pt.note).toMatch(/NÃO VERIFICADO/);
  });

  test('reserved content stays denied and there is no client role selector', () => {
    expect(canAccessReserved()).toBe(false);
    expect(publicArticles()).not.toContainEqual(expect.objectContaining({visibility: 'restricted'}));
  });
});


describe('help center search boundaries and localized metadata', () => {
  test('does not present the registration article for unrelated operations', () => {
    const cases = [
      ['es', ['eliminar cuenta', 'recuperar contraseña', 'completar perfil']],
      ['en', ['delete account', 'recover password', 'complete profile']],
      ['pt', ['excluir conta', 'recuperar senha', 'completar perfil']],
    ];
    for (const [lang, queries] of cases) {
      for (const query of queries) {
        const outcome = searchHelp(query, lang);
        expect(outcome.results).toEqual([]);
        expect(outcome.fallback).toBe('support');
        expect(outcome.reason).toBe('insufficient_verified_content');
      }
    }
  });

  test('keeps registration/open-form/cadastro searches useful', () => {
    expect(searchHelp('abrir formulario', 'es').results.map((item) => item.id)).toContain('open-registration');
    expect(searchHelp('registro', 'es').results.map((item) => item.id)).toContain('open-registration');
    expect(searchHelp('open form', 'en').results.map((item) => item.id)).toContain('open-registration');
    expect(searchHelp('sign up', 'en').results.map((item) => item.id)).toContain('open-registration');
    expect(searchHelp('abrir formulário', 'pt').results.map((item) => item.id)).toContain('open-registration');
    expect(searchHelp('cadastro', 'pt').results.map((item) => item.id)).toContain('open-registration');
  });

  test('scope and category are localized for the UI while technical metadata stays out', () => {
    const article = PUBLIC_ARTICLES[0];
    expect(articleCopy(article, 'es')).toMatchObject({scope: expect.stringMatching(/Sólo abrir/), categoryLabel: 'Cuenta'});
    expect(articleCopy(article, 'en')).toMatchObject({scope: expect.stringMatching(/Only opening/), categoryLabel: 'Account'});
    expect(articleCopy(article, 'pt')).toMatchObject({scope: expect.stringMatching(/Somente abrir/), categoryLabel: 'Conta'});
    expect(articleCopy(article, 'en').scope).not.toBe(article.verifiedScope);
    expect(articleCopy(article, 'pt').scope).not.toBe(article.verifiedScope);
  });
});
