import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WHATSAPP_ASSISTANT_DEFAULT_HANDOFF,
  WHATSAPP_ASSISTANT_TOPICS,
  assistantConfigFromEnv,
  classifyWhatsappMessage,
  isAuthorizedOperator,
  isSpamLike,
  normalizeInboundText,
  resolveAssistantReply,
  resolveWhatsappPermissions,
  sanitizeForLog,
} from './whatsappAssistant.js';
import { createWhatsappCloudService } from './whatsappCloud.js';

const ACADEMY_URL = 'https://padbol.com/academy';

function config(overrides = {}) {
  return {
    dispatchAllowed: true,
    academyUrl: ACADEMY_URL,
    humanHandoffChannel: '',
    authorizedOperators: new Set(['operador@padbol.com']),
    ...overrides,
  };
}

test('clasifica los siete temas oficiales', () => {
  const cases = [
    ['Quiero hacer un curso de Padbol', 'courses_academy'],
    ['¿Cuánto cuesta la inscripción?', 'courses_academy'],
    ['No puedo entrar a mi cuenta', 'access_account'],
    ['Quiero reservar una cancha', 'venues_courts_bookings'],
    ['¿Hay torneos este mes?', 'tournaments_competition_ranking'],
    ['¿Qué es Padbol Match?', 'padbol_match'],
    ['¿Cuál es el reglamento de FIPA?', 'fipa_rules'],
    ['Quiero hablar con una persona', 'support_human'],
  ];
  for (const [text, topic] of cases) {
    assert.equal(classifyWhatsappMessage(text).topic, topic, text);
  }
});

test('desconocido deriva a persona', () => {
  assert.equal(classifyWhatsappMessage('xqyzz no tengo idea').topic, null);
  const result = resolveAssistantReply({ text: 'xqyzz no tengo idea', config: config() });
  assert.equal(result.kind, 'handoff');
  assert.equal(result.dispatch, true);
  assert.match(result.body, /asesor/i);
});

test('cursos enlaza Academy sin informar precios', () => {
  const result = resolveAssistantReply({
    text: '¿Cuánto cuesta un curso?',
    config: config(),
  });
  assert.equal(result.kind, 'reply');
  assert.equal(result.topic, 'courses_academy');
  assert.match(result.body, /Padbol Academy/);
  assert.match(result.body, /padbol\.com\/academy/);
  assert.doesNotMatch(result.body, /\$\s?\d|USD|ARS|\d+\s?(pesos|dólares)/);
  assert.match(result.body, /No informamos precios/);
});

test('sin URL de Academy configurada usa el dominio oficial y no inventa', () => {
  const result = resolveAssistantReply({
    text: 'quiero anotarme a un curso',
    config: config({ academyUrl: '' }),
  });
  assert.match(result.body, /https:\/\/padbol\.com/);
});

test('dispatchAllowed false mantiene todo retenido', () => {
  const result = resolveAssistantReply({
    text: 'quiero reservar una cancha',
    config: config({ dispatchAllowed: false }),
  });
  assert.equal(result.kind, 'held');
  assert.equal(result.dispatch, false);
});

test('entrada inválida y spam no despachan', () => {
  assert.equal(resolveAssistantReply({ text: '   ', config: config() }).kind, 'invalid');
  assert.equal(
    resolveAssistantReply({ text: 'aaaaaaaaaaaaaaa', config: config() }).kind,
    'spam',
  );
  assert.equal(
    resolveAssistantReply({ text: 'http://a.com http://b.com http://c.com', config: config() }).kind,
    'spam',
  );
  assert.equal(isSpamLike(normalizeInboundText('aaaaaaaaaaaaaaa')), true);
});

test('derivación humana usa el canal oficial configurado o el soporte oficial', () => {
  const withChannel = resolveAssistantReply({
    text: 'quiero hablar con un asesor',
    config: config({ humanHandoffChannel: 'https://padbolmatch.com/contacto' }),
  });
  assert.match(withChannel.body, /padbolmatch\.com\/contacto/);

  const fallback = resolveAssistantReply({
    text: 'quiero hablar con un asesor',
    config: config(),
  });
  assert.equal(fallback.body, WHATSAPP_ASSISTANT_DEFAULT_HANDOFF);
});

test('valida operador autorizado sin aceptar texto libre', () => {
  assert.equal(isAuthorizedOperator('operador@padbol.com', config()), true);
  assert.equal(isAuthorizedOperator('OPERADOR@PADBOL.COM', config()), true);
  assert.equal(isAuthorizedOperator('otro@x.com', config()), false);
  assert.equal(isAuthorizedOperator('', config()), false);
  assert.equal(isAuthorizedOperator(null, config()), false);
});

test('permisos: Nicolás (operador) atiende y deriva sin auditar todo', () => {
  const perms = resolveWhatsappPermissions({
    email: 'sm@padbol.com',
    role: null,
    operators: new Set(['sm@padbol.com']),
  });
  assert.equal(perms.role, 'operator');
  assert.equal(perms.canOperate, true);
  assert.equal(perms.canAudit, false);
});

test('permisos: Gustavo (superadmin) audita todo y no es operador', () => {
  const perms = resolveWhatsappPermissions({
    email: 'padbolinternacional@gmail.com',
    role: 'super_admin',
    operators: new Set(['sm@padbol.com']),
  });
  assert.equal(perms.role, 'superadmin');
  assert.equal(perms.canOperate, false);
  assert.equal(perms.canAudit, true);
});

