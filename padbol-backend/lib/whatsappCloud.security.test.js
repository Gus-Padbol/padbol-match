import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWhatsappCloudService,
  createWhatsappMetaSender,
} from './whatsappCloud.js';

const PHONE_A = '123456789012345';
const PHONE_B = '987654321098765';
const FROM_WA_ID = '15551234567';
const BASE_TIME = new Date('2026-09-09T12:00:00.000Z');

function webhookPayload({
  phoneNumberId = PHONE_A,
  messageId = 'wamid.security-1',
  timestamp = Math.floor(BASE_TIME.getTime() / 1000),
} = {}) {
  return {
    object: 'whatsapp_business_account',
    tenant_id: 'tenant-inyectado',
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: {
            display_phone_number: PHONE_B,
            phone_number_id: phoneNumberId,
          },
          messages: [{
            from: FROM_WA_ID,
            id: messageId,
            timestamp: String(timestamp),
            type: 'text',
            text: { body: 'Consulta de seguridad' },
          }],
        },
      }],
    }],
  };
}

function createMemoryRepository({ channels, onOutboxCreated } = {}) {
  const channelRows = channels || [];
  const inbound = [];
  const outbox = [];

  function currentOutbox(row) {
    return outbox.find((candidate) => candidate.id === row.id && candidate.tenant_id === row.tenant_id);
  }

  return {
    channels: channelRows,
    inbound,
    outbox,

    async findActiveChannelByPhoneNumberId(phoneNumberId) {
      return channelRows.find((channel) => (
        channel.meta_phone_number_id === phoneNumberId
        && channel.active
        && channel.tenantActive
      )) || null;
    },

    async findActiveChannelById(tenantId, channelId) {
      return channelRows.find((channel) => (
        channel.tenant_id === tenantId
        && channel.id === channelId
        && channel.active
        && channel.tenantActive
      )) || null;
    },

    async recordInbound({ channel, inbound: message }) {
      const existing = inbound.find((row) => (
        row.tenant_id === channel.tenant_id
        && row.provider_message_id === message.providerMessageId
      ));
      if (existing) return { row: existing, created: false };
      const row = {
        id: `inbound-${inbound.length + 1}`,
        tenant_id: channel.tenant_id,
        channel_id: channel.id,
        provider_message_id: message.providerMessageId,
        from_wa_id: message.fromWaId,
        received_at: message.receivedAt,
      };
      inbound.push(row);
      return { row, created: true };
    },

    async ensureOutbox({
      channel,
      inboundRow,
      body,
      windowExpiresAt,
      idempotencyKey,
    }) {
      const existing = outbox.find((row) => (
        row.tenant_id === channel.tenant_id
        && row.idempotency_key === idempotencyKey
      ));
      if (existing) return { row: existing, created: false };
      const row = {
        id: `outbox-${outbox.length + 1}`,
        tenant_id: channel.tenant_id,
        channel_id: channel.id,
        inbound_message_id: inboundRow.id,
        idempotency_key: idempotencyKey,
        to_wa_id: inboundRow.from_wa_id,
        reply_to_provider_message_id: inboundRow.provider_message_id,
        text_body: body,
        status: 'pending',
        attempts: 0,
        next_attempt_at: BASE_TIME.toISOString(),
        customer_service_window_expires_at: windowExpiresAt,
      };
      outbox.push(row);
      onOutboxCreated?.({ channel, row });
      return { row, created: true };
    },

    async claimPendingOutbox(row, attemptedAt) {
      const current = currentOutbox(row);
      if (!current || current.status !== 'pending') return null;
      current.status = 'sending';
      current.attempts += 1;
      current.last_attempt_at = attemptedAt;
      return { ...current };
    },

    async fetchPendingOutbox(readyAt, limit) {
      return outbox
        .filter((row) => row.status === 'pending' && row.next_attempt_at <= readyAt)
        .slice(0, limit)
        .map((row) => ({ ...row }));
    },

    async markOutboxSent(row, providerMessageId, sentAt) {
      const current = currentOutbox(row);
      if (!current || current.status !== 'sending') return;
      current.status = 'sent';
      current.provider_message_id = providerMessageId;
      current.sent_at = sentAt;
    },

    async markOutboxPending(row, errorMessage, nextAttemptAt) {
      const current = currentOutbox(row);
      if (!current || current.status !== 'sending') return;
      current.status = 'pending';
      current.last_error = errorMessage;
      current.next_attempt_at = nextAttemptAt;
    },

    async markOutboxExpired(row, expiredAt) {
      const current = currentOutbox(row);
      if (!current) return;
      current.status = 'expired';
      current.last_attempt_at = expiredAt;
    },

    async markOutboxCancelled(row, cancelledAt) {
      const current = currentOutbox(row);
      if (!current || current.status !== 'pending') return;
      current.status = 'cancelled';
      current.last_attempt_at = cancelledAt;
    },
  };
}

