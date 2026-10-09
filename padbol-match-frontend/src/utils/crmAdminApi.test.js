import { crmAdminApi } from './crmAdminApi';

afterEach(() => jest.restoreAllMocks());
it('sends the stable email request identity while preserving the legacy WhatsApp body', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ status: 'sent' }) }));
  await crmAdminApi.reply('fixture', 'conversation', 'Email body', '12345678-1234-4123-8123-123456789012');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ body: 'Email body', requestId: '12345678-1234-4123-8123-123456789012' });
  await crmAdminApi.reply('fixture', 'conversation', 'Legacy body');
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ body: 'Legacy body' });
});