test('permisos: superadmin nunca queda como operador aunque coincida el email', () => {
  const perms = resolveWhatsappPermissions({
    email: 'x@padbol.com',
    role: 'super_admin',
    operators: new Set(['x@padbol.com']),
  });
  assert.equal(perms.role, 'superadmin');
  assert.equal(perms.canOperate, false);
  assert.equal(perms.canAudit, true);
});

test('permisos: email desconocido sin acceso', () => {
  const perms = resolveWhatsappPermissions({
    email: 'otro@x.com',
    role: null,
    operators: new Set(['sm@padbol.com']),
  });
  assert.equal(perms.role, 'none');
  assert.equal(perms.canOperate, false);
  assert.equal(perms.canAudit, false);
});

test('sanitiza información sensible en logs', () => {
  const clean = sanitizeForLog('contacto foo@bar.com y tel +54 9 11 2345 6789 DNI 40123456');
  assert.match(clean, /\[email\]/);
  assert.match(clean, /\[tel\]/);
  assert.match(clean, /\[id\]/);
  assert.doesNotMatch(clean, /foo@bar\.com/);
  assert.doesNotMatch(clean, /2345/);
  assert.doesNotMatch(clean, /40123456/);
});

test('configuración de entorno falla cerrada por defecto', () => {
  const cfg = assistantConfigFromEnv({});
  assert.equal(cfg.dispatchAllowed, false);
  assert.equal(cfg.academyUrl, '');
  assert.equal(cfg.authorizedOperators.size, 0);
});

// --- recorrido completo con el servicio real (transporte apagado) ---

function memoryRepository(channels = []) {
  const inbound = [];
  const outbox = [];
  return {
    inbound,
    outbox,
    async findActiveChannelByPhoneNumberId(phoneNumberId) {
      return channels.find((c) => c.meta_phone_number_id === phoneNumberId) || null;
    },
    async recordInbound({ channel, inbound: next }) {
      const existing = inbound.find((r) => (
        r.tenant_id === channel.tenant_id
        && r.provider_message_id === next.providerMessageId
      ));
      if (existing) return { row: existing, created: false };
      const row = {
        id: `in-${inbound.length + 1}`,
        tenant_id: channel.tenant_id,
        channel_id: channel.id,
        provider_message_id: next.providerMessageId,
        from_wa_id: next.fromWaId,
        received_at: next.receivedAt,
      };
      inbound.push(row);
      return { row, created: true };
    },
    async ensureOutbox({ channel, inboundRow, body, windowExpiresAt, idempotencyKey }) {
      const existing = outbox.find((r) => r.idempotency_key === idempotencyKey);
      if (existing) return { row: existing, created: false };
      const row = {
        id: `out-${outbox.length + 1}`,
        tenant_id: channel.tenant_id,
        channel_id: channel.id,
        inbound_message_id: inboundRow.id,
        idempotency_key: idempotencyKey,
        to_wa_id: inboundRow.from_wa_id,
        text_body: body,
        status: 'pending',
        attempts: 0,
        customer_service_window_expires_at: windowExpiresAt,
      };
      outbox.push(row);
      return { row, created: true };
    },
  };
}

function webhookPayload(body = 'Quiero hacer un curso', messageId = 'wamid.inbound-1') {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: '123456789012345' },
          messages: [{
            from: '15551234567',
            id: messageId,
            timestamp: '1757419200',
            type: 'text',
            text: { body },
          }],
        },
      }],
    }],
  };
}

test('recorrido: entrada → clasificación → respuesta → registro (una sola salida)', async () => {
  const repo = memoryRepository([
    { id: 'ch-1', tenant_id: 't-1', meta_phone_number_id: '123456789012345', active: true },
  ]);
  const service = createWhatsappCloudService({
    repository: repo,
    sender: {},
    sendEnabled: false,
    resolveReply: ({ text }) => resolveAssistantReply({ text, config: config() }),
  });

  const result = await service.handleWebhook(webhookPayload('Quiero hacer un curso de Padbol'));
  assert.equal(result.received, 1);
  assert.equal(result.results[0].created, true);
  assert.equal(result.results[0].topic, 'courses_academy');
  assert.equal(result.results[0].disposition, 'reply');
  assert.equal(result.results[0].delivery, 'held'); // transporte apagado
  assert.equal(repo.outbox.length, 1);
  assert.match(repo.outbox[0].text_body, /Padbol Academy/);
});

test('repetición del mismo mensaje no crea dos respuestas ni dos registros', async () => {
  const repo = memoryRepository([
    { id: 'ch-1', tenant_id: 't-1', meta_phone_number_id: '123456789012345', active: true },
  ]);
  const service = createWhatsappCloudService({
    repository: repo,
    sender: {},
    sendEnabled: false,
    resolveReply: ({ text }) => resolveAssistantReply({ text, config: config() }),
  });

  const payload = webhookPayload('Quiero reservar una cancha', 'wamid.inbound-dup');
  const first = await service.handleWebhook(payload);
  const second = await service.handleWebhook(payload);

  assert.equal(first.results[0].created, true);
  assert.equal(first.results[0].outboxCreated, true);
  assert.equal(second.results[0].created, false);
  assert.equal(second.results[0].outboxCreated, false);
  assert.equal(repo.inbound.length, 1);
  assert.equal(repo.outbox.length, 1);
});

test('todos los temas definidos tienen respuesta segura', () => {
  for (const topic of Object.keys(WHATSAPP_ASSISTANT_TOPICS)) {
    const result = resolveAssistantReply({
      text: `consulta sobre ${topic.replace(/_/g, ' ')}`,
      config: config(),
    });
    assert.ok(result.body, topic);
  }
});
