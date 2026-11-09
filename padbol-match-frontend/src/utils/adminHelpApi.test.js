import { adminHelpApi, AdminHelpApiError } from './adminHelpApi';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('search sends bearer, q and lang to the protected endpoint', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ results: [{ id: 'a' }], total: 1, lang: 'en' }) }));
  const data = await adminHelpApi.search('fixture-token', { q: 'tickets', lang: 'en' });
  expect(data.total).toBe(1);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain('/api/admin/help/search?q=tickets&lang=en');
  expect(options.headers.Authorization).toBe('Bearer fixture-token');
});

test('detail encodes module/slug and exposes API error code/status', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: 'HELP_FORBIDDEN', code: 'HELP_FORBIDDEN' }) }));
  await expect(adminHelpApi.getArticle('fixture-token', 'soporte', 'gestionar-tickets', { lang: 'es' }))
    .rejects.toMatchObject({ status: 403, code: 'HELP_FORBIDDEN' });
  expect(global.fetch.mock.calls[0][0]).toContain('/api/admin/help/articles/soporte/gestionar-tickets?lang=es');
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture-token');
});

test('unexpected API payload never becomes success content', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => null }));
  await expect(adminHelpApi.search('fixture-token', { lang: 'es' })).rejects.toBeInstanceOf(AdminHelpApiError);
});

test('401 is surfaced as an API error without content', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'HELP_UNAUTHENTICATED', code: 'HELP_UNAUTHENTICATED' }) }));
  await expect(adminHelpApi.search('fixture-token', { lang: 'es' })).rejects.toMatchObject({ status: 401, code: 'HELP_UNAUTHENTICATED' });
});
