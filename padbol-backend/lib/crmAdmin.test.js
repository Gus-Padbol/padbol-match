import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { createCrmAdminService, registerCrmAdminRoutes } from './crmAdmin.js';

function memoryRepository() {
  const contacts = [{ id: 'contact-23', nombre: 'Prueba 23' }];
  const conversations = [{
    id: 'conversation-23',
    contact_id: 'contact-23',
    source_channel: 'whatsapp',
    estado: 'nuevo',
    handoff_ready: true,
    qualification_status: 'qualified',
    subject: 'Prueba 23',
  }];
  const replies = [];
  const activities = [];
  return {
    contacts,
    conversations,
    replies,
    activities,
    async listConversations(filters = {}) {
      return conversations.filter((row) => (
        (!filters.sourceChannel || row.source_channel === filters.sourceChannel)
        && (!filters.estado || row.estado === filters.estado)
      ));
    },
    async getConversation(id) { return conversations.find((row) => row.id === id) || null; },
    async createReply(payload) {
      const row = { id: `reply-${replies.length + 1}`, ...payload };
      replies.push(row);
      return row;
    },
    async updateReplyStatus(id, status, providerMessageId) {
      const row = replies.find((item) => item.id === id);
      if (row) Object.assign(row, { status, provider_message_id: providerMessageId || null });
    },
    async listActivities(conversationId) {
      return activities.filter((row) => row.conversation_id === conversationId);
    },
    async createActivity(payload) {
      const row = { id: `activity-${activities.length + 1}`, ...payload };
      activities.push(row);
      return row;
    },
    async markHandoff({ conversationId, operador }) {
      const row = conversations.find((item) => item.id === conversationId);
      Object.assign(row, { estado: 'derivado', derivado: true, operador });
    },
    async listAuditActivity() {
      return { contacts, conversations, attempts: [], replies, activities };
    },
  };
}

async function withServer(run) {
  const repository = memoryRepository();
  const service = createCrmAdminService({
    repository,
    operators: new Set(['operator@example.test']),
    superAdminEmails: new Set(['superadmin@example.test']),
    sendWhatsappReply: null,
  });
  const app = express();
  app.use(express.json());
  registerCrmAdminRoutes(app, {
    crmAdminService: service,
    authUserFromBearer: async (req) => {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (token === 'super-token') return { id: 'super-id', email: 'superadmin@example.test' };
      if (token === 'operator-token') return { id: 'operator-id', email: 'operator@example.test' };
      return null;
    },
    fetchUserRoleRowForAuthUser: async (user) => ({
      role: user.id === 'super-id' ? 'super_admin' : null,
    }),
    logger: { error() {} },
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    const address = server.address();
    await run({ repository, baseUrl: `http://127.0.0.1:${address.port}` });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

test('contrato HTTP CRM registra auditoría y acciones reales con salidas externas apagadas', async () => {
  await withServer(async ({ repository, baseUrl }) => {
    const auditResponse = await fetch(`${baseUrl}/api/admin/crm/audit`, { headers: auth('super-token') });
    assert.equal(auditResponse.status, 200);
    const audit = await auditResponse.json();
    assert.equal(audit.conversations[0].subject, 'Prueba 23');

    const permissionsResponse = await fetch(`${baseUrl}/api/admin/crm/permissions`, {
      headers: auth('operator-token'),
    });
    assert.equal(permissionsResponse.status, 200);
    assert.deepEqual(await permissionsResponse.json(), {
      role: 'operator',
      canOperate: true,
      canAudit: false,
      whatsappSendEnabled: false,
    });

    const activityResponse = await fetch(`${baseUrl}/api/admin/crm/inbox/conversation-23/activities`, {
      method: 'POST',
      headers: auth('operator-token'),
      body: JSON.stringify({ type: 'note', summary: 'Seguimiento E2E', next_step: 'Llamar mañana' }),
    });
    assert.equal(activityResponse.status, 201);
    const activity = await activityResponse.json();
    assert.equal(activity.author, 'operator@example.test');
    assert.equal(repository.activities.length, 1);

    const replyResponse = await fetch(`${baseUrl}/api/admin/crm/inbox/conversation-23/reply`, {
      method: 'POST',
      headers: auth('operator-token'),
      body: JSON.stringify({ body: 'Respuesta retenida en QA' }),
    });
    assert.equal(replyResponse.status, 200);
    assert.equal((await replyResponse.json()).status, 'pending');
    assert.equal(repository.replies[0].status, 'pending');

    const handoffResponse = await fetch(`${baseUrl}/api/admin/crm/inbox/conversation-23/handoff`, {
      method: 'POST',
      headers: auth('operator-token'),
      body: '{}',
    });
    assert.equal(handoffResponse.status, 200);
    assert.equal(repository.conversations[0].estado, 'derivado');
  });
});

test('el contrato HTTP CRM falla cerrado para sesión ausente', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/admin/crm/audit`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'CRM_ADMIN_UNAUTHENTICATED');
  });
});
