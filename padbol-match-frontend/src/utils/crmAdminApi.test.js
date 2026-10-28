import { crmAdminApi } from './crmAdminApi';

afterEach(() => jest.restoreAllMocks());
it('searches the complete ticket reference on the authenticated inbox endpoint', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ items: [] }) }));
  await crmAdminApi.inbox('fixture', { ticketReference: 'PB-0123456789abcdef0123456789abcdef' });
  expect(fetch.mock.calls[0][0]).toContain('/api/admin/crm/inbox?ticket_reference=PB-0123456789abcdef0123456789abcdef');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture');
});
it('sends the stable email request identity while preserving the legacy WhatsApp body', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ status: 'sent' }) }));
  await crmAdminApi.reply('fixture', 'conversation', 'Email body', '12345678-1234-4123-8123-123456789012');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ body: 'Email body', requestId: '12345678-1234-4123-8123-123456789012' });
  await crmAdminApi.reply('fixture', 'conversation', 'Legacy body');
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ body: 'Legacy body' });
});

it('downloads an attachment with session authorization and a safe server filename', async () => {
  const blob = new Blob(['test']);
  global.fetch = jest.fn(async () => ({ ok: true, headers: { get: () => 'attachment; filename="adjunto-whatsapp.jpg"' }, blob: async () => blob }));
  const result = await crmAdminApi.whatsappMedia('session-token', 'conversation', 'event');
  expect(result).toEqual({ blob, filename: 'adjunto-whatsapp.jpg' });
  expect(fetch.mock.calls[0][0]).toContain('/conversations/conversation/events/event/whatsapp-media');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer session-token');
});
it('consulta el historial de correo del lead con su sesión y sin búsquedas por contacto',async()=>{global.fetch=jest.fn(async()=>({ok:true,json:async()=>({messages:[]})}));await crmAdminApi.emailHistory('fixture','conversation/id');expect(fetch.mock.calls[0][0]).toContain('/api/admin/crm/inbox/conversation%2Fid/email-history');expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture');});
