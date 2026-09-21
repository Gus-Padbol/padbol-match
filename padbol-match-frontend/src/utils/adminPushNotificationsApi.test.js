import {
  formatAdminPushSegmentLabel,
  sendAdminPushNotification,
} from './adminPushNotificationsApi';

describe('adminPushNotificationsApi', () => {
  afterEach(() => jest.restoreAllMocks());

  it('envía Bearer e idempotencia sin incorporar userId fuera del segmento', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    await sendAdminPushNotification({
      apiBaseUrl: 'https://api.example.test',
      accessToken: 'access-token',
      title: 'Título',
      body: 'Mensaje',
      segment: { type: 'sede', sedeId: 7 },
      idempotencyKey: 'd7c58a9b-9edf-4632-8974-0e7786d78db1',
    });
    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer access-token');
    expect(JSON.parse(options.body)).toEqual({
      title: 'Título',
      body: 'Mensaje',
      segment: { type: 'sede', sedeId: 7 },
      idempotencyKey: 'd7c58a9b-9edf-4632-8974-0e7786d78db1',
    });
  });

  it('formatea la segmentación por ciudad', () => {
    const t = (key, values) => `${key}:${values?.city || ''}`;
    expect(formatAdminPushSegmentLabel({ type: 'ciudad', ciudad: 'La Plata' }, t)).toBe(
      'admin.pushNotif.segments.city:La Plata',
    );
  });
});
