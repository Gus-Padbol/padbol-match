import { whatsappAdminApi } from './whatsappAdminApi';

afterEach(() => jest.restoreAllMocks());

function mockFetch(body = {}, ok = true, status = 200) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({ ok, status, json: async () => body });
}

test('permissions llama al endpoint con Bearer', async () => {
  const spy = mockFetch({ role: 'operator', canOperate: true, canAudit: false });
  const r = await whatsappAdminApi.permissions('tok');
  expect(r.canOperate).toBe(true);
  const [url, options] = spy.mock.calls[0];
  expect(String(url)).toContain('/api/admin/whatsapp/permissions');
  expect(options.headers.Authorization).toBe('Bearer tok');
});

test('inbox codifica el límite', async () => {
  const spy = mockFetch({ items: [] });
  await whatsappAdminApi.inbox('tok', 25);
  expect(String(spy.mock.calls[0][0])).toContain('/api/admin/whatsapp/inbox?limit=25');
});

test('reply envía POST con body { body }', async () => {
  const spy = mockFetch({ ok: true });
  await whatsappAdminApi.reply('tok', 'm1', 'Hola');
  const [url, options] = spy.mock.calls[0];
  expect(String(url)).toContain('/api/admin/whatsapp/inbox/m1/reply');
  expect(options.method).toBe('POST');
  expect(JSON.parse(options.body)).toEqual({ body: 'Hola' });
});

test('handoff envía POST sin body', async () => {
  const spy = mockFetch({ ok: true });
  await whatsappAdminApi.handoff('tok', 'm1');
  expect(String(spy.mock.calls[0][0])).toContain('/api/admin/whatsapp/inbox/m1/handoff');
  expect(spy.mock.calls[0][1].method).toBe('POST');
});

test('audit llama al endpoint de auditoría', async () => {
  const spy = mockFetch({});
  await whatsappAdminApi.audit('tok');
  expect(String(spy.mock.calls[0][0])).toContain('/api/admin/whatsapp/audit');
});

test('403 lanza error con status y mensaje', async () => {
  mockFetch({ error: 'No tenés acceso' }, false, 403);
  await expect(whatsappAdminApi.permissions('tok')).rejects.toMatchObject({
    status: 403,
    message: 'No tenés acceso',
  });
});
