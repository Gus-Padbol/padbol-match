import { sendAdminPushNotification } from './adminPushNotificationsApi';

test('envía un destino navegable junto con la notificación', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ cantidad_enviadas: 1 }),
  });

  await sendAdminPushNotification({
    apiBaseUrl: 'https://qa.example.test',
    accessToken: 'qa-token',
    title: 'Torneo actualizado',
    body: 'Revisá el cuadro',
    segment: { type: 'todos_usuarios' },
    destination: { type: 'torneo', entityId: 'torneo-42' },
    idempotencyKey: 'qa-idempotency',
  });

  expect(global.fetch).toHaveBeenCalledWith(
    'https://qa.example.test/api/push/send-admin',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        title: 'Torneo actualizado',
        body: 'Revisá el cuadro',
        segment: { type: 'todos_usuarios' },
        destination: { type: 'torneo', entityId: 'torneo-42' },
        idempotencyKey: 'qa-idempotency',
      }),
    }),
  );
});