function activeChannel(overrides = {}) {
  return {
    id: 'channel-a',
    tenant_id: 'tenant-a',
    meta_phone_number_id: PHONE_A,
    credential_ref: 'TEST_A',
    auto_reply_text: 'Respuesta controlada',
    active: true,
    tenantActive: true,
    ...overrides,
  };
}

test('ignora tenant y número visible inyectados; enlaza sólo por Phone Number ID', async () => {
  const repository = createMemoryRepository({
    channels: [
      activeChannel(),
      activeChannel({
        id: 'channel-b',
        tenant_id: 'tenant-b',
        meta_phone_number_id: PHONE_B,
        credential_ref: 'TEST_B',
      }),
    ],
  });
  const service = createWhatsappCloudService({
    repository,
    sender: { async sendText() { throw new Error('envío deshabilitado'); } },
    now: () => new Date(BASE_TIME),
  });

  await service.handleWebhook(webhookPayload());

  assert.equal(repository.inbound.length, 1);
  assert.equal(repository.inbound[0].tenant_id, 'tenant-a');
  assert.equal(repository.outbox[0].tenant_id, 'tenant-a');
});

test('replay y dos webhooks concurrentes producen una sola salida y un solo envío', async () => {
  const repository = createMemoryRepository({ channels: [activeChannel()] });
  let sends = 0;
  const service = createWhatsappCloudService({
    repository,
    sender: {
      async sendText() {
        sends += 1;
        await new Promise((resolve) => setImmediate(resolve));
        return { providerMessageId: 'wamid.security-outbound' };
      },
    },
    sendEnabled: true,
    now: () => new Date(BASE_TIME),
  });
  const payload = webhookPayload();

  await Promise.all([
    service.handleWebhook(payload),
    service.handleWebhook(payload),
  ]);
  await service.handleWebhook(payload);

  assert.equal(repository.inbound.length, 1);
  assert.equal(repository.outbox.length, 1);
  assert.equal(repository.outbox[0].status, 'sent');
  assert.equal(sends, 1);
});

test('el límite exacto de 24 horas expira sin llamar al transporte', async () => {
  const repository = createMemoryRepository({ channels: [activeChannel()] });
  let sends = 0;
  const atBoundary = new Date(BASE_TIME.getTime() + 24 * 60 * 60 * 1000);
  const service = createWhatsappCloudService({
    repository,
    sender: { async sendText() { sends += 1; } },
    sendEnabled: true,
    now: () => new Date(atBoundary),
  });

  const result = await service.handleWebhook(webhookPayload());

  assert.equal(result.results[0].delivery, 'expired');
  assert.equal(repository.outbox[0].status, 'expired');
  assert.equal(sends, 0);
});

test('revocar el canal durante la ingesta impide el envío inmediato', async () => {
  const channel = activeChannel();
  const repository = createMemoryRepository({
    channels: [channel],
    onOutboxCreated: () => {
      channel.active = false;
    },
  });
  let sends = 0;
  const service = createWhatsappCloudService({
    repository,
    sender: {
      async sendText() {
        sends += 1;
        return { providerMessageId: 'wamid.must-not-send' };
      },
    },
    sendEnabled: true,
    now: () => new Date(BASE_TIME),
  });

  const result = await service.handleWebhook(webhookPayload());

  assert.equal(result.results[0].delivery, 'cancelled');
  assert.equal(repository.outbox[0].status, 'cancelled');
  assert.equal(sends, 0);
});

test('un rechazo de Meta no incluye secretos ni contenido remoto en el error', async () => {
  const sender = createWhatsappMetaSender({
    graphVersion: 'v23.0',
    resolveAccessToken: () => 'secret-token-must-not-leak',
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: 'private remote detail',
          access_token: 'secret-token-must-not-leak',
        },
      }),
    }),
  });

  await assert.rejects(
    sender.sendText({
      channel: { meta_phone_number_id: PHONE_A, credential_ref: 'TEST_A' },
      toWaId: FROM_WA_ID,
      body: 'contenido privado',
    }),
    (error) => {
      assert.equal(error.code, 'WHATSAPP_META_SEND_FAILED');
      const visible = `${error.message} ${error.stack}`;
      assert.equal(visible.includes('secret-token-must-not-leak'), false);
      assert.equal(visible.includes('private remote detail'), false);
      assert.equal(visible.includes('contenido privado'), false);
      return true;
    },
  );
});
